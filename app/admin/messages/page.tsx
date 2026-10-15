"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Inbox, Mail, MailOpen, Archive, ArchiveRestore, Trash2, RefreshCw, Search, Phone, MessageSquare, ExternalLink } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { updateMessageStatusAction, deleteMessageAction } from "@/app/actions/contact";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: "unread" | "read" | "replied" | "archived";
  created_at: string;
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    unread: "bg-blue-100 text-blue-700 border border-blue-200",
    read: "bg-gray-100 text-gray-500 border border-gray-200",
    replied: "bg-green-100 text-green-700 border border-green-200",
    archived: "bg-amber-100 text-amber-700 border border-amber-200",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${map[status] ?? map.read}`}>
      {status}
    </span>
  );
};

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [filtered, setFiltered] = useState<ContactMessage[]>([]);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const supabase = createClient();

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load messages");
    if (data) {
      setMessages(data);
      setFiltered(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();

    // Realtime subscription for new messages
    const channel = supabase
      .channel("contact-messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contact_messages" }, (payload) => {
        setMessages((prev) => [payload.new as ContactMessage, ...prev]);
        toast.success(`New message from ${(payload.new as ContactMessage).name}!`);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    let result = messages;
    if (statusFilter !== "all") {
      result = result.filter((m) => m.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.message.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [messages, search, statusFilter]);

  const handleOpenMessage = async (msg: ContactMessage) => {
    setSelected(msg);
    if (msg.status === "unread") {
      const result = await updateMessageStatusAction(msg.id, "read");
      if (result.success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, status: "read" } : m))
        );
      }
    }
  };

  const handleStatusChange = async (id: string, status: "unread" | "read" | "replied" | "archived") => {
    const result = await updateMessageStatusAction(id, status);
    if (result.success) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status } : m))
      );
      if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status } : null);
      const label =
        status === "archived"
          ? "Message archived"
          : status === "read"
          ? "Message unarchived"
          : `Marked as ${status}`;
      toast.success(label);
    } else {
      toast.error("Failed to update status");
    }
  };

  const handleReplyViaGmail = (msg: ContactMessage) => {
    if (msg.status !== "replied") {
      handleStatusChange(msg.id, "replied");
    }

    const customerEmail = msg.email.trim();
    const customerName = msg.name.trim();
    const subject = `Re: ${msg.subject || "Customer Inquiry - Jbenz Bistro"}`;
    const body = `Hi ${customerName},\n\n\n\n--- Customer Inquiry Reference ---\nFrom: ${customerName} <${customerEmail}>\n${msg.phone ? `Phone: ${msg.phone}\n` : ""}Date: ${new Date(msg.created_at).toLocaleString()}\nSubject: ${msg.subject || "General Inquiry"}\n\n${msg.message}\n`;

    const encodedTo = encodeURIComponent(customerEmail);
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);

    const isMobile =
      typeof window !== "undefined" &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    if (isMobile) {
      // Mobile: Try direct Gmail app URI scheme, fallback to mailto
      const gmailAppUri = `googlegmail:///co?to=${encodedTo}&subject=${encodedSubject}&body=${encodedBody}`;
      const mailtoUri = `mailto:${encodedTo}?subject=${encodedSubject}&body=${encodedBody}`;

      const start = Date.now();
      window.location.href = gmailAppUri;

      setTimeout(() => {
        if (Date.now() - start < 2000 && !document.hidden) {
          window.location.href = mailtoUri;
        }
      }, 1200);
    } else {
      // Desktop: Open Gmail Web compose in a new tab
      const gmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;
      window.open(gmailWebUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const result = await deleteMessageAction(id);
    setDeleting(null);
    if (result.success) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success("Message deleted");
    } else {
      toast.error("Failed to delete");
    }
  };

  const unreadCount = messages.filter((m) => m.status === "unread").length;

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Inbox size={20} className="text-red-900" />
            Customer Messages
            {unreadCount > 0 && (
              <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage contact form submissions from customers</p>
        </div>
        <button
          onClick={fetchMessages}
          disabled={loading}
          className="flex items-center gap-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-5 h-[calc(100vh-220px)] min-h-[500px]">
        {/* ── Left: Message List ── */}
        <div className="xl:w-96 flex-shrink-0 flex flex-col gap-3">
          {/* Filters */}
          <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm space-y-2">
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search messages…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent outline-none text-gray-600 placeholder-gray-400"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {["all", "unread", "read", "replied", "archived"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                    statusFilter === s
                      ? "bg-red-900 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {s}
                  {s === "unread" && unreadCount > 0 && (
                    <span className="ml-1 bg-red-500 text-white rounded-full px-1 text-[9px]">
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto bg-white border border-gray-100 rounded-2xl shadow-sm divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 space-y-2 animate-pulse">
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-2 bg-gray-100 rounded w-3/4" />
                  <div className="h-2 bg-gray-100 rounded w-1/3" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <MessageSquare size={32} className="text-gray-200 mb-3" />
                <p className="text-sm font-semibold text-gray-400">No messages found</p>
                <p className="text-xs text-gray-300 mt-1">Submissions from the contact form will appear here</p>
              </div>
            ) : (
              filtered.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => handleOpenMessage(msg)}
                  className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors ${
                    selected?.id === msg.id ? "bg-red-50 border-l-2 border-red-600" : ""
                  } ${msg.status === "unread" ? "bg-blue-50/40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={`text-sm font-semibold truncate ${msg.status === "unread" ? "text-gray-900" : "text-gray-600"}`}>
                      {msg.name}
                    </span>
                    {statusBadge(msg.status)}
                  </div>
                  <p className="text-xs text-gray-500 truncate font-medium">{msg.subject || "General Inquiry"}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{msg.message}</p>
                  <p className="text-[10px] text-gray-300 mt-1">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right: Message Detail ── */}
        <div className="flex-1 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-gray-100">
                <Mail size={28} className="text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-400">Select a message to read</p>
              <p className="text-xs text-gray-300 mt-1">Click any message from the list on the left</p>
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-800">
                      {selected.subject || "General Inquiry"}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500 font-semibold">{selected.name}</span>
                      <button
                        type="button"
                        onClick={() => handleReplyViaGmail(selected)}
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        title="Click to reply via Gmail"
                      >
                        {selected.email}
                        <ExternalLink size={10} className="opacity-70" />
                      </button>
                      {selected.phone && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Phone size={10} /> {selected.phone}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Received {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {statusBadge(selected.status)}
                  </div>
                </div>
              </div>

              {/* Message Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {selected.message}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleReplyViaGmail(selected)}
                  className="flex items-center gap-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                  title="Open in Gmail (App on mobile, Web on desktop)"
                >
                  <Mail size={13} />
                  Reply via Gmail
                  <ExternalLink size={11} className="opacity-80" />
                </button>

                {selected.status !== "replied" && (
                  <button
                    onClick={() => handleStatusChange(selected.id, "replied")}
                    className="flex items-center gap-2 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 px-4 py-2 rounded-xl transition-colors"
                  >
                    <MailOpen size={13} />
                    Mark Replied
                  </button>
                )}

                {selected.status === "archived" ? (
                  <button
                    onClick={() => handleStatusChange(selected.id, "read")}
                    className="flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors"
                    title="Restore message to active inbox"
                  >
                    <ArchiveRestore size={13} />
                    Unarchive
                  </button>
                ) : (
                  <button
                    onClick={() => handleStatusChange(selected.id, "archived")}
                    className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-4 py-2 rounded-xl transition-colors"
                    title="Move message to archive"
                  >
                    <Archive size={13} />
                    Archive
                  </button>
                )}

                <button
                  onClick={() => handleDelete(selected.id)}
                  disabled={deleting === selected.id}
                  className="flex items-center gap-2 text-xs font-semibold text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 px-4 py-2 rounded-xl transition-colors disabled:opacity-50 ml-auto"
                >
                  <Trash2 size={13} />
                  {deleting === selected.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
