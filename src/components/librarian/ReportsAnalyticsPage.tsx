import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookCheck,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Filter,
  Info,
  Layers,
  Lock,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  formatLibrarianShortDate,
  formatStaffDateTime,
  type LibrarianPermissions,
} from '../../utils/librarianDashboard';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import {
  buildReportCsvContent,
  buildReportsApiQueryParams,
  computeReportsAnalyticsView,
  createDefaultReportsFilterState,
  createSampleReportsSourceDataset,
  DATE_PRESET_OPTIONS,
  REPORT_TABS,
  resolveDateRangeFromPreset,
  validateReportDateRange,
  type MostBorrowedBookItem,
  type ReportDatePreset,
  type ReportsFilterState,
  type ReportsSourceDataset,
  type ReportTabId,
  type TrendGrouping,
} from '../../utils/librarianReports';
import {
  CirculationBookCover,
  CirculationPageHeader,
  CirculationStatusBadge,
} from './CirculationSharedComponents';
import {
  DualSeriesTrendChart,
  HorizontalDistributionChart,
  StatusDoughnutChart,
} from './ReportsCharts';

const TABLE_PAGE_SIZE = 8;

interface ReportsAnalyticsPageProps {
  permissions: LibrarianPermissions;
  onNavigate: (route: AppRoute) => void;
}

