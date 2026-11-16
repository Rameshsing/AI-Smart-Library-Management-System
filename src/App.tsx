import React, { useEffect, useState } from 'react';
import type { AppRoute } from './data/libraryData';
import { parseRouteFromPathname, routeToPathname } from './utils/catalogSearch';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { LibraryStatsSection } from './components/LibraryStatsSection';
import { FeaturedBooksSection } from './components/FeaturedBooksSection';
import { RecommendationsSection } from './components/RecommendationsSection';
import { HowItWorksSection } from './components/HowItWorksSection';
import { FeaturesSection } from './components/FeaturesSection';
import { AboutSection } from './components/AboutSection';
import { CtaSection } from './components/CtaSection';
import { Footer } from './components/Footer';
import { PlannedRouteView } from './components/PlannedRouteView';
import { StudentRegistrationPage } from './components/StudentRegistrationPage';
import { LoginPage } from './components/LoginPage';
import { StudentDashboardPage } from './components/student/StudentDashboardPage';
import { BookDetailsPage } from './components/student/BookDetailsPage';
import { LibrarianDashboardPage } from './components/librarian/LibrarianDashboardPage';
import { AdminDashboardPage } from './components/admin/AdminDashboardPage';
import { isStudentSectionRoute } from './utils/studentDashboard';
import { isLibrarianSectionRoute } from './utils/librarianDashboard';
import { isAdminSectionRoute } from './utils/adminDashboard';

const STUDENT_CONTEXT_STORAGE_KEY = 'ai_smart_library_student_context';

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseRouteFromPathname(window.location.pathname)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [studentContextActive, setStudentContextActive] = useState<boolean>(() => {
    const initialRoute = parseRouteFromPathname(window.location.pathname);
    if (isStudentSectionRoute(initialRoute.name)) {
      return true;
    }
    if (isLibrarianSectionRoute(initialRoute.name) || isAdminSectionRoute(initialRoute.name)) {
      return false;
    }
    if (initialRoute.name === 'book-detail' && /^\d+$/.test(initialRoute.slug)) {
      return true;
    }
    try {
      return window.sessionStorage.getItem(STUDENT_CONTEXT_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handlePopState = () => {
      const next = parseRouteFromPathname(window.location.pathname);
      setRoute(next);
      if (isStudentSectionRoute(next.name)) {
        setStudentContextActive(true);
      } else if (
        next.name === 'login' ||
        next.name === 'admin-login' ||
        next.name === 'home' ||
        isLibrarianSectionRoute(next.name) ||
        isAdminSectionRoute(next.name)
      ) {
        setStudentContextActive(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (nextRoute: AppRoute, sectionId?: string) => {
    if (isStudentSectionRoute(nextRoute.name)) {
      setStudentContextActive(true);
      try {
        window.sessionStorage.setItem(STUDENT_CONTEXT_STORAGE_KEY, '1');
      } catch {
        // Ignore storage restrictions
      }
    } else if (
      nextRoute.name === 'login' ||
      nextRoute.name === 'admin-login' ||
      nextRoute.name === 'home' ||
      isLibrarianSectionRoute(nextRoute.name) ||
      isAdminSectionRoute(nextRoute.name)
    ) {
      setStudentContextActive(false);
      try {
        window.sessionStorage.removeItem(STUDENT_CONTEXT_STORAGE_KEY);
      } catch {
        // Ignore storage restrictions
      }
    } else if (nextRoute.name === 'book-detail' && /^\d+$/.test(nextRoute.slug)) {
      setStudentContextActive(true);
      try {
        window.sessionStorage.setItem(STUDENT_CONTEXT_STORAGE_KEY, '1');
      } catch {
        // Ignore storage restrictions
      }
    }

    const targetPath = routeToPathname(nextRoute);
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    setRoute(nextRoute);

    if (nextRoute.name === 'home' && sectionId) {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(sectionId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleHeroSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedCategory('All');
    navigate({ name: 'home' }, 'explore-books');
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
  };

  if (isStudentSectionRoute(route.name)) {
    return <StudentDashboardPage activeRoute={route.name} onNavigate={navigate} />;
  }

  if (isLibrarianSectionRoute(route.name)) {
    return (
      <LibrarianDashboardPage
        activeRoute={route.name}
        routeState={route}
        profileSection={route.name === 'librarian-profile' ? route.section : undefined}
        onNavigate={navigate}
      />
    );
  }

  if (isAdminSectionRoute(route.name)) {
    return (
      <AdminDashboardPage
        activeRoute={route.name}
        routeState={route}
        onNavigate={navigate}
      />
    );
  }

  if (route.name === 'book-detail' && (studentContextActive || /^\d+$/.test(route.slug))) {
    return (
      <StudentDashboardPage
        activeRoute="student-search"
        bookIdentifier={route.slug}
        onNavigate={navigate}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1E293B]">
      <Navbar currentRoute={route} onNavigate={navigate} />

      <main className="flex-1">
        {route.name === 'home' ? (
          <>
            <HeroSection
              searchQuery={searchQuery}
              onSearchSubmit={handleHeroSearch}
              onNavigate={navigate}
            />
            <LibraryStatsSection />
            <FeaturedBooksSection
              searchQuery={searchQuery}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              onSearchChange={setSearchQuery}
              onClearFilters={handleClearFilters}
              onNavigate={navigate}
            />
            <RecommendationsSection onNavigate={navigate} />
            <HowItWorksSection />
            <FeaturesSection />
            <AboutSection />
            <CtaSection onNavigate={navigate} />
          </>
        ) : route.name === 'signup' ? (
          <StudentRegistrationPage onNavigate={navigate} />
        ) : route.name === 'login' ? (
          <LoginPage initialRole="student" onNavigate={navigate} />
        ) : route.name === 'admin-login' ? (
          <LoginPage initialRole="librarian" onNavigate={navigate} />
        ) : route.name === 'book-detail' ? (
          <div className="bg-[#F5F8FC] py-8 sm:py-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <BookDetailsPage
                bookIdentifier={route.slug}
                isStudentContext={false}
                onNavigate={navigate}
              />
            </div>
          </div>
        ) : (
          <PlannedRouteView route={route} onNavigate={navigate} />
        )}
      </main>

      <Footer onNavigate={navigate} />
    </div>
  );
}
