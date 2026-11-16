import { createSampleLibrarianDashboardBundles } from './librarianDashboard';

export type AnnouncementStatus = 'Draft' | 'Scheduled' | 'Published' | 'Archived';
export type AnnouncementFilterTab = 'All' | 'Published' | 'Drafts' | 'Scheduled' | 'Archived';
export type AnnouncementPriority = 'Normal' | 'Important' | 'Urgent';
export type AnnouncementTargetType = 'all_students' | 'department' | 'course' | 'academic_year';

export const DEFAULT_ANNOUNCEMENT_CATEGORIES: string[] = [
  'General Notice',
  'Library Timings',
  'New Arrivals',
  'Maintenance',
  'Events',
  'Book Return Reminder',
  'Examination Notice',
  'Policy Update',
];

export interface AnnouncementDeliveryStats {
  notifications_created: number;
  recipients_count: number;
  read_count: number | null;
}

export interface LibraryAnnouncementItem {
  announcement_id: number;
  title: string;
  content: string;
  category: string;
  priority: AnnouncementPriority;
  target_type: AnnouncementTargetType;
  target_value: string | null;
  target_label: string;
  status: AnnouncementStatus;
  publish_at: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  estimated_recipient_count: number | null;
  delivery_stats: AnnouncementDeliveryStats | null;
}

export interface AnnouncementPolicyCapabilities {
  categories: string[];
  supports_scheduling: boolean;
  supports_target_options: {
    all_students: boolean;
    department: boolean;
    course: boolean;
    academic_year: boolean;
  };
  supports_email_notifications: boolean;
  allow_edit_published: boolean;
  departments: string[];
  courses: string[];
  academic_years: string[];
  timezone_label: string;
}

export interface AnnouncementsSummaryCounts {
  total: number;
  published: number;
  scheduled: number;
  drafts: number;
  archived: number;
}

export interface AnnouncementFilterCriteria {
  tab: AnnouncementFilterTab;
  query: string;
  category: string;
  targetType: 'All' | AnnouncementTargetType;
  publishDate: string;
}

export interface AnnouncementDraftForm {
  title: string;
  content: string;
  category: string;
  priority: AnnouncementPriority;
  target_type: AnnouncementTargetType;
  target_value: string;
  publish_mode: 'now' | 'schedule' | 'draft';
  publish_at: string;
  expires_at: string;
  notify_on_published_edit: boolean;
}

export function sanitizeAnnouncementText(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

export function formatAnnouncementTargetLabel(
  targetType: AnnouncementTargetType,
  targetValue: string | null | undefined
): string {
  const cleanVal = targetValue?.trim();
  switch (targetType) {
    case 'all_students':
      return 'All Students';
    case 'department':
      return cleanVal ? `Department: ${cleanVal}` : 'Specific Department';
    case 'course':
      return cleanVal ? `Course: ${cleanVal}` : 'Specific Course';
    case 'academic_year':
      return cleanVal ? `Academic Year: ${cleanVal}` : 'Specific Academic Year';
  }
}

export function isAnnouncementExpired(
  item: Pick<LibraryAnnouncementItem, 'expires_at' | 'status'>,
  referenceDate: Date
): boolean {
  if (!item.expires_at) return false;
  const expiry = new Date(item.expires_at);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() < referenceDate.getTime();
}

export function computeAnnouncementsSummary(
  items: LibraryAnnouncementItem[]
): AnnouncementsSummaryCounts {
  let published = 0;
  let scheduled = 0;
  let drafts = 0;
  let archived = 0;

  for (const item of items) {
    if (item.status === 'Published') published += 1;
    else if (item.status === 'Scheduled') scheduled += 1;
    else if (item.status === 'Draft') drafts += 1;
    else if (item.status === 'Archived') archived += 1;
  }

  return {
    total: items.length,
    published,
    scheduled,
    drafts,
    archived,
  };
}

export function filterAndPaginateAnnouncements(
  items: LibraryAnnouncementItem[],
  criteria: AnnouncementFilterCriteria,
  page: number,
  pageSize: number
): {
  items: LibraryAnnouncementItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
} {
  const lower = criteria.query.trim().toLowerCase();

  const filtered = items
    .filter((item) => {
      if (criteria.tab === 'Published' && item.status !== 'Published') return false;
      if (criteria.tab === 'Drafts' && item.status !== 'Draft') return false;
      if (criteria.tab === 'Scheduled' && item.status !== 'Scheduled') return false;
      if (criteria.tab === 'Archived' && item.status !== 'Archived') return false;

      if (criteria.category !== 'All' && item.category !== criteria.category) return false;
      if (criteria.targetType !== 'All' && item.target_type !== criteria.targetType) return false;

      if (criteria.publishDate) {
        const pubDate = (item.publish_at ?? item.created_at).slice(0, 10);
        if (pubDate !== criteria.publishDate) return false;
      }

      if (!lower) return true;
      return (
        item.title.toLowerCase().includes(lower) ||
        item.content.toLowerCase().includes(lower) ||
        item.created_by.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower) ||
        item.target_label.toLowerCase().includes(lower)
      );
    })
    .sort((a, b) => {
      const aTime = a.publish_at ?? a.updated_at ?? a.created_at;
      const bTime = b.publish_at ?? b.updated_at ?? b.created_at;
      return bTime.localeCompare(aTime);
    });

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    totalCount,
    totalPages,
    currentPage,
  };
}

