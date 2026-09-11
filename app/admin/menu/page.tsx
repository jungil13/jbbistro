"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  ImageIcon,
  Upload,
  Link as LinkIcon,
  X,
  Loader2,
  Utensils,
  ZoomIn,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { addMenuItem, updateMenuItem, deleteMenuItem, getMenuImages } from "@/app/actions/menu";
import Pagination from "@/components/admin/Pagination";

interface MenuItem {
  id: string;
  category: string;
  name: string;
  price: number;
  description: string | null;
  available: boolean;
  sort_order: number;
  image_url?: string;
}

export default function AdminMenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filtered, setFiltered] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ITEMS_PER_PAGE = 10;
  const supabase = createClient();

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<MenuItem | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "Beverages",
    price: 0,
    description: "",
    available: true,
    image_url: "",
  });

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const [itemsRes, imagesMap] = await Promise.all([
        supabase
          .from("menu_items")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        getMenuImages(),
      ]);

      if (!itemsRes.error && itemsRes.data) {
        const merged: MenuItem[] = itemsRes.data.map((item: any) => ({
          ...item,
          image_url: item.image_url || imagesMap[item.id] || "",
        }));
        setMenuItems(merged);
        setFiltered(merged);
      }
    } catch (err) {
      console.error("Error fetching menu items:", err);
    } finally {
      setLoading(false);
    }
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
            item.category.toLowerCase().includes(q) ||
            (item.description && item.description.toLowerCase().includes(q))
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
        image_url: item.image_url || "",
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: "",
        category: "Beverages",
        price: 0,
        description: "",
        available: true,
        image_url: "",
      });
    }
    setShowFormModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (under 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size should be less than 5MB");
      return;
    }

    setUploadingImage(true);
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `menu/${Date.now()}_${cleanName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        toast.error("Upload failed: " + uploadError.message);
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from("uploads")
          .getPublicUrl(filePath);
        setFormData((prev) => ({ ...prev, image_url: publicUrl }));
        toast.success("Image uploaded successfully!");
      }
    } catch (err: any) {
      toast.error("Upload error: " + err.message);
    } finally {
      setUploadingImage(false);
    }
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
          <p className="text-sm text-gray-400">Add, edit, or remove menu items and customize item photos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchMenuItems}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center gap-2 bg-red-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-800 transition-colors shadow-sm"
          >
            <Plus size={14} />
            Add Item
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, category, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
          />
        </div>
        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
          Total: <strong className="text-gray-700">{filtered.length}</strong> items
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Utensils size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-500">No menu items found</p>
            <p className="text-xs text-gray-400 mt-1">Try another search or add a new menu item</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Item", "Category", "Price", "Description", "Status", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="text-left py-3.5 px-4 text-gray-400 font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                    {/* Item Image + Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => {
                            if (item.image_url) setPreviewImage(item);
                          }}
                          className={`w-14 h-14 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center relative group/img ${
                            item.image_url ? "cursor-pointer hover:ring-2 hover:ring-[#c9a84c] shadow-sm transition-all" : ""
                          }`}
                          title={item.image_url ? `Click to preview ${item.name}` : undefined}
                        >
                          {item.image_url ? (
                            <>
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn size={16} className="text-white drop-shadow" />
                              </div>
                            </>
                          ) : (
                            <Utensils size={18} className="text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{item.name}</p>
                          <span className="text-[10px] text-gray-400">Order: #{item.sort_order}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap font-medium">
                      <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 font-semibold text-[11px]">
                        {item.category}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-red-950 font-bold whitespace-nowrap text-sm">
                      ₱{item.price.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-gray-500 truncate max-w-[220px]" title={item.description || ""}>
                      {item.description || <span className="text-gray-300 italic">No description</span>}
                    </td>

                    <td className="py-3 px-4">
                      {item.available ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 flex items-center gap-1 w-max">
                          <CheckCircle size={11} /> Available
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 flex items-center gap-1 w-max">
                          <XCircle size={11} /> Hidden
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleOpenForm(item)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-[11px] font-semibold"
                          title="Edit"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-[11px] font-semibold"
                          title="Delete"
                        >
                          <Trash2 size={12} /> Delete
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
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
          onClick={() => setShowFormModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                {editingItem ? "Edit Menu Item" : "Add New Menu Item"}
              </h3>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              {/* Image upload / preview section */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Item Image (Editable)
                </label>
                <div className="flex items-start gap-4">
                  {/* Thumbnail display */}
                  <div className="w-24 h-24 rounded-xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative flex-shrink-0 group">
                    {formData.image_url ? (
                      <>
                        <img
                          src={formData.image_url}
                          alt="preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, image_url: "" })}
                          className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white p-1 rounded-full shadow"
                          title="Remove image"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-400 p-2 text-center">
                        <ImageIcon size={22} className="mb-1" />
                        <span className="text-[9px]">No photo</span>
                      </div>
                    )}
                  </div>

                  {/* Actions: upload file or enter URL */}
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-900 hover:bg-red-100 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload size={13} />
                            Upload Photo
                          </>
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>

                    <div className="relative">
                      <LinkIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="url"
                        placeholder="Or paste direct image URL (https://...)"
                        value={formData.image_url}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                        className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-red-300"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400">
                      Supports JPG, PNG, WEBP. Upload a photo or link to a web image.
                    </p>
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Item Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Crispy Pata, Blue Hawaiian Cocktail"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
                />
              </div>

              {/* Category & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  <input
                    required
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
                    placeholder="e.g. Beverages, Pulutan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Price (₱)</label>
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

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Describe ingredients, flavor profile, or serving size..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100 resize-none h-20"
                />
              </div>

              {/* Availability */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="available"
                  checked={formData.available}
                  onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                  className="rounded text-red-900 focus:ring-red-800 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="available" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Available on public customer menu
                </label>
              </div>

              {/* Action Buttons */}
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
                  className="flex-1 bg-red-900 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-red-800 transition-colors shadow-md"
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
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 size={24} strokeWidth={2} />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">Delete Menu Item?</h3>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              Are you sure you want to delete this menu item? This action cannot be undone.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-semibold text-xs hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-semibold text-xs hover:bg-red-700 transition-colors shadow-md shadow-red-600/20"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors"
            >
              <X size={16} />
            </button>
            <div className="w-full bg-gray-100 flex items-center justify-center min-h-[220px] max-h-[60vh] overflow-hidden">
              <img
                src={previewImage.image_url}
                alt={previewImage.name}
                className="w-full h-full max-h-[58vh] object-contain"
              />
            </div>
            <div className="p-4 bg-white flex items-center justify-between border-t border-gray-100">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-[#c9a84c] border border-[#c9a84c]/20 uppercase">
                  {previewImage.category}
                </span>
                <h4 className="font-bold text-gray-800 text-base mt-1">{previewImage.name}</h4>
              </div>
              <span className="font-extrabold text-[#3d0a14] text-lg">
                ₱{previewImage.price.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
