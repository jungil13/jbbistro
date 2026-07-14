"use client";
import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Bot, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  role: "bot" | "user";
  text: string;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [config, setConfig] = useState({ enabled: true, name: "JB Assistant", greeting: "Hi! Welcome to Jbenz Bistro! How can I help you today?" });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from("settings").select("*").in("key", ["ai_enabled", "chatbot_name", "chatbot_greeting"]);
      if (data) {
        const conf: any = { enabled: true, name: "JB Assistant", greeting: "Hi! Welcome to Jbenz Bistro! How can I help you today?" };
        data.forEach(d => {
          if (d.key === "ai_enabled") conf.enabled = d.value === "true";
          if (d.key === "chatbot_name" && d.value) conf.name = d.value;
          if (d.key === "chatbot_greeting" && d.value) conf.greeting = d.value;
        });
        setConfig(conf);
        if (messages.length === 0) {
          setMessages([{ id: "msg-0", role: "bot", text: conf.greeting }]);
        }
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  if (!config.enabled) return null;

  const getBotResponse = (msg: string) => {
    const lmsg = msg.toLowerCase();
    if (lmsg.includes("reserve") || lmsg.includes("book")) {
      return "You can easily make a reservation by clicking the 'Reserve' link in our navigation menu! You can book dining tables, karaoke rooms, or billiard tables.";
    }
    if (lmsg.includes("hour") || lmsg.includes("time") || lmsg.includes("open")) {
      return "We are open Mon-Thu 11AM-11PM, Fri-Sat 11AM-2AM, and Sundays 12PM-10PM.";
    }
    if (lmsg.includes("price") || lmsg.includes("cost") || lmsg.includes("rate")) {
      return "Our karaoke rooms start at ₱400/hr for standard and ₱800/hr for VIP. Billiard tables are ₱150/hr for standard and ₱300/hr for VIP.";
    }
    if (lmsg.includes("location") || lmsg.includes("where")) {
      return "We are located in the heart of the city. You can find our full address and map on the Contact page.";
    }
    return "I'm a simple AI assistant. For more complex inquiries, please contact our staff directly at the restaurant or via our Contact page. Is there anything else about reservations, hours, or prices I can help with?";
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", text: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    // Simulate bot delay
    setTimeout(() => {
      const botMsg: Message = { id: (Date.now()+1).toString(), role: "bot", text: getBotResponse(userMsg.text) };
      setMessages(prev => [...prev, botMsg]);
    }, 1000);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Window */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col mb-4 transition-all" style={{ height: '450px' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-red-950 to-red-900 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                <Bot size={18} />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">{config.name}</h3>
                <p className="text-white/60 text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 block" /> Online
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white p-1">
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
            {messages.map((m) => (
              <div key={m.id} className={`flex items-end gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === "user" ? "bg-red-100 text-red-900" : "bg-gray-200 text-gray-600"}`}>
                  {m.role === "user" ? <User size={12} /> : <Bot size={12} />}
                </div>
                <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${m.role === "user" ? "bg-red-900 text-white rounded-br-none" : "bg-white border border-gray-100 text-gray-700 shadow-sm rounded-bl-none"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-100">
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-red-300 focus:bg-white transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-10 h-10 rounded-full bg-red-900 text-white flex items-center justify-center flex-shrink-0 hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} className="ml-1" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-red-900 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-900/30 hover:bg-red-800 hover:-translate-y-1 transition-all"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>
    </div>
  );
}
