"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Legend,
} from "recharts";
import {
  LayoutDashboard, Activity, BarChart2, Bell, Users, QrCode,
  Download, Send, AlertTriangle, CheckCircle2, TrendingUp,
  BookOpen, Coffee, Monitor, Zap, Circle, LogOut, Menu, X, Plus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Resource, BookingWithDetails } from "@/lib/types";

// ─── Config ───────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  library: "#0d9488", reading_room: "#9333ea", computer_lab: "#3b82f6",
  badminton: "#22c55e", basketball: "#f97316",
};
const ICON_MAP: Record<string, React.ElementType> = {
  library: BookOpen, reading_room: Coffee, computer_lab: Monitor,
  badminton: Zap, basketball: Circle,
};

type AdminPage = "overview" | "occupancy" | "analytics" | "alerts" | "users" | "scanner" | "add_resource";

const NAV_ITEMS: { key: AdminPage; label: string; Icon: React.ElementType }[] = [
  { key: "overview",     label: "Overview",       Icon: LayoutDashboard },
  { key: "occupancy",    label: "Live Occupancy",  Icon: Activity },
  { key: "analytics",   label: "Analytics",       Icon: BarChart2 },
  { key: "alerts",      label: "Alerts",          Icon: Bell },
  { key: "users",       label: "Users",           Icon: Users },
  { key: "add_resource",label: "Add Resource",    Icon: Plus },
  { key: "scanner",     label: "QR Scanner",      Icon: QrCode },
];

// ─── analyzePatterns ──────────────────────────────────────────────────────────
interface Insight { icon: string; text: string; severity: "info" | "warning" | "success" }

function analyzePatterns(bookings: BookingWithDetails[], resources: Resource[]): Insight[] {
  const insights: Insight[] = [];

  const byResource: Record<string, { total: number; noShow: number; byHour: Record<number, number> }> = {};
  resources.forEach((r) => { byResource[r.id] = { total: 0, noShow: 0, byHour: {} }; });

  bookings.forEach((b) => {
    if (!byResource[b.resource_id]) return;
    byResource[b.resource_id].total++;
    if (b.status === "no_show") byResource[b.resource_id].noShow++;
    const h = parseInt(b.slot.start_time.slice(0, 2));
    byResource[b.resource_id].byHour[h] = (byResource[b.resource_id].byHour[h] ?? 0) + 1;
  });

  let totalNoShow = 0, totalBookings = 0;
  resources.forEach((r) => {
    const d = byResource[r.id];
    if (!d) return;
    totalBookings += d.total;
    totalNoShow += d.noShow;

    if (d.total === 0) {
      insights.push({ icon: "📭", text: `${r.name} has 0 bookings — send a push notification to students or add a discount/incentive for first-time users.`, severity: "warning" });
      return;
    }

    const noShowRate = d.noShow / d.total;
    if (noShowRate > 0.35) {
      insights.push({ icon: "⚠️", text: `${r.name}: ${Math.round(noShowRate * 100)}% no-show rate. Recommendation: implement automatic 15-min grace-period cancellation and release slots back to the queue.`, severity: "warning" });
    }

    // Peak hour
    const sorted = Object.entries(d.byHour).sort((a, b) => +b[1] - +a[1]);
    const peak = sorted[0];
    const low  = sorted[sorted.length - 1];
    if (peak && +peak[1] >= 3) {
      insights.push({ icon: "📈", text: `${r.name} peaks at ${peak[0]}:00 (${peak[1]} bookings). Suggestion: open a second parallel session or add more seats during this window.`, severity: "info" });
    }
    if (low && +low[1] === 0 && sorted.length > 4) {
      insights.push({ icon: "💤", text: `${r.name} has dead slots at ${low[0]}:00. Suggestion: allow drop-in walk-ins or run a targeted promotion for off-peak hours.`, severity: "info" });
    }

    // Cancellation rate
    const cancelled = bookings.filter((b) => b.resource_id === r.id && b.status === "cancelled").length;
    const cancelRate = d.total > 0 ? cancelled / d.total : 0;
    if (cancelRate > 0.2) {
      insights.push({ icon: "🔄", text: `${r.name}: ${Math.round(cancelRate * 100)}% cancellation rate. Suggestion: introduce a 30-min pre-slot cancellation deadline to reduce last-minute drops.`, severity: "warning" });
    }
  });

  // Campus-wide insight
  const campusNoShowRate = totalBookings > 0 ? totalNoShow / totalBookings : 0;
  if (campusNoShowRate > 0.15) {
    insights.push({ icon: "🏫", text: `Campus-wide no-show rate is ${Math.round(campusNoShowRate * 100)}%. Recommendation: send automated WhatsApp/email reminders 1 hour before each slot.`, severity: "warning" });
  } else if (totalBookings > 10) {
    insights.push({ icon: "✅", text: `Campus utilisation looks healthy. Overall no-show rate: ${Math.round(campusNoShowRate * 100)}%. Keep monitoring weekly trends.`, severity: "success" });
  }

  if (insights.length === 0) {
    insights.push({ icon: "✅", text: "All resources have healthy utilisation patterns. Great job!", severity: "success" });
  }

  return insights.slice(0, 7);
}

