"use client";

import { useState } from "react";
import { type Notification } from "@/lib/types";

interface NotificationBellProps {
  notifications: Notification[];
  onMarkRead?: (id: string) => void;
}

export function NotificationBell({ notifications, onMarkRead }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full hover:bg-muted transition-colors"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        {/* Bell icon */}
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-9.33-4.999M9 17h6m-3 4a1 1 0 01-1-1h2a1 1 0 01-1 1z"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-card border rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="font-medium text-sm">Notifications</span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Close
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onMarkRead?.(n.id)}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors flex gap-3 ${
                    !n.is_read ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="shrink-0 mt-0.5">
                    {n.type === "reminder" ? "⏰" : n.type === "alert" ? "⚠️" : "📊"}
                  </span>
                  <div>
                    <p className={!n.is_read ? "font-medium" : ""}>{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(n.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
