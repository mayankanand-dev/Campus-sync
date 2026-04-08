"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen, Coffee, Monitor, Zap, Circle, Bell, Search,
  LogOut, LayoutDashboard, Mic2, LayoutGrid, Share2, Volleyball,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Resource, Slot, User } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────
type ResourceType =
  | "library" | "reading_room" | "computer_lab"
  | "badminton" | "basketball" | "volleyball"
  | "club_event_venue" | "misc";

type FilterCategory = "library" | "reading_room" | "computer_lab" | "sports" | "venues" | "misc";
type FilterType = "all" | ResourceType | "sports" | "venues" | "misc_filter";

interface ResourceWithAvailability extends Resource {
  totalSlots: number;
  bookedSlots: number;
  availableNow: boolean;
}

// ─── Resource config ─────────────────────────────────────────────────────────
const RESOURCE_CONFIG: Record<
  ResourceType,
  { Icon: React.ElementType; color: string; bg: string; badgeColor: string; category: FilterCategory }
> = {
  library:          { Icon: BookOpen,   color: "text-teal-600",    bg: "bg-teal-50",    badgeColor: "bg-teal-100 text-teal-700",     category: "library" },
  reading_room:     { Icon: Coffee,     color: "text-purple-600",  bg: "bg-purple-50",  badgeColor: "bg-purple-100 text-purple-700",  category: "reading_room" },
  computer_lab:     { Icon: Monitor,    color: "text-blue-600",    bg: "bg-blue-50",    badgeColor: "bg-blue-100 text-blue-700",      category: "computer_lab" },
  badminton:        { Icon: Zap,        color: "text-green-600",   bg: "bg-green-50",   badgeColor: "bg-green-100 text-green-700",    category: "sports" },
  basketball:       { Icon: Circle,     color: "text-orange-600",  bg: "bg-orange-50",  badgeColor: "bg-orange-100 text-orange-700",  category: "sports" },
  volleyball:       { Icon: Volleyball, color: "text-yellow-600",  bg: "bg-yellow-50",  badgeColor: "bg-yellow-100 text-yellow-700",  category: "sports" },
  club_event_venue: { Icon: Mic2,       color: "text-rose-600",    bg: "bg-rose-50",    badgeColor: "bg-rose-100 text-rose-700",      category: "venues" },
  misc:             { Icon: LayoutGrid, color: "text-slate-600",   bg: "bg-slate-50",   badgeColor: "bg-slate-100 text-slate-700",    category: "misc" },
};

const TYPE_LABELS: Record<ResourceType, string> = {
  library: "Library", reading_room: "Reading Room", computer_lab: "Computer Lab",
  badminton: "Badminton", basketball: "Basketball", volleyball: "Volleyball",
  club_event_venue: "Event Venue", misc: "Classroom / Misc",
};

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all",          label: "All" },
  { key: "library",      label: "Library" },
  { key: "reading_room", label: "Reading Room" },
  { key: "computer_lab", label: "Computer Lab" },
  { key: "sports",       label: "Sports" },
  { key: "venues",       label: "Event Venues" },
  { key: "misc_filter",  label: "Classrooms" },
];

// ─── Helper: status from utilisation ─────────────────────────────────────────
function getStatus(booked: number, total: number) {
  if (total === 0) return { label: "Unavailable", className: "bg-gray-100 text-gray-600" };
  const pct = booked / total;
  if (pct >= 1)    return { label: "Full",          className: "bg-red-100 text-red-700" };
  if (pct >= 0.75) return { label: "Almost full",   className: "bg-amber-100 text-amber-700" };
  return               { label: "Available now",  className: "bg-green-100 text-green-700" };
}

// ─── Skeleton tile ────────────────────────────────────────────────────────────
function TileSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-5 space-y-3">
      <Skeleton className="w-12 h-12 rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  );
}