// ─── Download CSV ─────────────────────────────────────────────────────────────
function downloadCSV(data: BookingWithDetails[]) {
  const rows = [
    ["Date", "Resource", "Start", "End", "Status", "Student"],
    ...data.map((b) => [b.slot.date, b.resource.name, b.slot.start_time, b.slot.end_time, b.status, b.user_id]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "campus-sync-report.csv"; a.click();
}

// ─── Sub-pages ────────────────────────────────────────────────────────────────

function OverviewPage({ bookings, resources }: { bookings: BookingWithDetails[]; resources: Resource[] }) {
  const today = new Date().toISOString().split("T")[0];
  const activeNow = bookings.filter((b) => b.status === "active" && b.slot.date === today).length;
  const occupied = new Set(bookings.filter((b) => b.status === "active" && b.slot.date === today).map((b) => b.resource_id)).size;
  const noShowThisWeek = bookings.filter((b) => b.status === "no_show").length;
  const noShowRate = bookings.length > 0 ? Math.round((noShowThisWeek / bookings.length) * 100) : 0;
  const topResource = useMemo(() => {
    const m: Record<string, number> = {};
    bookings.filter((b) => b.slot.date === today).forEach((b) => { m[b.resource.name] = (m[b.resource.name] ?? 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Bookings", value: activeNow, sub: "right now", color: "text-green-600", bg: "bg-green-50" },
          { label: "Occupied Resources", value: `${occupied}/${resources.length}`, sub: "today", color: "text-blue-600", bg: "bg-blue-50" },
          { label: "No-show Rate", value: `${noShowRate}%`, sub: "this week", color: noShowRate > 20 ? "text-red-600" : "text-amber-600", bg: noShowRate > 20 ? "bg-red-50" : "bg-amber-50" },
          { label: "Most Booked", value: topResource, sub: "today", color: "text-purple-600", bg: "bg-purple-50" },
        ].map(({ label, value, sub, color, bg }) => (
          <div key={label} className={`rounded-2xl border p-5 shadow-sm ${bg}`}>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color} truncate`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold mb-3 text-sm">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/scanner"><Button className="gap-2"><QrCode className="w-4 h-4" />Open QR Scanner</Button></Link>
          <Button variant="outline" className="gap-2" onClick={() => downloadCSV(bookings)}><Download className="w-4 h-4" />Export CSV</Button>
          <Button variant="outline" className="gap-2"><Send className="w-4 h-4" />Send Alert to All Users</Button>
        </div>
      </div>

      {/* Recent bookings table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm">Recent Bookings</h2>
          <Button size="sm" variant="outline" onClick={() => downloadCSV(bookings)}>Export</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>{["Date", "Resource", "Time", "Status"].map((h) => <th key={h} className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody>
              {bookings.slice(0, 10).map((b, i) => (
                <tr key={b.id} className={i < 9 ? "border-b" : ""}>
                  <td className="px-4 py-2 text-xs">{b.slot.date}</td>
                  <td className="px-4 py-2 font-medium">{b.resource.name}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{b.slot.start_time.slice(0, 5)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.status === "active" ? "bg-green-100 text-green-700" : b.status === "completed" ? "bg-blue-100 text-blue-700" : b.status === "no_show" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{b.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OccupancyPage({ bookings, resources }: { bookings: BookingWithDetails[]; resources: Resource[] }) {
  const today = new Date().toISOString().split("T")[0];

  const occupancy = useMemo(() => resources.map((r) => {
    const today_bookings = bookings.filter((b) => b.resource_id === r.id && b.slot.date === today && b.status === "active");
    const signed_in = bookings.filter((b) => b.resource_id === r.id && b.slot.date === today && b.signed_in_at && !b.signed_out_at);
    const pct = r.capacity > 0 ? (signed_in.length / r.capacity) * 100 : 0;
    return { resource: r, signed_in, total_booked: today_bookings.length, pct };
  }), [bookings, resources]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Live occupancy — updates in real-time via Supabase Realtime.</p>
      {occupancy.map(({ resource, signed_in, total_booked, pct }) => {
        const Icon = ICON_MAP[resource.type] ?? BookOpen;
        const barColor = pct > 85 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-green-500";
        return (
          <div key={resource.id} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${TYPE_COLORS[resource.type]}20` }}>
                <Icon className="w-5 h-5" style={{ color: TYPE_COLORS[resource.type] }} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{resource.name}</h3>
                <p className="text-xs text-muted-foreground">{resource.location}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">{signed_in.length}/{resource.capacity}</p>
                <p className="text-xs text-muted-foreground">{total_booked} booked today</p>
              </div>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            {signed_in.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">{signed_in.length} student{signed_in.length > 1 ? "s" : ""} currently signed in</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AnalyticsPage({ bookings, resources }: { bookings: BookingWithDetails[]; resources: Resource[] }) {
  // Hourly demand heatmap data
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);
  const heatGrid: Record<string, number> = {};
  bookings.forEach((b) => {
    const d = new Date(b.slot.date);
    const dow = (d.getDay() + 6) % 7;
    const h = parseInt(b.slot.start_time.slice(0, 2));
    const k = `${dow}-${h}`; heatGrid[k] = (heatGrid[k] ?? 0) + 1;
  });
  const heatMax = Math.max(1, ...Object.values(heatGrid));

  // Last 30 days utilisation per resource
  const last30 = bookings.filter((b) => {
    const d = new Date(b.slot.date);
    return (Date.now() - d.getTime()) < 30 * 86400_000;
  });
  const lineMap: Record<string, Record<string, number>> = {};
  last30.forEach((b) => {
    const k = b.slot.date;
    if (!lineMap[k]) lineMap[k] = {};
    lineMap[k][b.resource.type] = (lineMap[k][b.resource.type] ?? 0) + 1;
  });
  const lineData = Object.entries(lineMap).sort().map(([date, v]) => ({ date: date.slice(5), ...v }));

  // No-show trend weekly
  const noShowWeekly: Record<string, { booked: number; no_show: number }> = {};
  bookings.forEach((b) => {
    const w = `W${Math.ceil((new Date(b.slot.date).getDate()) / 7)}`;
    if (!noShowWeekly[w]) noShowWeekly[w] = { booked: 0, no_show: 0 };
    noShowWeekly[w].booked++;
    if (b.status === "no_show") noShowWeekly[w].no_show++;
  });
  const noShowData = Object.entries(noShowWeekly).map(([week, v]) => ({
    week, rate: v.booked > 0 ? Math.round((v.no_show / v.booked) * 100) : 0,
  }));

  // Booking vs actual (signed in) per resource
  const bvActual = resources.map((r) => ({
    name: r.name.replace("Computer Lab ", "Lab ").replace(" Court", ""),
    booked: bookings.filter((b) => b.resource_id === r.id).length,
    actual: bookings.filter((b) => b.resource_id === r.id && b.signed_in_at).length,
  }));

  const insights = analyzePatterns(bookings, resources);

  return (
    <div className="space-y-6">
      {/* Heatmap */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm overflow-x-auto">
        <h2 className="font-semibold text-sm mb-4">Hourly Demand Heatmap (all campus)</h2>
        <div className="inline-block min-w-full">
          <div className="flex ml-10 gap-1 mb-1">
            {HOURS.map((h) => <div key={h} className="w-7 text-[9px] text-muted-foreground text-center">{h}</div>)}
          </div>
          {DAYS.map((day, dow) => (
            <div key={day} className="flex items-center gap-1 mb-1">
              <span className="w-9 text-[10px] text-muted-foreground text-right pr-1">{day}</span>
              {HOURS.map((h) => {
                const count = heatGrid[`${dow}-${h}`] ?? 0;
                return (
                  <div key={h} title={`${day} ${h}:00 — ${count}`} className="w-7 h-7 rounded-sm"
                    style={{ backgroundColor: count === 0 ? "hsl(var(--muted))" : `rgba(30,58,138,${0.1 + (count / heatMax) * 0.9})` }} />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Line chart — utilisation over 30 days */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold text-sm mb-4">Resource Utilisation (last 30 days)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v.replace(/_/g, " ")} />
            {Array.from(new Set(bookings.map((b) => b.resource.type))).map((t) => (
              <Line key={t} type="monotone" dataKey={t} stroke={TYPE_COLORS[t] ?? "#94a3b8"} dot={false} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Booking vs actual */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold text-sm mb-4">Bookings vs Actual Sign-ins (no-shows = gap)</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={bvActual} barSize={12}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="booked" fill="#3b82f6" name="Booked" />
            <Bar dataKey="actual" fill="#22c55e" name="Signed In" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* No-show trend */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold text-sm mb-4">No-show Rate Trend (%)</h2>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={noShowData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Area type="monotone" dataKey="rate" stroke="#ef4444" fill="#fecaca" strokeWidth={2} name="No-show %" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* AI Insights */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> AI-Style Insights</h2>
        <div className="space-y-2">
          {insights.map((ins, i) => (
            <div key={i} className={`flex gap-3 p-3 rounded-xl text-sm ${ins.severity === "warning" ? "bg-amber-50 border border-amber-200" : ins.severity === "success" ? "bg-green-50 border border-green-200" : "bg-blue-50 border border-blue-200"}`}>
              <span className="text-base shrink-0">{ins.icon}</span>
              <span>{ins.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertsPage({ bookings, resources }: { bookings: BookingWithDetails[]; resources: Resource[] }) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const today = new Date().toISOString().split("T")[0];

  const alerts = useMemo(() => {
    const out: { id: string; type: string; resource: string; message: string; severity: "high" | "medium" | "low" }[] = [];

    resources.forEach((r) => {
      const todayBookings = bookings.filter((b) => b.slot.date === today && b.resource_id === r.id);
      const booked = todayBookings.length;
      const total = r.capacity * 14; // 14 slots/day
      if (total > 0 && booked / total < 0.3) {
        out.push({ id: `util-${r.id}`, type: "Underutilization", resource: r.name, message: `Only ${Math.round((booked / total) * 100)}% of today's slots are booked.`, severity: "low" });
      }
      const noShows = todayBookings.filter((b) => b.status === "no_show").length;
      if (noShows >= 2) {
        out.push({ id: `noshows-${r.id}`, type: "No-show Spike", resource: r.name, message: `${noShows} no-shows recorded today.`, severity: "high" });
      }
    });

    return out;
  }, [bookings, resources]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{alerts.length} active alert{alerts.length !== 1 ? "s" : ""}</p>
      {alerts.length === 0 && (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="font-semibold">All systems nominal</p>
          <p className="text-sm text-muted-foreground">No active alerts right now.</p>
        </div>
      )}
      {alerts.filter((a) => !resolved.has(a.id)).map((a) => (
        <div key={a.id} className={`rounded-2xl border p-4 shadow-sm flex gap-4 items-start ${a.severity === "high" ? "border-red-200 bg-red-50" : a.severity === "medium" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"}`}>
          <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${a.severity === "high" ? "text-red-600" : a.severity === "medium" ? "text-amber-600" : "text-blue-600"}`} />
          <div className="flex-1 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{a.type}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.severity === "high" ? "bg-red-100 text-red-700" : a.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{a.severity}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">{a.resource}</p>
            <p className="text-xs">{a.message}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setResolved((s) => new Set([...s, a.id]))}>Resolve</Button>
        </div>
      ))}
    </div>
  );
}

function UsersPage() {
  const [users, setUsers] = useState<{ id: string; name: string; email: string; student_id: string | null; branch: string | null; role: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("users").select("id, name, email, student_id, branch, role").order("name")
      .then(({ data }) => { setUsers((data as typeof users) ?? []); setLoading(false); });
  }, []);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="p-4 border-b"><h2 className="font-semibold text-sm">Registered Users ({users.length})</h2></div>
      {loading ? <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>{["Name", "Student ID", "Branch", "Role"].map((h) => <th key={h} className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className={i < users.length - 1 ? "border-b" : ""}>
                  <td className="px-4 py-2.5">
                    <div><p className="font-medium text-sm">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{u.student_id ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{u.branch ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{u.role}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

// --- Add Resource Page ---
function AddResourcePage({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: "", type: "library", capacity: 30, location: "", description: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error: err } = await (supabase as any).from("resources").insert({
      name: form.name.trim(), type: form.type,
      capacity: Number(form.capacity),
      location: form.location.trim(),
      description: form.description.trim(),
      is_active: true,
    }).select("id").single();
    if (err || !inserted) { setError(err?.message ?? "Insert failed"); setSaving(false); return; }
    const slots: { resource_id: string; date: string; start_time: string; end_time: string; total_seats: number; booked_seats: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split("T")[0];
      for (let h = 8; h <= 21; h++) {
        slots.push({
          resource_id: inserted.id, date: dateStr,
          start_time: `${String(h).padStart(2,"0")}:00:00`,
          end_time:   `${String(h+1).padStart(2,"0")}:00:00`,
          total_seats: Number(form.capacity), booked_seats: 0,
        });
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("slots").insert(slots);
    setSaving(false); setSaved(true); onSuccess();
    setForm({ name:"", type:"library", capacity:30, location:"", description:"" });
    setTimeout(() => setSaved(false), 3000);
  }

  const cls = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition";
  const lbl = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <div className="max-w-xl">
      <h2 className="text-base font-bold mb-1">Add New Resource</h2>
      <p className="text-sm text-muted-foreground mb-5">Creates a bookable resource with 7-day time slots auto-generated.</p>
      {saved && (
        <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Resource added! Slots generated for next 7 days.
        </div>
      )}
      <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div>
          <label className={lbl}>Resource Name *</label>
          <input required className={cls} placeholder="e.g. Seminar Hall A" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Type *</label>
            <select required className={cls} value={form.type} onChange={(e) => set("type", e.target.value)}>
              <option value="library">Library</option>
              <option value="reading_room">Reading Room</option>
              <option value="computer_lab">Computer Lab</option>
              <option value="badminton">Badminton</option>
              <option value="basketball">Basketball</option>
              <option value="volleyball">Volleyball</option>
              <option value="club_event_venue">Event Venue (Audi / Club)</option>
              <option value="misc">Classroom / Misc</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Capacity *</label>
            <input required type="number" min={1} max={500} className={cls} value={form.capacity}
              onChange={(e) => set("capacity", parseInt(e.target.value) || 1)} />
          </div>
        </div>
        <div>
          <label className={lbl}>Location *</label>
          <input required className={cls} placeholder="e.g. Block D, Ground Floor" value={form.location} onChange={(e) => set("location", e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Description</label>
          <textarea rows={3} className={cls} placeholder="Optional details..." value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" className="w-full gap-2" disabled={saving}>
          <Plus className="w-4 h-4" />
          {saving ? "Adding..." : "Add Resource + Generate Slots"}
        </Button>
      </form>
    </div>
  );
}
export default function AdminDashboardPage() {
  const router = useRouter();
  const [page, setPage] = useState<AdminPage>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data: res } = await supabase.from("resources").select("*").order("name");
    const { data: bkgs } = await supabase
      .from("bookings").select("*, slot:slots(*), resource:resources(*)")
      .order("created_at", { ascending: false }).limit(200);
    setResources((res ?? []) as Resource[]);
    setBookings((bkgs ?? []) as unknown as BookingWithDetails[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    const chan = supabase.channel("admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "slots" }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [fetchData]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const currentPageTitle = NAV_ITEMS.find((n) => n.key === page)?.label ?? "Dashboard";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-card border-r flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-16 flex items-center justify-between px-5 border-b">
          <Link href="/home" className="font-bold text-primary hover:text-primary/80 transition-colors">
            Campus-Sync
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X className="w-4 h-4" /></button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ key, label, Icon }) => (
            key === "scanner" ? (
              <Link key={key} href="/scanner"
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Icon className="w-4 h-4" />{label}
              </Link>
            ) : (
              <button key={key} onClick={() => { setPage(key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${page === key ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            )
          ))}
        </nav>
        <Separator />
        <div className="p-3">
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors">
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        </div>
      </aside>

      {/* Backdrop */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card/90 backdrop-blur sticky top-0 z-30 flex items-center gap-4 px-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-muted"><Menu className="w-5 h-5" /></button>
          <h1 className="font-semibold text-base">{currentPageTitle}</h1>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-xs">Admin</Badge>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {loading ? (<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>) : (
            <>
              {page === "overview"    && <OverviewPage   bookings={bookings} resources={resources} />}
              {page === "occupancy"   && <OccupancyPage  bookings={bookings} resources={resources} />}
              {page === "analytics"   && <AnalyticsPage  bookings={bookings} resources={resources} />}
              {page === "alerts"      && <AlertsPage     bookings={bookings} resources={resources} />}
              {page === "users"       && <UsersPage />}
              {page === "add_resource"&& <AddResourcePage onSuccess={fetchData} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}



