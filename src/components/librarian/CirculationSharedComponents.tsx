import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Lock,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import { formatLibrarianShortDate } from '../../utils/librarianDashboard';
import type {
  ActiveBorrowingDetail,
  CirculationStudentRecord,
  StudentEligibilityResult,
} from '../../utils/librarianCirculation';

export function CirculationPageHeader({
  title,
  subtitle,
  onNavigate,
}: {
  title: string;
  subtitle: string;
  onNavigate: (route: AppRoute) => void;
}) {
  return (
    <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-[#142B4A] sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1 text-xs text-[#64748B] sm:text-sm">{subtitle}</p>
      </div>

      <button
        type="button"
        onClick={() => onNavigate({ name: 'librarian-dashboard' })}
        className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>Back to Dashboard</span>
      </button>
    </section>
  );
}

export function CirculationBookCover({
  src,
  title,
  size = 'md',
}: {
  src: string;
  title: string;
  size?: 'sm' | 'md';
}) {
  const [failed, setFailed] = useState(false);
  const dimClass = size === 'sm' ? 'h-12 w-9' : 'h-16 w-12';

  if (failed || !src) {
    return (
      <div
        title={title}
        className={`flex ${dimClass} shrink-0 items-center justify-center rounded border border-slate-200 bg-[#142B4A] text-[#DBEAFE]`}
      >
        <BookOpen className="h-4 w-4" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Cover of ${title}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${dimClass} shrink-0 rounded border border-slate-200 object-cover`}
    />
  );
}

export function CirculationStatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized = status.trim().toLowerCase();

  if (
    normalized === 'eligible' ||
    normalized === 'eligible for borrowing' ||
    normalized === 'available' ||
    normalized === 'active' ||
    normalized === 'good' ||
    normalized === 'returned' ||
    normalized === 'completed' ||
    normalized === 'fulfilled' ||
    normalized === 'published'
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  if (
    normalized === 'due soon' ||
    normalized === 'due today' ||
    normalized === 'reserved' ||
    normalized === 'fair' ||
    normalized === 'under repair' ||
    normalized === 'renewal pending' ||
    normalized === 'ready for pickup' ||
    normalized === 'expiring soon' ||
    normalized === '1–7 days overdue' ||
    normalized === 'important'
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 whitespace-nowrap">
        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  if (normalized === 'issued' || normalized === 'waiting' || normalized === 'scheduled' || normalized === 'normal') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[#DBEAFE] bg-[#F5F8FC] px-2 py-0.5 text-[11px] font-semibold text-[#142B4A] whitespace-nowrap">
        <Clock className="h-3 w-3 shrink-0 text-[#2563EB]" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  if (
    normalized === 'overdue' ||
    normalized === '8–30 days overdue' ||
    normalized === 'more than 30 days overdue' ||
    normalized === 'urgent' ||
    normalized === 'blocked' ||
    normalized === 'suspended' ||
    normalized === 'damaged' ||
    normalized === 'lost' ||
    normalized === 'retired' ||
    normalized === 'expired'
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800 whitespace-nowrap">
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  if (normalized === 'cancelled' || normalized === 'draft' || normalized === 'archived') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 whitespace-nowrap">
        {normalized === 'cancelled' ? (
          <X className="h-3 w-3 shrink-0" aria-hidden="true" />
        ) : (
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
        )}
        <span>{status}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-[#1E293B] whitespace-nowrap">
      <span>{status}</span>
    </span>
  );
}

export function StudentBorrowingSummaryCard({
  student,
  eligibility,
  onInspectStudent,
}: {
  student: CirculationStudentRecord;
  eligibility: StudentEligibilityResult;
  onInspectStudent?: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/70 p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-display text-base font-bold text-[#142B4A]">
              {student.full_name}
            </h4>
            <CirculationStatusBadge status={student.account_status} />
            <CirculationStatusBadge
              status={eligibility.eligible ? 'Eligible for borrowing' : 'Restricted'}
            />
          </div>
          <p className="mt-1 text-xs text-[#64748B]">
            <span className="font-mono-tabular font-semibold text-[#142B4A]">
              {student.student_code}
            </span>{' '}
            · Roll: <span className="font-mono-tabular">{student.roll_number}</span> ·{' '}
            {student.department}
          </p>
          <p className="mt-0.5 text-xs text-[#64748B]">
            {student.program} · {student.email}
          </p>
        </div>

        {onInspectStudent && (
          <button
            type="button"
            onClick={onInspectStudent}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>View Student Profile</span>
          </button>
        )}
      </div>

      {/* Actual Student Borrowing Summary Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-medium text-[#64748B]">Current Loans</p>
          <p className="font-mono-tabular mt-1 text-base font-bold text-[#142B4A]">
            {student.active_loans_count} / {student.max_borrowing_limit}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-medium text-[#64748B]">Remaining Capacity</p>
          <p
            className={`font-mono-tabular mt-1 text-base font-bold ${
              student.remaining_capacity > 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {student.remaining_capacity}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-medium text-[#64748B]">Due Soon</p>
          <p className="font-mono-tabular mt-1 text-base font-bold text-amber-800">
            {student.due_soon_count}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-medium text-[#64748B]">Overdue Books</p>
          <p
            className={`font-mono-tabular mt-1 text-base font-bold ${
              student.overdue_count > 0 ? 'text-red-700' : 'text-[#142B4A]'
            }`}
          >
            {student.overdue_count}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-medium text-[#64748B]">Max Borrowing Limit</p>
          <p className="font-mono-tabular mt-1 text-base font-bold text-[#142B4A]">
            {student.max_borrowing_limit}
          </p>
        </div>
      </div>

      {/* Authoritative Eligibility Notice */}
      <div
        role={eligibility.eligible ? 'status' : 'alert'}
        className={`mt-4 flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
          eligibility.eligible
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-red-200 bg-red-50 text-red-900'
        }`}
      >
        {eligibility.eligible ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
        ) : (
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
        )}
        <div>
          <p className="font-semibold">
            {eligibility.eligible ? 'Eligible for borrowing' : 'Issuing Blocked'}
          </p>
          {!eligibility.eligible && <p className="mt-0.5">{eligibility.message}</p>}
        </div>
      </div>
    </div>
  );
}

export function CirculationAuthorizationBlocked({
  title,
  message,
  onNavigate,
}: {
  title: string;
  message: string;
  onNavigate: (route: AppRoute) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
        <Lock className="h-6 w-6" aria-hidden="true" />
      </span>
      <h2 className="font-display mt-4 text-lg font-bold text-[#142B4A]">{title}</h2>
      <p className="mt-1 text-sm text-[#64748B]">{message}</p>
      <button
        type="button"
        onClick={() => onNavigate({ name: 'librarian-dashboard' })}
        className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>Back to Dashboard</span>
      </button>
    </section>
  );
}

export function CirculationStudentModal({
  student,
  onClose,
}: {
  student: CirculationStudentRecord | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!student) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [student, onClose]);

  if (!student) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="circulation-student-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
              Verified Student Record
            </p>
            <h3
              id="circulation-student-modal-title"
              className="font-display mt-0.5 text-lg font-bold text-[#142B4A]"
            >
              {student.full_name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close student details modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <dl className="mt-4 space-y-2.5 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Student ID</dt>
            <dd className="font-mono-tabular font-semibold text-[#142B4A]">
              {student.student_code}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Roll Number</dt>
            <dd className="font-mono-tabular text-[#1E293B]">{student.roll_number}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Department</dt>
            <dd className="text-right text-[#1E293B]">{student.department}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Program</dt>
            <dd className="text-right text-[#1E293B]">{student.program}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Account Status</dt>
            <dd>
              <CirculationStatusBadge status={student.account_status} />
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Active Loans / Capacity</dt>
            <dd className="font-mono-tabular font-semibold text-[#142B4A]">
              {student.active_loans_count} / {student.max_borrowing_limit} (Remaining:{' '}
              {student.remaining_capacity})
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Overdue Books</dt>
            <dd className="font-mono-tabular font-semibold text-[#142B4A]">
              {student.overdue_count}
            </dd>
          </div>
        </dl>

        {student.restriction_reason && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{student.restriction_reason}</span>
          </div>
        )}

        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1f3e69] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function CirculationBorrowingModal({
  borrowing,
  onClose,
}: {
  borrowing: ActiveBorrowingDetail | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!borrowing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [borrowing, onClose]);

  if (!borrowing) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="circulation-borrowing-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <p className="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
              {borrowing.transaction_code}
            </p>
            <h3
              id="circulation-borrowing-modal-title"
              className="font-display mt-0.5 text-lg font-bold text-[#142B4A]"
            >
              Borrowing Transaction Details
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close borrowing details modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <dl className="mt-4 space-y-2.5 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Student</dt>
            <dd className="text-right font-semibold text-[#142B4A]">
              {borrowing.student_name} ({borrowing.student_code})
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Book</dt>
            <dd className="text-right font-semibold text-[#142B4A]">{borrowing.book_title}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Physical Copy</dt>
            <dd className="font-mono-tabular text-right text-[#1E293B]">
              ID #{borrowing.copy_id} · {borrowing.accession_number}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Location</dt>
            <dd className="text-right text-[#1E293B]">{borrowing.shelf_location}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Issue Date</dt>
            <dd className="font-mono-tabular text-[#1E293B]">
              {formatLibrarianShortDate(borrowing.issue_date)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Due Date</dt>
            <dd className="font-mono-tabular font-semibold text-[#142B4A]">
              {formatLibrarianShortDate(borrowing.due_date)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Status</dt>
            <dd>
              <CirculationStatusBadge status={borrowing.status} />
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1f3e69] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
