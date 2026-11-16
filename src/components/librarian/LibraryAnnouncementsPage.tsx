import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Edit3,
  Eye,
  Info,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Send,
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
  buildAnnouncementApiPayload,
  buildAnnouncementsApiQueryParams,
  computeAnnouncementsSummary,
  createSampleAnnouncementsStore,
  filterAndPaginateAnnouncements,
  formatAnnouncementTargetLabel,
  isAnnouncementExpired,
  mapAnnouncementApiError,
  sanitizeAnnouncementText,
  validateAnnouncementDraft,
  type AnnouncementDraftForm,
  type AnnouncementFilterTab,
  type AnnouncementPolicyCapabilities,
  type AnnouncementPriority,
  type AnnouncementTargetType,
  type LibraryAnnouncementItem,
} from '../../utils/librarianAnnouncements';
import {
  CirculationAuthorizationBlocked,
  CirculationStatusBadge,
} from './CirculationSharedComponents';

interface LibraryAnnouncementsPageProps {
  permissions: LibrarianPermissions;
  onNavigate: (route: AppRoute) => void;
}

const PAGE_SIZE = 6;
const ANNOUNCEMENT_TABS: AnnouncementFilterTab[] = [
  'All',
  'Published',
  'Drafts',
  'Scheduled',
  'Archived',
];

function createEmptyAnnouncementForm(defaultCategory: string): AnnouncementDraftForm {
  return {
    title: '',
    content: '',
    category: defaultCategory,
    priority: 'Normal',
    target_type: 'all_students',
    target_value: '',
    publish_mode: 'now',
    publish_at: '',
    expires_at: '',
    notify_on_published_edit: false,
  };
}

