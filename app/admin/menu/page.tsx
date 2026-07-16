"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Pencil, Trash2, RefreshCw, Search, CheckCircle, XCircle } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { addMenuItem, updateMenuItem, deleteMenuItem } from "@/app/actions/menu";
import Pagination from "@/components/admin/Pagination";

interface MenuItem {
  id: string;
  category: string;
  name: string;
  price: number;
  description: string | null;
  available: boolean;
  sort_order: number;
}

export default function AdminMenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filtered, setFiltered] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const supabase = createClient();

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "Beverages",
    price: 0,
    description: "",
    available: true,
  });

  const fetchMenuItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    
    if (!error && data) {
      setMenuItems(data);
      setFiltered(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  useEffect(() => {
    if (search) {
      const q = search.toLowerCase();
      setFiltered(
        menuItems.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q)
        )
      );
    } else {
      setFiltered(menuItems);
    }
    setCurrentPage(1);
  }, [menuItems, search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleOpenForm = (item?: MenuItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category,
        price: item.price,
        description: item.description || "",
        available: item.available,
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: "",
        category: "Beverages",
        price: 0,
        description: "",
        available: true,
      });
    }
    setShowFormModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      const res = await updateMenuItem(editingItem.id, formData);
      if (res.success) {
        toast.success("Menu item updated!");
        setShowFormModal(false);
        fetchMenuItems();
      } else {
        toast.error("Failed to update: " + res.error);
      }
    } else {
      const res = await addMenuItem(formData);
      if (res.success) {
        toast.success("Menu item added!");
        setShowFormModal(false);
        fetchMenuItems();
      } else {
        toast.error("Failed to add: " + res.error);
      }
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const res = await deleteMenuItem(deleteConfirmId);
    if (res.success) {
      toast.success("Menu item deleted!");
      fetchMenuItems();
    } else {
      toast.error("Failed to delete: " + res.error);
    }
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-5">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Menu Management</h1>
          <p className="text-sm text-gray-400">Add, edit, or remove menu items</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchMenuItems} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
            <RefreshCw size={14} />
            Refresh
          </button>
          <button onClick={() => handleOpenForm()} className="flex items-center gap-2 bg-red-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-800 transition-colors">
            <Plus size={14} />
            Add Item
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search menu items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-400">No menu items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Name", "Category", "Price", "Description", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-gray-400 font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-gray-700">{item.name}</td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{item.category}</td>
                    <td className="py-3 px-4 text-gray-800 font-bold whitespace-nowrap">₱{item.price.toLocaleString()}</td>
                    <td className="py-3 px-4 text-gray-500 truncate max-w-[200px]" title={item.description || ""}>
                      {item.description || "—"}
                    </td>
                    <td className="py-3 px-4">
                      {item.available ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200 flex items-center gap-1 w-max">
                          <CheckCircle size={10} /> Available
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600 border border-red-200 flex items-center gap-1 w-max">
                          <XCircle size={10} /> Hidden
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleOpenForm(item)}
                          className="bg-gray-100 text-gray-600 hover:bg-gray-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-bold"
                          title="Edit"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-bold"
                          title="Delete"
                        >
                          <Trash2 size={13} /> Delete
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

      {/* Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowFormModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-4">{editingItem ? "Edit Menu Item" : "Add Menu Item"}</h3>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                  <input
                    required
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
                    placeholder="e.g. Beverages"
                  />
                </div>
                <div className="w-1/3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Price (₱)</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100 resize-none h-20"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="available"
                  checked={formData.available}
                  onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                  className="rounded text-red-700 focus:ring-red-700"
                />
                <label htmlFor="available" className="text-sm font-medium text-gray-700 cursor-pointer">Available to order</label>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-red-800 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-red-900 transition-colors"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} strokeWidth={2} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Menu Item?</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              This action cannot be undone. Are you sure you want to permanently remove this item from the menu?
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setDeleteConfirmId(null)} 
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete} 
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
