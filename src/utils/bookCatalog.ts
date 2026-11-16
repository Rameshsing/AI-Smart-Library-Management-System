import { DEMO_BOOKS } from '../data/libraryData';

export type BookFormat = 'Physical Book' | 'E-Book';
export type BookLanguage = 'English' | 'Hindi' | 'Other';
export type AvailabilityFilter = 'all' | 'available' | 'issued' | 'reserved';
export type CatalogSortOption =
  | 'relevance'
  | 'newest'
  | 'title_asc'
  | 'title_desc'
  | 'highest_rated'
  | 'most_borrowed'
  | 'recently_published';

export interface CatalogBook {
  book_id: number;
  slug: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publication_year: number;
  category: string;
  subject: string;
  description: string;
  keywords: string[];
  language: BookLanguage;
  format: BookFormat;
  cover_image: string;
  total_copies: number;
  available_copies: number;
  reserved_copies: number;
  rating_average: number;
  rating_count: number;
  review_count: number;
  borrow_count: number;
  created_at: string;
}

export interface BookAvailabilityInfo {
  status: 'available' | 'issued' | 'reserved';
  label: string;
  shortLabel: string;
}

export interface CatalogQueryState {
  search: string;
  category: string;
  subject: string;
  author: string;
  availability: AvailabilityFilter;
  yearFrom: string;
  yearTo: string;
  minRating: string;
  language: string;
  format: string;
  sort: CatalogSortOption;
  page: number;
  limit: number;
}

export interface CatalogFilterOptions {
  categories: string[];
  subjects: string[];
  authors: string[];
  languages: BookLanguage[];
  formats: BookFormat[];
  minYear: number;
  maxYear: number;
}

export interface CatalogQueryResult {
  items: CatalogBook[];
  total: number;
  availableCatalogCount: number;
  page: number;
  limit: number;
  totalPages: number;
  facets: CatalogFilterOptions;
  isPrototypeSample: boolean;
}

export const DEFAULT_CATALOG_LIMIT = 12;

export const DEFAULT_CATALOG_QUERY_STATE: CatalogQueryState = {
  search: '',
  category: '',
  subject: '',
  author: '',
  availability: 'all',
  yearFrom: '',
  yearTo: '',
  minRating: '',
  language: '',
  format: '',
  sort: 'relevance',
  page: 1,
  limit: DEFAULT_CATALOG_LIMIT,
};

export function getBookAvailabilityInfo(book: Pick<
  CatalogBook,
  'available_copies' | 'total_copies' | 'reserved_copies' | 'format'
>): BookAvailabilityInfo {
  if (book.available_copies > 0) {
    if (book.format === 'E-Book') {
      return {
        status: 'available',
        label: 'Available',
        shortLabel: 'Available',
      };
    }
    const label =
      book.total_copies > 1
        ? `${book.available_copies} of ${book.total_copies} available`
        : 'Available';
    return {
      status: 'available',
      label,
      shortLabel: 'Available',
    };
  }

  if (book.reserved_copies > 0) {
    return {
      status: 'reserved',
      label: 'Reserved',
      shortLabel: 'Reserved',
    };
  }

  return {
    status: 'issued',
    label: 'Currently Issued',
    shortLabel: 'Currently Issued',
  };
}

export function extractCatalogFilterOptions(books: CatalogBook[]): CatalogFilterOptions {
  const categories = Array.from(new Set(books.map((b) => b.category))).sort((a, b) =>
    a.localeCompare(b)
  );
  const subjects = Array.from(new Set(books.map((b) => b.subject))).sort((a, b) =>
    a.localeCompare(b)
  );
  const authors = Array.from(new Set(books.map((b) => b.author))).sort((a, b) =>
    a.localeCompare(b)
  );
  const languages = Array.from(new Set(books.map((b) => b.language))) as BookLanguage[];
  const formats = Array.from(new Set(books.map((b) => b.format))) as BookFormat[];
  const years = books.map((b) => b.publication_year);
  const minYear = years.length > 0 ? Math.min(...years) : 2000;
  const maxYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();

  return {
    categories,
    subjects,
    authors,
    languages,
    formats,
    minYear,
    maxYear,
  };
}

function slugifyToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function matchFacetToken(candidate: string, paramValue: string): boolean {
  if (!paramValue) return true;
  const normalizedParam = paramValue.trim().toLowerCase();
  return (
    candidate.toLowerCase() === normalizedParam ||
    slugifyToken(candidate) === slugifyToken(normalizedParam)
  );
}

