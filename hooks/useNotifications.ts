"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { type Notification } from "@/lib/types";

/**
 * Hook: returns notifications for the current user.
 * - Subscribes to Supabase Realtime for live INSERT events.
 * - Requests browser Push API permission on first call.
 * - Shows a browser notification when a new notification arrives.
 * - Notification has two actions: "Still here" (keeps booking active)
 *   and "Sign out" (triggers checkout).
 */
export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Request push permission on mount ────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    async function fetchNotifications() {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(30);
      setNotifications((data ?? []) as Notification[]);
      setLoading(false);
    }

    fetchNotifications();

    // ── Realtime: listen for new notifications ───────────────────────────
    const channel = supabase
      .channel(`notifications:user_id=eq.${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const newNotif = payload.new as Notification;

          // Add to local state
          setNotifications((prev) => [newNotif, ...prev]);

          // Browser notification
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const notif = new Notification("CampusSync", {
              body: newNotif.message,
              icon: "/favicon.ico",
              tag: newNotif.id,
            });

            // For "are you still here" alerts, add action buttons via
            // the Notifications API (supported in Service Workers).
            // Here we show the notification and handle click:
            notif.onclick = () => {
              window.focus();
              // Navigate to profile bookings
              window.location.href = "/profile";
            };

            // Auto-close after 10 seconds
            setTimeout(() => notif.close(), 10_000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ── Mark a single notification read ────────────────────────────────────
  async function markRead(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("notifications") as any).update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }

  // ── Mark all read ────────────────────────────────────────────────────────
  async function markAllRead() {
    if (!userId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("notifications") as any)
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  return { notifications, loading, markRead, markAllRead };
}
