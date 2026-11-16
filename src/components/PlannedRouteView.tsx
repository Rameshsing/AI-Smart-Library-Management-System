import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  Layers,
  Database,
  Sparkles,
} from 'lucide-react';
import { DEMO_BOOKS, type AppRoute } from '../data/libraryData';
import { findDemoBookBySlug } from '../utils/catalogSearch';
import { findCatalogBookByIdentifier, getBookAvailabilityInfo } from '../utils/bookCatalog';
import type { StudentSectionRoute } from '../utils/studentDashboard';
import type { LibrarianSectionRoute } from '../utils/librarianDashboard';
import type { AdminSectionRoute } from '../utils/adminDashboard';
import { BookCard } from './BookCard';

interface PlannedRouteViewProps {
  route: Exclude<AppRoute, { name: 'home' }>;
  onNavigate: (route: AppRoute, sectionId?: string) => void;
}

interface RouteMetadata {
  routePath: string;
  title: string;
  subtitle: string;
  plannedModule: string;
  description: string;
  capabilities: string[];
}

const ROUTE_PLACEHOLDERS: Record<
  Exclude<
    AppRoute['name'],
    | 'home'
    | 'book-detail'
    | 'books'
    | Exclude<StudentSectionRoute, 'student-dashboard'>
    | LibrarianSectionRoute
    | AdminSectionRoute
  >,
  RouteMetadata
> = {
  login: {
    routePath: '/login',
    title: 'Student Login',
    subtitle: 'Planned Authentication Destination',
    plannedModule: 'Flask Session Authentication · MySQL Users Table',
    description:
      'This route is reserved for the Student Login page. Once connected to the Python Flask and MySQL backend, students will sign in here to access their dashboard, borrowing history, and personalized AI recommendations.',
    capabilities: [
      'Student credential verification via Python Flask',
      'Redirect to personalized Student Dashboard',
      'Access to active book reservations and due-date alerts',
    ],
  },
  signup: {
    routePath: '/signup',
    title: 'Student Registration',
    subtitle: 'Planned Onboarding Destination',
    plannedModule: 'Flask Registration API · Learning Interest Capture',
    description:
      'This route is reserved for Student Registration. Students will create an account and select their academic subjects and reading interests to initialize their AI recommendation profile.',
    capabilities: [
      'Create verified student library account',
      'Select preferred subjects and learning topics',
      'Seed content-based & hybrid filtering recommendations',
    ],
  },
  'admin-login': {
    routePath: '/admin-login',
    title: 'Admin & Librarian Login',
    subtitle: 'Planned Staff Portal Destination',
    plannedModule: 'Role-Based Librarian Access · Catalog & Circulation Control',
    description:
      'This route is reserved for Librarian and Administrator sign-in. Staff members will manage book inventory, approve borrowing/return transactions, and monitor overdue notifications.',
    capabilities: [
      'Add, edit, or archive books in MySQL catalog',
      'Process issue, return, and reservation approvals',
      'Review automated due-date notification schedules',
    ],
  },
  'student-dashboard': {
    routePath: '/student-dashboard',
    title: 'Student Dashboard (Protected Route)',
    subtitle: 'Requires Server-Verified Student Session',
    plannedModule: 'Flask Session Guard · Role === "student"',
    description:
      'Access to the Student Dashboard requires a verified Flask authentication session. Direct URL navigation without server authorization will be redirected to Login once connected.',
    capabilities: [
      'Personalized AI book recommendations',
      'Active reservations, borrowed books & due dates',
      'Reading history and saved titles',
    ],
  },
  recommendations: {
    routePath: '/recommendations',
    title: 'Explore Smart Recommendations',
    subtitle: 'Planned AI Discovery Engine Destination',
    plannedModule: 'Python & Pandas · Content-Based & Hybrid Filtering',
    description:
      'Personalized AI recommendations require a registered student account. Once logged in, this view will rank available library books based on your selected interests, reading history, and student ratings.',
    capabilities: [
      'Interest-based topic similarity scoring',
      'Reading history and peer rating analysis',
      'Real-time availability filtering before display',
    ],
  },
  contact: {
    routePath: '/contact',
    title: 'Contact Us',
    subtitle: 'Planned Support & Institutional Inquiry Destination',
    plannedModule: 'Institutional Support Directory',
    description:
      'This route is reserved for institutional contact information and library desk inquiries. Real campus email addresses, library hours, and support forms will be configured during deployment.',
    capabilities: [
      'Library helpdesk email & campus location details',
      'Student & faculty resource request inquiries',
      'Institutional onboarding support',
    ],
  },
  privacy: {
    routePath: '/privacy',
    title: 'Privacy Policy',
    subtitle: 'Planned Policy Documentation',
    plannedModule: 'Student Reading Data & Privacy Governance',
    description:
      'This route is reserved for the platform Privacy Policy, detailing how student borrowing history, ratings, and reading preferences are stored securely for AI recommendations.',
    capabilities: [
      'Transparent handling of student borrowing records',
      'Opt-in reading interest controls',
      'Institutional data retention guidelines',
    ],
  },
  terms: {
    routePath: '/terms',
    title: 'Terms and Conditions',
    subtitle: 'Planned Library Usage Terms',
    plannedModule: 'Academic Borrowing & Platform Rules',
    description:
      'This route is reserved for library usage terms, loan duration policies, reservation holds, and student account responsibilities.',
    capabilities: [
      'Standard borrowing durations and renewal rules',
      'Book reservation hold expiry policies',
      'Responsible academic resource usage guidelines',
    ],
  },
};

