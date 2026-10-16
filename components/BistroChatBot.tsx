"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  RotateCcw,
  Bot,
  User,
  ExternalLink,
} from "lucide-react";

interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
  time: string;
}

const INITIAL_MESSAGE: Message = {
  id: "welcome-1",
  role: "assistant",
  text: "Mabuhay! 🍷 Welcome to **Jbenz Bistro**. I'm your AI Concierge powered by **Gemini**.\n\nHow can I assist you today? Feel free to ask about our **menu**, **VIP karaoke suites**, **billiard tables**, **operating hours**, or making a **reservation**!",
  time: "Just now",
};

const SUGGESTIONS = [
  "🎤 Karaoke rooms & rates",
  "🍽️ Popular menu dishes",
  "📅 How do I reserve a table?",
  "📍 Location & opening hours",
];

// Lightweight Markdown Formatter for Assistant replies
function FormattedMessage({ text, isBot }: { text: string; isBot: boolean }) {
  if (!isBot) {
    return <div className="whitespace-pre-wrap break-words">{text}</div>;
  }

  const lines = text.split("\n");

  const parseInline = (line: string) => {
    const regex = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }

      if (match[1]) {
        // [Link](url)
        const label = match[2];
        const url = match[3];
        parts.push(
          <a
            key={key++}
            href={url}
            className="text-red-900 font-semibold underline hover:text-gold transition-colors inline-flex items-center gap-0.5"
            target={url.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
          >
            {label}
            {url.startsWith("http") && <ExternalLink size={10} className="inline ml-0.5" />}
          </a>
        );
      } else if (match[4]) {
        // **bold**
        parts.push(
          <strong key={key++} className="font-semibold text-gray-900">
            {match[5]}
          </strong>
        );
      } else if (match[6]) {
        // `code`
        parts.push(
          <code
            key={key++}
            className="bg-amber-50 text-red-950 px-1 py-0.5 rounded text-[11px] font-mono border border-amber-200"
          >
            {match[7]}
          </code>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }

    return parts.length > 0 ? parts : line;
  };

  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-gray-700">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Header ###
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="font-bold text-gray-900 text-xs mt-2.5 mb-1 text-red-950 font-playfair">
              {parseInline(trimmed.replace(/^###\s*/, ""))}
            </h4>
          );
        }

        // Bullet point * or -
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5 my-1">
              <span className="text-gold mt-1 flex-shrink-0 text-[10px] leading-none">✦</span>
              <div className="flex-1">{parseInline(trimmed.replace(/^(\*|-)\s*/, ""))}</div>
            </div>
          );
        }

        return <div key={idx}>{parseInline(line)}</div>;
      })}
    </div>
  );
}

