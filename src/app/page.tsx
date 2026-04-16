"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, ArrowUp, MessageCircle, AtSign, Loader2, LogOut } from "lucide-react";

interface ChatHistory {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("chatHistory");
    if (stored) {
      const parsed = JSON.parse(stored);
      setChatHistory(
        parsed.map((item: ChatHistory) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }))
      );
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const chatId = Date.now().toString();
    router.push(`/chat/${chatId}?q=${encodeURIComponent(input.trim())}`);
  };

  const handleSuggestion = (suggestion: string) => {
    const chatId = Date.now().toString();
    router.push(`/chat/${chatId}?q=${encodeURIComponent(suggestion)}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      // Navigate to a new chat with the file upload context
      const chatId = Date.now().toString();
      const query = `I've uploaded a file: "${file.name}" (${data.fileType}). Here's a preview: ${data.preview}\n\nPlease analyze this document and tell me what it contains.`;
      router.push(`/chat/${chatId}?q=${encodeURIComponent(query)}`);
    } catch (error) {
      console.error("Upload error:", error);
      alert(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const groupByDate = (items: ChatHistory[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const groups: { [key: string]: ChatHistory[] } = {};

    items.forEach((item) => {
      const itemDate = new Date(item.timestamp);
      itemDate.setHours(0, 0, 0, 0);

      if (itemDate.getTime() === today.getTime()) {
        if (!groups["Today"]) groups["Today"] = [];
        groups["Today"].push(item);
      } else {
        const label = itemDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        });
        if (!groups[label]) groups[label] = [];
        groups[label].push(item);
      }
    });

    return groups;
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth");
  };

  const suggestions = [
    "What can you do?",
    "What deals need attention?",
    "Who should I follow up with?",
  ];

  const grouped = groupByDate(chatHistory);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center">
      {/* Top bar with logout */}
      <div className="w-full max-w-2xl px-4 pt-4 flex justify-end">
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <LogOut size={14} />
          <span>Sign out</span>
        </button>
      </div>
      <div className="w-full max-w-2xl px-4 pt-8 pb-8">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="40" cy="45" rx="28" ry="25" fill="#A7E8D0" />
              <ellipse cx="40" cy="42" rx="24" ry="22" fill="#7DDDB8" />
              <circle cx="32" cy="38" r="3" fill="#2D6A4F" />
              <circle cx="48" cy="38" r="3" fill="#2D6A4F" />
              <path d="M33 48 Q40 54 47 48" stroke="#2D6A4F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              {/* Sparkles */}
              <circle cx="18" cy="22" r="2" fill="#7DDDB8" opacity="0.7" />
              <circle cx="60" cy="18" r="3" fill="#A7E8D0" opacity="0.8" />
              <circle cx="55" cy="28" r="1.5" fill="#7DDDB8" opacity="0.6" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-center text-2xl font-semibold mb-6">
          How can <span className="text-black">I </span>
          <span className="text-emerald-500">help</span>?
        </h1>

        {/* Suggestion chips */}
        <div className="flex items-center gap-3 mb-4 bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => handleSuggestion(suggestion)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
            >
              <MessageCircle size={14} className="text-gray-400" />
              {suggestion}
            </button>
          ))}
        </div>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="relative mb-2">
          <div className="border border-gray-200 rounded-lg">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Rep questions about your customers and deals"
              className="w-full px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none rounded-lg"
            />
            <div className="flex items-center justify-between px-4 py-2">
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                <AtSign size={16} />
                <span>Add context</span>
              </button>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.jpg,.jpeg,.png,.gif,.webp,.bmp"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                </button>
                <button
                  type="submit"
                  className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white transition-colors"
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Chat History */}
        {Object.keys(grouped).length > 0 && (
          <div className="mt-8">
            {Object.entries(grouped).map(([dateLabel, items]) => (
              <div key={dateLabel}>
                <h3 className="text-sm text-gray-400 mb-3">{dateLabel}</h3>
                <div className="space-y-0">
                  {items.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => router.push(`/chat/${chat.id}`)}
                      className="flex items-start justify-between py-4 border-t border-gray-100 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <h4 className="font-semibold text-gray-900 text-sm mb-1">
                          {chat.title}
                        </h4>
                        <p className="text-sm text-gray-500 truncate">
                          {chat.preview}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap mt-1">
                        {formatTimeAgo(chat.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
