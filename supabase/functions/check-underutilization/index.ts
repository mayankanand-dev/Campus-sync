// Underutilization alert Edge Function
// Deploy: supabase functions deploy check-underutilization
// Schedule: every 2 hours via pg_cron
//
// Checks each resource's next 3 hours of slots.
// If booked_seats / total_seats < 0.3 → inserts alert notification for admin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async () => {
  try {
    const now = new Date();
    const todayDate = now.toISOString().split("T")[0];
    const currentHour = now.getHours();

    // Fetch all resources
    const { data: resources } = await supabase.from("resources").select("id, name").eq("is_active", true);

    // Fetch admin user(s)
    const { data: admins } = await supabase.from("users").select("id").eq("role", "admin");
    const adminId = admins?.[0]?.id;
    if (!adminId) return new Response(JSON.stringify({ error: "No admin found" }), { status: 500 });

    let alertCount = 0;

    for (const resource of resources ?? []) {
      // Next 3 hours of slots
      const nextHours = [currentHour, currentHour + 1, currentHour + 2].map(
        (h) => `${String(Math.min(h, 23)).padStart(2, "0")}:00:00`
      );

      const { data: slots } = await supabase
        .from("slots")
        .select("total_seats, booked_seats, start_time")
        .eq("resource_id", resource.id)
        .eq("date", todayDate)
        .in("start_time", nextHours);

      if (!slots || slots.length === 0) continue;

      const totalSeats = slots.reduce((s, sl) => s + sl.total_seats, 0);
      const bookedSeats = slots.reduce((s, sl) => s + sl.booked_seats, 0);
      const utilisation = totalSeats > 0 ? bookedSeats / totalSeats : 1;

      if (utilisation < 0.3) {
        await supabase.from("notifications").insert({
          user_id: adminId,
          type: "underutilization",
          message: `📊 ${resource.name}: only ${Math.round(utilisation * 100)}% booked for the next 3 hours. Consider sending a push notification to students.`,
          is_read: false,
        });
        alertCount++;
      }
    }

    return new Response(JSON.stringify({ alerts_sent: alertCount }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