export function ReportsAnalyticsPage({
  permissions,
  onNavigate,
}: ReportsAnalyticsPageProps) {
  const [referenceDate] = useState<Date>(() => new Date());
  const [filters, setFilters] = useState<ReportsFilterState>(() =>
    createDefaultReportsFilterState(new Date())
  );
  const [dateError, setDateError] = useState<string | null>(null);
  const [dataset, setDataset] = useState<ReportsSourceDataset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Interactive chart & table controls
  const [trendMode, setTrendMode] = useState<'bar' | 'line'>('bar');
  const [taxonomyView, setTaxonomyView] = useState<'categories' | 'subjects'>('categories');
  const [activeTab, setActiveTab] = useState<ReportTabId>('borrowing');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [tablePage, setTablePage] = useState<number>(1);
  const [selectedBookDetail, setSelectedBookDetail] = useState<MostBorrowedBookItem | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    tone: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  const apiBaseUrl = getApiBaseUrl();
  const hasBackendApi = isBackendConnected();

  const loadReportsData = useCallback(
    async (activeFilters: ReportsFilterState) => {
      if (!permissions.can_view_reports) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setLoadError(null);

      if (!hasBackendApi) {
        await new Promise((resolve) => window.setTimeout(resolve, 90));
        setDataset(createSampleReportsSourceDataset(referenceDate));
        setIsLoading(false);
        return;
      }

      try {
        const query = buildReportsApiQueryParams(activeFilters).toString();
        const res = await fetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/reports/summary?${query}`,
          {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          }
        );
        if (res.status === 401) {
          onNavigate({ name: 'admin-login' });
          return;
        }
        if (res.status === 403) {
          throw new Error('You are not authorized to view library reports & analytics.');
        }
        if (!res.ok) {
          throw new Error(`Unable to load library reports (${res.status}).`);
        }
        const payload = (await res.json()) as ReportsSourceDataset;
        setDataset({ ...payload, is_prototype_sample: false });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Unable to load reports data.');
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, hasBackendApi, onNavigate, permissions.can_view_reports, referenceDate]
  );

  useEffect(() => {
    void loadReportsData(filters);
    // Initial load on mount / permission ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions.can_view_reports]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const computedView = useMemo(() => {
    if (!dataset) return null;
    return computeReportsAnalyticsView(dataset, filters, referenceDate);
  }, [dataset, filters, referenceDate]);

  const handlePresetChange = (preset: ReportDatePreset) => {
    const resolved = resolveDateRangeFromPreset(
      preset,
      referenceDate,
      filters.dateFrom,
      filters.dateTo
    );
    const nextFilters: ReportsFilterState = {
      ...filters,
      datePreset: preset,
      dateFrom: resolved.dateFrom,
      dateTo: resolved.dateTo,
    };
    setDateError(null);
    setFilters(nextFilters);
    setTablePage(1);
  };

  const handleCustomDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    const nextFilters: ReportsFilterState = {
      ...filters,
      datePreset: 'custom',
      [field]: value,
    };
    setFilters(nextFilters);
    const check = validateReportDateRange(nextFilters.dateFrom, nextFilters.dateTo);
    setDateError(check.error);
    setTablePage(1);
  };

  const handleResetFilters = () => {
    const defaults = createDefaultReportsFilterState(referenceDate);
    setDateError(null);
    setFilters(defaults);
    setTableSearch('');
    setTablePage(1);
  };

  const activeFiltersSummary = useMemo(() => {
    const parts = [`Range: ${filters.dateFrom} to ${filters.dateTo}`];
    if (filters.branch !== 'All') parts.push(`Branch: ${filters.branch}`);
    if (filters.category !== 'All') parts.push(`Category: ${filters.category}`);
    if (filters.subject !== 'All') parts.push(`Subject: ${filters.subject}`);
    if (filters.department !== 'All') parts.push(`Department: ${filters.department}`);
    if (filters.borrowingStatus !== 'All') parts.push(`Borrowing: ${filters.borrowingStatus}`);
    if (filters.reservationStatus !== 'All') {
      parts.push(`Reservation: ${filters.reservationStatus}`);
    }
    return parts.join(' | ');
  }, [filters]);

  // Tabbed table rows filtered by quick table search
  const activeTabRows = useMemo(() => {
    if (!computedView) return [];
    const q = tableSearch.trim().toLowerCase();
    switch (activeTab) {
      case 'borrowing':
        return computedView.tables.borrowing.filter(
          (r) =>
            !q ||
            r.transaction_code.toLowerCase().includes(q) ||
            r.book_title.toLowerCase().includes(q) ||
            r.student_name.toLowerCase().includes(q) ||
            r.student_code.toLowerCase().includes(q)
        );
      case 'returns':
        return computedView.tables.returns.filter(
          (r) =>
            !q ||
            r.transaction_code.toLowerCase().includes(q) ||
            r.book_title.toLowerCase().includes(q) ||
            r.student_name.toLowerCase().includes(q) ||
            r.student_code.toLowerCase().includes(q)
        );
      case 'overdue':
        return computedView.tables.overdue.filter(
          (r) =>
            !q ||
            r.transaction_code.toLowerCase().includes(q) ||
            r.book_title.toLowerCase().includes(q) ||
            r.student_name.toLowerCase().includes(q) ||
            r.student_code.toLowerCase().includes(q)
        );
      case 'inventory':
        return computedView.tables.inventory.filter(
          (r) =>
            !q ||
            r.title.toLowerCase().includes(q) ||
            r.authors.toLowerCase().includes(q) ||
            r.isbn.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q)
        );
      case 'reservations':
        return computedView.tables.reservations.filter(
          (r) =>
            !q ||
            r.reservation_code.toLowerCase().includes(q) ||
            r.book_title.toLowerCase().includes(q) ||
            r.student_name.toLowerCase().includes(q) ||
            r.student_code.toLowerCase().includes(q)
        );
      case 'student_activity':
        return computedView.tables.student_activity.filter(
          (r) => !q || r.department.toLowerCase().includes(q)
        );
    }
  }, [activeTab, computedView, tableSearch]);

  const totalTablePages = Math.max(1, Math.ceil(activeTabRows.length / TABLE_PAGE_SIZE));
  const safeTablePage = Math.min(tablePage, totalTablePages);
  const paginatedRows = activeTabRows.slice(
    (safeTablePage - 1) * TABLE_PAGE_SIZE,
    safeTablePage * TABLE_PAGE_SIZE
  );

  const handleExportCsv = () => {
    if (!permissions.can_view_reports || !computedView || activeTabRows.length === 0) {
      setToastMessage({
        tone: 'error',
        text: 'No report rows available to export for the active tab and filters.',
      });
      return;
    }

    const activeTabMeta = REPORT_TABS.find((t) => t.id === activeTab);
    let headers: string[] = [];
    let csvRows: Array<Array<string | number | boolean | null>> = [];

    if (activeTab === 'borrowing') {
      headers = ['Transaction Code', 'Book Title', 'Student', 'Student Code', 'Department', 'Accession', 'Issue Date', 'Due Date', 'Return Date', 'Status'];
      csvRows = (activeTabRows as typeof computedView.tables.borrowing).map((r) => [
        r.transaction_code,
        r.book_title,
        r.student_name,
        r.student_code,
        r.department,
        r.accession_number,
        r.issue_date,
        r.due_date,
        r.return_date ?? '—',
        r.status,
      ]);
    } else if (activeTab === 'returns') {
      headers = ['Transaction Code', 'Book Title', 'Student', 'Student Code', 'Accession', 'Issue Date', 'Due Date', 'Return Date', 'Days Late', 'Condition'];
      csvRows = (activeTabRows as typeof computedView.tables.returns).map((r) => [
        r.transaction_code,
        r.book_title,
        r.student_name,
        r.student_code,
        r.accession_number,
        r.issue_date,
        r.due_date,
        r.return_date,
        r.days_late,
        r.condition,
      ]);
    } else if (activeTab === 'overdue') {
      headers = ['Transaction Code', 'Book Title', 'Student', 'Student Code', 'Department', 'Accession', 'Due Date', 'Days Overdue', 'Duration Bucket', 'Fine Status'];
      csvRows = (activeTabRows as typeof computedView.tables.overdue).map((r) => [
        r.transaction_code,
        r.book_title,
        r.student_name,
        r.student_code,
        r.department,
        r.accession_number,
        r.due_date,
        r.days_overdue,
        r.duration_bucket,
        r.fine_label,
      ]);
    } else if (activeTab === 'inventory') {
      headers = ['Title', 'Author', 'ISBN', 'Category', 'Subject', 'Branch', 'Total Copies', 'Available', 'Issued', 'Reserved', 'Unavailable', 'Status', 'Total Borrows'];
      csvRows = (activeTabRows as typeof computedView.tables.inventory).map((r) => [
        r.title,
        r.authors,
        r.isbn,
        r.category,
        r.subject,
        r.branch,
        r.total_copies,
        r.available_copies,
        r.issued_copies,
        r.reserved_copies,
        r.unavailable_copies,
        r.availability_status,
        r.borrow_count,
      ]);
    } else if (activeTab === 'reservations') {
      headers = ['Reservation Code', 'Book Title', 'Student', 'Student Code', 'Department', 'Branch', 'Requested Date', 'Queue Position', 'Status', 'Pickup Deadline'];
      csvRows = (activeTabRows as typeof computedView.tables.reservations).map((r) => [
        r.reservation_code,
        r.book_title,
        r.student_name,
        r.student_code,
        r.department,
        r.branch,
        r.reservation_date,
        r.queue_position ?? '—',
        r.status,
        r.pickup_deadline ?? '—',
      ]);
    } else {
      headers = ['Department', 'Registered Students', 'Active Students', 'Total Borrows', 'Active Loans', 'Completed Loans', 'Overdue Loans', 'Active Reservations'];
      csvRows = (activeTabRows as typeof computedView.tables.student_activity).map((r) => [
        r.department,
        r.distinct_students,
        r.active_students,
        r.total_borrows,
        r.active_loans,
        r.completed_loans,
        r.overdue_loans,
        r.active_reservations,
      ]);
    }

    const csvContent = buildReportCsvContent({
      reportTitle: activeTabMeta?.label ?? 'Library Report',
      generatedAtIso: computedView.generated_at,
      activeFiltersSummary,
      headers,
      rows: csvRows,
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `library-${activeTab}-report-${filters.dateTo}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToastMessage({
      tone: 'success',
      text: `Exported ${csvRows.length} ${activeTabMeta?.label ?? 'report'} rows as CSV.`,
    });
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleExportPdfBackend = async () => {
    if (!hasBackendApi || !dataset?.capabilities.can_export_pdf_backend) {
      setToastMessage({
        tone: 'info',
        text: 'Server-side PDF export requires a configured backend reporting endpoint. Use Print Report to save as PDF.',
      });
      return;
    }
    const query = buildReportsApiQueryParams(filters).toString();
    try {
      const res = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/reports/export?format=pdf&tab=${activeTab}&${query}`,
        { method: 'GET', credentials: 'include' }
      );
      if (!res.ok) throw new Error(`PDF export failed (${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `library-${activeTab}-report-${filters.dateTo}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setToastMessage({ tone: 'success', text: 'PDF report downloaded.' });
    } catch (err) {
      setToastMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Unable to export PDF.',
      });
    }
  };

  if (!permissions.can_view_reports) {
    return (
      <div className="space-y-6">
        <CirculationPageHeader
          title="Reports & Analytics"
          subtitle="Operational library insights, circulation trends, and inventory reports."
          onNavigate={onNavigate}
        />
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <h3 className="font-display font-bold">Permission Required</h3>
              <p className="mt-1 text-xs leading-relaxed">
                Your librarian account does not currently have the{' '}
                <code className="font-mono-tabular">can_view_reports</code> permission enabled.
                Contact a Library Administrator if you require reporting access.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CirculationPageHeader
        title="Reports & Analytics"
        subtitle="Monitor circulation trends, popular books, inventory utilization, overdue follow-ups, and department reading activity."
        onNavigate={onNavigate}
      />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium shadow-xs ${
            toastMessage.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : toastMessage.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-[#DBEAFE] bg-[#F5F8FC] text-[#142B4A]'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.tone === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            ) : toastMessage.tone === 'error' ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
            className="rounded p-1 hover:bg-black/5 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Action & Date Range Control Bar */}
      <section
        aria-label="Report period and export controls"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#142B4A]">
            <CalendarDays className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
            <span>Date Range:</span>
          </span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date range presets">
            {DATE_PRESET_OPTIONS.map((preset) => {
              const active = filters.datePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetChange(preset.id)}
                  aria-pressed={active}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'border-[#2563EB] bg-[#2563EB] text-white'
                      : 'border-slate-200 bg-[#F5F8FC] text-[#1E293B] hover:border-[#2563EB]/50'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom From / To Date Inputs + Actions */}
        <div className="mt-4 flex flex-col justify-between gap-4 border-t border-slate-100 pt-4 xl:flex-row xl:items-end">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label
                htmlFor="report-date-from"
                className="block text-[11px] font-semibold uppercase tracking-wide text-[#64748B]"
              >
                From Date
              </label>
              <input
                id="report-date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleCustomDateChange('dateFrom', e.target.value)}
                className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-hidden"
              />
            </div>
            <div>
              <label
                htmlFor="report-date-to"
                className="block text-[11px] font-semibold uppercase tracking-wide text-[#64748B]"
              >
                To Date
              </label>
              <input
                id="report-date-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleCustomDateChange('dateTo', e.target.value)}
                className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-hidden"
              />
            </div>

            <div className="pb-1 text-xs text-[#64748B]">
              <span className="font-medium text-[#142B4A]">Active Window:</span>{' '}
              <span className="font-mono-tabular">
                {formatLibrarianShortDate(filters.dateFrom)} –{' '}
                {formatLibrarianShortDate(filters.dateTo)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadReportsData(filters)}
              disabled={isLoading || Boolean(dateError)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Refresh Data</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isLoading || activeTabRows.length === 0 || Boolean(dateError)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrintReport}
              disabled={isLoading || Boolean(dateError)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Print Report</span>
            </button>

            <button
              type="button"
              onClick={() => void handleExportPdfBackend()}
              title={
                hasBackendApi && dataset?.capabilities.can_export_pdf_backend
                  ? 'Download backend-generated PDF report'
                  : 'PDF export requires backend reporting service; use Print Report to save PDF'
              }
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F5F8FC] px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:border-[#2563EB]/40 hover:text-[#142B4A] whitespace-nowrap cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {dateError && (
          <p role="alert" className="mt-3 text-xs font-semibold text-red-700">
            {dateError}
          </p>
        )}
      </section>

      {loadError ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadReportsData(filters)}
              className="rounded-lg bg-red-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-800 cursor-pointer"
            >
              Retry
            </button>
          </div>
        </section>
      ) : isLoading || !computedView ? (
        <div className="space-y-6 animate-pulse" aria-label="Loading reports and analytics">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white p-4" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-72 rounded-xl border border-slate-200 bg-white p-6" />
            <div className="h-72 rounded-xl border border-slate-200 bg-white p-6" />
          </div>
        </div>
      ) : (
        <>
          {/* KPI Summary Strip (7 cards matching core library metrics) */}
          <section aria-label="Summary KPI Metrics">
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              <KpiCard
                label="Total Book Titles"
                value={computedView.summary.totalBookTitles}
                icon={<BookOpen className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />}
              />
              <KpiCard
                label="Total Physical Copies"
                value={computedView.summary.totalPhysicalCopies}
                icon={<Layers className="h-4 w-4 text-[#142B4A]" aria-hidden="true" />}
              />
              <KpiCard
                label="Available Copies"
                value={computedView.summary.availableCopies}
                accentClass="text-emerald-700"
                icon={<BookCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
              />
              <KpiCard
                label="Issued (In Range)"
                value={computedView.summary.booksIssuedInRange}
                delta={computedView.summary.previousPeriodDeltas?.booksIssued}
                accentClass="text-[#2563EB]"
                icon={<BarChart3 className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />}
              />
              <KpiCard
                label="Returned (In Range)"
                value={computedView.summary.booksReturnedInRange}
                delta={computedView.summary.previousPeriodDeltas?.booksReturned}
                accentClass="text-emerald-700"
                icon={<RotateCcw className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
              />
              <KpiCard
                label="Currently Overdue"
                value={computedView.summary.currentlyOverdueBooks}
                delta={computedView.summary.previousPeriodDeltas?.currentlyOverdue}
                accentClass={
                  computedView.summary.currentlyOverdueBooks > 0
                    ? 'text-red-700'
                    : 'text-[#142B4A]'
                }
                icon={<AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />}
              />
              <KpiCard
                label="Active Reservations"
                value={computedView.summary.activeReservations}
                delta={computedView.summary.previousPeriodDeltas?.activeReservations}
                accentClass="text-[#142B4A]"
                icon={<ClipboardList className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />}
              />
            </div>
          </section>

          {/* Multi-Filter Control Strip */}
          <section
            aria-label="Report filters"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#142B4A]">
                <Filter className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                <span>Filter Analytics &amp; Report Tables</span>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div>
                <label
                  htmlFor="filter-branch"
                  className="block text-[11px] font-semibold text-[#64748B]"
                >
                  Library Branch
                </label>
                <select
                  id="filter-branch"
                  value={filters.branch}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, branch: e.target.value }));
                    setTablePage(1);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-hidden"
                >
                  <option value="All">All Branches</option>
                  {computedView.facets.branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-category"
                  className="block text-[11px] font-semibold text-[#64748B]"
                >
                  Category
                </label>
                <select
                  id="filter-category"
                  value={filters.category}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, category: e.target.value }));
                    setTablePage(1);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-hidden"
                >
                  <option value="All">All Categories</option>
                  {computedView.facets.categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-subject"
                  className="block text-[11px] font-semibold text-[#64748B]"
                >
                  Subject
                </label>
                <select
                  id="filter-subject"
                  value={filters.subject}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, subject: e.target.value }));
                    setTablePage(1);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-hidden"
                >
                  <option value="All">All Subjects</option>
                  {computedView.facets.subjects.map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-department"
                  className="block text-[11px] font-semibold text-[#64748B]"
                >
                  Student Department
                </label>
                <select
                  id="filter-department"
                  value={filters.department}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, department: e.target.value }));
                    setTablePage(1);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-hidden"
                >
                  <option value="All">All Departments</option>
                  {computedView.facets.departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-borrowing-status"
                  className="block text-[11px] font-semibold text-[#64748B]"
                >
                  Borrowing Status
                </label>
                <select
                  id="filter-borrowing-status"
                  value={filters.borrowingStatus}
                  onChange={(e) => {
                    setFilters((prev) => ({
                      ...prev,
                      borrowingStatus: e.target.value as ReportsFilterState['borrowingStatus'],
                    }));
                    setTablePage(1);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-hidden"
                >
                  <option value="All">All Statuses</option>
                  <option value="Issued">Issued</option>
                  <option value="Returned">Returned</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Renewal Pending">Renewal Pending</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-reservation-status"
                  className="block text-[11px] font-semibold text-[#64748B]"
                >
                  Reservation Status
                </label>
                <select
                  id="filter-reservation-status"
                  value={filters.reservationStatus}
                  onChange={(e) => {
                    setFilters((prev) => ({
                      ...prev,
                      reservationStatus: e.target
                        .value as ReportsFilterState['reservationStatus'],
                    }));
                    setTablePage(1);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-hidden"
                >
                  <option value="All">All Reservations</option>
                  <option value="Waiting">Waiting</option>
                  <option value="Ready for Pickup">Ready for Pickup</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>
            </div>
          </section>

          {/* Charts & Insights Grid */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            {/* 1. Borrowing & Return Trends */}
            <section
              aria-labelledby="chart-borrowing-trends-heading"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-7"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3
                    id="chart-borrowing-trends-heading"
                    className="font-display text-base font-bold text-[#142B4A]"
                  >
                    Borrowing &amp; Return Trends
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Compare books issued and returned across the selected period.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="inline-flex rounded-lg border border-slate-200 bg-[#F5F8FC] p-0.5 text-[11px] font-semibold"
                    role="group"
                    aria-label="Trend grouping"
                  >
                    {(['daily', 'weekly', 'monthly'] as TrendGrouping[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setFilters((prev) => ({ ...prev, grouping: g }))}
                        aria-pressed={filters.grouping === g}
                        className={`rounded-md px-2.5 py-1 capitalize cursor-pointer ${
                          filters.grouping === g
                            ? 'bg-white text-[#142B4A] shadow-2xs'
                            : 'text-[#64748B] hover:text-[#142B4A]'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>

                  <div
                    className="inline-flex rounded-lg border border-slate-200 bg-[#F5F8FC] p-0.5 text-[11px] font-semibold"
                    role="group"
                    aria-label="Chart type"
                  >
                    <button
                      type="button"
                      onClick={() => setTrendMode('bar')}
                      aria-pressed={trendMode === 'bar'}
                      className={`rounded-md px-2.5 py-1 cursor-pointer ${
                        trendMode === 'bar'
                          ? 'bg-white text-[#142B4A] shadow-2xs'
                          : 'text-[#64748B] hover:text-[#142B4A]'
                      }`}
                    >
                      Bar
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrendMode('line')}
                      aria-pressed={trendMode === 'line'}
                      className={`rounded-md px-2.5 py-1 cursor-pointer ${
                        trendMode === 'line'
                          ? 'bg-white text-[#142B4A] shadow-2xs'
                          : 'text-[#64748B] hover:text-[#142B4A]'
                      }`}
                    >
                      Line
                    </button>
                  </div>
                </div>
              </div>

              <DualSeriesTrendChart
                data={computedView.charts.circulationTrends.map((t) => ({
                  label: t.label,
                  primary: t.issued,
                  secondary: t.returned,
                }))}
                primaryLabel="Books Issued"
                secondaryLabel="Books Returned"
                mode={trendMode}
                emptyMessage="Insufficient circulation activity in this date range to plot trends."
              />
            </section>

            {/* 2. Inventory Status Breakdown */}
            <section
              aria-labelledby="chart-inventory-status-heading"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-5"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h3
                    id="chart-inventory-status-heading"
                    className="font-display text-base font-bold text-[#142B4A]"
                  >
                    Inventory Status &amp; Copy Distribution
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Physical copy allocation across filtered branches and categories.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate({ name: 'librarian-inventory' })}
                  className="text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
                >
                  Open Inventory
                </button>
              </div>

              <StatusDoughnutChart
                centerLabel="Total Copies"
                centerValue={computedView.charts.inventoryStatus.total_copies}
                segments={[
                  {
                    label: 'Available',
                    value: computedView.charts.inventoryStatus.available,
                    color: '#059669',
                  },
                  {
                    label: 'Issued',
                    value: computedView.charts.inventoryStatus.issued,
                    color: '#2563EB',
                  },
                  {
                    label: 'Reserved',
                    value: computedView.charts.inventoryStatus.reserved,
                    color: '#D97706',
                  },
                  {
                    label: 'Lost / Damaged / Repair',
                    value: computedView.charts.inventoryStatus.lost_damaged_repair,
                    color: '#DC2626',
                  },
                ]}
              />
            </section>

            {/* 3. Most Borrowed Books */}
            <section
              aria-labelledby="chart-most-borrowed-heading"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-7"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h3
                    id="chart-most-borrowed-heading"
                    className="font-display text-base font-bold text-[#142B4A]"
                  >
                    Most Borrowed Books
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Click any title to inspect copy availability and book metrics.
                  </p>
                </div>
              </div>

              {computedView.charts.mostBorrowedBooks.length === 0 ? (
                <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-[#F5F8FC]/60 px-4 text-center text-xs text-[#64748B]">
                  No borrowing records match the active date range and filters.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {computedView.charts.mostBorrowedBooks.map((book) => (
                    <button
                      key={book.book_id}
                      type="button"
                      onClick={() => setSelectedBookDetail(book)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#F5F8FC]/50 p-3 text-left transition-colors hover:border-[#2563EB]/50 hover:bg-[#F5F8FC] cursor-pointer"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <CirculationBookCover src={book.cover_image} title={book.title} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#142B4A]">
                            {book.title}
                          </p>
                          <p className="truncate text-[11px] text-[#64748B]">
                            {book.author} · {book.category}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-4 text-right text-xs">
                        <div>
                          <p className="font-mono-tabular font-bold text-[#2563EB]">
                            {book.total_borrows}
                          </p>
                          <p className="text-[10px] text-[#64748B]">Borrows</p>
                        </div>
                        <div>
                          <p className="font-mono-tabular font-semibold text-[#142B4A]">
                            {book.available_copies}/{book.total_copies}
                          </p>
                          <p className="text-[10px] text-[#64748B]">Available</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* 4. Popular Categories & Subjects */}
            <section
              aria-labelledby="chart-popular-categories-heading"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-5"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3
                    id="chart-popular-categories-heading"
                    className="font-display text-base font-bold text-[#142B4A]"
                  >
                    Popular Categories &amp; Subjects
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Borrowing share across library topics.
                  </p>
                </div>

                <div
                  className="inline-flex rounded-lg border border-slate-200 bg-[#F5F8FC] p-0.5 text-[11px] font-semibold"
                  role="group"
                  aria-label="Taxonomy breakdown"
                >
                  <button
                    type="button"
                    onClick={() => setTaxonomyView('categories')}
                    aria-pressed={taxonomyView === 'categories'}
                    className={`rounded-md px-2.5 py-1 cursor-pointer ${
                      taxonomyView === 'categories'
                        ? 'bg-white text-[#142B4A] shadow-2xs'
                        : 'text-[#64748B] hover:text-[#142B4A]'
                    }`}
                  >
                    Categories
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxonomyView('subjects')}
                    aria-pressed={taxonomyView === 'subjects'}
                    className={`rounded-md px-2.5 py-1 cursor-pointer ${
                      taxonomyView === 'subjects'
                        ? 'bg-white text-[#142B4A] shadow-2xs'
                        : 'text-[#64748B] hover:text-[#142B4A]'
                    }`}
                  >
                    Subjects
                  </button>
                </div>
              </div>

              <HorizontalDistributionChart
                items={(taxonomyView === 'categories'
                  ? computedView.charts.popularCategories
                  : computedView.charts.popularSubjects
                ).map((c) => ({
                  label: c.name,
                  value: c.borrow_count,
                  helper: `${c.share_percent}%`,
                  color: taxonomyView === 'categories' ? '#2563EB' : '#142B4A',
                }))}
                emptyMessage="No borrowing activity for categories or subjects in this window."
              />
            </section>

            {/* 5. Overdue Trends & Severity */}
            <section
              aria-labelledby="chart-overdue-trends-heading"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-6"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h3
                    id="chart-overdue-trends-heading"
                    className="font-display text-base font-bold text-[#142B4A]"
                  >
                    Overdue Distribution &amp; Resolution Trends
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Breakdown of active overdue duration buckets and resolved late loans.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate({ name: 'librarian-overdue' })}
                  className="text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
                >
                  Open Overdue Books
                </button>
              </div>

              <div className="space-y-5">
                <HorizontalDistributionChart
                  items={computedView.charts.overdueBuckets.map((b, idx) => ({
                    label: b.bucket,
                    value: b.count,
                    color: idx === 0 ? '#D97706' : idx === 1 ? '#EA580C' : '#DC2626',
                  }))}
                  emptyMessage="No active overdue loans match current filters."
                />

                {computedView.charts.overdueTrends.length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <DualSeriesTrendChart
                      data={computedView.charts.overdueTrends.map((t) => ({
                        label: t.label,
                        primary: t.overdue_count,
                        secondary: t.resolved_count,
                      }))}
                      primaryLabel="Due / Overdue"
                      secondaryLabel="Returned Late"
                      primaryColor="#DC2626"
                      secondaryColor="#059669"
                      mode="bar"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* 6. Reservation Analytics & Department Activity */}
            <section
              aria-labelledby="chart-reservations-activity-heading"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-6"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h3
                    id="chart-reservations-activity-heading"
                    className="font-display text-base font-bold text-[#142B4A]"
                  >
                    Reservations &amp; Department Activity
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Reservation status breakdown and aggregate borrowing by department.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate({ name: 'librarian-reservations' })}
                  className="text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
                >
                  Manage Holds
                </button>
              </div>

              <div className="space-y-5">
                <StatusDoughnutChart
                  centerLabel="Reservations"
                  centerValue={computedView.charts.reservationBreakdown.total}
                  emptyMessage="No reservations found in the selected date window."
                  segments={[
                    {
                      label: 'Waiting',
                      value: computedView.charts.reservationBreakdown.waiting,
                      color: '#2563EB',
                    },
                    {
                      label: 'Ready for Pickup',
                      value: computedView.charts.reservationBreakdown.ready_for_pickup,
                      color: '#D97706',
                    },
                    {
                      label: 'Completed',
                      value: computedView.charts.reservationBreakdown.completed,
                      color: '#059669',
                    },
                    {
                      label: 'Cancelled',
                      value: computedView.charts.reservationBreakdown.cancelled,
                      color: '#64748B',
                    },
                    {
                      label: 'Expired',
                      value: computedView.charts.reservationBreakdown.expired,
                      color: '#DC2626',
                    },
                  ]}
                />

                <div className="border-t border-slate-100 pt-4">
                  <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-[#142B4A]">
                    <Users className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                    <span>Aggregate Borrows by Department (Privacy-Safe)</span>
                  </div>
                  <HorizontalDistributionChart
                    items={computedView.charts.departmentActivity.slice(0, 5).map((d) => ({
                      label: d.department,
                      value: d.total_borrows,
                      helper: `${d.distinct_students} students`,
                      color: '#142B4A',
                    }))}
                    emptyMessage="No department borrowing records in this window."
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Detailed Report Tables Section */}
          <section
            aria-labelledby="detailed-reports-heading"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
          >
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center">
              <div>
                <h3
                  id="detailed-reports-heading"
                  className="font-display text-lg font-bold text-[#142B4A]"
                >
                  Detailed Operational Reports
                </h3>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  {activeFiltersSummary} · Generated{' '}
                  <span className="font-mono-tabular">
                    {formatStaffDateTime(computedView.generated_at)}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={tableSearch}
                    onChange={(e) => {
                      setTableSearch(e.target.value);
                      setTablePage(1);
                    }}
                    placeholder="Filter report rows..."
                    aria-label="Filter report table rows"
                    className="w-56 rounded-lg border border-slate-300 bg-[#F5F8FC] py-1.5 pl-8 pr-3 text-xs text-[#1E293B] focus:border-[#2563EB] focus:bg-white focus:outline-hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={activeTabRows.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Export Table CSV</span>
                </button>
              </div>
            </div>

            {/* Report Tabs */}
            <div
              role="tablist"
              aria-label="Detailed report categories"
              className="mt-4 flex flex-wrap gap-1.5 border-b border-slate-200 pb-3"
            >
              {REPORT_TABS.map((tab) => {
                const isSelected = activeTab === tab.id;
                const count = computedView.tables[tab.id].length;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setTablePage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#142B4A] text-white'
                        : 'bg-[#F5F8FC] text-[#1E293B] hover:bg-[#DBEAFE]/60'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`font-mono-tabular rounded px-1.5 py-0.5 text-[10px] ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-white text-[#64748B]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Table Content */}
            <div className="mt-4 overflow-x-auto">
              {activeTabRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-[#F5F8FC]/60 p-8 text-center text-xs text-[#64748B]">
                  No report rows match the selected filters and search query.
                </div>
              ) : (
                <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F5F8FC] text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                      {activeTab === 'borrowing' && (
                        <>
                          <th className="px-3 py-2.5">Transaction</th>
                          <th className="px-3 py-2.5">Book Title</th>
                          <th className="px-3 py-2.5">Student</th>
                          <th className="px-3 py-2.5">Department</th>
                          <th className="px-3 py-2.5">Issue Date</th>
                          <th className="px-3 py-2.5">Due Date</th>
                          <th className="px-3 py-2.5">Status</th>
                        </>
                      )}
                      {activeTab === 'returns' && (
                        <>
                          <th className="px-3 py-2.5">Transaction</th>
                          <th className="px-3 py-2.5">Book Title</th>
                          <th className="px-3 py-2.5">Student</th>
                          <th className="px-3 py-2.5">Issue Date</th>
                          <th className="px-3 py-2.5">Return Date</th>
                          <th className="px-3 py-2.5">Days Late</th>
                          <th className="px-3 py-2.5">Condition</th>
                        </>
                      )}
                      {activeTab === 'overdue' && (
                        <>
                          <th className="px-3 py-2.5">Transaction</th>
                          <th className="px-3 py-2.5">Book Title</th>
                          <th className="px-3 py-2.5">Student</th>
                          <th className="px-3 py-2.5">Due Date</th>
                          <th className="px-3 py-2.5">Days Overdue</th>
                          <th className="px-3 py-2.5">Severity Bucket</th>
                          <th className="px-3 py-2.5">Fine Policy</th>
                        </>
                      )}
                      {activeTab === 'inventory' && (
                        <>
                          <th className="px-3 py-2.5">Book Title</th>
                          <th className="px-3 py-2.5">Category / Subject</th>
                          <th className="px-3 py-2.5">Branch</th>
                          <th className="px-3 py-2.5">Total</th>
                          <th className="px-3 py-2.5">Available</th>
                          <th className="px-3 py-2.5">Issued / Res.</th>
                          <th className="px-3 py-2.5">Status</th>
                        </>
                      )}
                      {activeTab === 'reservations' && (
                        <>
                          <th className="px-3 py-2.5">Reservation</th>
                          <th className="px-3 py-2.5">Book Title</th>
                          <th className="px-3 py-2.5">Student</th>
                          <th className="px-3 py-2.5">Requested</th>
                          <th className="px-3 py-2.5">Queue</th>
                          <th className="px-3 py-2.5">Pickup Deadline</th>
                          <th className="px-3 py-2.5">Status</th>
                        </>
                      )}
                      {activeTab === 'student_activity' && (
                        <>
                          <th className="px-3 py-2.5">Academic Department</th>
                          <th className="px-3 py-2.5">Students</th>
                          <th className="px-3 py-2.5">Active Accounts</th>
                          <th className="px-3 py-2.5">Total Borrows</th>
                          <th className="px-3 py-2.5">Active Loans</th>
                          <th className="px-3 py-2.5">Overdue</th>
                          <th className="px-3 py-2.5">Active Holds</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeTab === 'borrowing' &&
                      (paginatedRows as typeof computedView.tables.borrowing).map((row) => (
                        <tr key={row.borrowing_id} className="hover:bg-[#F5F8FC]/70">
                          <td className="font-mono-tabular px-3 py-2.5 font-semibold text-[#142B4A]">
                            {row.transaction_code}
                            <div className="text-[11px] font-normal text-[#64748B]">
                              {row.accession_number}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-[#1E293B]">
                            {row.book_title}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-[#142B4A]">{row.student_name}</span>
                            <div className="font-mono-tabular text-[11px] text-[#64748B]">
                              {row.student_code}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-[#64748B]">{row.department}</td>
                          <td className="font-mono-tabular px-3 py-2.5 text-[#1E293B]">
                            {formatLibrarianShortDate(row.issue_date)}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 text-[#1E293B]">
                            {formatLibrarianShortDate(row.due_date)}
                          </td>
                          <td className="px-3 py-2.5">
                            <CirculationStatusBadge status={row.status} />
                          </td>
                        </tr>
                      ))}

                    {activeTab === 'returns' &&
                      (paginatedRows as typeof computedView.tables.returns).map((row) => (
                        <tr key={row.borrowing_id} className="hover:bg-[#F5F8FC]/70">
                          <td className="font-mono-tabular px-3 py-2.5 font-semibold text-[#142B4A]">
                            {row.transaction_code}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-[#1E293B]">
                            {row.book_title}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-[#142B4A]">{row.student_name}</span>
                            <div className="font-mono-tabular text-[11px] text-[#64748B]">
                              {row.student_code}
                            </div>
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 text-[#64748B]">
                            {formatLibrarianShortDate(row.issue_date)}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 text-[#1E293B]">
                            {formatLibrarianShortDate(row.return_date)}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 font-semibold text-[#142B4A]">
                            {row.days_late > 0 ? `${row.days_late}d late` : 'On time'}
                          </td>
                          <td className="px-3 py-2.5">
                            <CirculationStatusBadge status={row.condition} />
                          </td>
                        </tr>
                      ))}

                    {activeTab === 'overdue' &&
                      (paginatedRows as typeof computedView.tables.overdue).map((row) => (
                        <tr key={row.borrowing_id} className="hover:bg-[#F5F8FC]/70">
                          <td className="font-mono-tabular px-3 py-2.5 font-semibold text-[#142B4A]">
                            {row.transaction_code}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-[#1E293B]">
                            {row.book_title}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-[#142B4A]">{row.student_name}</span>
                            <div className="font-mono-tabular text-[11px] text-[#64748B]">
                              {row.student_code}
                            </div>
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 text-[#1E293B]">
                            {formatLibrarianShortDate(row.due_date)}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 font-bold text-red-700">
                            {row.days_overdue} days
                          </td>
                          <td className="px-3 py-2.5">
                            <CirculationStatusBadge status={row.duration_bucket} />
                          </td>
                          <td className="px-3 py-2.5 text-[#64748B]">{row.fine_label}</td>
                        </tr>
                      ))}

                    {activeTab === 'inventory' &&
                      (paginatedRows as typeof computedView.tables.inventory).map((row) => (
                        <tr key={row.book_id} className="hover:bg-[#F5F8FC]/70">
                          <td className="px-3 py-2.5">
                            <span className="font-semibold text-[#142B4A]">{row.title}</span>
                            <div className="text-[11px] text-[#64748B]">
                              {row.authors} · <span className="font-mono-tabular">{row.isbn}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-[#1E293B]">
                            {row.category}
                            <div className="text-[11px] text-[#64748B]">{row.subject}</div>
                          </td>
                          <td className="px-3 py-2.5 text-[#64748B]">{row.branch}</td>
                          <td className="font-mono-tabular px-3 py-2.5 font-semibold text-[#142B4A]">
                            {row.total_copies}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 font-semibold text-emerald-700">
                            {row.available_copies}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 text-[#64748B]">
                            {row.issued_copies} / {row.reserved_copies}
                          </td>
                          <td className="px-3 py-2.5">
                            <CirculationStatusBadge status={row.availability_status} />
                          </td>
                        </tr>
                      ))}

                    {activeTab === 'reservations' &&
                      (paginatedRows as typeof computedView.tables.reservations).map((row) => (
                        <tr key={row.reservation_id} className="hover:bg-[#F5F8FC]/70">
                          <td className="font-mono-tabular px-3 py-2.5 font-semibold text-[#142B4A]">
                            {row.reservation_code}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-[#1E293B]">
                            {row.book_title}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-[#142B4A]">{row.student_name}</span>
                            <div className="font-mono-tabular text-[11px] text-[#64748B]">
                              {row.student_code}
                            </div>
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 text-[#1E293B]">
                            {formatLibrarianShortDate(row.reservation_date)}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 text-[#142B4A]">
                            {row.queue_position ? `#${row.queue_position}` : '—'}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 text-[#64748B]">
                            {row.pickup_deadline
                              ? formatStaffDateTime(row.pickup_deadline)
                              : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <CirculationStatusBadge status={row.status} />
                          </td>
                        </tr>
                      ))}

                    {activeTab === 'student_activity' &&
                      (paginatedRows as typeof computedView.tables.student_activity).map((row) => (
                        <tr key={row.department} className="hover:bg-[#F5F8FC]/70">
                          <td className="px-3 py-2.5 font-semibold text-[#142B4A]">
                            {row.department}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 font-semibold text-[#1E293B]">
                            {row.distinct_students}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 text-emerald-700">
                            {row.active_students}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 font-bold text-[#2563EB]">
                            {row.total_borrows}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 text-[#1E293B]">
                            {row.active_loans}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 font-semibold text-red-700">
                            {row.overdue_loans}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 text-[#1E293B]">
                            {row.active_reservations}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Table Pagination */}
            {activeTabRows.length > TABLE_PAGE_SIZE && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-[#64748B]">
                <span>
                  Showing {(safeTablePage - 1) * TABLE_PAGE_SIZE + 1}–
                  {Math.min(safeTablePage * TABLE_PAGE_SIZE, activeTabRows.length)} of{' '}
                  {activeTabRows.length} records
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safeTablePage <= 1}
                    onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-[#142B4A] disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="font-mono-tabular font-semibold text-[#142B4A]">
                    Page {safeTablePage} of {totalTablePages}
                  </span>
                  <button
                    type="button"
                    disabled={safeTablePage >= totalTablePages}
                    onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-[#142B4A] disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Book Analytics Drill-Down Modal */}
      {selectedBookDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-analytics-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <CirculationBookCover
                  src={selectedBookDetail.cover_image}
                  title={selectedBookDetail.title}
                />
                <div>
                  <h4
                    id="book-analytics-modal-title"
                    className="font-display text-base font-bold text-[#142B4A]"
                  >
                    {selectedBookDetail.title}
                  </h4>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    {selectedBookDetail.author} · {selectedBookDetail.isbn}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#2563EB]">
                    {selectedBookDetail.category} · {selectedBookDetail.subject}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookDetail(null)}
                aria-label="Close book report summary"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] p-3">
                <p className="text-[11px] font-medium text-[#64748B]">Borrows in Range</p>
                <p className="font-mono-tabular mt-0.5 text-lg font-bold text-[#2563EB]">
                  {selectedBookDetail.total_borrows}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] p-3">
                <p className="text-[11px] font-medium text-[#64748B]">Available Copies</p>
                <p className="font-mono-tabular mt-0.5 text-lg font-bold text-emerald-700">
                  {selectedBookDetail.available_copies}/{selectedBookDetail.total_copies}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] p-3">
                <p className="text-[11px] font-medium text-[#64748B]">Avg Rating</p>
                <p className="font-mono-tabular mt-0.5 text-lg font-bold text-[#142B4A]">
                  {selectedBookDetail.avg_rating !== null
                    ? `${selectedBookDetail.avg_rating.toFixed(1)} / 5`
                    : '—'}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setSelectedBookDetail(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = selectedBookDetail.book_id;
                  setSelectedBookDetail(null);
                  onNavigate({ name: 'librarian-issue-books', prefillBookId: id });
                }}
                className="rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                Issue This Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  accentClass = 'text-[#142B4A]',
  icon,
}: {
  label: string;
  value: number;
  delta?: number | null;
  accentClass?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[#64748B]">{label}</span>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#F5F8FC]">
          {icon}
        </span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className={`font-mono-tabular text-2xl font-bold ${accentClass}`}>
          {value}
        </span>
        {delta !== null && delta !== undefined && (
          <span
            className={`font-mono-tabular rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              delta >= 0
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-800'
            }`}
          >
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
    </div>
  );
}