export function PlannedRouteView({ route, onNavigate }: PlannedRouteViewProps) {
  const [coverError, setCoverError] = useState(false);

  if (route.name === 'books') {
    return (
      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => onNavigate({ name: 'home' }, 'explore-books')}
            className="inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold text-[#2563EB] hover:underline cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Welcome Page</span>
          </button>

          <div className="mt-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end">
            <div>
              <p className="font-mono-tabular text-xs font-medium text-[#2563EB]">
                Destination Route: /books
              </p>
              <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-[#142B4A]">
                Book Catalogue Preview
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Clean catalogue route destination displaying sample demo book records. Full
                pagination, MySQL query filtering, and reservation actions will be enabled in the
                catalogue module.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'signup' })}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Create Student Account
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_BOOKS.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onViewDetails={(slug) => onNavigate({ name: 'book-detail', slug })}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (route.name === 'book-detail') {
    const demoBook = findDemoBookBySlug(route.slug);
    const catalogBook = demoBook ? undefined : findCatalogBookByIdentifier(route.slug);

    const book = demoBook
      ? {
          routeLabel: `/books/${demoBook.slug}`,
          title: demoBook.title,
          author: demoBook.author,
          category: demoBook.category,
          metaTag: `Shelf: ${demoBook.shelfCode}`,
          publicationYear: demoBook.publicationYear,
          isbn: demoBook.isbnPlaceholder,
          summary: demoBook.summary,
          coverImage: demoBook.coverImage,
          statusText: `${demoBook.status} (${demoBook.availableCopies} of ${demoBook.totalCopies} demo copies)`,
          statusKind:
            demoBook.status === 'Available'
              ? ('available' as const)
              : demoBook.status === 'Limited'
                ? ('reserved' as const)
                : ('issued' as const),
          isCatalogId: false,
        }
      : catalogBook
        ? (() => {
            const avail = getBookAvailabilityInfo(catalogBook);
            return {
              routeLabel: `/books/${catalogBook.book_id}`,
              title: catalogBook.title,
              author: catalogBook.author,
              category: `${catalogBook.category} · ${catalogBook.subject}`,
              metaTag: `${catalogBook.format} · ${catalogBook.language}`,
              publicationYear: catalogBook.publication_year,
              isbn: catalogBook.isbn,
              summary: catalogBook.description,
              coverImage: catalogBook.cover_image,
              statusText: avail.label,
              statusKind: avail.status,
              isCatalogId: true,
            };
          })()
        : null;

    if (!book) {
      return (
        <section className="bg-white py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h1 className="font-display text-2xl font-bold text-[#142B4A]">
              Demo Book Not Found
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              The requested sample book record could not be located.
            </p>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'home' }, 'explore-books')}
              className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Return to Welcome Page</span>
            </button>
          </div>
        </section>
      );
    }

    const statusIcon =
      book.statusKind === 'available' ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
      ) : book.statusKind === 'reserved' ? (
        <AlertCircle className="h-4 w-4 text-amber-700" aria-hidden="true" />
      ) : (
        <Clock className="h-4 w-4 text-slate-600" aria-hidden="true" />
      );

    return (
      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-4">
            {book.isCatalogId ? (
              <button
                type="button"
                onClick={() => onNavigate({ name: 'student-search' })}
                className="inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold text-[#2563EB] hover:underline cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Back to Browse Library</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate({ name: 'home' }, 'explore-books')}
                className="inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold text-[#2563EB] hover:underline cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Back to Welcome Page</span>
              </button>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-[#F5F8FC] p-6 sm:p-10">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
              <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-6 md:col-span-4">
                {!coverError ? (
                  <img
                    src={book.coverImage}
                    alt={`Cover of ${book.title}`}
                    referrerPolicy="no-referrer"
                    onError={() => setCoverError(true)}
                    className="max-h-72 w-auto rounded-md object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-64 w-full flex-col items-center justify-center rounded-md bg-[#142B4A] p-4 text-center text-white">
                    <BookOpen className="h-10 w-10 text-[#DBEAFE]" aria-hidden="true" />
                    <p className="mt-2 text-sm font-semibold">{book.title}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-between md:col-span-8">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                    <span className="font-mono-tabular text-[#2563EB]">
                      Route: {book.routeLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Demo Book Record</span>
                  </div>

                  <h1 className="font-display mt-2 text-2xl font-bold text-[#142B4A] sm:text-3xl">
                    {book.title}
                  </h1>
                  <p className="mt-1 text-base font-medium text-slate-700">{book.author}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span>Category: {book.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{book.metaTag}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">Year: {book.publicationYear}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{book.isbn}</span>
                  </div>

                  <p className="mt-5 text-sm leading-relaxed text-slate-600 sm:text-base">
                    {book.summary}
                  </p>

                  <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#142B4A]">
                    {statusIcon}
                    <span>{book.statusText}</span>
                  </div>
                </div>

                <div className="mt-8 rounded-xl border border-[#DBEAFE] bg-white p-4">
                  <div className="flex items-start gap-3">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
                    <div className="text-xs leading-relaxed text-slate-600">
                      <p className="font-semibold text-[#142B4A]">
                        Planned Book Details &amp; Reservation Integration
                      </p>
                      <p className="mt-1">
                        Live borrowing, hold requests, and AI similarity recommendations for this
                        title will connect to the Python Flask API and MySQL database once the
                        student portal is implemented.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const meta =
    ROUTE_PLACEHOLDERS[route.name as keyof typeof ROUTE_PLACEHOLDERS] ??
    ROUTE_PLACEHOLDERS['student-dashboard'];

  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => onNavigate({ name: 'home' })}
          className="inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold text-[#2563EB] hover:underline cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Welcome Page</span>
        </button>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-[#F5F8FC] p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span className="font-mono-tabular text-[#2563EB]">
              Destination: {meta.routePath}
            </span>
            <span aria-hidden="true">·</span>
            <span>{meta.subtitle}</span>
          </div>

          <h1 className="font-display mt-3 text-2xl font-bold tracking-tight text-[#142B4A] sm:text-3xl">
            {meta.title}
          </h1>

          <p className="mt-3 text-base leading-relaxed text-slate-600">{meta.description}</p>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#142B4A]">
              <Database className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
              <span>Planned Architecture Scope: {meta.plannedModule}</span>
            </div>

            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              {meta.capabilities.map((cap) => (
                <li key={cap} className="flex items-start gap-2.5">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate({ name: 'home' })}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#142B4A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E3A63] cursor-pointer"
            >
              <Layers className="h-4 w-4" aria-hidden="true" />
              <span>Return to Welcome Page</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ name: 'books' })}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
            >
              <span>Browse Demo Catalogue</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