export function LibraryAnnouncementsPage({
  permissions,
  onNavigate,
}: LibraryAnnouncementsPageProps) {
  const apiBaseUrl = getApiBaseUrl();
  const hasBackendApi = isBackendConnected();

  const sampleStoreRef = useRef(createSampleAnnouncementsStore());
  const [policy, setPolicy] = useState<AnnouncementPolicyCapabilities>(
    sampleStoreRef.current.policy
  );
  const [items, setItems] = useState<LibraryAnnouncementItem[]>(sampleStoreRef.current.items);
  const [totalCount, setTotalCount] = useState(sampleStoreRef.current.items.length);
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<AnnouncementFilterTab>('All');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [targetFilter, setTargetFilter] = useState<'All' | AnnouncementTargetType>('All');
  const [publishDateFilter, setPublishDateFilter] = useState('');

  // Modals: Detail, Create/Edit Editor + Preview, Publish Confirm, Archive Confirm
  const [inspectedItem, setInspectedItem] = useState<LibraryAnnouncementItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryAnnouncementItem | null>(null);
  const [editorView, setEditorView] = useState<'edit' | 'preview'>('edit');
  const [formState, setFormState] = useState<AnnouncementDraftForm>(() =>
    createEmptyAnnouncementForm(sampleStoreRef.current.policy.categories[0] ?? 'General Notice')
  );
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [publishConfirmTarget, setPublishConfirmTarget] = useState<{
    mode: 'from_form' | 'existing';
    existing?: LibraryAnnouncementItem;
  } | null>(null);
  const [archiveConfirmTarget, setArchiveConfirmTarget] =
    useState<LibraryAnnouncementItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchInput);
      setPage(1);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filterCriteria = useMemo(
    () => ({
      tab: activeTab,
      query: debouncedQuery,
      category: categoryFilter,
      targetType: targetFilter,
      publishDate: publishDateFilter,
    }),
    [activeTab, categoryFilter, debouncedQuery, publishDateFilter, targetFilter]
  );

  const fetchAnnouncements = useCallback(async () => {
    setLoadError(null);

    if (!hasBackendApi) {
      const view = filterAndPaginateAnnouncements(
        sampleStoreRef.current.items,
        filterCriteria,
        page,
        PAGE_SIZE
      );
      setItems(sampleStoreRef.current.items);
      setTotalCount(view.totalCount);
      return;
    }

    setIsLoading(true);
    try {
      const params = buildAnnouncementsApiQueryParams(filterCriteria, page, PAGE_SIZE);
      const res = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/announcements?${params.toString()}`,
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
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(mapAnnouncementApiError(res.status, body?.message));
      }

      const data = (await res.json()) as {
        items?: LibraryAnnouncementItem[];
        total_count?: number;
        policy?: Partial<AnnouncementPolicyCapabilities>;
      };
      if (data.policy) {
        setPolicy((prev) => ({ ...prev, ...data.policy }));
      }
      setItems(data.items ?? []);
      setTotalCount(data.total_count ?? (data.items ?? []).length);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to load library announcements. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, filterCriteria, hasBackendApi, onNavigate, page]);

  useEffect(() => {
    void fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (publishConfirmTarget) setPublishConfirmTarget(null);
      else if (archiveConfirmTarget) setArchiveConfirmTarget(null);
      else if (editorOpen) setEditorOpen(false);
      else if (inspectedItem) setInspectedItem(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [archiveConfirmTarget, editorOpen, inspectedItem, publishConfirmTarget]);

  const summary = useMemo(() => computeAnnouncementsSummary(items), [items]);

  const paginatedView = useMemo(() => {
    if (hasBackendApi) {
      const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
      return {
        items,
        totalCount,
        totalPages,
        currentPage: Math.min(page, totalPages),
      };
    }
    return filterAndPaginateAnnouncements(items, filterCriteria, page, PAGE_SIZE);
  }, [filterCriteria, hasBackendApi, items, page, totalCount]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormState(createEmptyAnnouncementForm(policy.categories[0] ?? 'General Notice'));
    setFormErrors({});
    setSubmitError(null);
    setEditorView('edit');
    setEditorOpen(true);
  };

  const openEditModal = (ann: LibraryAnnouncementItem) => {
    setEditingItem(ann);
    setFormState({
      title: ann.title,
      content: ann.content,
      category: ann.category,
      priority: ann.priority,
      target_type: ann.target_type,
      target_value: ann.target_value ?? '',
      publish_mode: ann.status === 'Scheduled' ? 'schedule' : ann.status === 'Draft' ? 'draft' : 'now',
      publish_at: ann.publish_at ? ann.publish_at.slice(0, 16) : '',
      expires_at: ann.expires_at ? ann.expires_at.slice(0, 16) : '',
      notify_on_published_edit: false,
    });
    setFormErrors({});
    setSubmitError(null);
    setEditorView('edit');
    setEditorOpen(true);
  };

  const openDetailModal = async (ann: LibraryAnnouncementItem) => {
    setInspectedItem(ann);
    if (!hasBackendApi) return;
    try {
      const res = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/announcements/${ann.announcement_id}`,
        { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
      );
      if (res.ok) {
        const fresh = (await res.json()) as LibraryAnnouncementItem;
        setInspectedItem(fresh);
      }
    } catch {
      // Keep list summary snapshot if detail lookup fails
    }
  };

  const targetOptionsForType = (type: AnnouncementTargetType): string[] => {
    if (type === 'department') return policy.departments;
    if (type === 'course') return policy.courses;
    if (type === 'academic_year') return policy.academic_years;
    return [];
  };

  const handleSaveOrRequestPublish = (requestedMode: 'draft' | 'now' | 'schedule' | 'edit_published') => {
    const nextForm: AnnouncementDraftForm =
      requestedMode === 'edit_published'
        ? formState
        : { ...formState, publish_mode: requestedMode };
    setFormState(nextForm);

    const validation = validateAnnouncementDraft(nextForm, policy, new Date());
    if (!validation.valid) {
      setFormErrors(validation.errors as Record<string, string>);
      setEditorView('edit');
      return;
    }

    setFormErrors({});
    setSubmitError(null);

    if (requestedMode === 'now' || requestedMode === 'schedule') {
      setPublishConfirmTarget({ mode: 'from_form' });
      return;
    }

    void commitFormToBackend(nextForm);
  };

  const commitFormToBackend = async (formToSubmit: AnnouncementDraftForm) => {
    const isEditingPublished = editingItem?.status === 'Published';
    const payload = buildAnnouncementApiPayload(formToSubmit, Boolean(isEditingPublished));

    if (!hasBackendApi) {
      const verb =
        formToSubmit.publish_mode === 'draft'
          ? 'Draft validated'
          : formToSubmit.publish_mode === 'schedule'
            ? 'Schedule validated'
            : isEditingPublished
              ? 'Update validated'
              : 'Publication validated';
      setFeedbackBanner({
        type: 'info',
        message: `${verb} for "${sanitizeAnnouncementText(formToSubmit.title)}" (${formatAnnouncementTargetLabel(formToSubmit.target_type, formToSubmit.target_value)}). Connect VITE_API_BASE_URL to persist records and trigger student notifications via ${editingItem ? `PUT /api/librarian/announcements/${editingItem.announcement_id}` : 'POST /api/librarian/announcements'}.`,
      });
      setPublishConfirmTarget(null);
      setEditorOpen(false);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const endpoint = editingItem
        ? `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/announcements/${editingItem.announcement_id}`
        : `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/announcements`;

      const res = await fetch(endpoint, {
        method: editingItem ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }

      const body = (await res.json().catch(() => null)) as {
        message?: string;
        notifications_created?: number;
      } | null;

      if (!res.ok) {
        throw new Error(mapAnnouncementApiError(res.status, body?.message));
      }

      setFeedbackBanner({
        type: 'success',
        message:
          body?.message ||
          (formToSubmit.publish_mode === 'now' && !isEditingPublished
            ? `Announcement published successfully${typeof body?.notifications_created === 'number' ? ` (${body.notifications_created} student notification records created)` : ''}.`
            : 'Announcement saved successfully.'),
      });
      setPublishConfirmTarget(null);
      setEditorOpen(false);
      await fetchAnnouncements();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to save announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmExistingPublish = async (ann: LibraryAnnouncementItem) => {
    if (!hasBackendApi) {
      setFeedbackBanner({
        type: 'info',
        message: `Publication ready for "${ann.title}" (${ann.target_label}). Connect VITE_API_BASE_URL to commit via POST /api/librarian/announcements/${ann.announcement_id}/publish.`,
      });
      setPublishConfirmTarget(null);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/announcements/${ann.announcement_id}/publish`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }
      );
      if (res.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        throw new Error(mapAnnouncementApiError(res.status, body?.message));
      }
      setFeedbackBanner({
        type: 'success',
        message: body?.message || `Announcement "${ann.title}" published to students.`,
      });
      setPublishConfirmTarget(null);
      setInspectedItem(null);
      await fetchAnnouncements();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to publish announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveConfirmTarget) return;
    if (!hasBackendApi) {
      setFeedbackBanner({
        type: 'info',
        message: `Archive action prepared for "${archiveConfirmTarget.title}". Connect VITE_API_BASE_URL to preserve historical record via POST /api/librarian/announcements/${archiveConfirmTarget.announcement_id}/archive.`,
      });
      setArchiveConfirmTarget(null);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/announcements/${archiveConfirmTarget.announcement_id}/archive`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }
      );
      if (res.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        throw new Error(mapAnnouncementApiError(res.status, body?.message));
      }
      setFeedbackBanner({
        type: 'success',
        message:
          body?.message ||
          `Announcement "${archiveConfirmTarget.title}" archived and preserved for administrative records.`,
      });
      setArchiveConfirmTarget(null);
      setInspectedItem(null);
      await fetchAnnouncements();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to archive announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!permissions.can_manage_announcements) {
    return (
      <CirculationAuthorizationBlocked
        title="Announcements Management Restricted"
        message="Your librarian account does not currently have permission to create, publish, or archive official announcements."
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[#142B4A] sm:text-2xl">
            Library Announcements
          </h2>
          <p className="mt-1 text-xs text-[#64748B] sm:text-sm">
            Share important library updates, notices and information with students.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] whitespace-nowrap cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Create Announcement</span>
          </button>
          <button
            type="button"
            onClick={() => void fetchAnnouncements()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'librarian-dashboard' })}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </section>

      {!hasBackendApi && (
        <div
          role="status"
          className="flex flex-col justify-between gap-2 rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] px-4 py-3 text-xs text-[#142B4A] sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <span>
              Sample announcements synchronized with Librarian Dashboard and Student Notifications are
              loaded while <code className="font-mono-tabular font-semibold">VITE_API_BASE_URL</code>{' '}
              is unconfigured. Authoritative publication, scheduling, and notification dispatch
              commit via{' '}
              <code className="font-mono-tabular font-semibold">
                POST / PUT /api/librarian/announcements
              </code>
              .
            </span>
          </div>
        </div>
      )}

      {feedbackBanner && (
        <div
          role={feedbackBanner.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            feedbackBanner.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : feedbackBanner.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-[#DBEAFE] bg-white text-[#142B4A]'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            aria-label="Dismiss announcement notice"
            className="text-slate-500 hover:text-[#142B4A] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <section
        aria-label="Announcements summary metrics"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('All');
            setPage(1);
          }}
          className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
            activeTab === 'All'
              ? 'border-[#2563EB] bg-white ring-2 ring-[#2563EB]/15'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <p className="text-xs font-medium text-[#64748B]">Total Announcements</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#142B4A]">
            {summary.total}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('Published');
            setPage(1);
          }}
          className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
            activeTab === 'Published'
              ? 'border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-400/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <p className="text-xs font-medium text-emerald-800">Published</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-emerald-700">
            {summary.published}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('Scheduled');
            setPage(1);
          }}
          className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
            activeTab === 'Scheduled'
              ? 'border-[#2563EB] bg-[#F5F8FC] ring-2 ring-[#2563EB]/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <p className="text-xs font-medium text-[#142B4A]">Scheduled</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#2563EB]">
            {summary.scheduled}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('Drafts');
            setPage(1);
          }}
          className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
            activeTab === 'Drafts'
              ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-400/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <p className="text-xs font-medium text-[#64748B]">Drafts</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#142B4A]">
            {summary.drafts}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('Archived');
            setPage(1);
          }}
          className={`col-span-2 sm:col-span-1 rounded-xl border p-4 text-left transition-colors cursor-pointer ${
            activeTab === 'Archived'
              ? 'border-slate-400 bg-slate-50 ring-2 ring-slate-400/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <p className="text-xs font-medium text-[#64748B]">Archived</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-slate-600">
            {summary.archived}
          </p>
        </button>
      </section>

      {/* Tabs + Search + Filter + List */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div
          role="tablist"
          aria-label="Announcement status filter"
          className="flex flex-wrap gap-2 border-b border-slate-100 pb-4"
        >
          {ANNOUNCEMENT_TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => {
                  setActiveTab(tab);
                  setPage(1);
                }}
                className={`min-h-[36px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#142B4A] text-white'
                    : 'border border-slate-200 bg-[#F5F8FC] text-[#1E293B] hover:border-[#2563EB] hover:text-[#2563EB]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Search & Filters */}
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="relative lg:col-span-5">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search announcements"
              placeholder="Search title, content, author, or category..."
              className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white py-2 pr-4 pl-10 text-xs text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
            />
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="ann-filter-category" className="sr-only">
              Filter by category
            </label>
            <select
              id="ann-filter-category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-[#1E293B]"
            >
              <option value="All">All Categories</option>
              {policy.categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="ann-filter-audience" className="sr-only">
              Filter by target audience
            </label>
            <select
              id="ann-filter-audience"
              value={targetFilter}
              onChange={(e) => {
                setTargetFilter(e.target.value as 'All' | AnnouncementTargetType);
                setPage(1);
              }}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-[#1E293B]"
            >
              <option value="All">All Audiences</option>
              <option value="all_students">All Students</option>
              {policy.supports_target_options.department && (
                <option value="department">Department</option>
              )}
              {policy.supports_target_options.course && <option value="course">Course</option>}
              {policy.supports_target_options.academic_year && (
                <option value="academic_year">Academic Year</option>
              )}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="ann-filter-date" className="sr-only">
              Filter by publication date
            </label>
            <input
              id="ann-filter-date"
              type="date"
              value={publishDateFilter}
              onChange={(e) => {
                setPublishDateFilter(e.target.value);
                setPage(1);
              }}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B]"
            />
          </div>
        </div>

        {/* List Body */}
        <div className="mt-5">
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-28 rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : loadError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-6 text-center"
            >
              <AlertCircle className="mx-auto h-7 w-7 text-red-600" aria-hidden="true" />
              <p className="mt-2 font-display text-sm font-bold text-red-950">
                Unable to load announcements
              </p>
              <p className="mt-1 text-xs text-red-800">{loadError}</p>
              <button
                type="button"
                onClick={() => void fetchAnnouncements()}
                className="mt-4 inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : paginatedView.items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-10 text-center">
              <Megaphone className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="mt-3 font-display text-base font-bold text-[#142B4A]">
                {items.length === 0 ? 'No announcements yet' : 'No matching announcements'}
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                {items.length === 0
                  ? 'Create your first announcement to share library updates with students.'
                  : 'Try switching tabs or adjusting your search and category filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedView.items.map((ann) => {
                const expired = isAnnouncementExpired(ann, new Date());
                return (
                  <article
                    key={ann.announcement_id}
                    className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#2563EB]/40 sm:p-5"
                  >
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-base font-bold text-[#142B4A]">
                            {ann.title}
                          </h3>
                          <CirculationStatusBadge status={ann.status} />
                          <CirculationStatusBadge status={ann.priority} />
                          <span className="rounded-md border border-slate-200 bg-[#F5F8FC] px-2 py-0.5 text-[11px] font-semibold text-[#142B4A]">
                            {ann.category}
                          </span>
                          {expired && ann.status !== 'Archived' && (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                              Expired
                            </span>
                          )}
                        </div>

                        <p className="line-clamp-2 text-xs leading-relaxed text-[#1E293B]">
                          {ann.content}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#64748B]">
                          <span>
                            Audience:{' '}
                            <strong className="text-[#142B4A]">{ann.target_label}</strong>
                          </span>
                          <span>By {ann.created_by}</span>
                          <span>
                            Created:{' '}
                            <span className="font-mono-tabular">
                              {formatLibrarianShortDate(ann.created_at)}
                            </span>
                          </span>
                          {ann.publish_at && (
                            <span>
                              {ann.status === 'Scheduled' ? 'Scheduled:' : 'Published:'}{' '}
                              <span className="font-mono-tabular text-[#142B4A]">
                                {formatStaffDateTime(ann.publish_at)}
                              </span>
                            </span>
                          )}
                          {ann.expires_at && (
                            <span>
                              Expires:{' '}
                              <span className="font-mono-tabular">
                                {formatLibrarianShortDate(ann.expires_at)}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                        <button
                          type="button"
                          onClick={() => void openDetailModal(ann)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Details</span>
                        </button>

                        {ann.status !== 'Archived' &&
                          (ann.status !== 'Published' || policy.allow_edit_published) && (
                            <button
                              type="button"
                              onClick={() => openEditModal(ann)}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Edit</span>
                            </button>
                          )}

                        {(ann.status === 'Draft' || ann.status === 'Scheduled') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSubmitError(null);
                              setPublishConfirmTarget({ mode: 'existing', existing: ann });
                            }}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                          >
                            <Send className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Publish</span>
                          </button>
                        )}

                        {ann.status !== 'Archived' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSubmitError(null);
                              setArchiveConfirmTarget(ann);
                            }}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 cursor-pointer"
                          >
                            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Archive</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}

              <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-[#64748B] sm:flex-row">
                <p>
                  Showing{' '}
                  <strong className="font-mono-tabular text-[#142B4A]">
                    {paginatedView.items.length}
                  </strong>{' '}
                  of{' '}
                  <strong className="font-mono-tabular text-[#142B4A]">
                    {paginatedView.totalCount}
                  </strong>{' '}
                  announcements
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={paginatedView.currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-[#142B4A] disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="font-mono-tabular font-semibold text-[#142B4A]">
                    Page {paginatedView.currentPage} of {paginatedView.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={paginatedView.currentPage >= paginatedView.totalPages}
                    onClick={() => setPage((p) => Math.min(paginatedView.totalPages, p + 1))}
                    className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-[#142B4A] disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ANNOUNCEMENT DETAILS MODAL */}
      {inspectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ann-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CirculationStatusBadge status={inspectedItem.status} />
                  <CirculationStatusBadge status={inspectedItem.priority} />
                  <span className="text-xs font-semibold text-[#64748B]">
                    {inspectedItem.category}
                  </span>
                </div>
                <h3
                  id="ann-detail-title"
                  className="font-display mt-1 text-lg font-bold text-[#142B4A]"
                >
                  {inspectedItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedItem(null)}
                aria-label="Close announcement details"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 p-6 text-xs">
              <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-4 leading-relaxed text-[#1E293B] whitespace-pre-line">
                {sanitizeAnnouncementText(inspectedItem.content)}
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
                <div>
                  <span className="text-[#64748B]">Target Audience:</span>{' '}
                  <strong className="text-[#142B4A]">{inspectedItem.target_label}</strong>
                </div>
                <div>
                  <span className="text-[#64748B]">Created By:</span>{' '}
                  <strong className="text-[#142B4A]">{inspectedItem.created_by}</strong>
                </div>
                <div>
                  <span className="text-[#64748B]">Created Date:</span>{' '}
                  <strong className="font-mono-tabular text-[#142B4A]">
                    {formatStaffDateTime(inspectedItem.created_at)}
                  </strong>
                </div>
                <div>
                  <span className="text-[#64748B]">
                    {inspectedItem.status === 'Scheduled' ? 'Scheduled For:' : 'Published Date:'}
                  </span>{' '}
                  <strong className="font-mono-tabular text-[#142B4A]">
                    {inspectedItem.publish_at ? formatStaffDateTime(inspectedItem.publish_at) : '—'}
                  </strong>
                </div>
                <div>
                  <span className="text-[#64748B]">Expiry Date:</span>{' '}
                  <strong className="font-mono-tabular text-[#142B4A]">
                    {inspectedItem.expires_at ? formatStaffDateTime(inspectedItem.expires_at) : 'No expiry'}
                  </strong>
                </div>
                <div>
                  <span className="text-[#64748B]">Last Updated:</span>{' '}
                  <strong className="font-mono-tabular text-[#142B4A]">
                    {formatStaffDateTime(inspectedItem.updated_at)}
                  </strong>
                </div>
              </div>

              {/* Delivery Statistics — only real backend fields */}
              <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
                <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                  <h4 className="font-display text-sm font-bold text-[#142B4A]">
                    Student Notification Delivery
                  </h4>
                </div>
                {inspectedItem.delivery_stats ? (
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-[11px] text-[#64748B]">Recipients</p>
                      <p className="font-mono-tabular mt-0.5 text-base font-bold text-[#142B4A]">
                        {inspectedItem.delivery_stats.recipients_count}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-[11px] text-[#64748B]">Notifications Created</p>
                      <p className="font-mono-tabular mt-0.5 text-base font-bold text-[#2563EB]">
                        {inspectedItem.delivery_stats.notifications_created}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-[11px] text-[#64748B]">Read Count</p>
                      <p className="font-mono-tabular mt-0.5 text-base font-bold text-emerald-700">
                        {inspectedItem.delivery_stats.read_count !== null
                          ? inspectedItem.delivery_stats.read_count
                          : 'Unavailable'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[#64748B]">
                    Student notifications will be generated when this announcement is published.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap gap-2">
                  {inspectedItem.status !== 'Archived' &&
                    (inspectedItem.status !== 'Published' || policy.allow_edit_published) && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = inspectedItem;
                          setInspectedItem(null);
                          openEditModal(target);
                        }}
                        className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
                      >
                        Edit Announcement
                      </button>
                    )}
                  {(inspectedItem.status === 'Draft' || inspectedItem.status === 'Scheduled') && (
                    <button
                      type="button"
                      onClick={() =>
                        setPublishConfirmTarget({ mode: 'existing', existing: inspectedItem })
                      }
                      className="min-h-[38px] rounded-lg bg-[#2563EB] px-3.5 py-2 font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                    >
                      Publish Now
                    </button>
                  )}
                  {inspectedItem.status !== 'Archived' && (
                    <button
                      type="button"
                      onClick={() => setArchiveConfirmTarget(inspectedItem)}
                      className="min-h-[38px] rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 font-semibold text-red-800 cursor-pointer"
                    >
                      Archive
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setInspectedItem(null)}
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-[#142B4A] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT & PREVIEW MODAL */}
      {editorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ann-editor-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h3 id="ann-editor-title" className="font-display text-lg font-bold text-[#142B4A]">
                  {editingItem ? 'Edit Library Announcement' : 'Create Announcement'}
                </h3>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  {editorView === 'edit'
                    ? 'Compose announcement metadata, target audience, and schedule.'
                    : 'Review student-facing preview before saving or publishing.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                aria-label="Close announcement editor"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 text-xs">
              {/* Write / Preview Switcher */}
              <div className="mb-5 flex gap-2 border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setEditorView('edit')}
                  className={`min-h-[34px] rounded-lg px-3.5 py-1.5 font-semibold cursor-pointer ${
                    editorView === 'edit'
                      ? 'bg-[#142B4A] text-white'
                      : 'border border-slate-200 bg-[#F5F8FC] text-[#142B4A]'
                  }`}
                >
                  Compose
                </button>
                <button
                  type="button"
                  onClick={() => setEditorView('preview')}
                  className={`min-h-[34px] rounded-lg px-3.5 py-1.5 font-semibold cursor-pointer ${
                    editorView === 'preview'
                      ? 'bg-[#142B4A] text-white'
                      : 'border border-slate-200 bg-[#F5F8FC] text-[#142B4A]'
                  }`}
                >
                  Preview Before Publishing
                </button>
              </div>

              {editorView === 'edit' ? (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="ann-title-input"
                      className="mb-1 block font-semibold text-[#142B4A]"
                    >
                      Announcement Title <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="ann-title-input"
                      type="text"
                      value={formState.title}
                      onChange={(e) => setFormState((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Extended Reading Hall Hours During Assessments"
                      className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                    />
                    {formErrors.title && (
                      <p className="mt-1 text-[11px] font-medium text-red-700">
                        {formErrors.title}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="ann-content-input"
                      className="mb-1 block font-semibold text-[#142B4A]"
                    >
                      Description <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      id="ann-content-input"
                      rows={5}
                      value={formState.content}
                      onChange={(e) => setFormState((p) => ({ ...p, content: e.target.value }))}
                      placeholder="Enter clear plain-text instructions, hours, or policy details for students..."
                      className="w-full rounded-lg border border-slate-300 p-3 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                    />
                    {formErrors.content && (
                      <p className="mt-1 text-[11px] font-medium text-red-700">
                        {formErrors.content}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="ann-category-select"
                        className="mb-1 block font-semibold text-[#142B4A]"
                      >
                        Category
                      </label>
                      <select
                        id="ann-category-select"
                        value={formState.category}
                        onChange={(e) => setFormState((p) => ({ ...p, category: e.target.value }))}
                        className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-[#1E293B]"
                      >
                        {policy.categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="ann-priority-select"
                        className="mb-1 block font-semibold text-[#142B4A]"
                      >
                        Priority
                      </label>
                      <select
                        id="ann-priority-select"
                        value={formState.priority}
                        onChange={(e) =>
                          setFormState((p) => ({
                            ...p,
                            priority: e.target.value as AnnouncementPriority,
                          }))
                        }
                        className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-[#1E293B]"
                      >
                        <option value="Normal">Normal</option>
                        <option value="Important">Important</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="ann-target-type"
                        className="mb-1 block font-semibold text-[#142B4A]"
                      >
                        Target Audience
                      </label>
                      <select
                        id="ann-target-type"
                        value={formState.target_type}
                        onChange={(e) => {
                          const nextType = e.target.value as AnnouncementTargetType;
                          const opts = targetOptionsForType(nextType);
                          setFormState((p) => ({
                            ...p,
                            target_type: nextType,
                            target_value: opts[0] ?? '',
                          }));
                        }}
                        className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-[#1E293B]"
                      >
                        <option value="all_students">All Students</option>
                        {policy.supports_target_options.department && (
                          <option value="department">Specific Department</option>
                        )}
                        {policy.supports_target_options.course && (
                          <option value="course">Specific Course</option>
                        )}
                        {policy.supports_target_options.academic_year && (
                          <option value="academic_year">Specific Academic Year</option>
                        )}
                      </select>
                    </div>

                    {formState.target_type !== 'all_students' && (
                      <div>
                        <label
                          htmlFor="ann-target-value"
                          className="mb-1 block font-semibold text-[#142B4A]"
                        >
                          Select Target Group <span className="text-red-600">*</span>
                        </label>
                        <select
                          id="ann-target-value"
                          value={formState.target_value}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, target_value: e.target.value }))
                          }
                          className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-[#1E293B]"
                        >
                          <option value="">Choose...</option>
                          {targetOptionsForType(formState.target_type).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        {formErrors.target_value && (
                          <p className="mt-1 text-[11px] font-medium text-red-700">
                            {formErrors.target_value}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Schedule / Expiry */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {editingItem?.status !== 'Published' && policy.supports_scheduling && (
                      <div>
                        <label
                          htmlFor="ann-schedule-input"
                          className="mb-1 block font-semibold text-[#142B4A]"
                        >
                          Schedule Date &amp; Time (optional for immediate publish)
                        </label>
                        <input
                          id="ann-schedule-input"
                          type="datetime-local"
                          value={formState.publish_at}
                          onChange={(e) =>
                            setFormState((p) => ({
                              ...p,
                              publish_at: e.target.value,
                              publish_mode: e.target.value ? 'schedule' : 'now',
                            }))
                          }
                          className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-xs text-[#1E293B]"
                        />
                        {formErrors.publish_at && (
                          <p className="mt-1 text-[11px] font-medium text-red-700">
                            {formErrors.publish_at}
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="ann-expiry-input"
                        className="mb-1 block font-semibold text-[#142B4A]"
                      >
                        Expiry Date (optional)
                      </label>
                      <input
                        id="ann-expiry-input"
                        type="datetime-local"
                        value={formState.expires_at}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, expires_at: e.target.value }))
                        }
                        className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-xs text-[#1E293B]"
                      />
                      {formErrors.expires_at && (
                        <p className="mt-1 text-[11px] font-medium text-red-700">
                          {formErrors.expires_at}
                        </p>
                      )}
                    </div>
                  </div>

                  {editingItem?.status === 'Published' && (
                    <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-[#F5F8FC] p-3">
                      <input
                        type="checkbox"
                        checked={formState.notify_on_published_edit}
                        onChange={(e) =>
                          setFormState((p) => ({
                            ...p,
                            notify_on_published_edit: e.target.checked,
                          }))
                        }
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#2563EB]"
                      />
                      <span className="text-[#1E293B]">
                        Send an update notification to students (leave unchecked for minor spelling
                        or date corrections to avoid notification fatigue).
                      </span>
                    </label>
                  )}
                </div>
              ) : (
                /* PREVIEW MODE */
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <CirculationStatusBadge status={formState.priority} />
                      <span className="rounded bg-white px-2 py-0.5 text-[11px] font-semibold text-[#142B4A]">
                        {formState.category}
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        Audience:{' '}
                        <strong className="text-[#142B4A]">
                          {formatAnnouncementTargetLabel(
                            formState.target_type,
                            formState.target_value
                          )}
                        </strong>
                      </span>
                    </div>
                    <h4 className="font-display mt-2.5 text-lg font-bold text-[#142B4A]">
                      {sanitizeAnnouncementText(formState.title) || '(Untitled announcement)'}
                    </h4>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#1E293B]">
                      {sanitizeAnnouncementText(formState.content) || '(No description entered yet.)'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-200/70 pt-3 text-[11px] text-[#64748B]">
                      <span>
                        Publication:{' '}
                        <strong className="text-[#142B4A]">
                          {formState.publish_mode === 'schedule' && formState.publish_at
                            ? formatStaffDateTime(formState.publish_at)
                            : 'Immediate upon publish'}
                        </strong>
                      </span>
                      <span>
                        Expiry:{' '}
                        <strong className="text-[#142B4A]">
                          {formState.expires_at
                            ? formatStaffDateTime(formState.expires_at)
                            : 'None'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditorView('edit')}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 font-semibold text-[#142B4A] cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Return to Editing</span>
                  </button>
                </div>
              )}

              {submitError && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-medium text-red-900"
                >
                  {submitError}
                </div>
              )}

              {/* Footer Publishing Actions */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setEditorOpen(false)}
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-[#142B4A] cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {editingItem?.status === 'Published' ? (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSaveOrRequestPublish('edit_published')}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                    >
                      {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                      <span>Save Changes</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleSaveOrRequestPublish('draft')}
                        className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
                      >
                        Save Draft
                      </button>

                      {policy.supports_scheduling && formState.publish_at.trim() && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleSaveOrRequestPublish('schedule')}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#142B4A] px-4 py-2 font-semibold text-white hover:bg-[#1E3A5F] cursor-pointer"
                        >
                          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Schedule</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleSaveOrRequestPublish('now')}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Publish Now</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PUBLISH CONFIRMATION DIALOG */}
      {publishConfirmTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ann-publish-confirm-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3
              id="ann-publish-confirm-title"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Publish this announcement to the selected audience?
            </h3>

            {(() => {
              const targetLabel =
                publishConfirmTarget.mode === 'existing' && publishConfirmTarget.existing
                  ? publishConfirmTarget.existing.target_label
                  : formatAnnouncementTargetLabel(formState.target_type, formState.target_value);
              const count =
                publishConfirmTarget.mode === 'existing'
                  ? publishConfirmTarget.existing?.estimated_recipient_count
                  : editingItem?.estimated_recipient_count ?? null;

              return (
                <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-[#F5F8FC] p-3.5 text-xs text-[#1E293B]">
                  <p>
                    <span className="text-[#64748B]">Target Audience:</span>{' '}
                    <strong className="text-[#142B4A]">{targetLabel}</strong>
                  </p>
                  {typeof count === 'number' && (
                    <p className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                      <span>
                        Estimated Recipients:{' '}
                        <strong className="font-mono-tabular text-[#142B4A]">{count}</strong>
                      </span>
                    </p>
                  )}
                  <p className="text-[#64748B]">
                    In-app notifications will be created for eligible students via the backend
                    notification service.
                  </p>
                </div>
              );
            })()}

            {submitError && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-900"
              >
                {submitError}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setPublishConfirmTarget(null)}
                className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  if (publishConfirmTarget.mode === 'existing' && publishConfirmTarget.existing) {
                    void handleConfirmExistingPublish(publishConfirmTarget.existing);
                  } else {
                    void commitFormToBackend(formState);
                  }
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                <span>
                  {publishConfirmTarget.mode === 'from_form' && formState.publish_mode === 'schedule'
                    ? 'Confirm Schedule'
                    : 'Confirm & Publish'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVE CONFIRMATION DIALOG */}
      {archiveConfirmTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ann-archive-confirm-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3
              id="ann-archive-confirm-title"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Archive this announcement?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
              Archiving removes &ldquo;{archiveConfirmTarget.title}&rdquo; from active student
              banners while preserving the announcement and delivery history for administrative
              records.
            </p>

            {submitError && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-900"
              >
                {submitError}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setArchiveConfirmTarget(null)}
                className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleConfirmArchive()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3A5F] cursor-pointer"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                <span>Confirm Archive</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
