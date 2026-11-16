export type BookAvailabilityStatus = 'Available' | 'Limited' | 'Checked Out';

export interface DemoBook {
  id: string;
  slug: string;
  title: string;
  author: string;
  category: string;
  isbnPlaceholder: string;
  shelfCode: string;
  publicationYear: number;
  availableCopies: number;
  totalCopies: number;
  status: BookAvailabilityStatus;
  coverImage: string;
  summary: string;
  keywords: string[];
}

export interface DemoMetric {
  id: string;
  label: string;
  demoValue: string;
  placeholderNote: string;
}

export interface RecommendationElement {
  id: string;
  number: string;
  title: string;
  description: string;
}

export interface WorkflowStep {
  stepNumber: string;
  title: string;
  description: string;
  iconName: 'user-plus' | 'search' | 'sparkles' | 'book-open';
}

export interface PlatformFeature {
  id: string;
  title: string;
  description: string;
  iconName:
    | 'search'
    | 'brain'
    | 'check-circle'
    | 'bookmark'
    | 'repeat'
    | 'bell'
    | 'history'
    | 'layout-dashboard'
    | 'shield-check';
}

export type AdminManagementSection =
  | 'staff'
  | 'users'
  | 'categories'
  | 'subjects'
  | 'branches'
  | 'settings'
  | 'roles';

export type AppRoute =
  | { name: 'home' }
  | { name: 'books' }
  | { name: 'book-detail'; slug: string }
  | { name: 'login' }
  | { name: 'signup' }
  | { name: 'admin-login' }
  | { name: 'student-dashboard' }
  | { name: 'student-search' }
  | { name: 'student-recommendations' }
  | { name: 'student-my-books' }
  | { name: 'student-history' }
  | { name: 'student-reservations' }
  | { name: 'student-notifications' }
  | { name: 'student-profile' }
  | { name: 'librarian-dashboard' }
  | { name: 'librarian-inventory' }
  | { name: 'librarian-add-book' }
  | {
      name: 'librarian-issue-books';
      prefillStudentId?: number;
      prefillBookId?: number;
      prefillReservationId?: number;
    }
  | { name: 'librarian-return-books'; prefillSearchQuery?: string }
  | { name: 'librarian-reservations'; prefillSearchQuery?: string; prefillReservationId?: number }
  | { name: 'librarian-students'; prefillStudentId?: number; prefillSearchQuery?: string }
  | { name: 'librarian-overdue' }
  | { name: 'librarian-announcements' }
  | { name: 'librarian-reports' }
  | { name: 'librarian-profile'; section?: 'profile' | 'settings' | 'password' }
  | { name: 'admin-dashboard' }
  | { name: 'admin-management'; section?: AdminManagementSection }
  | { name: 'admin-inventory' }
  | { name: 'admin-add-book' }
  | { name: 'admin-reports' }
  | { name: 'admin-audit-logs' }
  | { name: 'admin-profile'; section?: 'profile' | 'password' }
  | { name: 'recommendations' }
  | { name: 'contact' }
  | { name: 'privacy' }
  | { name: 'terms' };

export const HERO_LIBRARY_IMAGE = '/src/assets/images/hero_smart_library_1794581525172.jpg';
export const ABOUT_LIBRARY_IMAGE = '/src/assets/images/about_library_collaboration_1794581525729.jpg';