function computeNeutralRelevanceScore(book: CatalogBook, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) {
    return book.rating_average * 10 + Math.min(book.borrow_count, 500) * 0.02;
  }

  const title = book.title.toLowerCase();
  const author = book.author.toLowerCase();
  const subject = book.subject.toLowerCase();
  const category = book.category.toLowerCase();
  const isbn = book.isbn.toLowerCase();
  const keywords = book.keywords.join(' ').toLowerCase();
  const description = book.description.toLowerCase();

  let score = 0;
  if (title === q) score += 120;
  else if (title.startsWith(q)) score += 90;
  else if (title.includes(q)) score += 70;

  if (isbn.includes(q)) score += 65;
  if (keywords.includes(q)) score += 50;
  if (subject.includes(q) || category.includes(q)) score += 45;
  if (author.includes(q)) score += 40;
  if (description.includes(q)) score += 20;

  // Neutral quality tie-breaker (does not depend on student profile)
  score += book.rating_average * 2 + Math.min(book.borrow_count, 400) * 0.01;
  return score;
}

export function querySampleCatalog(
  books: CatalogBook[],
  state: CatalogQueryState
): CatalogQueryResult {
  const normalizedSearch = state.search.trim().toLowerCase();
  const yearFromNum = state.yearFrom ? Number.parseInt(state.yearFrom, 10) : Number.NaN;
  const yearToNum = state.yearTo ? Number.parseInt(state.yearTo, 10) : Number.NaN;
  const minRatingNum = state.minRating ? Number.parseFloat(state.minRating) : Number.NaN;

  const filtered = books.filter((book) => {
    if (normalizedSearch) {
      const haystack = [
        book.title,
        book.author,
        book.subject,
        book.category,
        book.isbn,
        book.description,
        ...book.keywords,
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(normalizedSearch)) {
        return false;
      }
    }

    if (state.category && !matchFacetToken(book.category, state.category)) {
      return false;
    }

    if (state.subject && !matchFacetToken(book.subject, state.subject)) {
      return false;
    }

    if (state.author && !book.author.toLowerCase().includes(state.author.trim().toLowerCase())) {
      return false;
    }

    if (state.availability && state.availability !== 'all') {
      const info = getBookAvailabilityInfo(book);
      if (info.status !== state.availability) {
        return false;
      }
    }

    if (!Number.isNaN(yearFromNum) && book.publication_year < yearFromNum) {
      return false;
    }

    if (!Number.isNaN(yearToNum) && book.publication_year > yearToNum) {
      return false;
    }

    if (!Number.isNaN(minRatingNum) && book.rating_average < minRatingNum) {
      return false;
    }

    if (state.language && !matchFacetToken(book.language, state.language)) {
      return false;
    }

    if (state.format && !matchFacetToken(book.format, state.format)) {
      return false;
    }

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (state.sort) {
      case 'newest':
        return b.created_at.localeCompare(a.created_at) || b.book_id - a.book_id;
      case 'title_asc':
        return a.title.localeCompare(b.title);
      case 'title_desc':
        return b.title.localeCompare(a.title);
      case 'highest_rated':
        return b.rating_average - a.rating_average || b.rating_count - a.rating_count;
      case 'most_borrowed':
        return b.borrow_count - a.borrow_count || b.rating_average - a.rating_average;
      case 'recently_published':
        return b.publication_year - a.publication_year || b.book_id - a.book_id;
      case 'relevance':
      default:
        return (
          computeNeutralRelevanceScore(b, state.search) -
            computeNeutralRelevanceScore(a, state.search) || a.book_id - b.book_id
        );
    }
  });

  const safeLimit = Math.max(1, state.limit);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(Math.max(1, state.page), totalPages);
  const start = (safePage - 1) * safeLimit;
  const items = sorted.slice(start, start + safeLimit);
  const availableCatalogCount = books.filter((b) => b.available_copies > 0).length;

  return {
    items,
    total,
    availableCatalogCount,
    page: safePage,
    limit: safeLimit,
    totalPages,
    facets: extractCatalogFilterOptions(books),
    isPrototypeSample: true,
  };
}

export function getBasedOnInterestsBooks(
  books: CatalogBook[],
  interests: string[],
  preferredSubjects: string[],
  limit: number = 4
): CatalogBook[] {
  const interestTokens = [...interests, ...preferredSubjects]
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (interestTokens.length === 0) {
    return [];
  }

  return books
    .filter((book) => book.available_copies > 0)
    .map((book) => {
      const text = [book.title, book.category, book.subject, ...book.keywords]
        .join(' ')
        .toLowerCase();
      let matches = 0;
      for (const token of interestTokens) {
        if (text.includes(token)) {
          matches += 1;
        } else {
          const words = token.split(/\s+/).filter((w) => w.length > 2);
          if (words.some((w) => text.includes(w))) {
            matches += 0.5;
          }
        }
      }
      return { book, matches };
    })
    .filter((entry) => entry.matches > 0)
    .sort(
      (a, b) =>
        b.matches - a.matches || b.book.rating_average - a.book.rating_average
    )
    .slice(0, limit)
    .map((entry) => entry.book);
}