// ─── Resource tile ──────────────────────────────────────────────────────────
function ResourceTile({ resource }: { resource: ResourceWithAvailability }) {
  const cfg = RESOURCE_CONFIG[resource.type as ResourceType];
  if (!cfg) return null;
  const { Icon, color, bg, badgeColor } = cfg;
  const { totalSlots, bookedSlots } = resource;
  const pct = totalSlots > 0 ? (bookedSlots / totalSlots) * 100 : 0;
  const status = getStatus(bookedSlots, totalSlots);
  const isFull = bookedSlots >= totalSlots;
  const barColor = pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-green-500";

  return (
    <Link
      href={`/resource/${resource.id}`}
      className={`group flex flex-col rounded-2xl border bg-card p-5 shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-200 ${isFull ? "opacity-70 pointer-events-none" : ""}`}
    >
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-4`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>

      <div className="flex items-start justify-between gap-2 mb-1">
        <h2 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">
          {resource.name}
        </h2>
        <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeColor}`}>
          {TYPE_LABELS[resource.type as ResourceType]}
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground mb-1">{resource.location}</p>
      <p className="text-[11px] text-muted-foreground mb-3">
        {resource.capacity} {["badminton","basketball","volleyball"].includes(resource.type) ? "players" : "seats"}
      </p>

      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Today&apos;s slots</span>
          <span>{bookedSlots}/{totalSlots} booked</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>

      <span className={`self-start text-[10px] font-semibold px-2 py-0.5 rounded-full mt-auto mb-3 ${status.className}`}>
        {status.label}
      </span>

      <button
        className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors ${
          isFull
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {isFull ? "Full" : "Book now →"}
      </button>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [resources, setResources] = useState<ResourceWithAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push("/login"); return; }

      const { data: profile } = await supabase.from("users").select("*").eq("id", authUser.id).single();
      if (profile) setUser(profile as User);

      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", authUser.id)
        .eq("is_read", false);
      setUnreadCount(count ?? 0);

      await fetchResources();
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchResources() {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const { data: res } = await supabase.from("resources").select("*").eq("is_active", true).order("name");
    const { data: slots } = await supabase.from("slots").select("resource_id, total_seats, booked_seats").eq("date", today);

    if (!res) { setLoading(false); return; }

    const slotMap: Record<string, { total: number; booked: number }> = {};
    (slots ?? []).forEach((s: Slot) => {
      if (!slotMap[s.resource_id]) slotMap[s.resource_id] = { total: 0, booked: 0 };
      slotMap[s.resource_id].total  += s.total_seats;
      slotMap[s.resource_id].booked += s.booked_seats;
    });

    const nowH = new Date().getHours();
    const { data: nowSlots } = await supabase
      .from("slots")
      .select("resource_id, booked_seats, total_seats")
      .eq("date", today)
      .eq("start_time", `${String(nowH).padStart(2, "0")}:00:00`);

    const nowMap: Record<string, boolean> = {};
    (nowSlots ?? []).forEach((s: Slot) => { nowMap[s.resource_id] = s.booked_seats < s.total_seats; });

    const enriched: ResourceWithAvailability[] = res.map((r: Resource) => ({
      ...r,
      totalSlots:  slotMap[r.id]?.total  ?? 0,
      bookedSlots: slotMap[r.id]?.booked ?? 0,
      availableNow: nowMap[r.id] ?? false,
    }));

    setResources(enriched);
    setLoading(false);
  }

  useEffect(() => {
    const channel = supabase
      .channel("slots-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "slots" }, () => { fetchResources(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.type.toLowerCase().includes(search.toLowerCase());
      const cfg = RESOURCE_CONFIG[r.type as ResourceType];
      const matchFilter =
        activeFilter === "all" ||
        r.type === activeFilter ||
        (activeFilter === "sports"      && cfg?.category === "sports") ||
        (activeFilter === "venues"      && cfg?.category === "venues") ||
        (activeFilter === "misc_filter" && cfg?.category === "misc");
      return matchSearch && matchFilter;
    });
  }, [resources, search, activeFilter]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b bg-card/90 backdrop-blur-md shadow-sm">
        <div className="container flex h-16 items-center justify-between gap-4 px-4">
          {/* Logo */}
          <Link href="/home" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-primary hidden sm:block">Campus-Sync</span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <Link href="/profile" className="relative p-2 rounded-full hover:bg-muted transition-colors" aria-label="Notifications">
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-[10px] text-white font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Avatar */}
            <Link href="/profile" className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {user?.name?.charAt(0) ?? "S"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm font-medium">
                {user?.name?.split(" ")[0] ?? "Student"}
              </span>
            </Link>

            {/* Share */}
            <Link href="/share" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold hover:bg-primary/10 hover:text-primary transition-colors">
              <Share2 className="w-3.5 h-3.5" /> Share
            </Link>

            {/* Admin dashboard */}
            {user?.role === "admin" && (
              <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
                <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
              </Link>
            )}

            {/* Sign out */}
            <button onClick={handleSignOut} className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="Sign out">
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      <div className="container px-4 py-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Hey {user?.name?.split(" ")[0] ?? "there"} 👋</h1>
          <p className="text-muted-foreground text-sm mt-1">What would you like to book today?</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search by name or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring transition"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                activeFilter === key
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-input hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Resource grid */}
        {loading ? (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <TileSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold mb-1">No resources found</h3>
            <p className="text-muted-foreground text-sm mb-4">Try a different search or filter.</p>
            <button onClick={() => { setSearch(""); setActiveFilter("all"); }} className="text-primary text-sm font-medium hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => <ResourceTile key={r.id} resource={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}
