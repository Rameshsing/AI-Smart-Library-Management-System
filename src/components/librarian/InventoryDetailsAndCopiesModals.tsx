import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Barcode,
  BookmarkCheck,
  BookOpen,
  CheckCircle2,
  Edit3,
  Layers,
  MapPin,
  Plus,
  Sparkles,
  Star,
  Wrench,
  X,
} from 'lucide-react';
import {
  ALL_COPY_CONDITIONS,
  generateAccessionNumbers,
  validateCopyStatusTransition,
  validateNewCopyInput,
  type CopyCondition,
  type CopyStatus,
  type InventoryBookItem,
  type InventoryCapabilities,
  type InventoryPhysicalCopy,
  type TitleAvailabilityStatus,
} from '../../utils/librarianInventory';

export function getTitleStatusBadge(status: TitleAvailabilityStatus): {
  classes: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'Available':
      return {
        classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        icon: <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-700" aria-hidden="true" />,
      };
    case 'Partially Available':
      return {
        classes: 'border-[#DBEAFE] bg-[#EFF6FF] text-[#142B4A]',
        icon: <BookOpen className="h-3 w-3 shrink-0 text-[#2563EB]" aria-hidden="true" />,
      };
    case 'Fully Issued':
      return {
        classes: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: <BookOpen className="h-3 w-3 shrink-0 text-amber-700" aria-hidden="true" />,
      };
    case 'Reserved/Held':
      return {
        classes: 'border-indigo-200 bg-indigo-50 text-indigo-800',
        icon: <BookmarkCheck className="h-3 w-3 shrink-0 text-indigo-700" aria-hidden="true" />,
      };
    case 'Archived':
      return {
        classes: 'border-slate-300 bg-slate-100 text-slate-700',
        icon: <Archive className="h-3 w-3 shrink-0 text-slate-600" aria-hidden="true" />,
      };
    case 'Unavailable':
      return {
        classes: 'border-red-200 bg-red-50 text-red-800',
        icon: <AlertTriangle className="h-3 w-3 shrink-0 text-red-600" aria-hidden="true" />,
      };
  }
}

export function getCopyStatusBadge(status: CopyStatus): {
  classes: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'Available':
      return {
        classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        icon: <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-700" aria-hidden="true" />,
      };
    case 'Issued':
      return {
        classes: 'border-[#DBEAFE] bg-[#EFF6FF] text-[#142B4A]',
        icon: <BookOpen className="h-3 w-3 shrink-0 text-[#2563EB]" aria-hidden="true" />,
      };
    case 'Reserved':
      return {
        classes: 'border-indigo-200 bg-indigo-50 text-indigo-800',
        icon: <BookmarkCheck className="h-3 w-3 shrink-0 text-indigo-700" aria-hidden="true" />,
      };
    case 'Under Repair':
      return {
        classes: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: <Wrench className="h-3 w-3 shrink-0 text-amber-700" aria-hidden="true" />,
      };
    case 'Damaged':
    case 'Lost':
      return {
        classes: 'border-red-200 bg-red-50 text-red-800',
        icon: <AlertTriangle className="h-3 w-3 shrink-0 text-red-600" aria-hidden="true" />,
      };
    case 'Retired':
      return {
        classes: 'border-slate-300 bg-slate-100 text-slate-700',
        icon: <Archive className="h-3 w-3 shrink-0 text-slate-600" aria-hidden="true" />,
      };
  }
}

interface BookDetailsModalProps {
  book: InventoryBookItem | null;
  capabilities: InventoryCapabilities;
  canModify: boolean;
  onClose: () => void;
  onEdit: (book: InventoryBookItem) => void;
  onManageCopies: (book: InventoryBookItem) => void;
  onArchive: (book: InventoryBookItem) => void;
}

