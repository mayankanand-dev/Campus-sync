// Supabase Edge Function: check-occupancy
// Deploy with: supabase functions deploy check-occupancy
// Schedule via pg_cron: SELECT cron.schedule('check-occupancy', '*/30 * * * *', ...)
//
// What it does:
//  1. Finds all 'active' bookings where signed_in_at IS NOT NULL,
//     slot end_time has passed, signed_out_at IS NULL
//  2. Inserts "Are you still here?" notification into notifications table
//  3. After 10-min grace (handled by second cron), marks them 'completed'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async () => {
  try {
    const nowISO = new Date().toISOString();
    const todayDate = nowISO.split("T")[0];
    const nowTime = new Date().toTimeString().slice(0, 8); // HH:MM:SS

    // 1. Find bookings to auto-remind: signed in, slot ended, not yet signed out, reminder not sent
    const { data: bookingsToRemind, error: fetchErr } = await supabase
      .from("bookings")
      .select("id, user_id, resource_id, slot_id, signed_in_at, slot:slots(date, end_time), resource:resources(name)")
      .eq("status", "active")
      .not("signed_in_at", "is", null)
      .is("signed_out_at", null)
      .eq("check_in_reminder_sent", false);

    if (fetchErr) throw fetchErr;

    const reminders = (bookingsToRemind ?? []).filter((b: any) => {
      if (b.slot?.date !== todayDate) return false;
      return b.slot?.end_time <= nowTime; // slot has ended
    });

    // 2. Insert notifications + mark reminder sent
    for (const b of reminders) {
      await supabase.from("notifications").insert({
        user_id: b.user_id,
        booking_id: b.id,
        type: "alert",
        message: `Are you still at ${b.resource?.name ?? "the resource"}? Please sign out or you will be auto-signed-out in 10 minutes.`,
        is_read: false,
      });
      await supabase.from("bookings").update({ check_in_reminder_sent: true }).eq("id", b.id);
    }

    // 3. Auto-complete bookings where reminder was sent >10 min ago and still no sign-out
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: toAutoComplete } = await supabase
      .from("bookings")
      .select("id, slot:slots(date, end_time)")
      .eq("status", "active")
      .eq("check_in_reminder_sent", true)
      .is("signed_out_at", null)
      .lt("updated_at", tenMinAgo);

    const expiredBookings = (toAutoComplete ?? []).filter((b: any) => {
      return b.slot?.date <= todayDate && b.slot?.end_time <= nowTime;
    });

    for (const b of expiredBookings) {
      await supabase.from("bookings").update({
        status: "completed",
        signed_out_at: nowISO,
      }).eq("id", b.id);
    }

    return new Response(
      JSON.stringify({ reminded: reminders.length, completed: expiredBookings.length }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
