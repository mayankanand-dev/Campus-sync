"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, startOfWeek, getWeek, differenceInDays } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid, LineChart, Line,
} from "recharts";
import { BookOpen, Coffee, Monitor, Zap, Circle, QrCode, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BookingQR } from "@/components/qr/BookingQR";
import type { User, BookingWithDetails } from "@/lib/types";

// ─── Colours ──────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  library:      "#0d9488",
  reading_room: "#9333ea",
  computer_lab: "#3b82f6",
  badminton:    "#22c55e",
  basketball:   "#f97316",
};

const STATUS_STYLES: Record<string, string> = {
  active:    "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-600",
  no_show:   "bg-red-100 text-red-700",
};

const ICON_MAP: Record<string, React.ElementType> = {
  library: BookOpen, reading_room: Coffee, computer_lab: Monitor,
  badminton: Zap, basketball: Circle,
};

// ─── Heatmap ──────────────────────────────────────────────────────────────────
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8–21

function Heatmap({ bookings }: { bookings: BookingWithDetails[] }) {
  // Build day×hour count map
  const grid = useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach((b) => {
      const d = new Date(b.slot.date);
      const dow = (d.getDay() + 6) % 7; // 0=Mon
      const h = parseInt(b.slot.start_time.slice(0, 2));
      const key = `${dow}-${h}`;
      map[key] = (map[key] ?? 0) + 1;
    });
    return map;
  }, [bookings]);

  const max = Math.max(1, ...Object.values(grid));

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Hour headers */}
        <div className="flex ml-10 gap-1 mb-1">
          {HOURS.map((h) => (
            <div key={h} className="w-6 text-[9px] text-muted-foreground text-center">
              {h}
            </div>
          ))}
        </div>
        {/* Rows */}
        {DAYS.map((day, dow) => (
          <div key={day} className="flex items-center gap-1 mb-1">
            <span className="w-9 text-[10px] text-muted-foreground text-right pr-1">{day}</span>
            {HOURS.map((h) => {
              const count = grid[`${dow}-${h}`] ?? 0;
              const intensity = count / max;
              return (
                <div
                  key={h}
                  title={`${day} ${h}:00 — ${count} booking${count !== 1 ? "s" : ""}`}
                  className="w-6 h-6 rounded-sm transition-colors"
                  style={{
                    backgroundColor: count === 0
                      ? "hsl(var(--muted))"
                      : `rgba(30, 58, 138, ${0.15 + intensity * 0.85})`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrBooking, setQrBooking] = useState<BookingWithDetails | null>(null);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyPage, setHistoryPage] = useState(1);
  const PER_PAGE = 10;

  const fetchAll = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { router.push("/login"); return; }

    const { data: profile } = await supabase.from("users").select("*").eq("id", authUser.id).single();
    if (profile) setUser(profile as User);

    const { data: bkgs } = await supabase
      .from("bookings")
      .select(`*, slot:slots(*), resource:resources(*)`)
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false });

    setBookings((bkgs ?? []) as unknown as BookingWithDetails[]);
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!bookings.length) return { total: 0, thisMonth: 0, favourite: "—", streak: 0 };
    const now = new Date();
    const thisMonth = bookings.filter((b) => {
      const d = new Date(b.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    // Favourite resource
    const counts: Record<string, number> = {};
    bookings.forEach((b) => { counts[b.resource.name] = (counts[b.resource.name] ?? 0) + 1; });
    const favourite = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    // Streak — consecutive days with at least one booking ending today/backward
    const uniqueDays = [...new Set(bookings.map((b) => b.slot.date))].sort().reverse();
    let streak = 0;
    let checkDay = format(now, "yyyy-MM-dd");
    for (const d of uniqueDays) {
      if (d === checkDay) { streak++; checkDay = format(new Date(new Date(d).getTime() - 86400000), "yyyy-MM-dd"); }
      else break;
    }

    return { total: bookings.length, thisMonth, favourite, streak };
  }, [bookings]);

  // ── Active bookings ───────────────────────────────────────────────────────
  const activeBookings = useMemo(() =>
    bookings.filter((b) => b.status === "active" && new Date(b.slot.date) >= new Date(format(new Date(), "yyyy-MM-dd"))),
    [bookings]);

  // ── Weekly bar chart data ─────────────────────────────────────────────────
  const weeklyData = useMemo(() => {
    const weekMap: Record<string, Record<string, number>> = {};
    bookings.forEach((b) => {
      const w = `W${getWeek(new Date(b.slot.date))}`;
      if (!weekMap[w]) weekMap[w] = {};
      const t = b.resource.type;
      weekMap[w][t] = (weekMap[w][t] ?? 0) + 1;
    });
    return Object.entries(weekMap).slice(-10).map(([week, types]) => ({ week, ...types }));
  }, [bookings]);

  // ── Pie chart data ────────────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach((b) => { map[b.resource.type] = (map[b.resource.type] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [bookings]);

  // ── Booking history filter + pagination ───────────────────────────────────
  const historyBookings = useMemo(() => {
    const f = historyFilter === "all" ? bookings : bookings.filter((b) => b.status === historyFilter);
    return f;
  }, [bookings, historyFilter]);
  const totalPages = Math.max(1, Math.ceil(historyBookings.length / PER_PAGE));
  const pageItems = historyBookings.slice((historyPage - 1) * PER_PAGE, historyPage * PER_PAGE);

  async function handleCancel(b: BookingWithDetails) {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("cancel_booking", { p_booking_id: b.id, p_user_id: u.id });
    fetchAll();
  }

  // ── Can cancel? Only if >30 min before start ──────────────────────────────
  function canCancel(b: BookingWithDetails) {
    const slotStart = new Date(`${b.slot.date}T${b.slot.start_time}`);
    return differenceInDays(slotStart, new Date()) >= 0 && (slotStart.getTime() - Date.now()) > 30 * 60 * 1000;
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // ── Resource types for bar chart bars ─────────────────────────────────────
  const resourceTypes = [...new Set(bookings.map((b) => b.resource.type))];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/90 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between px-4">
          <span className="text-lg font-bold text-primary">CampusSync</span>
          <Button size="sm" variant="outline" onClick={handleSignOut}>Sign Out</Button>
        </div>
      </header>

      <div className="container px-4 py-8 max-w-3xl space-y-8">
        {/* ── SECTION 1: Profile header ────────────────────────────────────── */}
        <section>
          {loading ? (
            <div className="flex gap-4 items-center mb-5">
              <Skeleton className="w-20 h-20 rounded-full" />
              <div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-28" /></div>
            </div>
          ) : (
            <>
              <div className="flex gap-4 items-center mb-5">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary shrink-0">
                  {user?.name?.charAt(0) ?? "S"}
                </div>
                <div>
                  <h1 className="text-xl font-bold">{user?.name}</h1>
                  <p className="text-sm text-muted-foreground">{user?.student_id} · {user?.branch}</p>
                  <p className="text-sm text-muted-foreground">Semester {user?.semester}</p>
                </div>
              </div>
              {/* Stat pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total", value: stats.total },
                  { label: "This month", value: stats.thisMonth },
                  { label: "Favourite", value: stats.favourite },
                  { label: "Streak 🔥", value: `${stats.streak}d` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl border bg-card p-4 text-center shadow-sm">
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ── SECTION 2: Active bookings ────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-bold mb-3">Upcoming Bookings</h2>
          {loading ? (
            <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          ) : activeBookings.length === 0 ? (
            <div className="rounded-2xl border bg-card p-6 text-center">
              <p className="text-muted-foreground text-sm mb-2">No upcoming bookings.</p>
              <Button size="sm" onClick={() => router.push("/home")}>Book a resource now →</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeBookings.map((b) => {
                const Icon = ICON_MAP[b.resource.type] ?? BookOpen;
                return (
                  <div key={b.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${TYPE_COLORS[b.resource.type]}20` }}>
                      <Icon className="w-5 h-5" style={{ color: TYPE_COLORS[b.resource.type] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{b.resource.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(b.slot.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {b.slot.start_time.slice(0, 5)} – {b.slot.end_time.slice(0, 5)}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setQrBooking(b)}
                        className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        aria-label="Show QR"
                      ><QrCode className="w-4 h-4" /></button>
                      {canCancel(b) && (
                        <button
                          onClick={() => handleCancel(b)}
                          className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                          aria-label="Cancel"
                        ><X className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── SECTION 3: Charts ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-bold mb-3">Semester Usage</h2>
          {loading ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : (
            <Tabs defaultValue="bar">
              <TabsList className="mb-4">
                <TabsTrigger value="bar">Weekly</TabsTrigger>
                <TabsTrigger value="heat">Heatmap</TabsTrigger>
                <TabsTrigger value="pie">Breakdown</TabsTrigger>
              </TabsList>

              <TabsContent value="bar">
                <div className="rounded-2xl border bg-card p-4 shadow-sm">
                  <p className="text-sm font-medium mb-3">Bookings by week</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={weeklyData} barSize={10}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {resourceTypes.map((t) => (
                        <Bar key={t} dataKey={t} stackId="a" fill={TYPE_COLORS[t] ?? "#94a3b8"} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="heat">
                <div className="rounded-2xl border bg-card p-4 shadow-sm overflow-x-auto">
                  <p className="text-sm font-medium mb-3">Time preference heatmap</p>
                  <Heatmap bookings={bookings} />
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[10px] text-muted-foreground">Less</span>
                    {[0.1, 0.3, 0.6, 0.9].map((v) => (
                      <div key={v} className="w-4 h-4 rounded-sm" style={{ backgroundColor: `rgba(30, 58, 138, ${v})` }} />
                    ))}
                    <span className="text-[10px] text-muted-foreground">More</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pie">
                <div className="rounded-2xl border bg-card p-4 shadow-sm">
                  <p className="text-sm font-medium mb-3">Resource breakdown</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value">
                        {pieData.map((entry, i) => (
                          <Cell key={`cell-${i}`} fill={TYPE_COLORS[entry.name] ?? "#94a3b8"} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }}
                        formatter={(value) => value.replace(/_/g, " ")} />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </section>

        {/* ── SECTION 4: Booking history ────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-bold mb-3">Booking History</h2>
          {/* Filter tabs */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {["all", "completed", "cancelled", "no_show"].map((f) => (
              <button
                key={f}
                onClick={() => { setHistoryFilter(f); setHistoryPage(1); }}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all ${historyFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card border-input text-muted-foreground hover:border-primary/40"}`}
              >
                {f === "no_show" ? "No show" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : pageItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No bookings found.</div>
          ) : (
            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              {pageItems.map((b, idx) => (
                <div key={b.id} className={`flex items-center gap-3 px-4 py-3 ${idx < pageItems.length - 1 ? "border-b" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.resource.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.slot.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {b.slot.start_time.slice(0, 5)} – {b.slot.end_time.slice(0, 5)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[b.status]}`}>
                    {b.status === "no_show" ? "No show" : b.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-3">
              <Button size="sm" variant="outline" disabled={historyPage === 1} onClick={() => setHistoryPage((p) => p - 1)}>←</Button>
              <span className="text-sm self-center text-muted-foreground">{historyPage} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={historyPage === totalPages} onClick={() => setHistoryPage((p) => p + 1)}>→</Button>
            </div>
          )}
        </section>
      </div>

      {/* QR Dialog */}
      <Dialog open={!!qrBooking} onOpenChange={() => setQrBooking(null)}>
        <DialogContent className="max-w-sm">
          {qrBooking && (
            <BookingQR
              bookingId={qrBooking.id}
              qrToken={qrBooking.qr_token}
              resourceName={qrBooking.resource.name}
              slotDate={qrBooking.slot.date}
              slotStart={qrBooking.slot.start_time}
              slotEnd={qrBooking.slot.end_time}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
