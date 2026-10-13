"use client";

import { useEffect, useState } from "react";
import {
  UserCog,
  Search,
  Download,
  Plus,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  Edit2,
  Trash2,
  X,
  Shield,
  Key,
  Layers,
  CalendarDays,
  LayoutDashboard,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/admin/Pagination";
import toast, { Toaster } from "react-hot-toast";
import {
  getStaffWithPermissionsAction,
  updateStaffAction,
  deleteStaffAction,
  type StaffPermissionsInput,
} from "@/app/actions/staff";

interface StaffMember {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  role: "admin" | "manager" | "staff";
  status: "active" | "inactive";
  photo_url?: string;
  created_at: string;
  permissions?: StaffPermissionsInput;
}

export default function AdminStaff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [filtered, setFiltered] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Edit Modal State
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    role: "staff" as "admin" | "manager" | "staff",
    status: "active" as "active" | "inactive",
    password: "",
  });
  const [editPermissions, setEditPermissions] = useState<StaffPermissionsInput>({
    can_dashboard: false,
    can_reservations: false,
    can_services: false,
    can_billing: false,
  });
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deletingStaff, setDeletingStaff] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStaff = async () => {
    setLoading(true);
    const res = await getStaffWithPermissionsAction();
    if (res.success && res.data) {
      setStaff(res.data as StaffMember[]);
      setFiltered(res.data as StaffMember[]);
    } else {
      toast.error(res.error || "Failed to load staff list");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    if (!search) {
      setFiltered(staff);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      staff.filter(
        (s) =>
          `${s.first_name ?? ""} ${s.last_name ?? ""}`.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.role.toLowerCase().includes(q)
      )
    );
    setCurrentPage(1);
  }, [search, staff]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const exportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Role", "Status", "Permissions", "Joined"];
    const rows = filtered.map((s) => [
      `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim(),
      s.email,
      s.phone ?? "",
      s.role,
      s.status,
      s.role === "staff"
        ? [
            s.permissions?.can_dashboard ? "Dashboard" : "",
            s.permissions?.can_reservations ? "Reservations" : "",
            s.permissions?.can_services ? "Services" : "",
            s.permissions?.can_billing ? "Billing" : "",
          ]
            .filter(Boolean)
            .join("; ") || "None"
        : "Full Access",
      new Date(s.created_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jbenz-staff.csv";
    a.click();
  };

  const roleColor: Record<string, string> = {
    admin: "bg-red-100 text-red-700 border-red-200",
    manager: "bg-purple-100 text-purple-700 border-purple-200",
    staff: "bg-blue-100 text-blue-700 border-blue-200",
  };

  const openEditModal = (member: StaffMember) => {
    setEditingStaff(member);
    setEditForm({
      first_name: member.first_name || "",
      last_name: member.last_name || "",
      phone: member.phone || "",
      role: member.role,
      status: member.status,
      password: "",
    });
    setEditPermissions({
      can_dashboard: Boolean(member.permissions?.can_dashboard),
      can_reservations: Boolean(member.permissions?.can_reservations),
      can_services: Boolean(member.permissions?.can_services),
      can_billing: Boolean(member.permissions?.can_billing),
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setSaving(true);

    try {
      const res = await updateStaffAction({
        id: editingStaff.id,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        phone: editForm.phone,
        role: editForm.role,
        status: editForm.status,
        password: editForm.password.trim() ? editForm.password.trim() : undefined,
        permissions: {
          can_dashboard: editForm.role !== "staff" ? true : editPermissions.can_dashboard,
          can_reservations: editForm.role !== "staff" ? true : editPermissions.can_reservations,
          can_services: editForm.role !== "staff" ? true : editPermissions.can_services,
          can_billing: editForm.role !== "staff" ? true : editPermissions.can_billing,
        },
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to update staff member");
      }

      toast.success("Staff member updated successfully!");
      setEditingStaff(null);
      await fetchStaff();
    } catch (err: any) {
      toast.error(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!deletingStaff) return;
    setDeleting(true);

    try {
      const res = await deleteStaffAction(deletingStaff.id);
      if (!res.success) {
        throw new Error(res.error || "Failed to delete staff member");
      }
      toast.success("Staff account deleted!");
      setDeletingStaff(null);
      await fetchStaff();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete staff member");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Toaster position="top-right" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Staff Members & Permissions</h1>
          <p className="text-sm text-gray-400">
            Create team members, manage account status, and control individual access permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <Download size={14} />
            Export
          </button>
          <Link
            href="/admin/staff/add"
            className="flex items-center gap-2 bg-red-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-800 transition-colors no-underline shadow-sm"
          >
            <Plus size={14} />
            Add Staff
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search staff by name, email, or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300"
          />
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UserCog size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No staff members found</p>
            <Link
              href="/admin/staff/add"
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-red-700 font-semibold hover:underline no-underline"
            >
              <Plus size={14} /> Add your first staff member
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {[
                    "Staff Member",
                    "Email & Phone",
                    "Role",
                    "Status",
                    "Active Permissions",
                    "Joined",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left py-3 px-4 text-gray-400 font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedData.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    {/* Member */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {s.photo_url ? (
                          <img
                            src={s.photo_url}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-red-100 text-red-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {(s.first_name?.[0] ?? s.email[0]).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-800">
                            {`${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Staff Member"}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            ID: {s.id.substring(0, 8)}…
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Email & Phone */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Mail size={11} className="text-gray-400" />
                          <span>{s.email}</span>
                        </div>
                        {s.phone && (
                          <div className="flex items-center gap-1.5 text-gray-400 text-[10px]">
                            <Phone size={10} className="text-gray-300" />
                            <span>{s.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize border ${
                          roleColor[s.role] ?? "bg-gray-100 text-gray-500 border-gray-200"
                        }`}
                      >
                        {s.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <div
                        className={`flex items-center gap-1 text-[10px] font-bold ${
                          s.status === "active" ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {s.status === "active" ? (
                          <CheckCircle size={12} />
                        ) : (
                          <XCircle size={12} />
                        )}
                        <span className="capitalize">{s.status}</span>
                      </div>
                    </td>

                    {/* Permissions Badges */}
                    <td className="py-3 px-4">
                      {s.role === "admin" ? (
                        <span className="text-[10px] font-medium text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md">
                          Full Administrator Control
                        </span>
                      ) : s.role === "manager" ? (
                        <span className="text-[10px] font-medium text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md">
                          Broad Manager Access
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {s.permissions?.can_dashboard && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                              <LayoutDashboard size={10} /> Dashboard
                            </span>
                          )}
                          {s.permissions?.can_reservations && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                              <CalendarDays size={10} /> Reservations
                            </span>
                          )}
                          {s.permissions?.can_services && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                              <Layers size={10} /> Services
                            </span>
                          )}
                          {s.permissions?.can_billing && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                              <CreditCard size={10} /> Billing / POS
                            </span>
                          )}
                          {!s.permissions?.can_dashboard &&
                            !s.permissions?.can_reservations &&
                            !s.permissions?.can_services &&
                            !s.permissions?.can_billing && (
                              <span className="text-[10px] text-gray-400 italic">
                                No permissions assigned
                              </span>
                            )}
                        </div>
                      )}
                    </td>

                    {/* Joined Date */}
                    <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(s)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-900 hover:bg-red-50 transition-colors"
                          title="Edit member & permissions"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeletingStaff(s)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete staff account"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && !loading && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* EDIT MODAL */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setEditingStaff(null)}
              className="absolute right-5 top-5 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-900 flex items-center justify-center font-bold">
                <UserCog size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800">
                  Edit Staff: {editingStaff.email}
                </h2>
                <p className="text-xs text-gray-400">Update personal info, roles, and permissions</p>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value as "active" | "inactive" })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-300 bg-white"
                  >
                    <option value="active">Active (Can log in)</option>
                    <option value="inactive">Inactive (Deactivated)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      role: e.target.value as "admin" | "manager" | "staff",
                    })
                  }
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-300 bg-white"
                >
                  <option value="staff">Staff (Custom Permissions)</option>
                  <option value="manager">Manager (Broad Access)</option>
                  <option value="admin">Admin (Full Control)</option>
                </select>
              </div>

              {/* Permissions Section (for staff role) */}
              {editForm.role === "staff" ? (
                <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                    <Shield size={13} className="text-red-900" />
                    <span>Module Permissions</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      {
                        id: "can_dashboard",
                        label: "Dashboard & Analytics",
                        desc: "View revenue statistics and analytics hub",
                      },
                      {
                        id: "can_reservations",
                        label: "Reservations Management",
                        desc: "View, approve, and cancel bookings",
                      },
                      {
                        id: "can_services",
                        label: "Services & Rooms",
                        desc: "Manage karaoke, billiards, dining availability",
                      },
                      {
                        id: "can_billing",
                        label: "Billing & Walk-In POS",
                        desc: "Process walk-in cashiering and print receipts",
                      },
                    ].map((p) => {
                      const checked = editPermissions[p.id as keyof StaffPermissionsInput];
                      return (
                        <label
                          key={p.id}
                          className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-gray-200"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setEditPermissions({
                                ...editPermissions,
                                [p.id]: e.target.checked,
                              })
                            }
                            className="mt-0.5 rounded border-gray-300 text-red-900 focus:ring-red-900"
                          />
                          <div>
                            <p className="text-xs font-bold text-gray-800">{p.label}</p>
                            <p className="text-[10px] text-gray-400">{p.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                  <strong>{editForm.role.toUpperCase()}</strong> has full module access. Specific
                  permission flags are automatically enabled.
                </div>
              )}

              {/* Optional Password Reset */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Reset Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                </label>
                <div className="relative">
                  <Key size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    placeholder="Enter new temporary password (min 6 chars)"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-red-300"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-red-900 text-white rounded-xl text-xs font-semibold hover:bg-red-800 transition-colors disabled:opacity-60 flex items-center gap-1.5 shadow-sm"
                >
                  {saving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle size={14} />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">Delete Staff Member?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to remove{" "}
                <span className="font-semibold text-gray-800">{deletingStaff.email}</span>? This
                will delete their login account and revoke all permissions.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStaff(null)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteStaff}
                className="px-5 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 disabled:opacity-60 flex items-center gap-1.5"
              >
                {deleting && (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
