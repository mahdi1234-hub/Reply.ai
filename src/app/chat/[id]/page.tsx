"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  Paperclip,
  AtSign,
  User,
  FileText,
  Loader2,
  Copy,
  Check,
  Download,
  Square,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import * as Tooltip from "@radix-ui/react-tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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

/* Tooltip wrapper */
function ActionTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50"
          sideOffset={5}
        >
          {label}
          <Tooltip.Arrow className="fill-gray-800" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/* Message action buttons: copy, export CSV, regenerate, thumbs up/down */
function MessageActions({
  content,
  onRegenerate,
  showRegenerate,
}: {
  content: string;
  onRegenerate?: () => void;
  showRegenerate?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleExportCSV = () => {
    const lines = content.split("\n").filter((l) => l.includes("|"));
    if (lines.length < 2) {
      toast.info("No table data found to export");
      return;
    }
    const rows = lines
      .filter((l) => !l.match(/^\s*\|[-:|\s]+\|\s*$/))
      .map((l) =>
        l.split("|").map((c) => c.trim()).filter(Boolean)
      );
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "export.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const hasTable =
    content.includes("|") &&
    content.split("\n").filter((l) => l.includes("|")).length >= 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1 mt-2"
    >
      <ActionTooltip label={copied ? "Copied!" : "Copy"}>
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </ActionTooltip>

      {hasTable && (
        <ActionTooltip label="Export CSV">
          <button
            onClick={handleExportCSV}
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Download size={14} />
          </button>
        </ActionTooltip>
      )}

      {showRegenerate && onRegenerate && (
        <ActionTooltip label="Regenerate">
          <button
            onClick={onRegenerate}
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RotateCcw size={14} />
          </button>
        </ActionTooltip>
      )}

      <ActionTooltip label="Good response">
        <button
          onClick={() => toast.success("Thanks for the feedback!")}
          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ThumbsUp size={14} />
        </button>
      </ActionTooltip>

      <ActionTooltip label="Bad response">
        <button
          onClick={() => toast.info("Thanks for the feedback!")}
          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ThumbsDown size={14} />
        </button>
      </ActionTooltip>
    </motion.div>
  );
}

/* Collapsible table: shows 5 rows by default, with Show more / Show less */
const MAX_VISIBLE_ROWS = 5;

function CollapsibleTable({
  children,
}: {
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const [totalRows, setTotalRows] = useState(0);

  useEffect(() => {
    if (tableRef.current) {
      const tbody = tableRef.current.querySelector("tbody");
      if (tbody) {
        setTotalRows(tbody.children.length);
      } else {
        // count all tr except those inside thead
        const allRows = tableRef.current.querySelectorAll("tr");
        const theadRows = tableRef.current.querySelectorAll("thead tr");
        setTotalRows(allRows.length - theadRows.length);
      }
    }
  }, [children]);

  const needsCollapse = totalRows > MAX_VISIBLE_ROWS;

  return (
    <div className="relative">
      <div
        className={needsCollapse && !expanded ? "max-h-[220px] overflow-hidden" : ""}
      >
        <table ref={tableRef}>{children}</table>
      </div>
      {needsCollapse && !expanded && (
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-gray-100 to-transparent pointer-events-none" />
      )}
      {needsCollapse && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 mt-1 font-medium transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp size={14} />
              Show less
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              Show more ({totalRows - MAX_VISIBLE_ROWS} more rows)
            </>
          )}
        </button>
      )}
    </div>
  );
}

/* Custom markdown components with collapsible tables */
const markdownComponents: Partial<Components> = {
  table: ({ children }) => <CollapsibleTable>{children}</CollapsibleTable>,
};