export const DEMO_BOOKS: DemoBook[] = [
  {
    id: 'demo-book-1',
    slug: 'interconnected-knowledge-systems-data-modern-education',
    title: 'Interconnected Knowledge: Systems, Data & Modern Education',
    author: 'Dr. Eleanor Vance & Prof. Michael Chen',
    category: 'Artificial Intelligence',
    isbnPlaceholder: 'DEMO-ISBN-001',
    shelfCode: 'AI-104',
    publicationYear: 2025,
    availableCopies: 4,
    totalCopies: 5,
    status: 'Available',
    coverImage: '/src/assets/images/book_cover_ai_foundations_1794581525664.jpg',
    summary:
      'Sample catalog entry exploring knowledge graphs, content-based filtering foundations, and intelligent information retrieval in modern educational environments.',
    keywords: ['AI', 'knowledge graphs', 'machine learning', 'education', 'recommendation systems'],
  },
  {
    id: 'demo-book-2',
    slug: 'algorithms-and-data-structures',
    title: 'Algorithms & Data Structures: Computational Thinking',
    author: 'Evelyn J. Reed & Leo K. Chen',
    category: 'Computer Science',
    isbnPlaceholder: 'DEMO-ISBN-002',
    shelfCode: 'CS-212',
    publicationYear: 2024,
    availableCopies: 3,
    totalCopies: 4,
    status: 'Available',
    coverImage: '/src/assets/images/book_cover_algorithms_1794581526854.jpg',
    summary:
      'Sample academic reference covering trees, graph traversal, complexity analysis, and practical algorithmic problem solving for computer science students.',
    keywords: ['algorithms', 'data structures', 'binary trees', 'graphs', 'computer science'],
  },
  {
    id: 'demo-book-3',
    slug: 'contemporary-data-science',
    title: 'Contemporary Data Science: Statistical Methods & Prediction',
    author: "Dr. Emily Chen & Prof. Liam O'Neill",
    category: 'Data Science',
    isbnPlaceholder: 'DEMO-ISBN-003',
    shelfCode: 'DS-308',
    publicationYear: 2025,
    availableCopies: 1,
    totalCopies: 3,
    status: 'Limited',
    coverImage: '/src/assets/images/book_cover_data_science_1794581527416.jpg',
    summary:
      'Sample textbook introducing statistical modeling, Pandas data workflows, exploratory analysis, and predictive evaluation metrics.',
    keywords: ['data science', 'python', 'pandas', 'statistics', 'prediction'],
  },
  {
    id: 'demo-book-4',
    slug: 'software-engineering-modular-design-systems',
    title: 'Software Engineering: Modular Design, Systems & Structures',
    author: 'Arthur J. Reed, PhD & Elena M. Chen',
    category: 'Software Engineering',
    isbnPlaceholder: 'DEMO-ISBN-004',
    shelfCode: 'SE-415',
    publicationYear: 2024,
    availableCopies: 5,
    totalCopies: 5,
    status: 'Available',
    coverImage: '/src/assets/images/book_cover_software_arch_1794581527027.jpg',
    summary:
      'Sample engineering guide detailing relational database schemas, RESTful API architecture, modular maintainability, and automated testing patterns.',
    keywords: ['software engineering', 'architecture', 'flask', 'mysql', 'systems'],
  },
  {
    id: 'demo-book-5',
    slug: 'understanding-mind-academic-psychology',
    title: 'Understanding Mind: An Exploration of Academic Psychology',
    author: 'Dr. Elara J. Croft & Dr. Aris V. Lin',
    category: 'Cognitive Science',
    isbnPlaceholder: 'DEMO-ISBN-005',
    shelfCode: 'PS-119',
    publicationYear: 2024,
    availableCopies: 0,
    totalCopies: 2,
    status: 'Checked Out',
    coverImage: '/src/assets/images/book_cover_cognitive_psych_1794581528454.jpg',
    summary:
      'Sample humanities and cognitive science volume examining memory retention, attention systems, and active reading comprehension strategies.',
    keywords: ['psychology', 'cognitive science', 'learning', 'memory', 'research'],
  },
  {
    id: 'demo-book-6',
    slug: 'humanitas-and-interpretation',
    title: 'Humanitas & Interpretation: Archways and Manuscripts',
    author: 'Eleanor Vance, Ph.D.',
    category: 'Humanities',
    isbnPlaceholder: 'DEMO-ISBN-006',
    shelfCode: 'HM-102',
    publicationYear: 2023,
    availableCopies: 2,
    totalCopies: 2,
    status: 'Available',
    coverImage: '/src/assets/images/book_cover_world_history_1794581528139.jpg',
    summary:
      'Sample historical archive survey studying classical manuscripts, archival preservation, and cross-cultural scholarly traditions.',
    keywords: ['history', 'humanities', 'manuscripts', 'archives', 'literature'],
  },
];