export default function BistroChatBot() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasUnreadNotification, setHasUnreadNotification] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  // Hide on admin, manager, profile, receipt dashboards to avoid blocking operations
  const isDashboard =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/manager") ||
    pathname?.startsWith("/profile") ||
    pathname?.startsWith("/receipt");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasUnreadNotification(false);
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen, messages]);

  // Click outside to close (desktop & tablet) + Escape key listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        chatWindowRef.current &&
        !chatWindowRef.current.contains(e.target as Node)
      ) {
        const launcher = document.getElementById("bistro-bot-launcher");
        if (!launcher || !launcher.contains(e.target as Node)) {
          setIsOpen(false);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (isDashboard) return null;

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const historyPayload = newMessages.map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: historyPayload,
        }),
      });

      const data = await res.json();
      const replyText =
        data.reply ||
        "Mabuhay! 🍷 I'm happy to help. Feel free to browse our dishes at [/menu](/menu), reserve a table or karaoke suite at [/reserve](/reserve), or call us directly at 09935343043!";

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: replyText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: "Oops, something went wrong while communicating with Gemini. Please check back shortly or call us at 09935343043.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([INITIAL_MESSAGE]);
  };

  return (
    <>
      {/* ── Dark Backdrop Overlay (when open) ── */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity animate-in fade-in duration-200 cursor-pointer"
          aria-hidden="true"
        />
      )}

      {/* ── Floating Launcher Button (Lifted & High-Contrast) ── */}
      <div
        id="bistro-bot-launcher"
        className="fixed z-50 flex items-center gap-2.5 transition-all"
        style={{
          bottom: "max(1.5rem, calc(1.5rem + env(safe-area-inset-bottom, 0px)))",
          right: "max(1.25rem, calc(1.25rem + env(safe-area-inset-right, 0px)))",
        }}
      >
        {/* Floating Greeting Bubble (only when closed) */}
        {!isOpen && hasUnreadNotification && (
          <div
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 bg-white text-gray-800 text-xs font-semibold px-3.5 py-2 rounded-2xl shadow-[0_6px_25px_rgba(0,0,0,0.35)] border border-gold/60 cursor-pointer animate-bounce transition-all hover:scale-105 active:scale-95"
          >
            <Sparkles size={14} className="text-gold flex-shrink-0 animate-spin" />
            <span>Need assistance? Chat with <strong>BistroBot</strong>!</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setHasUnreadNotification(false);
              }}
              className="text-gray-400 hover:text-gray-600 ml-1 p-0.5"
            >
              ×
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
          className="relative w-14 h-14 rounded-full bg-gradient-to-br from-[#800A1D] via-[#5B0612] to-[#250308] text-white shadow-[0_6px_25px_rgba(212,175,55,0.55),0_10px_35px_rgba(0,0,0,0.7)] flex items-center justify-center border-[2.5px] border-[#D4AF37] hover:scale-110 active:scale-95 transition-all duration-300 group cursor-pointer"
        >
          {isOpen ? (
            <X size={26} className="text-[#F5E6B3] transition-transform" />
          ) : (
            <>
              <MessageSquare size={26} className="text-[#F5E6B3] group-hover:scale-110 transition-transform" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-xs" />
            </>
          )}
        </button>
      </div>

      {/* ── Chat Window (Mobile Safe-Positioned / Desktop Floating) ── */}
      {isOpen && (
        <div
          ref={chatWindowRef}
          className="fixed inset-x-3.5 top-14 bottom-3 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[390px] sm:h-[510px] sm:max-h-[calc(100vh-120px)] sm:top-auto z-50 bg-white rounded-3xl shadow-[0_25px_60px_-10px_rgba(0,0,0,0.6)] border border-gold/40 flex flex-col overflow-hidden animate-in fade-in sm:zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#3d0a14] via-[#5B0612] to-[#3d0a14] text-white px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col border-b border-gold/30 flex-shrink-0 shadow-sm">
            {/* Top Close Tap Bar (Mobile) */}
            <div
              onClick={() => setIsOpen(false)}
              className="w-12 h-1.5 bg-white/40 active:bg-white/70 rounded-full mx-auto mb-2 sm:hidden cursor-pointer"
              title="Tap to close"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative w-9 h-9 rounded-2xl bg-gradient-to-br from-gold/30 to-gold/10 border border-gold/50 flex items-center justify-center text-gold shadow-inner flex-shrink-0">
                  <Bot size={20} className="text-gold" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#3d0a14]" />
                </div>
                <div>
                  <h3 className="font-playfair text-sm font-bold text-white tracking-wide leading-tight">
                    Jbenz Bistro Concierge
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-gold/90 font-medium mt-0.5">
                    <Sparkles size={10} className="text-gold animate-pulse" />
                    <span>Online • Gemini AI Concierge</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleClearChat}
                  title="Reset conversation"
                  className="w-8 h-8 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Close chat window"
                  aria-label="Close Chat"
                  className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm border border-white/20"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3 bg-gradient-to-b from-gray-50/90 via-white to-gray-50/60 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full overscroll-contain">
            {messages.map((msg) => {
              const isBot = msg.role === "assistant";
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isBot ? "" : "flex-row-reverse"}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm ${
                      isBot
                        ? "bg-[#5B0612] text-gold border border-gold/30"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {isBot ? <Bot size={13} /> : <User size={13} />}
                  </div>

                  <div className={`max-w-[85%] sm:max-w-[80%] flex flex-col ${isBot ? "items-start" : "items-end"}`}>
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-xs shadow-sm break-words ${
                        isBot
                          ? "bg-white text-gray-800 border border-gray-100 rounded-tl-sm shadow-xs"
                          : "bg-gradient-to-r from-[#5B0612] to-[#3d0a14] text-white rounded-tr-sm shadow-md"
                      }`}
                    >
                      <FormattedMessage text={msg.text} isBot={isBot} />
                    </div>
                    <span className="text-[9px] text-gray-400 mt-0.5 px-1">{msg.time}</span>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#5B0612] text-gold border border-gold/30 flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm">
                  <Bot size={13} />
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5B0612] animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" />
                  <span className="text-[11px] text-gray-400 ml-1 font-medium">BistroBot is replying…</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions Chips (shown when 2 or fewer messages) */}
          {messages.length <= 2 && (
            <div className="px-3 py-2 bg-gray-50/95 border-t border-gray-100 flex gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => handleSend(item)}
                  className="text-[11px] font-medium text-gray-700 bg-white hover:bg-gold/15 hover:text-[#5B0612] hover:border-gold/60 border border-gray-200 px-3 py-1.5 rounded-full whitespace-nowrap transition-all shadow-2xs flex-shrink-0 active:scale-95 cursor-pointer"
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          {/* Quick links footer inside modal */}
          <div className="px-4 py-1.5 bg-gray-100/70 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-500 flex-shrink-0">
            <span className="text-gray-400">Quick links:</span>
            <div className="flex items-center gap-2.5 font-medium">
              <a href="/reserve" className="text-[#5B0612] hover:underline flex items-center gap-0.5">
                Reserve <ExternalLink size={8} />
              </a>
              <span>•</span>
              <a href="/menu" className="text-[#5B0612] hover:underline flex items-center gap-0.5">
                Menu <ExternalLink size={8} />
              </a>
              <span>•</span>
              <a href="/contact" className="text-[#5B0612] hover:underline flex items-center gap-0.5">
                Contact <ExternalLink size={8} />
              </a>
            </div>
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 sm:p-3 bg-white border-t border-gray-100 flex items-center gap-2 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about Jbenz Bistro…"
              disabled={loading}
              className="flex-1 text-xs bg-gray-50 border border-gray-200 focus:border-gold focus:bg-white rounded-xl px-3.5 py-2.5 outline-none text-gray-700 placeholder-gray-400 transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5B0612] to-[#3d0a14] text-gold flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition-all shadow-md flex-shrink-0 cursor-pointer"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