const VALID_AVAILABILITY: AvailabilityFilter[] = ['all', 'available', 'issued', 'reserved'];
const VALID_SORTS: CatalogSortOption[] = [
  'relevance',
  'newest',
  'title_asc',
  'title_desc',
  'highest_rated',
  'most_borrowed',
  'recently_published',
];

export function parseCatalogQueryFromSearch(searchString: string): CatalogQueryState {
  const params = new URLSearchParams(searchString.startsWith('?') ? searchString.slice(1) : searchString);

  const rawAvailability = (params.get('availability') ?? 'all').toLowerCase() as AvailabilityFilter;
  const rawSort = (params.get('sort') ?? 'relevance').toLowerCase() as CatalogSortOption;
  const rawPage = Number.parseInt(params.get('page') ?? '1', 10);
  const rawLimit = Number.parseInt(params.get('limit') ?? String(DEFAULT_CATALOG_LIMIT), 10);

  return {
    search: params.get('search') ?? '',
    category: params.get('category') ?? '',
    subject: params.get('subject') ?? '',
    author: params.get('author') ?? '',
    availability: VALID_AVAILABILITY.includes(rawAvailability) ? rawAvailability : 'all',
    yearFrom: params.get('year_from') ?? '',
    yearTo: params.get('year_to') ?? '',
    minRating: params.get('min_rating') ?? '',
    language: params.get('language') ?? '',
    format: params.get('format') ?? '',
    sort: VALID_SORTS.includes(rawSort) ? rawSort : 'relevance',
    page: Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage,
    limit: Number.isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_CATALOG_LIMIT : rawLimit,
  };
}

export function buildCatalogApiParams(state: CatalogQueryState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.search.trim()) params.set('search', state.search.trim());
  if (state.category.trim()) params.set('category', state.category.trim());
  if (state.subject.trim()) params.set('subject', state.subject.trim());
  if (state.author.trim()) params.set('author', state.author.trim());
  if (state.availability && state.availability !== 'all') {
    params.set('availability', state.availability);
  }
  if (state.yearFrom.trim()) params.set('year_from', state.yearFrom.trim());
  if (state.yearTo.trim()) params.set('year_to', state.yearTo.trim());
  if (state.minRating.trim()) params.set('min_rating', state.minRating.trim());
  if (state.language.trim()) params.set('language', state.language.trim());
  if (state.format.trim()) params.set('format', state.format.trim());
  if (state.sort && state.sort !== 'relevance') params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));
  if (state.limit !== DEFAULT_CATALOG_LIMIT) params.set('limit', String(state.limit));
  return params;
}

export function serializeCatalogQueryToSearch(state: CatalogQueryState): string {
  const str = buildCatalogApiParams(state).toString();
  return str ? `?${str}` : '';
}

export function countActiveCatalogFilters(state: CatalogQueryState): number {
  let count = 0;
  if (state.category.trim()) count += 1;
  if (state.subject.trim()) count += 1;
  if (state.author.trim()) count += 1;
  if (state.availability && state.availability !== 'all') count += 1;
  if (state.yearFrom.trim() || state.yearTo.trim()) count += 1;
  if (state.minRating.trim()) count += 1;
  if (state.language.trim()) count += 1;
  if (state.format.trim()) count += 1;
  return count;
}

export function buildPaginationTokens(
  currentPage: number,
  totalPages: number
): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const tokens: Array<number | 'ellipsis'> = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  if (left > 2) tokens.push('ellipsis');
  for (let p = left; p <= right; p += 1) {
    tokens.push(p);
  }
  if (right < totalPages - 1) tokens.push('ellipsis');
  tokens.push(totalPages);

  return tokens;
}

const COVER_AI = DEMO_BOOKS[0].coverImage;
const COVER_ALGO = DEMO_BOOKS[1].coverImage;
const COVER_DS = DEMO_BOOKS[2].coverImage;
const COVER_SE = DEMO_BOOKS[3].coverImage;
const COVER_PSYCH = DEMO_BOOKS[4].coverImage;
const COVER_HIST = DEMO_BOOKS[5].coverImage;

