import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Barcode,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Info,
  Loader2,
  Search,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  formatLibrarianShortDate,
  type LibrarianPermissions,
} from '../../utils/librarianDashboard';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import type {
  InventoryBookItem,
  InventoryPhysicalCopy,
} from '../../utils/librarianInventory';
import {
  calculatePolicyDueDatePreview,
  checkBookReservationConflict,
  createSampleCirculationStore,
  derivePhysicalCopyAvailabilitySummary,
  evaluateStudentEligibility,
  findCopyByScanIdentifier,
  getEligibleCopiesForIssue,
  mapCirculationApiError,
  validateIssueSubmissionReadiness,
  type ActiveBorrowingDetail,
  type CirculationPolicy,
  type CirculationReservationRecord,
  type CirculationStudentRecord,
  type IssueTransactionConfirmation,
} from '../../utils/librarianCirculation';
import {
  CirculationAuthorizationBlocked,
  CirculationBookCover,
  CirculationBorrowingModal,
  CirculationPageHeader,
  CirculationStatusBadge,
  CirculationStudentModal,
  StudentBorrowingSummaryCard,
} from './CirculationSharedComponents';

interface IssueBooksPageProps {
  permissions: LibrarianPermissions;
  prefillStudentId?: number;
  prefillBookId?: number;
  onNavigate: (route: AppRoute) => void;
}

type IssueStep = 1 | 2 | 3 | 4;

