import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Edit3,
  FolderPlus,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import {
  canDeleteTaxonomyRecord,
  computeBranchInventoryCounts,
  computeCategoryBookCounts,
  computeSubjectBookCounts,
  validateLibrarySettings,
  type CatalogCategoryRecord,
  type CatalogSubjectRecord,
  type LibraryBranchRecord,
  type LibraryPolicySettings,
} from '../../utils/adminManagement';
import type { InventoryBookItem, InventoryPhysicalCopy } from '../../utils/librarianInventory';

interface AdminCategoryManagementSectionProps {
  categories: CatalogCategoryRecord[];
  books: InventoryBookItem[];
  onSaveCategory: (input: {
    category_id?: number;
    name: string;
    description: string;
    status: 'Active' | 'Inactive';
  }) => { ok: boolean; error?: string };
  onDeleteCategory: (categoryId: number) => { ok: boolean; error?: string };
}

export function AdminCategoryManagementSection({
  categories,
  books,
  onSaveCategory,
  onDeleteCategory,
}: AdminCategoryManagementSectionProps) {
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogCategoryRecord | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const enriched = useMemo(() => {
    const withCounts = computeCategoryBookCounts(categories, books);
    const q = query.trim().toLowerCase();
    if (!q) return withCounts;
    return withCounts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }, [categories, books, query]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setStatus('Active');
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (cat: CatalogCategoryRecord) => {
    setEditing(cat);
    setName(cat.name);
    setDescription(cat.description);
    setStatus(cat.status);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setFormError('Enter a category name (at least 2 characters).');
      return;
    }
    const res = onSaveCategory({
      category_id: editing?.category_id,
      name: name.trim(),
      description: description.trim(),
      status,
    });
    if (!res.ok) {
      setFormError(res.error ?? 'Could not save category.');
      return;
    }
    setModalOpen(false);
    setFeedback({
      type: 'success',
      message: editing
        ? `Updated category "${name.trim()}".`
        : `Added new category "${name.trim()}".`,
    });
  };

  const handleDelete = (cat: CatalogCategoryRecord & { book_count: number }) => {
    const guard = canDeleteTaxonomyRecord({
      entityLabel: 'category',
      name: cat.name,
      bookCount: cat.book_count,
    });
    if (!guard.allowed) {
      setFeedback({ type: 'error', message: guard.reason ?? 'Delete blocked.' });
      return;
    }
    const res = onDeleteCategory(cat.category_id);
    if (!res.ok) {
      setFeedback({ type: 'error', message: res.error ?? 'Could not delete category.' });
    } else {
      setFeedback({ type: 'success', message: `Deleted unused category "${cat.name}".` });
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <span className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {feedback.message}
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss message"
            className="cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#142B4A]">
              Book Categories ({enriched.length})
            </h2>
            <p className="text-xs text-[#64748B]">
              Organize catalog classifications. Categories referenced by active books can be deactivated rather than deleted.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1d4ed8] cursor-pointer"
          >
            <FolderPlus className="h-4 w-4" aria-hidden="true" />
            <span>Add Category</span>
          </button>
        </div>

        <div className="relative mt-4 max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories..."
            aria-label="Search categories"
            className="h-10 w-full rounded-lg border border-slate-200 bg-[#F5F8FC]/60 pl-9 pr-3 text-xs focus:border-[#2563EB] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[#64748B]">
                <th className="py-2.5 pr-3 font-semibold">Category Name</th>
                <th className="py-2.5 pr-3 font-semibold">Description</th>
                <th className="py-2.5 pr-3 font-semibold">Titles</th>
                <th className="py-2.5 pr-3 font-semibold">Status</th>
                <th className="py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enriched.map((cat) => (
                <tr key={cat.category_id} className="hover:bg-[#F5F8FC]/60">
                  <td className="py-3 pr-3 font-semibold text-[#142B4A]">{cat.name}</td>
                  <td className="py-3 pr-3 text-[#64748B]">{cat.description}</td>
                  <td className="font-mono-tabular py-3 pr-3 font-semibold text-[#142B4A]">
                    {cat.book_count}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${
                        cat.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {cat.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(cat)}
                        aria-label={`Edit category ${cat.name}`}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2563EB] hover:bg-[#DBEAFE]/40 cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3" aria-hidden="true" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onSaveCategory({
                            category_id: cat.category_id,
                            name: cat.name,
                            description: cat.description,
                            status: cat.status === 'Active' ? 'Inactive' : 'Active',
                          })
                        }
                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#142B4A] hover:bg-[#F5F8FC] cursor-pointer"
                      >
                        {cat.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        aria-label={`Delete category ${cat.name}`}
                        className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                          cat.book_count === 0
                            ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer'
                            : 'border-slate-200 bg-slate-50 text-slate-400 cursor-pointer'
                        }`}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="category-modal-title" className="font-display text-base font-bold text-[#142B4A]">
                {editing ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
              {formError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  {formError}
                </p>
              )}
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">Category Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Quantum Computing"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563EB] px-4 py-2 font-semibold text-white hover:bg-[#1d4ed8] cursor-pointer"
                >
                  {editing ? 'Save Category' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface AdminSubjectManagementSectionProps {
  subjects: CatalogSubjectRecord[];
  books: InventoryBookItem[];
  onSaveSubject: (input: {
    subject_id?: number;
    name: string;
    code: string;
    description: string;
    status: 'Active' | 'Inactive';
  }) => { ok: boolean; error?: string };
  onDeleteSubject: (subjectId: number) => { ok: boolean; error?: string };
}

export function AdminSubjectManagementSection({
  subjects,
  books,
  onSaveSubject,
  onDeleteSubject,
}: AdminSubjectManagementSectionProps) {
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogSubjectRecord | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const enriched = useMemo(() => {
    const withCounts = computeSubjectBookCounts(subjects, books);
    const q = query.trim().toLowerCase();
    if (!q) return withCounts;
    return withCounts.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [subjects, books, query]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCode('');
    setDescription('');
    setStatus('Active');
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (subj: CatalogSubjectRecord) => {
    setEditing(subj);
    setName(subj.name);
    setCode(subj.code);
    setDescription(subj.description);
    setStatus(subj.status);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setFormError('Enter a subject name (at least 2 characters).');
      return;
    }
    if (code.trim().length < 2) {
      setFormError('Enter a subject code (e.g., CS-401).');
      return;
    }
    const res = onSaveSubject({
      subject_id: editing?.subject_id,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim(),
      status,
    });
    if (!res.ok) {
      setFormError(res.error ?? 'Could not save subject.');
      return;
    }
    setModalOpen(false);
    setFeedback({
      type: 'success',
      message: editing
        ? `Updated subject "${name.trim()}".`
        : `Added new subject "${name.trim()}".`,
    });
  };

  const handleDelete = (subj: CatalogSubjectRecord & { book_count: number }) => {
    const guard = canDeleteTaxonomyRecord({
      entityLabel: 'subject',
      name: subj.name,
      bookCount: subj.book_count,
    });
    if (!guard.allowed) {
      setFeedback({ type: 'error', message: guard.reason ?? 'Delete blocked.' });
      return;
    }
    const res = onDeleteSubject(subj.subject_id);
    if (!res.ok) {
      setFeedback({ type: 'error', message: res.error ?? 'Could not delete subject.' });
    } else {
      setFeedback({ type: 'success', message: `Deleted unused subject "${subj.name}".` });
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#142B4A]">
              Subject Taxonomy ({enriched.length})
            </h2>
            <p className="text-xs text-[#64748B]">
              Academic subjects power catalog search filters and AI book recommendations.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1d4ed8] cursor-pointer"
          >
            <Tags className="h-4 w-4" aria-hidden="true" />
            <span>Add Subject</span>
          </button>
        </div>

        <div className="relative mt-4 max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subjects or codes..."
            aria-label="Search subjects"
            className="h-10 w-full rounded-lg border border-slate-200 bg-[#F5F8FC]/60 pl-9 pr-3 text-xs focus:border-[#2563EB] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[#64748B]">
                <th className="py-2.5 pr-3 font-semibold">Subject</th>
                <th className="py-2.5 pr-3 font-semibold">Code</th>
                <th className="py-2.5 pr-3 font-semibold">Description</th>
                <th className="py-2.5 pr-3 font-semibold">Books</th>
                <th className="py-2.5 pr-3 font-semibold">Status</th>
                <th className="py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enriched.map((subj) => (
                <tr key={subj.subject_id} className="hover:bg-[#F5F8FC]/60">
                  <td className="py-3 pr-3 font-semibold text-[#142B4A]">{subj.name}</td>
                  <td className="font-mono-tabular py-3 pr-3 font-semibold text-[#2563EB]">
                    {subj.code}
                  </td>
                  <td className="py-3 pr-3 text-[#64748B]">{subj.description}</td>
                  <td className="font-mono-tabular py-3 pr-3 font-semibold text-[#142B4A]">
                    {subj.book_count}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${
                        subj.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {subj.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(subj)}
                        aria-label={`Edit subject ${subj.name}`}
                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2563EB] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onSaveSubject({
                            subject_id: subj.subject_id,
                            name: subj.name,
                            code: subj.code,
                            description: subj.description,
                            status: subj.status === 'Active' ? 'Inactive' : 'Active',
                          })
                        }
                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#142B4A] cursor-pointer"
                      >
                        {subj.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(subj)}
                        aria-label={`Delete subject ${subj.name}`}
                        className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                          subj.book_count === 0
                            ? 'border-red-200 bg-red-50 text-red-700 cursor-pointer'
                            : 'border-slate-200 bg-slate-50 text-slate-400 cursor-pointer'
                        }`}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="subject-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="subject-modal-title" className="font-display text-base font-bold text-[#142B4A]">
                {editing ? 'Edit Subject' : 'Add Subject'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
              {formError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  {formError}
                </p>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block font-semibold text-[#142B4A]">Subject Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Distributed Systems"
                    className="h-9 w-full rounded-lg border border-slate-200 px-3"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#142B4A]">Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="DS-402"
                    className="font-mono-tabular h-9 w-full rounded-lg border border-slate-200 px-3"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563EB] px-4 py-2 font-semibold text-white hover:bg-[#1d4ed8] cursor-pointer"
                >
                  Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface AdminBranchManagementSectionProps {
  branches: LibraryBranchRecord[];
  books: InventoryBookItem[];
  copies: InventoryPhysicalCopy[];
  onSaveBranch: (input: {
    branch_id?: number;
    name: string;
    code: string;
    address: string;
    contact_info: string;
    status: 'Active' | 'Inactive';
  }) => { ok: boolean; error?: string };
  onDeleteBranch: (branchId: number) => { ok: boolean; error?: string };
}

export function AdminBranchManagementSection({
  branches,
  books,
  copies,
  onSaveBranch,
  onDeleteBranch,
}: AdminBranchManagementSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryBranchRecord | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const enriched = useMemo(
    () => computeBranchInventoryCounts(branches, books, copies),
    [branches, books, copies]
  );

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCode('');
    setAddress('');
    setContactInfo('');
    setStatus('Active');
    setModalOpen(true);
  };

  const openEdit = (branch: LibraryBranchRecord) => {
    setEditing(branch);
    setName(branch.name);
    setCode(branch.code);
    setAddress(branch.address);
    setContactInfo(branch.contact_info);
    setStatus(branch.status);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onSaveBranch({
      branch_id: editing?.branch_id,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      address: address.trim(),
      contact_info: contactInfo.trim(),
      status,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', message: res.error ?? 'Could not save branch.' });
      return;
    }
    setModalOpen(false);
    setFeedback({
      type: 'success',
      message: editing ? `Updated branch "${name.trim()}".` : `Added branch "${name.trim()}".`,
    });
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#142B4A]">
              Library Branches & Campus Locations ({enriched.length})
            </h2>
            <p className="text-xs text-[#64748B]">
              Branches govern staff assignments, shelf inventory locations, and pickup desks.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1d4ed8] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Branch</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {enriched.map((branch) => {
            const deleteGuard = canDeleteTaxonomyRecord({
              entityLabel: 'branch',
              name: branch.name,
              bookCount: branch.book_count,
              copyCount: branch.copy_count,
            });
            return (
              <div
                key={branch.branch_id}
                className="rounded-xl border border-slate-200 bg-[#F5F8FC]/50 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                    <div>
                      <h3 className="text-sm font-bold text-[#142B4A]">{branch.name}</h3>
                      <p className="font-mono-tabular text-[11px] font-semibold text-[#2563EB]">
                        {branch.code}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                      branch.status === 'Active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {branch.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#1E293B]">{branch.address}</p>
                <p className="mt-1 text-[11px] text-[#64748B]">{branch.contact_info}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5 text-[11px]">
                  <span className="font-mono-tabular text-[#64748B]">
                    Titles: <strong className="text-[#142B4A]">{branch.book_count}</strong> · Copies:{' '}
                    <strong className="text-[#142B4A]">{branch.copy_count}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(branch)}
                      className="rounded border border-slate-200 bg-white px-2.5 py-1 font-semibold text-[#2563EB] cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!deleteGuard.allowed) {
                          setFeedback({
                            type: 'error',
                            message: deleteGuard.reason ?? 'Delete blocked.',
                          });
                          return;
                        }
                        onDeleteBranch(branch.branch_id);
                        setFeedback({
                          type: 'success',
                          message: `Removed branch "${branch.name}".`,
                        });
                      }}
                      className={`rounded border px-2 py-1 font-semibold ${
                        deleteGuard.allowed
                          ? 'border-red-200 bg-red-50 text-red-700 cursor-pointer'
                          : 'border-slate-200 bg-slate-100 text-slate-400 cursor-pointer'
                      }`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="branch-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="branch-modal-title" className="font-display text-base font-bold text-[#142B4A]">
                {editing ? 'Edit Library Branch' : 'Add Library Branch'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded p-1 text-slate-400 cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block font-semibold text-[#142B4A]">Branch Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 px-3"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#142B4A]">Code</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="font-mono-tabular h-9 w-full rounded-lg border border-slate-200 px-3"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">Address</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 px-3"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">Contact Info</label>
                <input
                  type="text"
                  required
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 px-3"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563EB] px-4 py-2 font-semibold text-white cursor-pointer"
                >
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface AdminLibrarySettingsSectionProps {
  settings: LibraryPolicySettings;
  onSaveSettings: (nextSettings: LibraryPolicySettings) => void;
}

export function AdminLibrarySettingsSection({
  settings,
  onSaveSettings,
}: AdminLibrarySettingsSectionProps) {
  const [draft, setDraft] = useState<LibraryPolicySettings>(settings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateLibrarySettings(draft);
    if (!validation.valid) {
      setErrors(validation.errors);
      setSavedBanner(null);
      return;
    }
    setErrors({});
    onSaveSettings(draft);
    setSavedBanner('Library operational policies saved and synchronized across circulation rules.');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {savedBanner && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            {savedBanner}
          </span>
          <button type="button" onClick={() => setSavedBanner(null)} className="cursor-pointer">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {Object.keys(errors).length > 0 && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Review highlighted policy settings before saving.</span>
        </div>
      )}

      {/* Loan Policy */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="font-display text-base font-bold text-[#142B4A]">Loan Policy</h2>
        <p className="text-xs text-[#64748B]">
          Governs default checkout period, concurrent borrowing limit, and renewal rules.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div>
            <label
              htmlFor="policy-loan-duration"
              className="mb-1 block font-semibold text-[#142B4A]"
            >
              Default Loan Duration (Days)
            </label>
            <input
              id="policy-loan-duration"
              type="number"
              min={1}
              max={90}
              value={draft.loan_policy.default_loan_duration_days}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  loan_policy: {
                    ...prev.loan_policy,
                    default_loan_duration_days: Number(e.target.value),
                  },
                }))
              }
              className="font-mono-tabular h-10 w-full rounded-lg border border-slate-200 px-3 focus:border-[#2563EB] focus:outline-none"
            />
            {errors.default_loan_duration_days && (
              <p className="mt-1 text-[11px] text-red-600">
                {errors.default_loan_duration_days}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="policy-max-loans"
              className="mb-1 block font-semibold text-[#142B4A]"
            >
              Max Active Loans / Student
            </label>
            <input
              id="policy-max-loans"
              type="number"
              min={1}
              max={20}
              value={draft.loan_policy.max_active_loans_per_student}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  loan_policy: {
                    ...prev.loan_policy,
                    max_active_loans_per_student: Number(e.target.value),
                  },
                }))
              }
              className="font-mono-tabular h-10 w-full rounded-lg border border-slate-200 px-3 focus:border-[#2563EB] focus:outline-none"
            />
            {errors.max_active_loans_per_student && (
              <p className="mt-1 text-[11px] text-red-600">
                {errors.max_active_loans_per_student}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="policy-max-renewals"
              className="mb-1 block font-semibold text-[#142B4A]"
            >
              Max Renewals / Loan
            </label>
            <input
              id="policy-max-renewals"
              type="number"
              min={1}
              max={5}
              disabled={!draft.loan_policy.allow_renewal}
              value={draft.loan_policy.max_renewals_per_loan}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  loan_policy: {
                    ...prev.loan_policy,
                    max_renewals_per_loan: Number(e.target.value),
                  },
                }))
              }
              className="font-mono-tabular h-10 w-full rounded-lg border border-slate-200 px-3 disabled:bg-slate-50"
            />
            {errors.max_renewals_per_loan && (
              <p className="mt-1 text-[11px] text-red-600">{errors.max_renewals_per_loan}</p>
            )}
          </div>

          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 font-semibold text-[#142B4A]">
              <input
                type="checkbox"
                checked={draft.loan_policy.allow_renewal}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    loan_policy: { ...prev.loan_policy, allow_renewal: e.target.checked },
                  }))
                }
              />
              <span>Allow Book Renewals</span>
            </label>
          </div>
        </div>
      </section>

      {/* Reminder & Reservation Policies */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="font-display text-base font-bold text-[#142B4A]">Reminder Policy</h2>
          <p className="text-xs text-[#64748B]">
            Automated schedule for due-soon alerts and overdue follow-up notifications.
          </p>
          <div className="mt-4 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">
                  Days Before Due Reminder
                </label>
                <input
                  type="number"
                  min={0}
                  max={14}
                  value={draft.reminder_policy.days_before_due_reminder}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      reminder_policy: {
                        ...prev.reminder_policy,
                        days_before_due_reminder: Number(e.target.value),
                      },
                    }))
                  }
                  className="font-mono-tabular h-9 w-full rounded-lg border border-slate-200 px-3"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">
                  Overdue Cadence (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={draft.reminder_policy.overdue_reminder_frequency_days}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      reminder_policy: {
                        ...prev.reminder_policy,
                        overdue_reminder_frequency_days: Number(e.target.value),
                      },
                    }))
                  }
                  className="font-mono-tabular h-9 w-full rounded-lg border border-slate-200 px-3"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 font-medium text-[#1E293B]">
              <input
                type="checkbox"
                checked={draft.reminder_policy.send_due_date_reminder}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    reminder_policy: {
                      ...prev.reminder_policy,
                      send_due_date_reminder: e.target.checked,
                    },
                  }))
                }
              />
              <span>Send reminder on exact due date</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 font-medium text-[#1E293B]">
              <input
                type="checkbox"
                checked={draft.reminder_policy.email_notifications_enabled}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    reminder_policy: {
                      ...prev.reminder_policy,
                      email_notifications_enabled: e.target.checked,
                    },
                  }))
                }
              />
              <span>Enable email notifications alongside in-app alerts</span>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="font-display text-base font-bold text-[#142B4A]">Reservation Policy</h2>
          <p className="text-xs text-[#64748B]">
            Configure student hold limits, pickup hold duration, and expiry actions.
          </p>
          <div className="mt-4 space-y-3 text-xs">
            <label className="flex cursor-pointer items-center gap-2 font-semibold text-[#142B4A]">
              <input
                type="checkbox"
                checked={draft.reservation_policy.reservations_enabled}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    reservation_policy: {
                      ...prev.reservation_policy,
                      reservations_enabled: e.target.checked,
                    },
                  }))
                }
              />
              <span>Enable Student Book Reservations</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">
                  Max Active Holds / Student
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={draft.reservation_policy.max_active_reservations_per_student}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      reservation_policy: {
                        ...prev.reservation_policy,
                        max_active_reservations_per_student: Number(e.target.value),
                      },
                    }))
                  }
                  className="font-mono-tabular h-9 w-full rounded-lg border border-slate-200 px-3"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">
                  Pickup Window (Hours)
                </label>
                <input
                  type="number"
                  min={6}
                  max={168}
                  value={draft.reservation_policy.pickup_window_hours}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      reservation_policy: {
                        ...prev.reservation_policy,
                        pickup_window_hours: Number(e.target.value),
                      },
                    }))
                  }
                  className="font-mono-tabular h-9 w-full rounded-lg border border-slate-200 px-3"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#142B4A]">Expiry Behavior</label>
              <select
                value={draft.reservation_policy.expiry_behavior}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    reservation_policy: {
                      ...prev.reservation_policy,
                      expiry_behavior: e.target.value as
                        | 'auto_expire_and_advance_queue'
                        | 'auto_expire_and_release_copy',
                    },
                  }))
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5"
              >
                <option value="auto_expire_and_advance_queue">
                  Auto-expire unclaimed hold and advance next queued student
                </option>
                <option value="auto_expire_and_release_copy">
                  Auto-expire unclaimed hold and return copy to open shelf
                </option>
              </select>
            </div>
          </div>
        </section>
      </div>

      {/* Conditional Fine Policy + General Settings */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#142B4A]">
                Late Fee / Fine Policy (Optional)
              </h2>
              <p className="text-xs text-[#64748B]">
                Fine calculation stays disabled unless explicitly enabled by library governance.
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#142B4A]">
              <input
                type="checkbox"
                checked={draft.fine_policy.fine_policy_enabled}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    fine_policy: {
                      ...prev.fine_policy,
                      fine_policy_enabled: e.target.checked,
                      fine_per_day_amount: e.target.checked
                        ? prev.fine_policy.fine_per_day_amount ?? 1
                        : null,
                    },
                  }))
                }
              />
              <span>{draft.fine_policy.fine_policy_enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>

          {draft.fine_policy.fine_policy_enabled ? (
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">
                  Daily Rate ({draft.fine_policy.fine_currency_symbol})
                </label>
                <input
                  type="number"
                  step="0.25"
                  min={0.25}
                  value={draft.fine_policy.fine_per_day_amount ?? ''}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      fine_policy: {
                        ...prev.fine_policy,
                        fine_per_day_amount: Number(e.target.value),
                      },
                    }))
                  }
                  className="font-mono-tabular h-9 w-full rounded-lg border border-slate-200 px-3"
                />
                {errors.fine_per_day_amount && (
                  <p className="mt-1 text-[11px] text-red-600">{errors.fine_per_day_amount}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">
                  Grace Period (Days)
                </label>
                <input
                  type="number"
                  min={0}
                  max={14}
                  value={draft.fine_policy.grace_period_days}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      fine_policy: {
                        ...prev.fine_policy,
                        grace_period_days: Number(e.target.value),
                      },
                    }))
                  }
                  className="font-mono-tabular h-9 w-full rounded-lg border border-slate-200 px-3"
                />
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-[#F5F8FC]/60 p-3 text-xs text-[#64748B]">
              Monetary overdue fines are currently disabled. Overdue tracking operates via reminder schedules and borrowing eligibility holds.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="font-display text-base font-bold text-[#142B4A]">
            General Library Information
          </h2>
          <div className="mt-4 space-y-3 text-xs">
            <div>
              <label className="mb-1 block font-semibold text-[#142B4A]">Library Name</label>
              <input
                type="text"
                value={draft.general_settings.library_name}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    general_settings: {
                      ...prev.general_settings,
                      library_name: e.target.value,
                    },
                  }))
                }
                className="h-9 w-full rounded-lg border border-slate-200 px-3"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">Contact Email</label>
                <input
                  type="email"
                  value={draft.general_settings.contact_email}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      general_settings: {
                        ...prev.general_settings,
                        contact_email: e.target.value,
                      },
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 px-3"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">Contact Phone</label>
                <input
                  type="text"
                  value={draft.general_settings.contact_phone}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      general_settings: {
                        ...prev.general_settings,
                        contact_phone: e.target.value,
                      },
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 px-3"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-[#142B4A]">Opening Hours</label>
              <input
                type="text"
                value={draft.general_settings.opening_hours}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    general_settings: {
                      ...prev.general_settings,
                      opening_hours: e.target.value,
                    },
                  }))
                }
                className="h-9 w-full rounded-lg border border-slate-200 px-3"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1d4ed8] cursor-pointer"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          <span>Save Library Policies</span>
        </button>
      </div>
    </form>
  );
}