export function buildAnnouncementsApiQueryParams(
  criteria: AnnouncementFilterCriteria,
  page: number,
  pageSize: number
): URLSearchParams {
  const params = new URLSearchParams();
  if (criteria.tab !== 'All') {
    const statusMap: Record<Exclude<AnnouncementFilterTab, 'All'>, AnnouncementStatus> = {
      Published: 'Published',
      Drafts: 'Draft',
      Scheduled: 'Scheduled',
      Archived: 'Archived',
    };
    params.set('status', statusMap[criteria.tab]);
  }
  if (criteria.query.trim()) params.set('q', criteria.query.trim());
  if (criteria.category !== 'All') params.set('category', criteria.category);
  if (criteria.targetType !== 'All') params.set('target_type', criteria.targetType);
  if (criteria.publishDate) params.set('publish_date', criteria.publishDate);
  params.set('page', String(page));
  params.set('limit', String(pageSize));
  return params;
}

export function validateAnnouncementDraft(
  form: AnnouncementDraftForm,
  policy: Pick<AnnouncementPolicyCapabilities, 'supports_scheduling' | 'supports_target_options'>,
  referenceDate: Date
): { valid: boolean; errors: Partial<Record<keyof AnnouncementDraftForm | 'general', string>> } {
  const errors: Partial<Record<keyof AnnouncementDraftForm | 'general', string>> = {};
  const cleanTitle = sanitizeAnnouncementText(form.title);
  const cleanContent = sanitizeAnnouncementText(form.content);

  if (cleanTitle.length < 4) {
    errors.title = 'Enter a clear announcement title (at least 4 characters).';
  } else if (cleanTitle.length > 160) {
    errors.title = 'Announcement title cannot exceed 160 characters.';
  }

  if (cleanContent.length < 10) {
    errors.content = 'Enter the announcement message for students (at least 10 characters).';
  }

  if (!form.category.trim()) {
    errors.category = 'Select an announcement category.';
  }

  if (!policy.supports_target_options[form.target_type]) {
    errors.target_type = 'Selected audience targeting option is not supported by the backend.';
  }

  if (form.target_type !== 'all_students' && !form.target_value.trim()) {
    errors.target_value = 'Select a target group value for the chosen audience.';
  }

  if (form.publish_mode === 'schedule') {
    if (!policy.supports_scheduling) {
      errors.publish_mode = 'Scheduled publication is disabled by current library configuration.';
    } else if (!form.publish_at.trim()) {
      errors.publish_at = 'Select a future publication date and time.';
    } else {
      const scheduledMs = new Date(form.publish_at).getTime();
      if (Number.isNaN(scheduledMs) || scheduledMs <= referenceDate.getTime()) {
        errors.publish_at = 'Scheduled publication time must be in the future.';
      }
    }
  }

  if (form.expires_at.trim()) {
    const expiryMs = new Date(form.expires_at).getTime();
    if (Number.isNaN(expiryMs)) {
      errors.expires_at = 'Enter a valid expiry date.';
    } else {
      const effectivePublishMs =
        form.publish_mode === 'schedule' && form.publish_at
          ? new Date(form.publish_at).getTime()
          : referenceDate.getTime();
      if (!Number.isNaN(effectivePublishMs) && expiryMs <= effectivePublishMs) {
        errors.expires_at = 'Expiry date must be after the publication date.';
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function buildAnnouncementApiPayload(
  form: AnnouncementDraftForm,
  isEditingPublished: boolean
): Record<string, unknown> {
  return {
    title: sanitizeAnnouncementText(form.title),
    content: sanitizeAnnouncementText(form.content),
    category: form.category.trim(),
    priority: form.priority,
    target_type: form.target_type,
    target_value: form.target_type === 'all_students' ? null : form.target_value.trim(),
    publish_mode: isEditingPublished ? 'keep_published' : form.publish_mode,
    publish_at: form.publish_mode === 'schedule' ? form.publish_at : null,
    expires_at: form.expires_at.trim() || null,
    notify_students_on_edit: isEditingPublished ? form.notify_on_published_edit : undefined,
  };
}

export function mapAnnouncementApiError(status: number, rawMessage?: string | null): string {
  const msg = rawMessage?.trim();
  if (status === 401) {
    return 'Your librarian session expired. Sign in again to manage library announcements.';
  }
  if (status === 403) {
    return msg || 'Your staff account does not have permission to publish or edit announcements.';
  }
  if (status === 404) {
    return msg || 'Announcement record was not found.';
  }
  if (status === 400 || status === 422) {
    return msg || 'Unable to publish announcement. Please review the form inputs and try again.';
  }
  if (status >= 500) {
    return msg || 'A server error prevented saving or publishing this announcement. Please retry.';
  }
  return msg || `Announcement request failed (${status}).`;
}

function addDaysIso(baseDate: Date, offsetDays: number): string {
  const target = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + offsetDays
  );
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface SampleAnnouncementsStore {
  policy: AnnouncementPolicyCapabilities;
  items: LibraryAnnouncementItem[];
}

export function createSampleAnnouncementsStore(
  referenceDate: Date = new Date()
): SampleAnnouncementsStore {
  const dashboardBundles = createSampleLibrarianDashboardBundles(referenceDate);

  const policy: AnnouncementPolicyCapabilities = {
    categories: DEFAULT_ANNOUNCEMENT_CATEGORIES,
    supports_scheduling: true,
    supports_target_options: {
      all_students: true,
      department: true,
      course: true,
      academic_year: true,
    },
    supports_email_notifications: false,
    allow_edit_published: true,
    departments: [
      'Computer Science & Engineering',
      'Artificial Intelligence & Data Science',
      'Software Engineering',
      'Data Science',
      'Cognitive & Behavioural Sciences',
    ],
    courses: [
      'B.Tech CSE',
      'B.Tech AI',
      'M.Tech AI',
      'B.Tech SE',
      'B.Sc Data Science',
      'B.A. Psychology',
    ],
    academic_years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate'],
    timezone_label: 'Asia/Kolkata (IST)',
  };

  const dashAnn1 = dashboardBundles.announcements[0];
  const dashAnn2 = dashboardBundles.announcements[1];

  const items: LibraryAnnouncementItem[] = [
    {
      announcement_id: dashAnn1?.announcement_id ?? 301,
      title:
        dashAnn1?.title ?? 'Extended Reading Hall Hours During End-Semester Assessments',
      content:
        dashAnn1?.description ??
        'Main Library Reading Halls and Circulation Desks stay open from 07:30 to 23:00 for exam preparation.',
      category: 'Library Timings',
      priority: 'Important',
      target_type: 'all_students',
      target_value: null,
      target_label: 'All Students',
      status: 'Published',
      publish_at: `${addDaysIso(referenceDate, -2)}T09:00:00`,
      expires_at: `${addDaysIso(referenceDate, 18)}T23:00:00`,
      created_by: 'Dr. Priya Nair · Head of Circulation',
      created_at: `${addDaysIso(referenceDate, -2)}T08:30:00`,
      updated_at: `${addDaysIso(referenceDate, -2)}T09:00:00`,
      estimated_recipient_count: 1420,
      delivery_stats: {
        notifications_created: 1420,
        recipients_count: 1420,
        read_count: 964,
      },
    },
    {
      announcement_id: dashAnn2?.announcement_id ?? 302,
      title: dashAnn2?.title ?? 'Annual Stock Verification & Reference Audit Notice',
      content:
        dashAnn2?.description ??
        'Departmental reserve shelves CS-200 through AI-150 will undergo barcode verification next Monday. Students may request holds online while physical bays are audited.',
      category: 'Maintenance',
      priority: 'Urgent',
      target_type: 'department',
      target_value: 'Computer Science & Engineering',
      target_label: 'Department: Computer Science & Engineering',
      status: 'Published',
      publish_at: `${addDaysIso(referenceDate, 0)}T08:15:00`,
      expires_at: `${addDaysIso(referenceDate, 7)}T18:00:00`,
      created_by: 'Cataloguing & Inventory Team',
      created_at: `${addDaysIso(referenceDate, -1)}T16:40:00`,
      updated_at: `${addDaysIso(referenceDate, 0)}T08:15:00`,
      estimated_recipient_count: 410,
      delivery_stats: {
        notifications_created: 410,
        recipients_count: 410,
        read_count: 218,
      },
    },
    {
      announcement_id: 303,
      title: 'New AI & Distributed Systems Titles Added to Floor 3 Reference Collection',
      content:
        'Eighteen newly catalogued titles covering deep learning architectures, vector retrieval, and distributed databases are now open for 7-day student borrowing.',
      category: 'New Arrivals',
      priority: 'Normal',
      target_type: 'course',
      target_value: 'B.Tech AI',
      target_label: 'Course: B.Tech AI',
      status: 'Scheduled',
      publish_at: `${addDaysIso(referenceDate, 2)}T09:00:00`,
      expires_at: `${addDaysIso(referenceDate, 30)}T18:00:00`,
      created_by: 'Dr. Priya Nair · Head of Circulation',
      created_at: `${addDaysIso(referenceDate, 0)}T09:20:00`,
      updated_at: `${addDaysIso(referenceDate, 0)}T09:20:00`,
      estimated_recipient_count: 185,
      delivery_stats: null,
    },
    {
      announcement_id: 304,
      title: 'End-of-Semester Book Return & Clearance Guidelines for Graduating Cohorts',
      content:
        'Final-year students must return all active library loans before clearance verification. Hold-shelf requests remain paused for graduating accounts after clearance cut-off.',
      category: 'Book Return Reminder',
      priority: 'Important',
      target_type: 'academic_year',
      target_value: '4th Year',
      target_label: 'Academic Year: 4th Year',
      status: 'Draft',
      publish_at: null,
      expires_at: null,
      created_by: 'Dr. Priya Nair · Head of Circulation',
      created_at: `${addDaysIso(referenceDate, -1)}T11:10:00`,
      updated_at: `${addDaysIso(referenceDate, -1)}T11:45:00`,
      estimated_recipient_count: 320,
      delivery_stats: null,
    },
    {
      announcement_id: 305,
      title: 'Orientation Workshop: Using AI Smart Library Recommendations & Citation Tools',
      content:
        'First-year orientation sessions in Digital Commons Lab B covered catalog filtering, subject preferences, and reservation alerts.',
      category: 'Events',
      priority: 'Normal',
      target_type: 'academic_year',
      target_value: '1st Year',
      target_label: 'Academic Year: 1st Year',
      status: 'Archived',
      publish_at: `${addDaysIso(referenceDate, -25)}T09:00:00`,
      expires_at: `${addDaysIso(referenceDate, -10)}T17:00:00`,
      created_by: 'Student Outreach Desk',
      created_at: `${addDaysIso(referenceDate, -27)}T14:00:00`,
      updated_at: `${addDaysIso(referenceDate, -9)}T10:00:00`,
      estimated_recipient_count: 390,
      delivery_stats: {
        notifications_created: 390,
        recipients_count: 390,
        read_count: 341,
      },
    },
  ];

  return {
    policy,
    items,
  };
}
