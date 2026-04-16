"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, X, Check, CheckCheck, Trash2 } from "lucide-react";
import { useKnockFeed } from "@knocklabs/react";
import { toast } from "sonner";
import type { FeedItem } from "@knocklabs/client";

function NotificationInboxContent() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { feedClient, useFeedStore } = useKnockFeed();
  const { items, metadata } = useFeedStore();

  const unreadCount = metadata?.unread_count ?? 0;

  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (items && items.length > 0 && seenIdsRef.current.size === 0) {
      items.forEach((item: FeedItem) => seenIdsRef.current.add(item.id));
    }
  }, [items]);

  useEffect(() => {
    if (!feedClient) return;

    const handleNewMessage = () => {
      const currentItems = feedClient.store.getState().items;
      currentItems.forEach((item: FeedItem) => {
        if (!seenIdsRef.current.has(item.id)) {
          seenIdsRef.current.add(item.id);
          const body =
            (item.blocks?.[0] as { rendered?: string })?.rendered ||
            (item.data as { message?: string })?.message ||
            "New notification";
          const plainText = body.replace(/<[^>]*>/g, "");
          toast.info(plainText, {
            duration: 5000,
            position: "top-right",
          });
        }
      });
    };

    feedClient.on("items.received.realtime", handleNewMessage);
    return () => {
      feedClient.off("items.received.realtime", handleNewMessage);
    };
  }, [feedClient]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = useCallback(() => {
    if (feedClient) {
      feedClient.markAllAsRead();
      toast.success("All notifications marked as read");
    }
  }, [feedClient]);

  const handleMarkAsRead = useCallback(
    (item: FeedItem) => {
      if (feedClient) {
        feedClient.markAsRead(item);
      }
    },
    [feedClient]
  );

  const handleArchive = useCallback(
    (item: FeedItem) => {
      if (feedClient) {
        feedClient.markAsArchived(item);
        toast.success("Notification archived");
      }
    },
    [feedClient]
  );

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-full hover:bg-gray-100"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-[480px] flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {(!items || items.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Bell size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              items.map((item: FeedItem) => {
                const body =
                  (item.blocks?.[0] as { rendered?: string })?.rendered ||
                  (item.data as { message?: string })?.message ||
                  "New notification";
                const isRead = !!item.read_at;

                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      !isRead ? "bg-emerald-50/40" : ""
                    }`}
                  >
                    <div className="mt-1.5 flex-shrink-0">
                      {!isRead ? (
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-transparent" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm text-gray-800 leading-relaxed [&_p]:m-0"
                        dangerouslySetInnerHTML={{ __html: body }}
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTime(item.inserted_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                      {!isRead && (
                        <button
                          onClick={() => handleMarkAsRead(item)}
                          className="p-1 text-gray-400 hover:text-emerald-600 transition-colors"
                          title="Mark as read"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleArchive(item)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Archive"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationInboxContent;
