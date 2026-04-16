"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowUp, Paperclip, AtSign, User, FileText, X, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  fileName?: string;
}

interface ChatHistory {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  messages: Message[];
}

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const chatId = params.id as string;
  const initialQuery = searchParams.get("q");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; preview: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Check if there's an existing chat
    const stored = localStorage.getItem("chatHistory");
    if (stored) {
      const parsed: ChatHistory[] = JSON.parse(stored);
      const existing = parsed.find((c) => c.id === chatId);
      if (existing && existing.messages) {
        setMessages(existing.messages);
        return;
      }
    }

    // Start new chat with initial query
    if (initialQuery) {
      const userMessage: Message = { role: "user", content: initialQuery };
      setMessages([userMessage]);
      sendMessage([userMessage]);
    }
  }, [chatId, initialQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const generateTitle = (content: string) => {
    const words = content.split(" ").slice(0, 6).join(" ");
    return words.length < content.length ? words : content;
  };

  const saveChatHistory = (msgs: Message[]) => {
    const stored = localStorage.getItem("chatHistory");
    const history: ChatHistory[] = stored ? JSON.parse(stored) : [];

    const existingIndex = history.findIndex((c) => c.id === chatId);
    const firstUserMsg = msgs.find((m) => m.role === "user");
    const lastAssistantMsg = [...msgs].reverse().find((m) => m.role === "assistant");

    const chatEntry: ChatHistory = {
      id: chatId,
      title: generateTitle(firstUserMsg?.content || "New Chat"),
      preview: lastAssistantMsg?.content?.slice(0, 80) || firstUserMsg?.content?.slice(0, 80) || "",
      timestamp: new Date(),
      messages: msgs,
    };

    if (existingIndex >= 0) {
      history[existingIndex] = chatEntry;
    } else {
      history.unshift(chatEntry);
    }

    localStorage.setItem("chatHistory", JSON.stringify(history));
  };

  const sendMessage = async (msgs: Message[]) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let assistantContent = "";

      const assistantMsg: Message = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantContent += parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                  };
                  return updated;
                });
              }
            } catch {
              // skip
            }
          }
        }
      }

      const finalMsgs = [
        ...msgs,
        { role: "assistant" as const, content: assistantContent },
      ];
      saveChatHistory(finalMsgs);
    } catch (error) {
      console.error("Error:", error);
      const errorMsg: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
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

      setUploadedFile({ name: file.name, preview: data.preview });

      // Add a system message about the upload and ask AI about it
      const uploadMsg: Message = {
        role: "user",
        content: `I've uploaded a file: "${file.name}" (${data.fileType}). Here's a preview: ${data.preview}\n\nPlease analyze this document and tell me what it contains.`,
        fileName: file.name,
      };
      const newMessages = [...messages, uploadMsg];
      setMessages(newMessages);
      setUploadedFile(null);
      sendMessage(newMessages);
    } catch (error) {
      console.error("Upload error:", error);
      const errorMsg: Message = {
        role: "assistant",
        content: `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    sendMessage(newMessages);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7">
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="40" cy="45" rx="28" ry="25" fill="#A7E8D0" />
              <ellipse cx="40" cy="42" rx="24" ry="22" fill="#7DDDB8" />
              <circle cx="32" cy="38" r="3" fill="#2D6A4F" />
              <circle cx="48" cy="38" r="3" fill="#2D6A4F" />
              <path d="M33 48 Q40 54 47 48" stroke="#2D6A4F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-semibold text-sm text-gray-800">Rep AI</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 flex-shrink-0 mt-1">
                  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="40" cy="45" rx="28" ry="25" fill="#A7E8D0" />
                    <ellipse cx="40" cy="42" rx="24" ry="22" fill="#7DDDB8" />
                    <circle cx="32" cy="38" r="3" fill="#2D6A4F" />
                    <circle cx="48" cy="38" r="3" fill="#2D6A4F" />
                    <path d="M33 48 Q40 54 47 48" stroke="#2D6A4F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  </svg>
                </div>
              )}
              <div
                className={`max-w-lg rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.fileName && (
                  <div className="flex items-center gap-1.5 mb-1.5 text-xs opacity-80">
                    <FileText size={12} />
                    <span>{msg.fileName}</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 flex-shrink-0 mt-1 bg-gray-200 rounded-full flex items-center justify-center">
                  <User size={14} className="text-gray-500" />
                </div>
              )}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 flex-shrink-0 mt-1">
                <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <ellipse cx="40" cy="45" rx="28" ry="25" fill="#A7E8D0" />
                  <ellipse cx="40" cy="42" rx="24" ry="22" fill="#7DDDB8" />
                  <circle cx="32" cy="38" r="3" fill="#2D6A4F" />
                  <circle cx="48" cy="38" r="3" fill="#2D6A4F" />
                  <path d="M33 48 Q40 54 47 48" stroke="#2D6A4F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                </svg>
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-4 py-3">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="border border-gray-200 rounded-lg">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Rep questions about your customers and deals"
              className="w-full px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none rounded-lg"
              disabled={isLoading}
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
                  disabled={isLoading}
                  className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center text-white transition-colors"
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