export function BookDetailsModal({
  book,
  capabilities,
  canModify,
  onClose,
  onEdit,
  onManageCopies,
  onArchive,
}: BookDetailsModalProps) {
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    setCoverFailed(false);
  }, [book?.book_id]);

  useEffect(() => {
    if (!book) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [book, onClose]);

  if (!book) return null;
  const statusBadge = getTitleStatusBadge(book.availability_status);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inv-book-details-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]" onClick={onClose} />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <p className="font-mono-tabular text-xs font-semibold text-[#2563EB]">
              ISBN: {book.isbn}
            </p>
            <h2
              id="inv-book-details-title"
              className="font-display mt-0.5 text-lg font-bold text-[#142B4A]"
            >
              {book.title}
            </h2>
            {book.subtitle && <p className="text-xs text-[#64748B]">{book.subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close book details modal"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5 text-xs">
          <div className="flex flex-col gap-5 sm:flex-row">
            {!coverFailed && book.cover_image ? (
              <img
                src={book.cover_image}
                alt={`Cover of ${book.title}`}
                referrerPolicy="no-referrer"
                onError={() => setCoverFailed(true)}
                className="h-44 w-32 shrink-0 rounded-lg border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-44 w-32 shrink-0 flex-col items-center justify-center rounded-lg border border-slate-200 bg-[#142B4A] p-3 text-center text-white">
                <BookOpen className="h-7 w-7 text-[#DBEAFE]" aria-hidden="true" />
                <span className="mt-2 line-clamp-3 text-[11px] font-semibold">{book.title}</span>
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold ${statusBadge.classes}`}
                >
                  {statusBadge.icon}
                  <span>{book.availability_status}</span>
                </span>
                <span className="text-xs text-[#64748B]">
                  {book.format} · {book.language} ·{' '}
                  <span className="font-mono-tabular">{book.pages} pages</span>
                </span>
              </div>

              <p className="leading-relaxed text-[#1E293B]">{book.description}</p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748B]">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                  <strong className="font-mono-tabular text-[#142B4A]">
                    {book.rating_average !== null ? book.rating_average.toFixed(1) : 'N/A'}
                  </strong>{' '}
                  (<span className="font-mono-tabular">{book.rating_count}</span> ratings)
                </span>
                <span>
                  Total Borrows:{' '}
                  <strong className="font-mono-tabular text-[#142B4A]">
                    {book.borrow_count}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Bibliographic Information */}
          <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-4">
            <h3 className="font-display text-xs font-bold text-[#142B4A]">
              Bibliographic Information
            </h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <dt className="text-[11px] text-[#64748B]">Author(s)</dt>
                <dd className="mt-0.5 font-semibold text-[#142B4A]">{book.authors}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#64748B]">Publisher</dt>
                <dd className="mt-0.5 font-semibold text-[#142B4A]">{book.publisher}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#64748B]">Publication Year &amp; Edition</dt>
                <dd className="font-mono-tabular mt-0.5 font-semibold text-[#142B4A]">
                  {book.publication_year} · {book.edition || 'Standard'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#64748B]">Category</dt>
                <dd className="mt-0.5 font-semibold text-[#142B4A]">{book.category}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#64748B]">Subject</dt>
                <dd className="mt-0.5 font-semibold text-[#142B4A]">{book.subject}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#64748B]">Keywords</dt>
                <dd className="mt-0.5 text-[#1E293B]">
                  {book.keywords.length > 0 ? book.keywords.join(', ') : 'None assigned'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Library Information */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-display text-xs font-bold text-[#142B4A]">
              Library Copy Counts &amp; Shelf Location
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-lg bg-[#F5F8FC] p-2.5">
                <p className="text-[11px] text-[#64748B]">Total Copies</p>
                <p className="font-mono-tabular mt-0.5 text-base font-bold text-[#142B4A]">
                  {book.total_copies}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2.5">
                <p className="text-[11px] text-emerald-800">Available</p>
                <p className="font-mono-tabular mt-0.5 text-base font-bold text-emerald-800">
                  {book.available_copies}
                </p>
              </div>
              <div className="rounded-lg bg-[#EFF6FF] p-2.5">
                <p className="text-[11px] text-[#142B4A]">Issued</p>
                <p className="font-mono-tabular mt-0.5 text-base font-bold text-[#2563EB]">
                  {book.issued_copies}
                </p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-2.5">
                <p className="text-[11px] text-indigo-800">Reserved/Held</p>
                <p className="font-mono-tabular mt-0.5 text-base font-bold text-indigo-800">
                  {book.reserved_copies}
                </p>
              </div>
              <div className="rounded-lg bg-red-50 p-2.5">
                <p className="text-[11px] text-red-800">Unavailable</p>
                <p className="font-mono-tabular mt-0.5 text-base font-bold text-red-700">
                  {book.unavailable_copies}
                </p>
              </div>
            </div>

            {capabilities.supports_locations && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#64748B]">
                <MapPin className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                <span>
                  {book.branch} · {book.floor} · {book.section} ·{' '}
                  <strong className="font-mono-tabular text-[#142B4A]">Shelf {book.shelf}</strong>
                </span>
              </p>
            )}
          </div>

          {/* Staff Metadata */}
          <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-4">
            <h3 className="font-display text-xs font-bold text-[#142B4A]">
              Staff Catalogue Metadata
            </h3>
            <dl className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] text-[#64748B]">Added Date</dt>
                <dd className="font-mono-tabular font-medium text-[#142B4A]">{book.created_at}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#64748B]">Last Updated</dt>
                <dd className="font-mono-tabular font-medium text-[#142B4A]">{book.updated_at}</dd>
              </div>
              {capabilities.supports_staff_audit_names && book.added_by && (
                <div>
                  <dt className="text-[11px] text-[#64748B]">Added By</dt>
                  <dd className="font-medium text-[#142B4A]">{book.added_by}</dd>
                </div>
              )}
              {capabilities.supports_staff_audit_names && book.updated_by && (
                <div>
                  <dt className="text-[11px] text-[#64748B]">Last Updated By</dt>
                  <dd className="font-medium text-[#142B4A]">{book.updated_by}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 bg-[#F5F8FC] px-6 py-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onManageCopies(book);
              }}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Manage Copies</span>
            </button>
            {canModify && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(book);
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Edit Book</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onArchive(book);
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                >
                  <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Archive Book</span>
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface ManageCopiesModalProps {
  book: InventoryBookItem | null;
  copies: InventoryPhysicalCopy[];
  isLoading: boolean;
  error: string | null;
  capabilities: InventoryCapabilities;
  canModify: boolean;
  hasBackendApi: boolean;
  onClose: () => void;
  onRetryLoad: () => void;
  onUpdateCopy: (
    copy: InventoryPhysicalCopy,
    updates: { status: CopyStatus; condition: CopyCondition; shelf: string }
  ) => Promise<{ ok: boolean; message: string }>;
  onAddCopy: (payload: {
    accession_number: string;
    barcode: string;
    condition: CopyCondition;
    branch: string;
    floor: string;
    section: string;
    shelf: string;
  }) => Promise<{ ok: boolean; message: string }>;
}

export function ManageCopiesModal({
  book,
  copies,
  isLoading,
  error,
  capabilities,
  canModify,
  hasBackendApi,
  onClose,
  onRetryLoad,
  onUpdateCopy,
  onAddCopy,
}: ManageCopiesModalProps) {
  const [editingCopyId, setEditingCopyId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<CopyStatus>('Available');
  const [editCondition, setEditCondition] = useState<CopyCondition>('Good');
  const [editShelf, setEditShelf] = useState<string>('');
  const [rowError, setRowError] = useState<string | null>(null);
  const [rowNotice, setRowNotice] = useState<string | null>(null);
  const [isSavingCopy, setIsSavingCopy] = useState<boolean>(false);

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newAccession, setNewAccession] = useState<string>('');
  const [newBarcode, setNewBarcode] = useState<string>('');
  const [newCondition, setNewCondition] = useState<CopyCondition>('New');
  const [newBranch, setNewBranch] = useState<string>('');
  const [newFloor, setNewFloor] = useState<string>('');
  const [newSection, setNewSection] = useState<string>('');
  const [newShelf, setNewShelf] = useState<string>('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addNotice, setAddNotice] = useState<string | null>(null);
  const [isAddingCopy, setIsAddingCopy] = useState<boolean>(false);

  useEffect(() => {
    if (!book) return;
    setEditingCopyId(null);
    setRowError(null);
    setRowNotice(null);
    setShowAddForm(false);
    setAddError(null);
    setAddNotice(null);
    setNewBranch(book.branch);
    setNewFloor(book.floor);
    setNewSection(book.section);
    setNewShelf(book.shelf);
  }, [book]);

  useEffect(() => {
    if (!book) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [book, onClose]);

  if (!book) return null;

  const startEditingCopy = (copy: InventoryPhysicalCopy) => {
    setEditingCopyId(copy.copy_id);
    setEditStatus(copy.status);
    setEditCondition(copy.condition);
    setEditShelf(copy.shelf);
    setRowError(null);
    setRowNotice(null);
  };

  const handleSaveCopyEdit = async (copy: InventoryPhysicalCopy) => {
    const check = validateCopyStatusTransition(copy, editStatus);
    if (!check.valid) {
      setRowError(check.reason ?? 'Invalid copy status change.');
      return;
    }
    setIsSavingCopy(true);
    setRowError(null);
    const result = await onUpdateCopy(copy, {
      status: editStatus,
      condition: editCondition,
      shelf: editShelf.trim() || copy.shelf,
    });
    setIsSavingCopy(false);
    if (!result.ok) {
      setRowError(result.message);
      return;
    }
    setEditingCopyId(null);
    setRowNotice(result.message);
  };

  const handleGenerateAccession = () => {
    const [nextCode] = generateAccessionNumbers(
      capabilities.accession_prefix_format,
      copies.map((c) => c.accession_number),
      1
    );
    if (nextCode) {
      setNewAccession(nextCode);
      setAddError(null);
    }
  };

  const handleSubmitNewCopy = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateNewCopyInput(newAccession, newBarcode, book.isbn, copies);
    if (!validation.valid) {
      setAddError(validation.error ?? 'Invalid copy identifier.');
      return;
    }
    setIsAddingCopy(true);
    setAddError(null);
    setAddNotice(null);
    const res = await onAddCopy({
      accession_number: newAccession.trim(),
      barcode: newBarcode.trim(),
      condition: newCondition,
      branch: newBranch.trim() || book.branch,
      floor: newFloor.trim() || book.floor,
      section: newSection.trim() || book.section,
      shelf: newShelf.trim() || book.shelf,
    });
    setIsAddingCopy(false);
    if (!res.ok) {
      setAddError(res.message);
      return;
    }
    setShowAddForm(false);
    setNewAccession('');
    setNewBarcode('');
    setAddNotice(res.message);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inv-manage-copies-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]" onClick={onClose} />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <p className="font-mono-tabular text-xs font-semibold text-[#2563EB]">
              Physical Copies · ISBN {book.isbn}
            </p>
            <h2
              id="inv-manage-copies-title"
              className="font-display mt-0.5 text-lg font-bold text-[#142B4A]"
            >
              Manage Copies: {book.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {canModify && (
              <button
                type="button"
                onClick={() => {
                  setShowAddForm((prev) => !prev);
                  setAddError(null);
                  setAddNotice(null);
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] whitespace-nowrap cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Physical Copy</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close physical copy management modal"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 text-xs">
          {!hasBackendApi && (
            <div
              role="note"
              className="flex items-start gap-2.5 rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] p-3.5 text-[#1E293B]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
              <span>
                Backend inventory API is not configured (<code>VITE_API_BASE_URL</code> unset).
                Validation rules execute live, while copy creation and status mutations require
                server confirmation (`POST /api/librarian/books/{book.book_id}/copies` &amp; `PUT
                /api/librarian/copies/&#123;copy_id&#125;`).
              </span>
            </div>
          )}

          {rowError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{rowError}</span>
            </div>
          )}

          {rowNotice && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800"
            >
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <span>{rowNotice}</span>
            </div>
          )}

          {addNotice && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800"
            >
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <span>{addNotice}</span>
            </div>
          )}

          {showAddForm && (
            <form
              onSubmit={(e) => void handleSubmitNewCopy(e)}
              className="rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] p-4 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-[#142B4A]">
                  Register New Physical Copy
                </h3>
                <button
                  type="button"
                  onClick={handleGenerateAccession}
                  className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                >
                  <Sparkles className="h-3 w-3 text-[#2563EB]" aria-hidden="true" />
                  <span>Generate Unique Accession ID</span>
                </button>
              </div>

              {addError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800"
                >
                  {addError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label
                    htmlFor="new-copy-accession"
                    className="block font-semibold text-[#142B4A]"
                  >
                    Accession / Copy Number *
                  </label>
                  <input
                    id="new-copy-accession"
                    type="text"
                    required
                    placeholder={capabilities.accession_prefix_format}
                    value={newAccession}
                    onChange={(e) => setNewAccession(e.target.value)}
                    className="font-mono-tabular mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                {capabilities.supports_barcodes && (
                  <div>
                    <label
                      htmlFor="new-copy-barcode"
                      className="block font-semibold text-[#142B4A]"
                    >
                      Barcode / QR Code
                    </label>
                    <input
                      id="new-copy-barcode"
                      type="text"
                      placeholder="Optional barcode"
                      value={newBarcode}
                      onChange={(e) => setNewBarcode(e.target.value)}
                      className="font-mono-tabular mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="new-copy-condition"
                    className="block font-semibold text-[#142B4A]"
                  >
                    Condition
                  </label>
                  <select
                    id="new-copy-condition"
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value as CopyCondition)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  >
                    {ALL_COPY_CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="new-copy-shelf" className="block font-semibold text-[#142B4A]">
                    Shelf Code
                  </label>
                  <input
                    id="new-copy-shelf"
                    type="text"
                    value={newShelf}
                    onChange={(e) => setNewShelf(e.target.value)}
                    className="font-mono-tabular mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 font-semibold text-[#142B4A] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingCopy}
                  className="min-h-[36px] rounded-lg bg-[#2563EB] px-4 py-1.5 font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
                >
                  {isAddingCopy ? 'Submitting...' : 'Save Physical Copy'}
                </button>
              </div>
            </form>
          )}

          {isLoading ? (
            <div className="space-y-2.5 animate-pulse">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="h-12 rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-6 text-center">
              <p className="font-semibold text-[#142B4A]">Unable to load physical copies</p>
              <p className="mt-1 text-red-700">{error}</p>
              <button
                type="button"
                onClick={onRetryLoad}
                className="mt-3 rounded-lg bg-[#2563EB] px-4 py-2 font-semibold text-white cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : copies.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-8 text-center text-[#64748B]">
              No physical copies registered for this title yet.
            </div>
          ) : (
            <>
              {/* Desktop Copy-Level Table */}
              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F5F8FC] text-[11px] font-semibold text-[#64748B]">
                      <th scope="col" className="px-3 py-2.5">
                        Accession / Copy ID
                      </th>
                      {capabilities.supports_barcodes && (
                        <th scope="col" className="px-3 py-2.5">
                          Barcode
                        </th>
                      )}
                      <th scope="col" className="px-3 py-2.5">
                        Status
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Location
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Condition
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Current Borrower / Due
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Added Date
                      </th>
                      {canModify && (
                        <th scope="col" className="px-3 py-2.5 text-right">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {copies.map((copy) => {
                      const badge = getCopyStatusBadge(copy.status);
                      const isEditing = editingCopyId === copy.copy_id;

                      return (
                        <tr key={copy.copy_id} className="hover:bg-[#F5F8FC]/60">
                          <td className="font-mono-tabular px-3 py-3 font-semibold text-[#142B4A] whitespace-nowrap">
                            {copy.accession_number}
                          </td>
                          {capabilities.supports_barcodes && (
                            <td className="font-mono-tabular px-3 py-3 text-[#64748B] whitespace-nowrap">
                              <span className="inline-flex items-center gap-1">
                                <Barcode className="h-3 w-3 text-slate-400" aria-hidden="true" />
                                <span>{copy.barcode ?? '—'}</span>
                              </span>
                            </td>
                          )}
                          <td className="px-3 py-3 whitespace-nowrap">
                            {isEditing ? (
                              <select
                                aria-label={`Status for ${copy.accession_number}`}
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value as CopyStatus)}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-[#142B4A]"
                              >
                                {capabilities.supported_copy_statuses.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.classes}`}
                              >
                                {badge.icon}
                                <span>{copy.status}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-[#1E293B]">
                            {isEditing ? (
                              <input
                                type="text"
                                aria-label={`Shelf location for ${copy.accession_number}`}
                                value={editShelf}
                                onChange={(e) => setEditShelf(e.target.value)}
                                className="font-mono-tabular w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                              />
                            ) : (
                              <span>
                                {copy.floor} · {copy.shelf}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {isEditing ? (
                              <select
                                aria-label={`Condition for ${copy.accession_number}`}
                                value={editCondition}
                                onChange={(e) =>
                                  setEditCondition(e.target.value as CopyCondition)
                                }
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-[#142B4A]"
                              >
                                {ALL_COPY_CONDITIONS.map((cond) => (
                                  <option key={cond} value={cond}>
                                    {cond}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[#1E293B]">{copy.condition}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-[#64748B]">
                            {copy.current_borrower_name ? (
                              <div>
                                <p className="font-medium text-[#142B4A]">
                                  {copy.current_borrower_name}
                                </p>
                                <p className="font-mono-tabular text-[11px]">
                                  {copy.current_borrower_code}
                                  {copy.due_date ? ` · Due ${copy.due_date}` : ''}
                                </p>
                              </div>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td className="font-mono-tabular px-3 py-3 text-[#64748B] whitespace-nowrap">
                            {copy.added_at}
                          </td>
                          {canModify && (
                            <td className="px-3 py-3 text-right whitespace-nowrap">
                              {isEditing ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isSavingCopy}
                                    onClick={() => void handleSaveCopyEdit(copy)}
                                    className="rounded bg-[#2563EB] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCopyId(null)}
                                    className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-[#142B4A] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditingCopy(copy)}
                                  aria-label={`Update copy ${copy.accession_number}`}
                                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                                >
                                  Update
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Copy Cards */}
              <div className="space-y-2.5 md:hidden">
                {copies.map((copy) => {
                  const badge = getCopyStatusBadge(copy.status);
                  return (
                    <div
                      key={copy.copy_id}
                      className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-tabular font-bold text-[#142B4A]">
                          {copy.accession_number}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.classes}`}
                        >
                          {badge.icon}
                          <span>{copy.status}</span>
                        </span>
                      </div>
                      <p className="mt-1.5 text-[#64748B]">
                        {copy.floor} · {copy.shelf} · Condition: {copy.condition}
                      </p>
                      {copy.current_borrower_name && (
                        <p className="mt-1 text-[#142B4A]">
                          Holder: {copy.current_borrower_name}{' '}
                          <span className="font-mono-tabular text-[#64748B]">
                            ({copy.current_borrower_code})
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-[#F5F8FC] px-6 py-3.5 text-xs">
          <span className="font-mono-tabular text-[#64748B]">
            {copies.length} physical {copies.length === 1 ? 'copy' : 'copies'} registered
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-4 py-1.5 font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
