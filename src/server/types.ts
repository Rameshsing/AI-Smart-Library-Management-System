import type { AdminPermissions, AdminProfile } from '../utils/adminDashboard.ts';
import type {
  AdminAuditLogEntry,
  CatalogCategoryRecord,
  CatalogSubjectRecord,
  LibraryBranchRecord,
  LibraryPolicySettings,
  RolePermissionDefinition,
  StaffAccountRecord,
} from '../utils/adminManagement.ts';
import type { CopyCondition, CopyStatus, InventoryFormat } from '../utils/librarianInventory.ts';
import type {
  AnnouncementPriority,
  AnnouncementStatus,
  AnnouncementTargetType,
} from '../utils/librarianAnnouncements.ts';
import type { LibrarianProfile } from '../utils/librarianDashboard.ts';
import type {
  LibrarianNotificationPreferenceItem,
  LibrarianSessionRecord,
} from '../utils/librarianProfile.ts';
import type { OverdueFinePaymentStatus, OverdueReminderLogItem } from '../utils/librarianOverdue.ts';
import type { NotificationCategory, NotificationPreferencesPayload, NotificationPriority, NotificationRelatedEntityType } from '../utils/notificationsPage.ts';
import type { RecommendationFeedbackValue } from '../utils/recommendationsPage.ts';
import type { RecommendationPreferences } from '../utils/studentProfilePage.ts';

export type UserRole = 'student' | 'librarian' | 'admin';

export interface DbUser {
  user_id: number;
  role: UserRole;
  full_name: string;
  email: string;
  code: string; // student_code / staff_code
  password_hash: string; // scrypt "salt:hash"
  account_status: 'Active' | 'Blocked' | 'Suspended' | 'Inactive';
  avatar_url: string | null;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;

  // Student fields
  department?: string;
  program?: string;
  institution?: string;
  academic_year?: string;
  semester?: string;
  mobile?: string | null;
  interests?: string[];
  preferred_subjects?: string[];
  preferred_authors?: string[];
  restriction_reason?: string | null;
  recommendation_preferences?: RecommendationPreferences;
  notification_preferences?: NotificationPreferencesPayload;

  // Staff / Admin fields
  designation?: string;
  branch?: string;
  joining_date?: string;
  invitation_pending?: boolean;
  invitation_sent_at?: string | null;
  librarian_notification_preferences?:
    | LibrarianNotificationPreferenceItem[]
    | Record<string, boolean>;
}

export interface DbSession {
  session_id: string;
  user_id: number;
  role: UserRole;
  device_label: string;
  ip_address: string;
  created_at: string;
  last_active_at: string;
  expires_at: string;
}

export interface DbBook {
  book_id: number;
  slug: string;
  isbn: string;
  title: string;
  subtitle: string;
  authors: string;
  publisher: string;
  publication_year: number;
  edition: string;
  language: 'English' | 'Hindi' | 'Other';
  pages: number;
  category: string;
  subject: string;
  description: string;
  keywords: string[];
  format: InventoryFormat;
  catalog_format: 'Physical Book' | 'E-Book';
  cover_image: string;
  status: 'Active' | 'Archived';
  branch: string;
  floor: string;
  section: string;
  shelf: string;
  total_copies: number;
  available_copies: number;
  issued_copies: number;
  reserved_copies: number;
  unavailable_copies: number;
  rating_average: number;
  rating_count: number;
  review_count: number;
  borrow_count: number;
  created_at: string;
  updated_at: string;
  added_by: string | null;
  updated_by: string | null;
}

export interface DbBookCopy {
  copy_id: number;
  book_id: number;
  accession_number: string;
  barcode: string | null;
  status: CopyStatus;
  condition: CopyCondition;
  branch: string;
  floor: string;
  section: string;
  shelf: string;
  added_at: string;
  updated_at: string;
}

export interface DbBorrowing {
  borrowing_id: number;
  transaction_code: string;
  student_id: number;
  book_id: number;
  copy_id: number;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  status: 'Issued' | 'Overdue' | 'Renewal Pending' | 'Returned';
  renewals_used: number;
  progress_percent: number;
  issued_by_staff_name: string | null;
  returned_condition: 'Good' | 'Fair' | 'Damaged' | 'Lost' | null;
  condition_notes: string | null;
  fine_amount: number | null;
  fine_payment_status: OverdueFinePaymentStatus | null;
  fine_outstanding_balance: number | null;
  last_reminder_at: string | null;
  reminder_history: OverdueReminderLogItem[];
  created_at: string;
  updated_at: string;
}

export interface DbReservation {
  reservation_id: number;
  reservation_code: string;
  student_id: number;
  book_id: number;
  reservation_date: string;
  status: 'Waiting' | 'Ready for Pickup' | 'Completed' | 'Cancelled' | 'Expired';
  ready_date: string | null;
  pickup_deadline: string | null;
  assigned_copy_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbReview {
  rating_id: number;
  student_id: number;
  book_id: number;
  rating: number;
  review: string;
  created_at: string;
  updated_at: string;
}

export interface DbRecommendationFeedback {
  student_id: number;
  book_id: number;
  feedback: RecommendationFeedbackValue;
  updated_at: string;
}

export interface DbNotification {
  notification_id: number;
  user_id: number;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  is_read: boolean;
  related_entity_type: NotificationRelatedEntityType;
  related_entity_id: number | null;
  related_book_id: number | null;
  related_book_title: string | null;
  action_label: string | null;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
  can_delete: boolean;
  is_mandatory: boolean;
  announcement_author: string | null;
  dedupe_key?: string | null;
}

export interface DbAnnouncement {
  announcement_id: number;
  title: string;
  content: string;
  category: string;
  priority: AnnouncementPriority;
  target_type: AnnouncementTargetType;
  target_value: string | null;
  status: AnnouncementStatus;
  publish_at: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  notifications_sent: boolean;
  notifications_created: number;
  recipients_count: number;
}

export interface LibraryDbState {
  version: number;
  nextIds: {
    user: number;
    book: number;
    copy: number;
    borrowing: number;
    reservation: number;
    review: number;
    notification: number;
    announcement: number;
    category: number;
    subject: number;
    branch: number;
  };
  users: DbUser[];
  sessions: DbSession[];
  books: DbBook[];
  copies: DbBookCopy[];
  borrowings: DbBorrowing[];
  reservations: DbReservation[];
  reviews: DbReview[];
  recommendationFeedback: DbRecommendationFeedback[];
  notifications: DbNotification[];
  announcements: DbAnnouncement[];
  categories: CatalogCategoryRecord[];
  subjects: CatalogSubjectRecord[];
  branches: LibraryBranchRecord[];
  librarySettings: LibraryPolicySettings;
  roles: RolePermissionDefinition[];
  auditLogs: AdminAuditLogEntry[];
}

export type SessionResponsePayload = {
  authenticated: boolean;
  verified_role?: UserRole;
  role?: UserRole;
  user?: {
    user_id: number;
    full_name: string;
    email: string;
    code: string;
    role: UserRole;
    account_status: string;
  };
  student?: {
    student_id: number;
    student_code: string;
    name: string;
    email: string;
    course_department: string;
    academic_year: string;
    avatar_url: string;
    interests: string[];
    preferred_subjects: string[];
  };
  librarian?: LibrarianProfile;
  admin?: AdminProfile;
  permissions?: AdminPermissions;
  sessions?: LibrarianSessionRecord[];
  staffAccount?: StaffAccountRecord;
  message?: string;
};