export function IssueBooksPage({
  permissions,
  prefillStudentId,
  prefillBookId,
  onNavigate,
}: IssueBooksPageProps) {
  const apiBaseUrl = getApiBaseUrl();
  const hasBackendApi = isBackendConnected();

  const sampleStoreRef = useRef(createSampleCirculationStore());
  const [policy, setPolicy] = useState<CirculationPolicy>(sampleStoreRef.current.policy);

  const [step, setStep] = useState<IssueStep>(1);

  // Step 1: Student search & selection
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState<CirculationStudentRecord[]>(
    sampleStoreRef.current.students
  );
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [studentSearchError, setStudentSearchError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<CirculationStudentRecord | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);

  // Step 2: Book search & Scan Copy
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState<InventoryBookItem[]>(
    sampleStoreRef.current.books
  );
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);
  const [bookSearchError, setBookSearchError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<InventoryBookItem | null>(null);

  const [scanInput, setScanInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  // Step 3: Physical copies & reservation queue
  const [bookCopies, setBookCopies] = useState<InventoryPhysicalCopy[]>(
    sampleStoreRef.current.copies
  );
  const [reservations, setReservations] = useState<CirculationReservationRecord[]>(
    sampleStoreRef.current.reservations
  );
  const [isLoadingCopies, setIsLoadingCopies] = useState(false);
  const [copiesError, setCopiesError] = useState<string | null>(null);
  const [selectedCopy, setSelectedCopy] = useState<InventoryPhysicalCopy | null>(null);

  // Step 4: Submission & Confirmation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedIssue, setConfirmedIssue] = useState<IssueTransactionConfirmation | null>(
    null
  );
  const submitLockRef = useRef(false);

  // Inspection modals
  const [inspectStudentModal, setInspectStudentModal] =
    useState<CirculationStudentRecord | null>(null);
  const [inspectBorrowingModal, setInspectBorrowingModal] =
    useState<ActiveBorrowingDetail | null>(null);

  // Load circulation policy when backend is configured
  useEffect(() => {
    if (!hasBackendApi) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/circulation/policy`,
          { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
        );
        if (res.ok && active) {
          const data = (await res.json()) as Partial<CirculationPolicy>;
          setPolicy((prev) => ({ ...prev, ...data }));
        }
      } catch {
        // Keep safe policy defaults if endpoint unavailable
      }
    })();
    return () => {
      active = false;
    };
  }, [apiBaseUrl, hasBackendApi]);

  // Step 1: Server-side student search (or sample fallback)
  const searchStudents = useCallback(
    async (query: string) => {
      const clean = query.trim();
      setStudentSearchError(null);

      if (!hasBackendApi) {
        const lower = clean.toLowerCase();
        const filtered = !lower
          ? sampleStoreRef.current.students
          : sampleStoreRef.current.students.filter(
              (s) =>
                s.full_name.toLowerCase().includes(lower) ||
                s.student_code.toLowerCase().includes(lower) ||
                s.roll_number.toLowerCase().includes(lower) ||
                s.email.toLowerCase().includes(lower) ||
                String(s.student_id) === lower
            );
        setStudentResults(filtered);
        return;
      }

      setIsSearchingStudents(true);
      try {
        const res = await fetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/students/search?q=${encodeURIComponent(clean)}`,
          { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
        );
        if (res.status === 401) {
          onNavigate({ name: 'admin-login' });
          return;
        }
        if (!res.ok) {
          throw new Error(mapCirculationApiError(res.status));
        }
        const data = (await res.json()) as { items?: CirculationStudentRecord[] };
        setStudentResults(data.items ?? []);
      } catch (err) {
        setStudentSearchError(
          err instanceof Error ? err.message : 'Unable to search student records.'
        );
      } finally {
        setIsSearchingStudents(false);
      }
    },
    [apiBaseUrl, hasBackendApi, onNavigate]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void searchStudents(studentQuery);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchStudents, studentQuery]);

  // Select student + fetch backend eligibility
  const handleSelectStudent = async (student: CirculationStudentRecord) => {
    setSubmitError(null);
    setSelectedCopy(null);

    if (!hasBackendApi) {
      setSelectedStudent(student);
      return;
    }

    setIsCheckingEligibility(true);
    try {
      const res = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/students/${student.student_id}/eligibility`,
        { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
      );
      if (res.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }
      if (!res.ok) {
        throw new Error(mapCirculationApiError(res.status));
      }
      const data = (await res.json()) as Partial<CirculationStudentRecord>;
      setSelectedStudent({ ...student, ...data });
    } catch (err) {
      setStudentSearchError(
        err instanceof Error ? err.message : 'Unable to verify student eligibility.'
      );
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  // Step 2: Server-side book search
  const searchBooks = useCallback(
    async (query: string) => {
      const clean = query.trim();
      setBookSearchError(null);

      if (!hasBackendApi) {
        const lower = clean.toLowerCase();
        const filtered = !lower
          ? sampleStoreRef.current.books
          : sampleStoreRef.current.books.filter(
              (b) =>
                b.title.toLowerCase().includes(lower) ||
                b.authors.toLowerCase().includes(lower) ||
                b.isbn.toLowerCase().includes(lower) ||
                b.subject.toLowerCase().includes(lower) ||
                b.category.toLowerCase().includes(lower) ||
                b.keywords.some((k) => k.toLowerCase().includes(lower))
            );
        setBookResults(filtered);
        return;
      }

      setIsSearchingBooks(true);
      try {
        const res = await fetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/books/search?q=${encodeURIComponent(clean)}`,
          { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
        );
        if (res.status === 401) {
          onNavigate({ name: 'admin-login' });
          return;
        }
        if (!res.ok) {
          throw new Error(mapCirculationApiError(res.status));
        }
        const data = (await res.json()) as {
          items?: InventoryBookItem[];
          copies?: InventoryPhysicalCopy[];
          reservations?: CirculationReservationRecord[];
        };
        setBookResults(data.items ?? []);
        if (Array.isArray(data.copies)) setBookCopies(data.copies);
        if (Array.isArray(data.reservations)) setReservations(data.reservations);
      } catch (err) {
        setBookSearchError(err instanceof Error ? err.message : 'Unable to search books.');
      } finally {
        setIsSearchingBooks(false);
      }
    },
    [apiBaseUrl, hasBackendApi, onNavigate]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void searchBooks(bookQuery);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [bookQuery, searchBooks]);

  // Load copies + active reservations for selected book
  const loadBookCopiesAndQueue = useCallback(
    async (book: InventoryBookItem) => {
      setCopiesError(null);
      if (!hasBackendApi) {
        setBookCopies(sampleStoreRef.current.copies);
        setReservations(sampleStoreRef.current.reservations);
        return;
      }

      setIsLoadingCopies(true);
      try {
        const res = await fetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/books/${book.book_id}/copies`,
          { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
        );
        if (res.status === 401) {
          onNavigate({ name: 'admin-login' });
          return;
        }
        if (!res.ok) {
          throw new Error(mapCirculationApiError(res.status));
        }
        const data = (await res.json()) as {
          items?: InventoryPhysicalCopy[];
          reservations?: CirculationReservationRecord[];
        };
        if (Array.isArray(data.items)) {
          setBookCopies((prev) => [
            ...prev.filter((c) => c.book_id !== book.book_id),
            ...data.items!,
          ]);
        }
        if (Array.isArray(data.reservations)) {
          setReservations((prev) => [
            ...prev.filter((r) => r.book_id !== book.book_id),
            ...data.reservations!,
          ]);
        }
      } catch (err) {
        setCopiesError(
          err instanceof Error ? err.message : 'Unable to retrieve physical book copies.'
        );
      } finally {
        setIsLoadingCopies(false);
      }
    },
    [apiBaseUrl, hasBackendApi, onNavigate]
  );

  const appliedPrefillRef = useRef<string | null>(null);

  useEffect(() => {
    if (!prefillStudentId && !prefillBookId) return;
    const prefillKey = `${prefillStudentId ?? ''}:${prefillBookId ?? ''}`;
    if (appliedPrefillRef.current === prefillKey) return;
    appliedPrefillRef.current = prefillKey;

    let active = true;
    (async () => {
      let matchedStudent: CirculationStudentRecord | null = null;
      if (prefillStudentId) {
        if (!hasBackendApi) {
          matchedStudent =
            sampleStoreRef.current.students.find((s) => s.student_id === prefillStudentId) ?? null;
        } else {
          setIsCheckingEligibility(true);
          try {
            const res = await fetch(
              `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/students/${prefillStudentId}/eligibility`,
              { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
            );
            if (res.ok && active) {
              matchedStudent = (await res.json()) as CirculationStudentRecord;
            }
          } catch {
            // Fall through gracefully
          } finally {
            if (active) setIsCheckingEligibility(false);
          }
        }
        if (matchedStudent && active) {
          setSelectedStudent(matchedStudent);
          setStudentQuery(matchedStudent.student_code || matchedStudent.full_name);
        }
      }

      let loadedCopies = sampleStoreRef.current.copies;
      let loadedReservations = sampleStoreRef.current.reservations;

      if (prefillBookId && active) {
        let matchedBook: InventoryBookItem | null = null;
        if (!hasBackendApi) {
          matchedBook =
            sampleStoreRef.current.books.find((b) => b.book_id === prefillBookId) ?? null;
        } else {
          try {
            const res = await fetch(
              `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/books/search?q=${encodeURIComponent(String(prefillBookId))}`,
              { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
            );
            if (res.ok && active) {
              const data = (await res.json()) as {
                items?: InventoryBookItem[];
                copies?: InventoryPhysicalCopy[];
                reservations?: CirculationReservationRecord[];
              };
              matchedBook =
                (data.items ?? []).find((b) => b.book_id === prefillBookId) ??
                data.items?.[0] ??
                null;
              if (Array.isArray(data.copies)) {
                loadedCopies = data.copies;
                setBookCopies(data.copies);
              }
              if (Array.isArray(data.reservations)) {
                loadedReservations = data.reservations;
                setReservations(data.reservations);
              }
            }
          } catch {
            // Ignore non-fatal prefill fetch error
          }
        }
        if (matchedBook && active) {
          setSelectedBook(matchedBook);
          setBookQuery(matchedBook.isbn || matchedBook.title);
          if (hasBackendApi) {
            void loadBookCopiesAndQueue(matchedBook);
          }
        }
      }

      if (matchedStudent && active) {
        const eligibility = evaluateStudentEligibility({
          student: matchedStudent,
          selectedBookId: prefillBookId ?? null,
          copies: loadedCopies,
          reservations: loadedReservations,
        });
        if (eligibility.eligible) {
          setStep(prefillBookId ? 3 : 2);
        } else {
          setStep(1);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [apiBaseUrl, hasBackendApi, loadBookCopiesAndQueue, prefillBookId, prefillStudentId]);

  const handleSelectBook = async (book: InventoryBookItem) => {
    setSelectedBook(book);
    setSelectedCopy(null);
    setSubmitError(null);
    setScanFeedback(null);
    await loadBookCopiesAndQueue(book);
  };

  const handleScanBookCopyLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setScanFeedback(null);
    const trimmed = scanInput.trim();
    if (!trimmed) {
      setScanFeedback('Enter a Copy ID, Accession Number, or Barcode to look up.');
      return;
    }

    if (hasBackendApi) {
      try {
        const res = await fetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/copies/lookup?code=${encodeURIComponent(trimmed)}`,
          { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
        );
        if (res.ok) {
          const data = (await res.json()) as {
            copy?: InventoryPhysicalCopy;
            book?: InventoryBookItem;
          };
          if (data.copy && data.book) {
            setSelectedBook(data.book);
            setSelectedCopy(data.copy);
            await loadBookCopiesAndQueue(data.book);
            setScanFeedback(
              `Located copy ${data.copy.accession_number} (${data.copy.status}) for "${data.book.title}".`
            );
            return;
          }
        }
      } catch {
        // Fall through to helpful message
      }
    }

    const found = findCopyByScanIdentifier(trimmed, bookCopies, bookResults);
    if (!found) {
      setScanFeedback(`No physical copy matched "${trimmed}". Verify accession number or barcode.`);
      return;
    }

    setSelectedBook(found.book);
    setSelectedCopy(found.copy);
    setScanFeedback(
      `Located copy ${found.copy.accession_number} (${found.copy.status}) for "${found.book.title}".`
    );
  };

  const currentStudentEligibility = useMemo(() => {
    if (!selectedStudent) return null;
    return evaluateStudentEligibility({
      student: selectedStudent,
      selectedBookId: selectedBook?.book_id ?? null,
      copies: bookCopies,
      reservations,
    });
  }, [bookCopies, reservations, selectedBook, selectedStudent]);

  const currentBookQueueCheck = useMemo(() => {
    if (!selectedStudent || !selectedBook) return null;
    return checkBookReservationConflict({
      studentId: selectedStudent.student_id,
      bookId: selectedBook.book_id,
      copies: bookCopies,
      reservations,
    });
  }, [bookCopies, reservations, selectedBook, selectedStudent]);

  const copiesForSelectedBook = useMemo(() => {
    if (!selectedBook) return [];
    return bookCopies.filter((c) => c.book_id === selectedBook.book_id);
  }, [bookCopies, selectedBook]);

  const assignableCopies = useMemo(() => {
    if (!selectedBook || !selectedStudent) return [];
    return getEligibleCopiesForIssue({
      bookId: selectedBook.book_id,
      studentId: selectedStudent.student_id,
      copies: bookCopies,
      reservations,
    });
  }, [bookCopies, reservations, selectedBook, selectedStudent]);

  const dueDatePreview = useMemo(
    () =>
      calculatePolicyDueDatePreview(
        policy.server_reference_iso,
        policy.default_loan_duration_days
      ),
    [policy.default_loan_duration_days, policy.server_reference_iso]
  );

  const handleConfirmIssue = async () => {
    if (submitLockRef.current || isSubmitting) return;
    setSubmitError(null);

    const check = validateIssueSubmissionReadiness({
      student: selectedStudent,
      book: selectedBook,
      copy: selectedCopy,
      copies: bookCopies,
      reservations,
    });

    if (!check.valid) {
      setSubmitError(check.error ?? 'Issue validation failed.');
      return;
    }

    if (!hasBackendApi) {
      setSubmitError(
        'Pre-issue validation passed cleanly, but issuing a physical book requires VITE_API_BASE_URL to be configured so POST /api/librarian/borrowings can verify live concurrency, assign the authoritative due date, create the borrowing record, update copy status to Issued, and notify the student.'
      );
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/borrowings`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            student_id: selectedStudent!.student_id,
            book_id: selectedBook!.book_id,
            copy_id: selectedCopy!.copy_id,
            reservation_id: currentBookQueueCheck?.entitledReservation?.reservation_id ?? null,
          }),
        }
      );

      if (response.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }

      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | null;
        if (response.status === 409 && selectedBook) {
          await loadBookCopiesAndQueue(selectedBook);
          setSelectedCopy(null);
        }
        throw new Error(
          mapCirculationApiError(response.status, errBody?.message ?? errBody?.error)
        );
      }

      const confirmed = (await response.json()) as Partial<IssueTransactionConfirmation>;
      if (
        typeof confirmed.borrowing_id !== 'number' ||
        !confirmed.due_date ||
        !confirmed.issue_date
      ) {
        throw new Error(
          'Backend returned an incomplete confirmation without borrowing ID or official dates.'
        );
      }

      setConfirmedIssue({
        transaction_id: confirmed.transaction_id ?? null,
        borrowing_id: confirmed.borrowing_id,
        student_id: confirmed.student_id ?? selectedStudent!.student_id,
        student_name: confirmed.student_name ?? selectedStudent!.full_name,
        student_code: confirmed.student_code ?? selectedStudent!.student_code,
        book_id: confirmed.book_id ?? selectedBook!.book_id,
        book_title: confirmed.book_title ?? selectedBook!.title,
        copy_id: confirmed.copy_id ?? selectedCopy!.copy_id,
        accession_number: confirmed.accession_number ?? selectedCopy!.accession_number,
        issue_date: confirmed.issue_date,
        due_date: confirmed.due_date,
        loan_duration_days:
          confirmed.loan_duration_days ?? policy.default_loan_duration_days,
        librarian_name: confirmed.librarian_name ?? 'Verified Librarian',
        in_app_notification_created: Boolean(confirmed.in_app_notification_created),
        email_notification_sent: Boolean(confirmed.email_notification_sent),
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Unable to issue physical copy. Check server connection and retry.'
      );
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleResetIssueWorkflow = () => {
    setStep(1);
    setSelectedStudent(null);
    setSelectedBook(null);
    setSelectedCopy(null);
    setScanInput('');
    setScanFeedback(null);
    setSubmitError(null);
    setConfirmedIssue(null);
  };

  if (!permissions.can_issue_books) {
    return (
      <CirculationAuthorizationBlocked
        title="Book Issuing Restricted"
        message="Your staff account does not currently hold permission to issue library books."
        onNavigate={onNavigate}
      />
    );
  }

  const workflowSteps: Array<{ num: IssueStep; label: string }> = [
    { num: 1, label: 'Select Student' },
    { num: 2, label: 'Select Book' },
    { num: 3, label: 'Select Copy' },
    { num: 4, label: 'Review & Confirm' },
  ];

  return (
    <div className="space-y-6">
      <CirculationPageHeader
        title="Issue Books"
        subtitle="Issue an available physical book copy to an eligible student."
        onNavigate={onNavigate}
      />

      {!hasBackendApi && !confirmedIssue && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#DBEAFE] bg-white px-4 py-3 text-xs text-[#142B4A] shadow-xs">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
          <p>
            Sample circulation records are loaded for student eligibility, reservation queue, and
            physical copy selection previews while{' '}
            <span className="font-mono-tabular font-semibold">VITE_API_BASE_URL</span> is
            unconfigured. Authoritative issue commitment requires{' '}
            <span className="font-mono-tabular font-semibold">POST /api/librarian/borrowings</span>.
          </p>
        </div>
      )}

      {confirmedIssue ? (
        <section
          aria-live="polite"
          className="mx-auto max-w-3xl rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs sm:p-8"
        >
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
            </span>
            <h3 className="font-display mt-4 text-2xl font-bold text-[#142B4A]">
              Book Issued Successfully
            </h3>
            <p className="mt-1 text-sm text-[#64748B]">
              The borrowing transaction has been committed atomically and copy status updated to
              Issued.
            </p>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-[#F5F8FC] p-4 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-[#64748B]">Student</dt>
              <dd className="mt-0.5 font-semibold text-[#142B4A]">
                {confirmedIssue.student_name}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Student ID</dt>
              <dd className="font-mono-tabular mt-0.5 font-semibold text-[#142B4A]">
                {confirmedIssue.student_code}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Book</dt>
              <dd className="mt-0.5 font-semibold text-[#142B4A]">
                {confirmedIssue.book_title}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Copy ID / Accession Number</dt>
              <dd className="font-mono-tabular mt-0.5 font-semibold text-[#142B4A]">
                #{confirmedIssue.copy_id} · {confirmedIssue.accession_number}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Issue Date</dt>
              <dd className="font-mono-tabular mt-0.5 text-[#1E293B]">
                {formatLibrarianShortDate(confirmedIssue.issue_date)}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Due Date</dt>
              <dd className="font-mono-tabular mt-0.5 font-bold text-[#2563EB]">
                {formatLibrarianShortDate(confirmedIssue.due_date)}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Processed By</dt>
              <dd className="mt-0.5 text-[#1E293B]">{confirmedIssue.librarian_name}</dd>
            </div>
            {confirmedIssue.transaction_id && (
              <div>
                <dt className="text-[#64748B]">Transaction ID</dt>
                <dd className="font-mono-tabular mt-0.5 font-semibold text-[#142B4A]">
                  {confirmedIssue.transaction_id}
                </dd>
              </div>
            )}
          </dl>

          {confirmedIssue.in_app_notification_created && (
            <div className="mt-4 rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] px-4 py-3 text-xs text-[#142B4A]">
              <strong>Student In-App Notification Created:</strong> &ldquo;
              {confirmedIssue.book_title} has been issued to your account and is due on{' '}
              {formatLibrarianShortDate(confirmedIssue.due_date)}.&rdquo;
              {confirmedIssue.email_notification_sent && (
                <span className="mt-1 block text-[#64748B]">
                  Confirmation email delivered via library notification service.
                </span>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {selectedStudent && (
              <button
                type="button"
                onClick={() => setInspectStudentModal(selectedStudent)}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
              >
                View Student
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setInspectBorrowingModal({
                  borrowing_id: confirmedIssue.borrowing_id,
                  transaction_code:
                    confirmedIssue.transaction_id ?? `TXN-${confirmedIssue.borrowing_id}`,
                  student_id: confirmedIssue.student_id,
                  student_name: confirmedIssue.student_name,
                  student_code: confirmedIssue.student_code,
                  student_email: selectedStudent?.email ?? '',
                  student_department: selectedStudent?.department ?? '',
                  student_account_status: selectedStudent?.account_status ?? 'Active',
                  book_id: confirmedIssue.book_id,
                  book_title: confirmedIssue.book_title,
                  book_author: selectedBook?.authors ?? '',
                  book_isbn: selectedBook?.isbn ?? '',
                  book_cover: selectedBook?.cover_image ?? '',
                  copy_id: confirmedIssue.copy_id,
                  accession_number: confirmedIssue.accession_number,
                  barcode: selectedCopy?.barcode ?? null,
                  shelf_location: selectedBook
                    ? `${selectedBook.branch} · ${selectedBook.shelf}`
                    : '',
                  copy_condition: selectedCopy?.condition ?? 'New',
                  copy_status: 'Issued',
                  issue_date: confirmedIssue.issue_date,
                  due_date: confirmedIssue.due_date,
                  return_date: null,
                  status: 'Issued',
                })
              }
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
            >
              View Borrowing
            </button>
            <button
              type="button"
              onClick={handleResetIssueWorkflow}
              className="min-h-[40px] rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              Issue Another Book
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'librarian-dashboard' })}
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Guided Stepper Bar */}
          <nav
            aria-label="Issue book workflow steps"
            className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs sm:grid-cols-4 sm:gap-3"
          >
            {workflowSteps.map((ws) => {
              const isCurrent = step === ws.num;
              const isCompleted =
                (ws.num === 1 && Boolean(selectedStudent) && step > 1) ||
                (ws.num === 2 && Boolean(selectedBook) && step > 2) ||
                (ws.num === 3 && Boolean(selectedCopy) && step > 3);
              const isClickable =
                ws.num === 1 ||
                (ws.num === 2 && Boolean(selectedStudent) && Boolean(currentStudentEligibility?.eligible)) ||
                (ws.num === 3 &&
                  Boolean(selectedStudent) &&
                  Boolean(selectedBook) &&
                  Boolean(currentStudentEligibility?.eligible) &&
                  Boolean(currentBookQueueCheck?.allowed)) ||
                (ws.num === 4 &&
                  Boolean(selectedStudent) &&
                  Boolean(selectedBook) &&
                  Boolean(selectedCopy));

              return (
                <button
                  key={ws.num}
                  type="button"
                  disabled={!isClickable}
                  onClick={() => {
                    if (isClickable) setStep(ws.num);
                  }}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex min-h-[44px] items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                    isCurrent
                      ? 'border-[#2563EB] bg-[#F5F8FC] text-[#142B4A]'
                      : isCompleted
                        ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900 hover:bg-emerald-50 cursor-pointer'
                        : isClickable
                          ? 'border-slate-200 bg-white text-[#1E293B] hover:border-[#2563EB] cursor-pointer'
                          : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span
                    className={`font-mono-tabular inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                      isCurrent
                        ? 'bg-[#2563EB] text-white'
                        : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {ws.num}
                  </span>
                  <span className="truncate">{ws.label}</span>
                </button>
              );
            })}
          </nav>

          {/* STEP 1 — SELECT STUDENT & VERIFY ELIGIBILITY */}
          {step === 1 && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
              <div className="mb-4">
                <h3 className="font-display text-lg font-bold text-[#142B4A]">
                  Step 1 — Select Student & Verify Eligibility
                </h3>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  Search by Student ID, Roll Number, Full Name, or University Email.
                </p>
              </div>

              <div className="relative">
                <label htmlFor="issue-student-search" className="sr-only">
                  Search student by ID, roll number, name, or email
                </label>
                <Search
                  className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="issue-student-search"
                  type="search"
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="Search by Student ID (e.g. STU-2026-063), Roll Number, Name, or Email..."
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white py-2 pr-4 pl-10 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                />
              </div>

              {studentSearchError && (
                <div
                  role="alert"
                  className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-900"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{studentSearchError}</span>
                </div>
              )}

              {isSearchingStudents ? (
                <div className="mt-4 space-y-2 animate-pulse">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-14 rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : studentResults.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-[#F5F8FC] p-6 text-center text-xs text-[#64748B]">
                  No student records matched &ldquo;{studentQuery.trim()}&rdquo;. Verify Student
                  ID, Roll Number, or Email.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  {studentResults.map((student) => {
                    const isPicked = selectedStudent?.student_id === student.student_id;
                    return (
                      <div
                        key={student.student_id}
                        className={`flex flex-col justify-between gap-3 rounded-xl border p-3.5 transition-colors sm:flex-row sm:items-center ${
                          isPicked
                            ? 'border-[#2563EB] bg-[#F5F8FC]'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-bold text-[#142B4A]">
                              {student.full_name}
                            </p>
                            <CirculationStatusBadge status={student.account_status} />
                          </div>
                          <p className="mt-0.5 text-xs text-[#64748B]">
                            <span className="font-mono-tabular font-semibold text-[#142B4A]">
                              {student.student_code}
                            </span>{' '}
                            · {student.department}
                          </p>
                          <p className="font-mono-tabular mt-0.5 text-[11px] text-[#64748B]">
                            Current Loans: {student.active_loans_count} /{' '}
                            {student.max_borrowing_limit}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleSelectStudent(student)}
                          aria-label={
                            isPicked
                              ? `Selected student ${student.full_name} (${student.student_code})`
                              : `Select student ${student.full_name} (${student.student_code})`
                          }
                          className={`min-h-[38px] shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                            isPicked
                              ? 'bg-[#142B4A] text-white'
                              : 'border border-slate-300 bg-white text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB]'
                          }`}
                        >
                          {isPicked ? 'Selected' : 'Select Student'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {isCheckingEligibility && (
                <div className="mt-4 flex items-center gap-2 text-xs text-[#64748B]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" aria-hidden="true" />
                  <span>Verifying student eligibility & active loan counts...</span>
                </div>
              )}

              {selectedStudent && currentStudentEligibility && !isCheckingEligibility && (
                <div className="mt-6 space-y-4">
                  <StudentBorrowingSummaryCard
                    student={selectedStudent}
                    eligibility={currentStudentEligibility}
                    onInspectStudent={() => setInspectStudentModal(selectedStudent)}
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!currentStudentEligibility.eligible}
                      onClick={() => setStep(2)}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      <span>Continue to Select Book</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* STEP 2 — SELECT BOOK & RESERVATION CHECK */}
          {step === 2 && selectedStudent && (
            <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
              <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#142B4A]">
                    Step 2 — Select Book & Check Reservations
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Issuing to{' '}
                    <strong className="text-[#142B4A]">{selectedStudent.full_name}</strong> (
                    <span className="font-mono-tabular">{selectedStudent.student_code}</span> ·
                    Remaining capacity: {selectedStudent.remaining_capacity})
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Change Student</span>
                </button>
              </div>

              {/* Manual Barcode / Accession Quick Scan (No fake webcam) */}
              <form
                onSubmit={handleScanBookCopyLookup}
                className="rounded-xl border border-slate-200 bg-[#F5F8FC]/70 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label
                      htmlFor="issue-scan-copy-input"
                      className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#142B4A]"
                    >
                      <Barcode className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                      <span>Scan Book Copy (Barcode / Accession Number / Copy ID)</span>
                    </label>
                    <input
                      id="issue-scan-copy-input"
                      type="text"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      placeholder="Enter or scan barcode (e.g. BC-04-0016 or LIB-2026-0016)"
                      className="font-mono-tabular min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="min-h-[40px] shrink-0 rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e3d66] whitespace-nowrap cursor-pointer"
                  >
                    Scan Book Copy
                  </button>
                </div>
                {scanFeedback && (
                  <p className="mt-2 text-xs font-medium text-[#142B4A]">{scanFeedback}</p>
                )}
              </form>

              {/* Book Search */}
              <div className="relative">
                <label htmlFor="issue-book-search" className="sr-only">
                  Search books by title, author, ISBN, subject, category, or keyword
                </label>
                <Search
                  className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="issue-book-search"
                  type="search"
                  value={bookQuery}
                  onChange={(e) => setBookQuery(e.target.value)}
                  placeholder="Search catalogue by Title, Author, ISBN, Subject, Category, or Keyword..."
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white py-2 pr-4 pl-10 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                />
              </div>

              {bookSearchError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-900"
                >
                  {bookSearchError}
                </div>
              )}

              {isSearchingBooks ? (
                <div className="space-y-2 animate-pulse">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-20 rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : bookResults.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-[#F5F8FC] p-6 text-center text-xs text-[#64748B]">
                  Book not found for &ldquo;{bookQuery.trim()}&rdquo;.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {bookResults.map((book) => {
                    const copyStats = derivePhysicalCopyAvailabilitySummary(
                      bookCopies,
                      book.book_id
                    );
                    const isSelected = selectedBook?.book_id === book.book_id;
                    const eligibleCopiesCount = getEligibleCopiesForIssue({
                      bookId: book.book_id,
                      studentId: selectedStudent.student_id,
                      copies: bookCopies,
                      reservations,
                    }).length;

                    return (
                      <div
                        key={book.book_id}
                        className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 ${
                          isSelected
                            ? 'border-[#2563EB] bg-[#F5F8FC]'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <CirculationBookCover src={book.cover_image} title={book.title} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#142B4A]">
                              {book.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[#64748B]">
                              {book.authors}
                            </p>
                            <p className="font-mono-tabular mt-0.5 text-[11px] text-[#64748B]">
                              ISBN: {book.isbn} · {book.category}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <CirculationStatusBadge status={copyStats.label} />
                              {copyStats.reservedCopies > 0 && (
                                <span className="font-mono-tabular text-[11px] font-medium text-amber-800">
                                  {copyStats.reservedCopies} reserved hold
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleSelectBook(book)}
                          aria-label={
                            isSelected
                              ? `Selected book ${book.title}`
                              : `Select book ${book.title}`
                          }
                          className={`min-h-[38px] shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                            isSelected
                              ? 'bg-[#142B4A] text-white'
                              : eligibleCopiesCount > 0 || copyStats.reservedCopies > 0
                                ? 'border border-slate-300 bg-white text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB]'
                                : 'border border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select Book'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Selected Book Eligibility + Reservation Priority Result */}
              {selectedBook && currentStudentEligibility && currentBookQueueCheck && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  {!currentStudentEligibility.eligible &&
                    currentBookQueueCheck.status !== 'blocked_by_queue' && (
                      <div
                        role="alert"
                        className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-900"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                        <div>
                          <p className="font-bold">Cannot Issue Selected Book</p>
                          <p className="mt-0.5">{currentStudentEligibility.message}</p>
                        </div>
                      </div>
                    )}

                  {currentBookQueueCheck.status === 'blocked_by_queue' && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-950"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" aria-hidden="true" />
                      <div>
                        <p className="font-bold">Reservation Queue Priority Warning</p>
                        <p className="mt-0.5">{currentBookQueueCheck.message}</p>
                      </div>
                    </div>
                  )}

                  {currentStudentEligibility.eligible &&
                    currentBookQueueCheck.status === 'entitled_hold' && (
                      <div
                        role="status"
                        className="flex items-start gap-2.5 rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] px-4 py-3 text-xs font-medium text-[#142B4A]"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
                        <span>{currentBookQueueCheck.message}</span>
                      </div>
                    )}

                  {currentStudentEligibility.eligible &&
                    currentBookQueueCheck.allowed &&
                    assignableCopies.length === 0 && (
                      <div
                        role="alert"
                        className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-900"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                          No eligible physical copies are currently available on shelf for this
                          title.
                        </span>
                      </div>
                    )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={
                        !currentStudentEligibility.eligible ||
                        !currentBookQueueCheck.allowed ||
                        assignableCopies.length === 0
                      }
                      onClick={() => {
                        if (
                          selectedCopy &&
                          assignableCopies.some((c) => c.copy_id === selectedCopy.copy_id)
                        ) {
                          setStep(4);
                        } else {
                          setStep(3);
                        }
                      }}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      <span>Continue to Physical Copy</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* STEP 3 — SELECT PHYSICAL COPY */}
          {step === 3 && selectedStudent && selectedBook && (
            <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
              <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#142B4A]">
                    Step 3 — Select Physical Copy
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Select exactly one physical volume of{' '}
                    <strong className="text-[#142B4A]">{selectedBook.title}</strong> to issue to{' '}
                    <strong className="text-[#142B4A]">{selectedStudent.full_name}</strong> (
                    <span className="font-mono-tabular">{selectedStudent.student_code}</span>).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Change Book</span>
                </button>
              </div>

              {copiesError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-900"
                >
                  {copiesError}
                </div>
              )}

              {isLoadingCopies ? (
                <div className="space-y-2 animate-pulse">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-12 rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-[#F5F8FC] text-[11px] font-semibold text-[#64748B]">
                          <th scope="col" className="px-3.5 py-2.5">
                            Copy ID
                          </th>
                          <th scope="col" className="px-3.5 py-2.5">
                            Accession Number
                          </th>
                          <th scope="col" className="px-3.5 py-2.5">
                            Location
                          </th>
                          <th scope="col" className="px-3.5 py-2.5">
                            Condition
                          </th>
                          <th scope="col" className="px-3.5 py-2.5">
                            Status
                          </th>
                          <th scope="col" className="px-3.5 py-2.5 text-right">
                            Select
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {copiesForSelectedBook.map((copy) => {
                          const canAssign = assignableCopies.some(
                            (a) => a.copy_id === copy.copy_id
                          );
                          const isSelected = selectedCopy?.copy_id === copy.copy_id;
                          return (
                            <tr
                              key={copy.copy_id}
                              className={
                                isSelected
                                  ? 'bg-[#F5F8FC]'
                                  : canAssign
                                    ? 'hover:bg-[#F5F8FC]/60'
                                    : 'bg-slate-50/50 text-slate-500'
                              }
                            >
                              <td className="font-mono-tabular px-3.5 py-3 font-semibold text-[#142B4A]">
                                #{copy.copy_id}
                              </td>
                              <td className="font-mono-tabular px-3.5 py-3 font-medium text-[#142B4A]">
                                {copy.accession_number}
                              </td>
                              <td className="px-3.5 py-3">
                                {copy.branch} · {copy.floor} · {copy.shelf}
                              </td>
                              <td className="px-3.5 py-3">{copy.condition}</td>
                              <td className="px-3.5 py-3">
                                <CirculationStatusBadge status={copy.status} />
                              </td>
                              <td className="px-3.5 py-3 text-right">
                                <button
                                  type="button"
                                  disabled={!canAssign}
                                  onClick={() => setSelectedCopy(copy)}
                                  aria-label={
                                    isSelected
                                      ? `Selected copy ${copy.accession_number}`
                                      : canAssign
                                        ? `Select copy ${copy.accession_number}`
                                        : `Copy ${copy.accession_number} unavailable`
                                  }
                                  className={`min-h-[34px] rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#2563EB] text-white'
                                      : canAssign
                                        ? 'border border-slate-300 bg-white text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB]'
                                        : 'border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                  }`}
                                >
                                  {isSelected
                                    ? 'Selected'
                                    : canAssign
                                      ? 'Select Copy'
                                      : 'Unavailable'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List */}
                  <div className="space-y-3 md:hidden">
                    {copiesForSelectedBook.map((copy) => {
                      const canAssign = assignableCopies.some(
                        (a) => a.copy_id === copy.copy_id
                      );
                      const isSelected = selectedCopy?.copy_id === copy.copy_id;
                      return (
                        <div
                          key={copy.copy_id}
                          className={`rounded-xl border p-3.5 text-xs ${
                            isSelected ? 'border-[#2563EB] bg-[#F5F8FC]' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono-tabular font-bold text-[#142B4A]">
                              #{copy.copy_id} · {copy.accession_number}
                            </span>
                            <CirculationStatusBadge status={copy.status} />
                          </div>
                          <p className="mt-1.5 text-[#64748B]">
                            {copy.branch} · {copy.floor} · Shelf {copy.shelf}
                          </p>
                          <p className="mt-0.5 text-[#1E293B]">Condition: {copy.condition}</p>
                          <button
                            type="button"
                            disabled={!canAssign}
                            onClick={() => setSelectedCopy(copy)}
                            aria-label={
                              isSelected
                                ? `Selected copy ${copy.accession_number}`
                                : canAssign
                                  ? `Select copy ${copy.accession_number}`
                                  : `Copy ${copy.accession_number} unavailable`
                            }
                            className={`mt-3 min-h-[38px] w-full rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer ${
                              isSelected
                                ? 'bg-[#2563EB] text-white'
                                : canAssign
                                  ? 'border border-slate-300 bg-white text-[#142B4A]'
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {isSelected
                              ? 'Selected Physical Copy'
                              : canAssign
                                ? 'Select Copy'
                                : 'Unavailable for Issue'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!selectedCopy}
                  onClick={() => setStep(4)}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  <span>Review Loan & Confirm</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </section>
          )}

          {/* STEP 4 — LOAN DETAILS & REVIEW */}
          {step === 4 && selectedStudent && selectedBook && selectedCopy && (
            <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-display text-lg font-bold text-[#142B4A]">
                  Step 4 — Review Loan & Confirm Issue
                </h3>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  Review student eligibility, selected physical copy, and server-policy loan dates
                  prior to atomic confirmation.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Student Summary */}
                <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
                  <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 text-xs font-bold text-[#142B4A]">
                    <UserCheck className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                    <span>Student</span>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Name</dt>
                      <dd className="font-semibold text-[#142B4A]">{selectedStudent.full_name}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Student ID</dt>
                      <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                        {selectedStudent.student_code}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Department</dt>
                      <dd className="text-right text-[#1E293B]">{selectedStudent.department}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Current Loans</dt>
                      <dd className="font-mono-tabular text-[#142B4A]">
                        {selectedStudent.active_loans_count} / {selectedStudent.max_borrowing_limit}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Eligibility</dt>
                      <dd>
                        <CirculationStatusBadge
                          status={
                            currentStudentEligibility?.eligible
                              ? 'Eligible for borrowing'
                              : 'Blocked'
                          }
                        />
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Book Summary */}
                <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
                  <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 text-xs font-bold text-[#142B4A]">
                    <BookOpen className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                    <span>Book</span>
                  </div>
                  <div className="mt-3 flex items-start gap-3">
                    <CirculationBookCover
                      src={selectedBook.cover_image}
                      title={selectedBook.title}
                      size="sm"
                    />
                    <dl className="min-w-0 flex-1 space-y-1 text-xs">
                      <div>
                        <dt className="sr-only">Title</dt>
                        <dd className="font-bold text-[#142B4A]">{selectedBook.title}</dd>
                      </div>
                      <div>
                        <dt className="sr-only">Author</dt>
                        <dd className="text-[#64748B]">{selectedBook.authors}</dd>
                      </div>
                      <div>
                        <dt className="sr-only">ISBN</dt>
                        <dd className="font-mono-tabular text-[11px] text-[#142B4A]">
                          ISBN: {selectedBook.isbn}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Physical Copy Summary */}
                <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
                  <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 text-xs font-bold text-[#142B4A]">
                    <Barcode className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                    <span>Physical Copy</span>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Copy ID</dt>
                      <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                        #{selectedCopy.copy_id}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Accession Number</dt>
                      <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                        {selectedCopy.accession_number}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Location</dt>
                      <dd className="text-right text-[#1E293B]">
                        {selectedCopy.branch} · {selectedCopy.floor} · {selectedCopy.shelf}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Condition</dt>
                      <dd className="text-[#1E293B]">{selectedCopy.condition}</dd>
                    </div>
                  </dl>
                </div>

                {/* Loan Policy Details */}
                <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
                  <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 text-xs font-bold text-[#142B4A]">
                    <CalendarClock className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                    <span>Loan Policy Schedule</span>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Issue Date</dt>
                      <dd className="font-mono-tabular text-[#1E293B]">
                        {formatLibrarianShortDate(policy.server_reference_iso)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Loan Duration</dt>
                      <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                        {policy.default_loan_duration_days} days
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Estimated Due Date</dt>
                      <dd className="font-mono-tabular font-bold text-[#2563EB]">
                        {formatLibrarianShortDate(dueDatePreview)}
                      </dd>
                    </div>
                    <p className="pt-1 text-[11px] text-[#64748B]">
                      Authoritative issue timestamp and final due date are locked and confirmed by
                      the backend policy engine.
                    </p>
                  </dl>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-[#F5F8FC] px-3.5 py-2.5 text-xs text-[#64748B]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
                <p>
                  Submitting calls{' '}
                  <span className="font-mono-tabular font-semibold text-[#142B4A]">
                    POST /api/librarian/borrowings
                  </span>{' '}
                  in an atomic transaction that re-checks copy availability and student limits to
                  prevent concurrent double-issuing.
                </p>
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-900"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={isSubmitting}
                  className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] disabled:opacity-50 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmIssue()}
                  disabled={isSubmitting}
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Issuing Physical Copy...</span>
                    </>
                  ) : (
                    <span>Confirm Issue</span>
                  )}
                </button>
              </div>
            </section>
          )}
        </>
      )}

      <CirculationStudentModal
        student={inspectStudentModal}
        onClose={() => setInspectStudentModal(null)}
      />
      <CirculationBorrowingModal
        borrowing={inspectBorrowingModal}
        onClose={() => setInspectBorrowingModal(null)}
      />
    </div>
  );
}