export const DEMO_LIBRARY_METRICS: DemoMetric[] = [
  {
    id: 'total-books',
    label: 'Total Books',
    demoValue: '1,250+',
    placeholderNote: 'Sample placeholder · Connects to MySQL books table',
  },
  {
    id: 'available-books',
    label: 'Available Books',
    demoValue: '980',
    placeholderNote: 'Sample placeholder · Real-time copy inventory',
  },
  {
    id: 'registered-students',
    label: 'Registered Students',
    demoValue: '450+',
    placeholderNote: 'Sample placeholder · Connects to student records',
  },
  {
    id: 'book-categories',
    label: 'Book Categories',
    demoValue: '18',
    placeholderNote: 'Sample placeholder · Academic subject taxonomies',
  },
];

export const RECOMMENDATION_ELEMENTS: RecommendationElement[] = [
  {
    id: 'interest-based',
    number: '01',
    title: 'Interest-Based Recommendations',
    description:
      'Matches books to the academic subjects, topics, and learning domains each student selects during registration.',
  },
  {
    id: 'reading-history',
    number: '02',
    title: 'Reading History Analysis',
    description:
      'Uses past borrowings and completed titles via content-based and hybrid filtering to suggest relevant next reads.',
  },
  {
    id: 'ratings-feedback',
    number: '03',
    title: 'Student Ratings and Feedback',
    description:
      'Refines recommendation relevance over time using peer ratings and helpfulness feedback from active readers.',
  },
  {
    id: 'availability-filtering',
    number: '04',
    title: 'Book Availability Filtering',
    description:
      'Prioritizes titles that are currently on the shelf or ready for immediate reservation so students never hit dead ends.',
  },
];

export const HOW_IT_WORKS_STEPS: WorkflowStep[] = [
  {
    stepNumber: '01',
    title: 'Create Your Account',
    description: 'Students register and set their learning interests.',
    iconName: 'user-plus',
  },
  {
    stepNumber: '02',
    title: 'Explore Books',
    description: 'Search and discover books by title, author, category or subject.',
    iconName: 'search',
  },
  {
    stepNumber: '03',
    title: 'Get AI Recommendations',
    description:
      'The recommendation engine suggests relevant books using student preferences and reading history.',
    iconName: 'sparkles',
  },
  {
    stepNumber: '04',
    title: 'Borrow and Learn',
    description: 'Check availability, request or reserve books, and manage borrowing activity.',
    iconName: 'book-open',
  },
];

export const PLATFORM_FEATURES: PlatformFeature[] = [
  {
    id: 'smart-search',
    title: 'Smart Book Search',
    description: 'Query titles, authors, categories, and subject keywords with instant filtering.',
    iconName: 'search',
  },
  {
    id: 'ai-recommendations',
    title: 'Personalized AI Recommendations',
    description: 'Hybrid Python and Pandas filtering tailored to each student reading profile.',
    iconName: 'brain',
  },
  {
    id: 'real-time-availability',
    title: 'Real-Time Book Availability',
    description: 'See exact copy counts and shelf status before visiting the library desk.',
    iconName: 'check-circle',
  },
  {
    id: 'book-reservation',
    title: 'Book Reservation',
    description: 'Place hold requests on available or incoming copies directly from book pages.',
    iconName: 'bookmark',
  },
  {
    id: 'borrowing-tracking',
    title: 'Borrowing and Return Tracking',
    description: 'Monitor active loans, renewal windows, and scheduled return dates in one place.',
    iconName: 'repeat',
  },
  {
    id: 'due-date-notifications',
    title: 'Automated Due-Date Notifications',
    description: 'Timely reminders help students return books on schedule and avoid late fees.',
    iconName: 'bell',
  },
  {
    id: 'reading-history',
    title: 'Reading History',
    description: 'Keep an organized record of previously borrowed books and completed coursework.',
    iconName: 'history',
  },
  {
    id: 'student-dashboard',
    title: 'Student Dashboard',
    description: 'Dedicated workspace for saved titles, active reservations, and AI reading picks.',
    iconName: 'layout-dashboard',
  },
  {
    id: 'librarian-management',
    title: 'Librarian Management',
    description: 'Streamlined catalog updates, issue/return approvals, and inventory oversight.',
    iconName: 'shield-check',
  },
];
