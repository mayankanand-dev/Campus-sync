"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { type Booking } from "@/lib/types";

/**
 * Hook: returns the current user's bookings, with real-time updates.
 */
export function useBookings(userId: string | null) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    async function fetchBookings() {
      setLoading(true);
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });

      if (error) setError(error.message);
      else setBookings(data ?? []);
      setLoading(false);
    }

    fetchBookings();

    // Real-time subscription
    const channel = supabase
      .channel(`bookings:user_id=eq.${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchBookings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { bookings, loading, error };
}