/* Framer-motion variants for message appearance */
const messageVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

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
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    preview: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const stored = localStorage.getItem("chatHistory");
    if (stored) {
      const parsed: ChatHistory[] = JSON.parse(stored);
      const existing = parsed.find((c) => c.id === chatId);
      if (existing && existing.messages) {
        setMessages(existing.messages);
        return;
      }
    }

    if (initialQuery) {
      const userMessage: Message = { role: "user", content: initialQuery };
      setMessages([userMessage]);
      sendMessage([userMessage]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, initialQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const generateTitle = (content: string) => {
    const words = content.split(" ").slice(0, 6).join(" ");
    return words.length < content.length ? words : content;
  };

  const saveChatHistory = useCallback(
    (msgs: Message[]) => {
      const stored = localStorage.getItem("chatHistory");
      const history: ChatHistory[] = stored ? JSON.parse(stored) : [];

      const existingIndex = history.findIndex((c) => c.id === chatId);
      const firstUserMsg = msgs.find((m) => m.role === "user");
      const lastAssistantMsg = [...msgs]
        .reverse()
        .find((m) => m.role === "assistant");

      const chatEntry: ChatHistory = {
        id: chatId,
        title: generateTitle(firstUserMsg?.content || "New Chat"),
        preview:
          lastAssistantMsg?.content?.slice(0, 80) ||
          firstUserMsg?.content?.slice(0, 80) ||
          "",
        timestamp: new Date(),
        messages: msgs,
      };

      if (existingIndex >= 0) {
        history[existingIndex] = chatEntry;
      } else {
        history.unshift(chatEntry);
      }

      localStorage.setItem("chatHistory", JSON.stringify(history));
    },
    [chatId]
  );

  const sendMessage = async (msgs: Message[]) => {
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
        signal: abortControllerRef.current.signal,
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
              // skip parse errors
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
      if (error instanceof DOMException && error.name === "AbortError") {
        toast.info("Response stopped");
        return;
      }
      console.error("Error:", error);
      const errorMsg: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMsg]);
      toast.error("Failed to get response");
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleRegenerate = () => {
    if (isLoading) return;
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx === -1) return;

    const msgsUpToUser = messages.slice(0, lastUserIdx + 1);
    setMessages(msgsUpToUser);
    sendMessage(msgsUpToUser);
    toast.info("Regenerating response...");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    toast.info(`Uploading ${file.name}...`);

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
      toast.success(`${file.name} uploaded successfully`);

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
      toast.error(
        `Failed to upload: ${error instanceof Error ? error.message : "Unknown error"}`
      );
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
    <Tooltip.Provider>
      <div className="h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <ActionTooltip label="Back to home">
            <button
              onClick={() => router.push("/")}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          </ActionTooltip>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7">
              <svg
                viewBox="0 0 80 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <ellipse cx="40" cy="45" rx="28" ry="25" fill="#A7E8D0" />
                <ellipse cx="40" cy="42" rx="24" ry="22" fill="#7DDDB8" />
                <circle cx="32" cy="38" r="3" fill="#2D6A4F" />
                <circle cx="48" cy="38" r="3" fill="#2D6A4F" />
                <path
                  d="M33 48 Q40 54 47 48"
                  stroke="#2D6A4F"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="font-semibold text-sm text-gray-800">
              Rep AI
            </span>
          </div>
        </div>

        {/* Messages with Radix ScrollArea */}
        <ScrollArea.Root className="flex-1 overflow-hidden">
          <ScrollArea.Viewport className="h-full w-full px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={`${i}-${msg.role}`}
                    variants={messageVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                    className={`flex gap-3 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 flex-shrink-0 mt-1">
                        <svg
                          viewBox="0 0 80 80"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <ellipse cx="40" cy="45" rx="28" ry="25" fill="#A7E8D0" />
                          <ellipse cx="40" cy="42" rx="24" ry="22" fill="#7DDDB8" />
                          <circle cx="32" cy="38" r="3" fill="#2D6A4F" />
                          <circle cx="48" cy="38" r="3" fill="#2D6A4F" />
                          <path
                            d="M33 48 Q40 54 47 48"
                            stroke="#2D6A4F"
                            strokeWidth="2.5"
                            fill="none"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="max-w-lg">
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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
                        {msg.role === "assistant" ? (
                          <div className="markdown-body">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeHighlight]}
                              components={markdownComponents}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                      {msg.role === "assistant" && msg.content && (
                        <MessageActions
                          content={msg.content}
                          onRegenerate={handleRegenerate}
                          showRegenerate={i === messages.length - 1}
                        />
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 flex-shrink-0 mt-1 bg-gray-200 rounded-full flex items-center justify-center">
                        <User size={14} className="text-gray-500" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 justify-start"
                >
                  <div className="w-7 h-7 flex-shrink-0 mt-1">
                    <svg
                      viewBox="0 0 80 80"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <ellipse cx="40" cy="45" rx="28" ry="25" fill="#A7E8D0" />
                      <ellipse cx="40" cy="42" rx="24" ry="22" fill="#7DDDB8" />
                      <circle cx="32" cy="38" r="3" fill="#2D6A4F" />
                      <circle cx="48" cy="38" r="3" fill="#2D6A4F" />
                      <path
                        d="M33 48 Q40 54 47 48"
                        stroke="#2D6A4F"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div className="bg-gray-100 rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Upload preview indicator */}
              {uploadedFile && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex justify-end"
                >
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                    <FileText size={14} className="text-emerald-600" />
                    <span className="text-emerald-700">{uploadedFile.name}</span>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            className="flex select-none touch-none p-0.5 bg-transparent transition-colors hover:bg-gray-100 data-[orientation=vertical]:w-2"
            orientation="vertical"
          >
            <ScrollArea.Thumb className="flex-1 bg-gray-300 rounded-full relative" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>

        {/* Input area */}
        <div className="border-t border-gray-100 px-4 py-3 flex-shrink-0">
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
                  <ActionTooltip label="Upload file">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
                    >
                      {isUploading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Paperclip size={18} />
                      )}
                    </button>
                  </ActionTooltip>

                  {isLoading ? (
                    <ActionTooltip label="Stop generating">
                      <button
                        type="button"
                        onClick={handleStop}
                        className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
                      >
                        <Square size={12} fill="white" />
                      </button>
                    </ActionTooltip>
                  ) : (
                    <ActionTooltip label="Send message">
                      <button
                        type="submit"
                        disabled={!input.trim()}
                        className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center text-white transition-colors"
                      >
                        <ArrowUp size={16} />
                      </button>
                    </ActionTooltip>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
