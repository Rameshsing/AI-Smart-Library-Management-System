import { DEMO_BOOKS, type AppRoute, type DemoBook } from '../data/libraryData';

export function filterDemoBooks(
  books: DemoBook[],
  query: string,
  category: string = 'All'
): DemoBook[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedCategory = category.trim();

  return books.filter((book) => {
    const matchesCategory =
      !normalizedCategory ||
      normalizedCategory === 'All' ||
      book.category.toLowerCase() === normalizedCategory.toLowerCase();

    if (!matchesCategory) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      book.title,
      book.author,
      book.category,
      book.summary,
      book.isbnPlaceholder,
      ...book.keywords,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function getBookCategories(books: DemoBook[]): string[] {
  const unique = Array.from(new Set(books.map((book) => book.category)));
  return ['All', ...unique];
}

export function findDemoBookBySlug(
  slug: string,
  books: DemoBook[] = DEMO_BOOKS
): DemoBook | undefined {
  return books.find((book) => book.slug === slug);
}

export function parseRouteFromPathname(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';

  if (clean === '/') return { name: 'home' };
  if (clean === '/books') return { name: 'books' };
  if (clean.startsWith('/books/')) {
    const slug = clean.slice('/books/'.length);
    if (slug) {
      return { name: 'book-detail', slug };
    }
  }
  if (clean === '/login') return { name: 'login' };
  if (clean === '/signup') return { name: 'signup' };
  if (clean === '/admin-login') return { name: 'admin-login' };
  if (clean === '/student-dashboard') return { name: 'student-dashboard' };
  if (clean === '/student/search') return { name: 'student-search' };
  if (clean === '/student/recommendations') return { name: 'student-recommendations' };
  if (clean === '/student/my-books') return { name: 'student-my-books' };
  if (clean === '/student/history') return { name: 'student-history' };
  if (clean === '/student/reservations') return { name: 'student-reservations' };
  if (clean === '/student/notifications') return { name: 'student-notifications' };
  if (clean === '/student/profile') return { name: 'student-profile' };
  if (clean === '/librarian-dashboard') return { name: 'librarian-dashboard' };
  if (clean === '/librarian/inventory') return { name: 'librarian-inventory' };
  if (clean === '/librarian/books/new') return { name: 'librarian-add-book' };
  if (clean === '/librarian/issue-books') return { name: 'librarian-issue-books' };
  if (clean === '/librarian/return-books') return { name: 'librarian-return-books' };
  if (clean === '/librarian/reservations') return { name: 'librarian-reservations' };
  if (clean === '/librarian/students') return { name: 'librarian-students' };
  if (clean === '/librarian/overdue') return { name: 'librarian-overdue' };
  if (clean === '/librarian/announcements') return { name: 'librarian-announcements' };
  if (clean === '/librarian/reports') return { name: 'librarian-reports' };
  if (clean === '/librarian/profile') return { name: 'librarian-profile' };
  if (clean === '/librarian/profile/settings') {
    return { name: 'librarian-profile', section: 'settings' };
  }
  if (clean === '/librarian/profile/password') {
    return { name: 'librarian-profile', section: 'password' };
  }
  if (clean === '/admin-dashboard' || clean === '/admin/dashboard') {
    return { name: 'admin-dashboard' };
  }
  if (clean === '/admin/management') {
    return { name: 'admin-management', section: 'staff' };
  }
  if (clean === '/admin/management/staff') {
    return { name: 'admin-management', section: 'staff' };
  }
  if (clean === '/admin/management/users') {
    return { name: 'admin-management', section: 'users' };
  }
  if (clean === '/admin/management/categories') {
    return { name: 'admin-management', section: 'categories' };
  }
  if (clean === '/admin/management/subjects') {
    return { name: 'admin-management', section: 'subjects' };
  }
  if (clean === '/admin/management/branches') {
    return { name: 'admin-management', section: 'branches' };
  }
  if (clean === '/admin/management/settings') {
    return { name: 'admin-management', section: 'settings' };
  }
  if (clean === '/admin/management/roles') {
    return { name: 'admin-management', section: 'roles' };
  }
  if (clean === '/admin/inventory') return { name: 'admin-inventory' };
  if (clean === '/admin/books/new') return { name: 'admin-add-book' };
  if (clean === '/admin/reports') return { name: 'admin-reports' };
  if (clean === '/admin/audit-logs') return { name: 'admin-audit-logs' };
  if (clean === '/admin/profile') return { name: 'admin-profile', section: 'profile' };
  if (clean === '/admin/profile/password') {
    return { name: 'admin-profile', section: 'password' };
  }
  if (clean === '/recommendations') return { name: 'recommendations' };
  if (clean === '/contact') return { name: 'contact' };
  if (clean === '/privacy') return { name: 'privacy' };
  if (clean === '/terms') return { name: 'terms' };

  return { name: 'home' };
}

export function routeToPathname(route: AppRoute): string {
  switch (route.name) {
    case 'home':
      return '/';
    case 'books':
      return '/books';
    case 'book-detail':
      return `/books/${route.slug}`;
    case 'login':
      return '/login';
    case 'signup':
      return '/signup';
    case 'admin-login':
      return '/admin-login';
    case 'student-dashboard':
      return '/student-dashboard';
    case 'student-search':
      return '/student/search';
    case 'student-recommendations':
      return '/student/recommendations';
    case 'student-my-books':
      return '/student/my-books';
    case 'student-history':
      return '/student/history';
    case 'student-reservations':
      return '/student/reservations';
    case 'student-notifications':
      return '/student/notifications';
    case 'student-profile':
      return '/student/profile';
    case 'librarian-dashboard':
      return '/librarian-dashboard';
    case 'librarian-inventory':
      return '/librarian/inventory';
    case 'librarian-add-book':
      return '/librarian/books/new';
    case 'librarian-issue-books':
      return '/librarian/issue-books';
    case 'librarian-return-books':
      return '/librarian/return-books';
    case 'librarian-reservations':
      return '/librarian/reservations';
    case 'librarian-students':
      return '/librarian/students';
    case 'librarian-overdue':
      return '/librarian/overdue';
    case 'librarian-announcements':
      return '/librarian/announcements';
    case 'librarian-reports':
      return '/librarian/reports';
    case 'librarian-profile':
      return route.section === 'settings' || route.section === 'password'
        ? `/librarian/profile/${route.section}`
        : '/librarian/profile';
    case 'admin-dashboard':
      return '/admin/dashboard';
    case 'admin-management':
      return `/admin/management/${route.section ?? 'staff'}`;
    case 'admin-inventory':
      return '/admin/inventory';
    case 'admin-add-book':
      return '/admin/books/new';
    case 'admin-reports':
      return '/admin/reports';
    case 'admin-audit-logs':
      return '/admin/audit-logs';
    case 'admin-profile':
      return route.section === 'password' ? '/admin/profile/password' : '/admin/profile';
    case 'recommendations':
      return '/recommendations';
    case 'contact':
      return '/contact';
    case 'privacy':
      return '/privacy';
    case 'terms':
      return '/terms';
  }
}