export const SAMPLE_LIBRARY_CATALOG: CatalogBook[] = [
  {
    book_id: 101,
    slug: 'python-programming-foundations-modern-practice',
    isbn: '978-0-13-485398-7',
    title: 'Python Programming: Foundations & Modern Practice',
    author: 'Dr. Kavita Rao',
    publisher: 'Academic Tech Press',
    publication_year: 2025,
    category: 'Programming',
    subject: 'Python Programming',
    description:
      'Comprehensive introduction to Python syntax, object-oriented design, standard library tooling, and clean scripting workflows for university coursework.',
    keywords: ['python', 'programming', 'oop', 'scripting', 'software'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_ALGO,
    total_copies: 5,
    available_copies: 3,
    reserved_copies: 0,
    rating_average: 4.8,
    rating_count: 142,
    review_count: 34,
    borrow_count: 310,
    created_at: '2026-10-20',
  },
  {
    book_id: 102,
    slug: 'python-for-data-analysis-pandas-workflows',
    isbn: '978-1-491-95766-0',
    title: 'Python for Data Analysis & Pandas Workflows',
    author: 'Wes McKinney & Priya Nair',
    publisher: 'O’Reilly Academic',
    publication_year: 2024,
    category: 'Data Science',
    subject: 'Data Analysis',
    description:
      'Practical guide to data wrangling, time-series aggregation, NumPy vectorization, and reproducible analytics using Python and Pandas.',
    keywords: ['python', 'pandas', 'data analysis', 'numpy', 'data science'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_DS,
    total_copies: 5,
    available_copies: 2,
    reserved_copies: 1,
    rating_average: 4.7,
    rating_count: 128,
    review_count: 29,
    borrow_count: 295,
    created_at: '2026-10-14',
  },
  {
    book_id: 103,
    slug: 'learning-python-structured-problem-solving',
    isbn: '978-1-449-35573-9',
    title: 'Learning Python: Structured Problem Solving',
    author: 'Mark Lutz',
    publisher: 'Campus Computing Editions',
    publication_year: 2023,
    category: 'Programming',
    subject: 'Python Programming',
    description:
      'Step-by-step mastery of core Python types, generators, decorators, and modular testing patterns for computer science majors.',
    keywords: ['python', 'learning python', 'modules', 'testing'],
    language: 'English',
    format: 'E-Book',
    cover_image: COVER_SE,
    total_copies: 1,
    available_copies: 1,
    reserved_copies: 0,
    rating_average: 4.6,
    rating_count: 96,
    review_count: 21,
    borrow_count: 240,
    created_at: '2026-09-28',
  },
  {
    book_id: 104,
    slug: 'automating-with-python-campus-systems',
    isbn: '978-1-593-27992-9',
    title: 'Automating with Python: Practical Lab Workflows',
    author: 'Al Sweigart',
    publisher: 'No Starch Academic',
    publication_year: 2024,
    category: 'Programming',
    subject: 'Automation & Scripting',
    description:
      'Hands-on automation covering file parsing, API integration, spreadsheet processing, and scheduling tasks with Python.',
    keywords: ['python', 'automation', 'apis', 'scripting'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_ALGO,
    total_copies: 4,
    available_copies: 0,
    reserved_copies: 1,
    rating_average: 4.5,
    rating_count: 84,
    review_count: 18,
    borrow_count: 205,
    created_at: '2026-09-12',
  },
  {
    book_id: 105,
    slug: 'interconnected-knowledge-systems-data-modern-education',
    isbn: '978-0-262-04482-1',
    title: 'Interconnected Knowledge: Systems, Data & Modern Education',
    author: 'Dr. Eleanor Vance & Prof. Michael Chen',
    publisher: 'MIT Knowledge Press',
    publication_year: 2025,
    category: 'Artificial Intelligence',
    subject: 'Machine Learning',
    description:
      'Explores knowledge graphs, TF-IDF content-based filtering, and intelligent information retrieval in modern digital libraries.',
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'recommender', 'tf-idf'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_AI,
    total_copies: 5,
    available_copies: 4,
    reserved_copies: 0,
    rating_average: 4.9,
    rating_count: 164,
    review_count: 42,
    borrow_count: 342,
    created_at: '2026-11-01',
  },
  {
    book_id: 106,
    slug: 'algorithms-and-data-structures',
    isbn: '978-0-262-03384-8',
    title: 'Algorithms & Data Structures: Computational Thinking',
    author: 'Evelyn J. Reed & Leo K. Chen',
    publisher: 'Oxford Computing Series',
    publication_year: 2024,
    category: 'Computer Science',
    subject: 'Algorithms',
    description:
      'Rigorous coverage of binary trees, graph traversal, dynamic programming, and asymptotic complexity analysis.',
    keywords: ['algorithms', 'data structures', 'graphs', 'computer science'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_ALGO,
    total_copies: 4,
    available_copies: 3,
    reserved_copies: 0,
    rating_average: 4.8,
    rating_count: 119,
    review_count: 31,
    borrow_count: 278,
    created_at: '2026-10-18',
  },
  {
    book_id: 107,
    slug: 'contemporary-data-science',
    isbn: '978-1-108-47120-6',
    title: 'Contemporary Data Science: Statistical Methods & Prediction',
    author: "Dr. Emily Chen & Prof. Liam O'Neill",
    publisher: 'Cambridge Analytics Press',
    publication_year: 2025,
    category: 'Data Science',
    subject: 'Statistical Modeling',
    description:
      'Introduces hypothesis testing, regression, exploratory visualization, and predictive model evaluation metrics.',
    keywords: ['data science', 'statistics', 'prediction', 'modeling'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_DS,
    total_copies: 3,
    available_copies: 1,
    reserved_copies: 0,
    rating_average: 4.7,
    rating_count: 93,
    review_count: 19,
    borrow_count: 215,
    created_at: '2026-10-25',
  },
  {
    book_id: 108,
    slug: 'software-engineering-modular-design-systems',
    isbn: '978-0-13-475759-9',
    title: 'Software Engineering: Modular Design, Systems & Structures',
    author: 'Arthur J. Reed, PhD & Elena M. Chen',
    publisher: 'Addison Technical Publications',
    publication_year: 2024,
    category: 'Computer Science',
    subject: 'Software Architecture',
    description:
      'Covers relational database schemas, REST API design, modular maintainability, and automated integration testing.',
    keywords: ['software engineering', 'architecture', 'rest api', 'mysql'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_SE,
    total_copies: 5,
    available_copies: 5,
    reserved_copies: 0,
    rating_average: 4.6,
    rating_count: 107,
    review_count: 25,
    borrow_count: 254,
    created_at: '2026-10-08',
  },
  {
    book_id: 109,
    slug: 'neural-networks-deep-learning-principles',
    isbn: '978-0-262-03561-3',
    title: 'Neural Networks & Deep Learning Principles',
    author: 'Dr. Vikram Sethi',
    publisher: 'AI Research Monographs',
    publication_year: 2025,
    category: 'Artificial Intelligence',
    subject: 'Deep Learning',
    description:
      'Foundational guide to gradient optimization, convolutional architectures, attention mechanisms, and transformer models.',
    keywords: ['ai', 'deep learning', 'neural networks', 'machine learning'],
    language: 'English',
    format: 'E-Book',
    cover_image: COVER_AI,
    total_copies: 1,
    available_copies: 1,
    reserved_copies: 0,
    rating_average: 4.9,
    rating_count: 151,
    review_count: 37,
    borrow_count: 325,
    created_at: '2026-11-04',
  },
  {
    book_id: 110,
    slug: 'modern-web-development-typescript-react',
    isbn: '978-1-098-12345-6',
    title: 'Modern Web Development with TypeScript & React',
    author: 'Neha Kulkarni',
    publisher: 'Frontend Engineering Press',
    publication_year: 2025,
    category: 'Web Development',
    subject: 'Frontend Engineering',
    description:
      'Design accessible component architectures, type-safe state management, and responsive interfaces for web applications.',
    keywords: ['web development', 'typescript', 'react', 'accessibility', 'ui'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_SE,
    total_copies: 4,
    available_copies: 2,
    reserved_copies: 0,
    rating_average: 4.5,
    rating_count: 78,
    review_count: 16,
    borrow_count: 192,
    created_at: '2026-10-12',
  },
  {
    book_id: 111,
    slug: 'flask-web-apis-mysql-backends',
    isbn: '978-1-492-07812-3',
    title: 'Building Scalable Web APIs with Python Flask & MySQL',
    author: 'Rohan Deshmukh',
    publisher: 'Backend Systems Press',
    publication_year: 2024,
    category: 'Web Development',
    subject: 'Backend Engineering',
    description:
      'Covers blueprint routing, SQLAlchemy ORM modeling, session authentication, and secure REST endpoints with Flask.',
    keywords: ['flask', 'python', 'web development', 'mysql', 'api'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_SE,
    total_copies: 3,
    available_copies: 0,
    reserved_copies: 0,
    rating_average: 4.4,
    rating_count: 64,
    review_count: 14,
    borrow_count: 184,
    created_at: '2026-09-22',
  },
  {
    book_id: 112,
    slug: 'relational-database-management-sql-internals',
    isbn: '978-0-07-802215-9',
    title: 'Relational Database Systems & SQL Query Optimization',
    author: 'Abraham Silberschatz & Meera Iyer',
    publisher: 'McGraw University Press',
    publication_year: 2023,
    category: 'Database',
    subject: 'Database Systems',
    description:
      'Essential theory and practice of relational normalization, B-Tree indexing, ACID transactions, and MySQL execution plans.',
    keywords: ['database', 'mysql', 'sql', 'indexing', 'transactions'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_ALGO,
    total_copies: 6,
    available_copies: 4,
    reserved_copies: 0,
    rating_average: 4.7,
    rating_count: 135,
    review_count: 28,
    borrow_count: 289,
    created_at: '2026-08-30',
  },
  {
    book_id: 113,
    slug: 'computer-networking-top-down-protocols',
    isbn: '978-0-13-668155-7',
    title: 'Computer Networking: Protocols & Internet Architecture',
    author: 'James Kurose & Keith Ross',
    publisher: 'Pearson Academic',
    publication_year: 2022,
    category: 'Networking',
    subject: 'Network Protocols',
    description:
      'Deep exploration of HTTP, TCP/IP congestion control, routing algorithms, DNS resolution, and wireless networks.',
    keywords: ['networking', 'tcp', 'http', 'routing', 'protocols'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_SE,
    total_copies: 4,
    available_copies: 2,
    reserved_copies: 0,
    rating_average: 4.6,
    rating_count: 112,
    review_count: 22,
    borrow_count: 221,
    created_at: '2026-08-18',
  },
  {
    book_id: 114,
    slug: 'cybersecurity-applied-cryptography-defense',
    isbn: '978-1-119-09672-6',
    title: 'Cybersecurity & Applied Cryptographic Defense',
    author: 'Dr. Arjun Malhotra',
    publisher: 'Secure Systems Publishing',
    publication_year: 2025,
    category: 'Cybersecurity',
    subject: 'Information Security',
    description:
      'Practical security engineering covering symmetric/asymmetric ciphers, OWASP web defense, and zero-trust identity flows.',
    keywords: ['cybersecurity', 'cryptography', 'security', 'authentication'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_AI,
    total_copies: 3,
    available_copies: 1,
    reserved_copies: 0,
    rating_average: 4.8,
    rating_count: 89,
    review_count: 20,
    borrow_count: 198,
    created_at: '2026-10-29',
  },
  {
    book_id: 115,
    slug: 'linear-algebra-for-machine-learning',
    isbn: '978-1-108-45514-5',
    title: 'Linear Algebra & Matrix Calculus for Machine Learning',
    author: 'Prof. Gilbert Strang & Ananya Sen',
    publisher: 'Wellesley Academic Press',
    publication_year: 2024,
    category: 'Mathematics',
    subject: 'Linear Algebra',
    description:
      'Eigenvalues, singular value decomposition, vector spaces, and matrix calculus grounded in data science applications.',
    keywords: ['mathematics', 'linear algebra', 'svd', 'machine learning'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_DS,
    total_copies: 5,
    available_copies: 3,
    reserved_copies: 0,
    rating_average: 4.9,
    rating_count: 176,
    review_count: 45,
    borrow_count: 336,
    created_at: '2026-10-05',
  },
  {
    book_id: 116,
    slug: 'probability-statistics-engineering-sciences',
    isbn: '978-1-305-25180-9',
    title: 'Probability & Statistics for Engineering & Sciences',
    author: 'Jay L. Devore',
    publisher: 'Cengage Academic',
    publication_year: 2021,
    category: 'Mathematics',
    subject: 'Probability & Statistics',
    description:
      'Foundational probability distributions, Bayesian inference, confidence intervals, and ANOVA for engineering students.',
    keywords: ['probability', 'statistics', 'mathematics', 'bayesian'],
    language: 'English',
    format: 'E-Book',
    cover_image: COVER_DS,
    total_copies: 1,
    available_copies: 1,
    reserved_copies: 0,
    rating_average: 4.3,
    rating_count: 72,
    review_count: 13,
    borrow_count: 165,
    created_at: '2026-07-19',
  },
  {
    book_id: 117,
    slug: 'understanding-mind-academic-psychology',
    isbn: '978-0-19-884122-7',
    title: 'Understanding Mind: An Exploration of Academic Psychology',
    author: 'Dr. Elara J. Croft & Dr. Aris V. Lin',
    publisher: 'Scholarly Press',
    publication_year: 2024,
    category: 'Science',
    subject: 'Cognitive Science',
    description:
      'Examines memory consolidation, attention networks, metacognition, and evidence-based learning strategies.',
    keywords: ['psychology', 'cognitive science', 'learning', 'memory'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_PSYCH,
    total_copies: 2,
    available_copies: 0,
    reserved_copies: 1,
    rating_average: 4.4,
    rating_count: 58,
    review_count: 12,
    borrow_count: 141,
    created_at: '2026-09-03',
  },
  {
    book_id: 118,
    slug: 'physics-of-computation-quantum-systems',
    isbn: '978-0-521-19822-1',
    title: 'Principles of Quantum Mechanics & Computational Physics',
    author: 'Dr. Siddharth Bose',
    publisher: 'University Science House',
    publication_year: 2022,
    category: 'Science',
    subject: 'Applied Physics',
    description:
      'Bridges wave mechanics, statistical thermodynamics, and quantum information circuits for undergraduate science.',
    keywords: ['physics', 'science', 'quantum', 'simulation'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_AI,
    total_copies: 3,
    available_copies: 2,
    reserved_copies: 0,
    rating_average: 4.2,
    rating_count: 41,
    review_count: 9,
    borrow_count: 112,
    created_at: '2026-06-15',
  },
  {
    book_id: 119,
    slug: 'strategic-management-digital-enterprises',
    isbn: '978-1-260-57011-3',
    title: 'Strategic Management for Digital Enterprises',
    author: 'Prof. Hannah Brooks',
    publisher: 'Harvard Business Academic',
    publication_year: 2023,
    category: 'Business',
    subject: 'Management Strategy',
    description:
      'Analyzes platform economics, product-market fit, operations scaling, and ethical governance in technology firms.',
    keywords: ['business', 'strategy', 'management', 'economics'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_SE,
    total_copies: 4,
    available_copies: 3,
    reserved_copies: 0,
    rating_average: 4.1,
    rating_count: 53,
    review_count: 11,
    borrow_count: 134,
    created_at: '2026-07-04',
  },
  {
    book_id: 120,
    slug: 'humanitas-and-interpretation',
    isbn: '978-0-691-18923-4',
    title: 'Humanitas & Interpretation: Archways and Manuscripts',
    author: 'Eleanor Vance, Ph.D.',
    publisher: 'Princeton Humanities Press',
    publication_year: 2023,
    category: 'History',
    subject: 'Archival History',
    description:
      'Historical survey of classical manuscripts, archival preservation, and cross-cultural scholarly libraries.',
    keywords: ['history', 'archives', 'manuscripts', 'humanities'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_HIST,
    total_copies: 2,
    available_copies: 2,
    reserved_copies: 0,
    rating_average: 4.5,
    rating_count: 67,
    review_count: 15,
    borrow_count: 158,
    created_at: '2026-08-05',
  },
  {
    book_id: 121,
    slug: 'modern-world-history-scientific-revolutions',
    isbn: '978-0-300-24118-9',
    title: 'World History of Ideas & Scientific Revolutions',
    author: 'Dr. Tariq Al-Mansoor',
    publisher: 'Global Heritage Academic',
    publication_year: 2020,
    category: 'History',
    subject: 'World History',
    description:
      'Traces intellectual breakthroughs across ancient academies, the printing revolution, and modern research universities.',
    keywords: ['history', 'scientific revolution', 'libraries', 'culture'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_HIST,
    total_copies: 3,
    available_copies: 0,
    reserved_copies: 0,
    rating_average: 3.9,
    rating_count: 34,
    review_count: 7,
    borrow_count: 96,
    created_at: '2026-05-12',
  },
  {
    book_id: 122,
    slug: 'literary-criticism-narrative-craft',
    isbn: '978-0-14-313122-4',
    title: 'The Craft of Narrative & Comparative Literature',
    author: 'Prof. Clara Bennett',
    publisher: 'Penguin Scholarly',
    publication_year: 2021,
    category: 'Literature',
    subject: 'Comparative Literature',
    description:
      'Close-reading anthology analyzing narrative voice, metaphor, and structural form across global literary traditions.',
    keywords: ['literature', 'writing', 'criticism', 'novels'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_HIST,
    total_copies: 4,
    available_copies: 4,
    reserved_copies: 0,
    rating_average: 4.3,
    rating_count: 49,
    review_count: 10,
    borrow_count: 118,
    created_at: '2026-06-27',
  },
  {
    book_id: 123,
    slug: 'hindi-sahitya-aur-aadhunik-vichar',
    isbn: '978-81-267-3104-2',
    title: 'आधुनिक हिंदी साहित्य और वैचारिक विमर्श (Modern Hindi Literature)',
    author: 'डॉ. अशोक त्रिपाठी',
    publisher: 'Rajkamal Vidya Prakashan',
    publication_year: 2022,
    category: 'Literature',
    subject: 'Hindi Literature',
    description:
      'Comprehensive survey of modern Hindi prose, poetry movements, and literary criticism for university humanities courses.',
    keywords: ['hindi', 'literature', 'sahitya', 'poetry'],
    language: 'Hindi',
    format: 'Physical Book',
    cover_image: COVER_HIST,
    total_copies: 3,
    available_copies: 2,
    reserved_copies: 0,
    rating_average: 4.6,
    rating_count: 44,
    review_count: 11,
    borrow_count: 109,
    created_at: '2026-07-29',
  },
  {
    book_id: 124,
    slug: 'critical-thinking-general-knowledge-compendium',
    isbn: '978-0-19-949876-5',
    title: 'Critical Thinking, Logic & General Knowledge Compendium',
    author: 'Dr. Rameshwar Joshi',
    publisher: 'National Academic Press',
    publication_year: 2024,
    category: 'General Knowledge',
    subject: 'Analytical Reasoning',
    description:
      'Structured handbook covering formal logic, civic institutions, global affairs, and quantitative reasoning skills.',
    keywords: ['general knowledge', 'logic', 'reasoning', 'civic'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_PSYCH,
    total_copies: 6,
    available_copies: 5,
    reserved_copies: 0,
    rating_average: 4.2,
    rating_count: 61,
    review_count: 14,
    borrow_count: 175,
    created_at: '2026-09-09',
  },
  {
    book_id: 125,
    slug: 'bharat-ka-samvidhan-evam-samanya-gyan',
    isbn: '978-93-5260-881-4',
    title: 'भारत की राजव्यवस्था एवं सामान्य ज्ञान (Governance & General Studies)',
    author: 'एम. लक्ष्मीकांत एवं डॉ. सुनीता शर्मा',
    publisher: 'McGraw Hill India',
    publication_year: 2025,
    category: 'General Knowledge',
    subject: 'Public Policy',
    description:
      'Authoritative Hindi-medium reference on constitutional governance, parliamentary procedure, and public administration.',
    keywords: ['hindi', 'general knowledge', 'governance', 'policy'],
    language: 'Hindi',
    format: 'E-Book',
    cover_image: COVER_HIST,
    total_copies: 1,
    available_copies: 1,
    reserved_copies: 0,
    rating_average: 4.7,
    rating_count: 103,
    review_count: 23,
    borrow_count: 262,
    created_at: '2026-10-30',
  },
  {
    book_id: 126,
    slug: 'applied-natural-language-processing-python',
    isbn: '978-1-492-08421-1',
    title: 'Applied Natural Language Processing with Python',
    author: 'Dr. Meenakshi Krishnan',
    publisher: 'Intelligent Systems Press',
    publication_year: 2025,
    category: 'Artificial Intelligence',
    subject: 'Natural Language Processing',
    description:
      'Build text classification pipelines, TF-IDF vectorizers, semantic search engines, and document similarity rankers.',
    keywords: ['python', 'nlp', 'ai', 'tf-idf', 'cosine similarity'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_AI,
    total_copies: 4,
    available_copies: 3,
    reserved_copies: 0,
    rating_average: 4.8,
    rating_count: 91,
    review_count: 24,
    borrow_count: 229,
    created_at: '2026-11-05',
  },
  {
    book_id: 127,
    slug: 'distributed-systems-cloud-reliability',
    isbn: '978-1-491-90306-3',
    title: 'Designing Data-Intensive & Distributed Systems',
    author: 'Martin Kleppmann',
    publisher: 'O’Reilly Academic',
    publication_year: 2023,
    category: 'Database',
    subject: 'Distributed Systems',
    description:
      'Architectural deep dive into replication, consensus protocols, stream processing, and fault-tolerant storage engines.',
    keywords: ['distributed systems', 'database', 'replication', 'architecture'],
    language: 'English',
    format: 'Physical Book',
    cover_image: COVER_SE,
    total_copies: 3,
    available_copies: 1,
    reserved_copies: 0,
    rating_average: 4.9,
    rating_count: 184,
    review_count: 47,
    borrow_count: 358,
    created_at: '2026-09-17',
  },
  {
    book_id: 128,
    slug: 'academic-research-methodology-ethics',
    isbn: '978-1-544-34512-0',
    title: 'Academic Research Methodology & Scientific Writing',
    author: 'Prof. Daniel Okafor',
    publisher: 'Global University Press',
    publication_year: 2022,
    category: 'Other',
    subject: 'Research Methods',
    description:
      'Step-by-step guidance on literature reviews, experimental design, citation ethics, and peer-reviewed thesis writing.',
    keywords: ['research', 'methodology', 'academic writing', 'thesis'],
    language: 'Other',
    format: 'E-Book',
    cover_image: COVER_PSYCH,
    total_copies: 1,
    available_copies: 1,
    reserved_copies: 0,
    rating_average: 3.8,
    rating_count: 0,
    review_count: 0,
    borrow_count: 74,
    created_at: '2026-05-02',
  },
];

export function findCatalogBookByIdentifier(
  identifier: string,
  books: CatalogBook[] = SAMPLE_LIBRARY_CATALOG
): CatalogBook | undefined {
  const numericId = Number.parseInt(identifier, 10);
  return books.find(
    (book) =>
      book.slug === identifier ||
      (!Number.isNaN(numericId) && String(numericId) === identifier && book.book_id === numericId)
  );
}
