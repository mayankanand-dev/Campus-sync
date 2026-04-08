"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  MessageSquarePlus, Search, Plus, ChevronDown, ChevronUp,
  Clock, CheckCircle2, Package,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { EquipmentRequest, EquipmentComment, User } from "@/lib/types";

const URGENCY_STYLES: Record<string, string> = {
  high:   "bg-red-100 text-red-700",
  normal: "bg-amber-100 text-amber-700",
  low:    "bg-blue-100 text-blue-700",
};
const STATUS_STYLES: Record<string, string> = {
  open:      "bg-green-100 text-green-700",
  fulfilled: "bg-blue-100 text-blue-700",
  closed:    "bg-gray-100 text-gray-600",
};

type RequestWithMeta = EquipmentRequest & {
  user_name: string;
  user_email: string;
  comments: (EquipmentComment & { user_name: string; user_email: string })[];
};

// ─── Single request card ──────────────────────────────────────────────────────
function RequestCard({ req, currentUserId, currentEmail, onRefresh }: {
  req: RequestWithMeta;
  currentUserId: string;
  currentEmail: string;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  async function postComment() {
    if (!comment.trim()) return;
    setPosting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("equipment_comments").insert({
      request_id: req.id,
      user_id: currentUserId,
      comment: comment.trim(),
    });
    setComment("");
    setPosting(false);
    onRefresh();
    setOpen(true);
  }

  async function markFulfilled() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("equipment_requests").update({ status: "fulfilled" }).eq("id", req.id);
    onRefresh();
  }

  const initials = req.user_name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className={`rounded-2xl border bg-card shadow-sm overflow-hidden transition-all ${req.status !== "open" ? "opacity-70" : ""}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-semibold text-sm truncate">{req.item_name}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${URGENCY_STYLES[req.urgency]}`}>
                {req.urgency === "high" ? "🔴 Urgent" : req.urgency === "normal" ? "🟡 Normal" : "🟢 Low"}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[req.status]}`}>
                {req.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-1">{req.description}</p>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>By <strong>{req.user_name}</strong></span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(req.created_at).toLocaleDateString("en-IN")}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {req.comments.length} response{req.comments.length !== 1 ? "s" : ""}
          </button>
          {req.user_id === currentUserId && req.status === "open" && (
            <button onClick={markFulfilled} className="ml-auto text-[11px] text-green-700 font-semibold hover:underline flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Mark fulfilled
            </button>
          )}
        </div>
      </div>

      {/* Comments */}
      {open && (
        <div className="border-t bg-muted/30 px-4 py-3 space-y-3">
          {req.comments.length === 0 && (
            <p className="text-xs text-muted-foreground">No responses yet. Be the first to help!</p>
          )}
          {req.comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                  {c.user_name?.split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 bg-card rounded-xl px-3 py-2 border text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{c.user_name}</span>
                  <span className="text-muted-foreground text-[10px]">{new Date(c.created_at).toLocaleString("en-IN")}</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">{c.comment}</p>
              </div>
            </div>
          ))}

          {/* Reply box */}
          {req.status === "open" && (
            <div className="flex gap-2 pt-1">
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">
                  {currentEmail.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                  placeholder={`Reply with your email so they can contact you…`}
                  className="flex-1 rounded-xl border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                />
                <Button size="sm" className="h-7 px-3 text-xs" onClick={postComment} disabled={posting || !comment.trim()}>
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Post request form ────────────────────────────────────────────────────────
function PostRequestForm({ userId, onSuccess }: { userId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ item_name: "", description: "", urgency: "normal" });
  const [saving, setSaving] = useState(false);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("equipment_requests").insert({
      user_id: userId,
      item_name: form.item_name.trim(),
      description: form.description.trim(),
      urgency: form.urgency as "low" | "normal" | "high",
      status: "open",
    });
    setSaving(false);
    setOpen(false);
    setForm({ item_name: "", description: "", urgency: "normal" });
    onSuccess();
  }

  const cls = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="mb-5">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Post a new equipment request
        </button>
      ) : (
        <form onSubmit={handlePost} className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
          <h3 className="font-semibold text-sm mb-1">What do you need?</h3>
          <input required className={cls} placeholder="Equipment name (e.g. Casio Calculator, Multimeter)" value={form.item_name} onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))} />
          <textarea rows={2} className={cls} placeholder="Description — why you need it, how long, etc." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <div className="flex gap-3 items-center">
            <label className="text-xs text-muted-foreground shrink-0">Urgency</label>
            <select className={`${cls} flex-1`} value={form.urgency} onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}>
              <option value="low">🟢 Low</option>
              <option value="normal">🟡 Normal</option>
              <option value="high">🔴 High (needed very soon)</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Posting…" : "Post Request"}</Button>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Main Share page ──────────────────────────────────────────────────────────
export default function SharePage() {
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<RequestWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return;
      supabase.from("users").select("*").eq("id", u.id).single().then(({ data }) => {
        if (data) setUser(data as User);
      });
      fetchRequests();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchRequests() {
    setLoading(true);
    // Fetch requests with nested comments, each with user info
    const { data: reqs } = await supabase
      .from("equipment_requests")
      .select("*, user:users!equipment_requests_user_id_fkey(id,name,email)")
      .order("created_at", { ascending: false });

    const { data: cmts } = await supabase
      .from("equipment_comments")
      .select("*, user:users!equipment_comments_user_id_fkey(id,name,email)")
      .order("created_at", { ascending: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched: RequestWithMeta[] = (reqs ?? []).map((r: any) => ({
      ...r,
      user_name:  r.user?.name  ?? "Unknown",
      user_email: r.user?.email ?? "",
      comments: (cmts ?? [])
        .filter((c: any) => c.request_id === r.id)
        .map((c: any) => ({
          ...c,
          user_name:  c.user?.name  ?? "Unknown",
          user_email: c.user?.email ?? "",
        })),
    }));

    setRequests(enriched);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const matchSearch = r.item_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.description ?? "").toLowerCase().includes(search.toLowerCase());
      const matchTab = tab === "all" || r.user_id === user?.id;
      return matchSearch && matchTab;
    });
  }, [requests, search, tab, user]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/90 backdrop-blur-md shadow-sm">
        <div className="container flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/home" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Package className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-primary hidden sm:block">Campus-Sync</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/home" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Resources</Link>
            <Link href="/share" className="text-primary font-semibold">Share</Link>
            <Link href="/profile" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Profile</Link>
          </nav>
        </div>
      </header>

      <div className="container px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquarePlus className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">Equipment Sharing</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Need a calculator, multimeter, or any equipment? Post a request — a fellow student might have it!
          </p>
        </div>

        {/* Post CTA */}
        {user && <PostRequestForm userId={user.id} onSuccess={fetchRequests} />}

        {/* Tabs + Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex rounded-xl border overflow-hidden">
            {(["all", "mine"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
              >
                {t === "all" ? "All Requests" : "My Posts"}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search equipment…"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📦</div>
            <p className="font-semibold">No requests found</p>
            <p className="text-sm text-muted-foreground">Be the first to post one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <RequestCard
                key={r.id}
                req={r}
                currentUserId={user?.id ?? ""}
                currentEmail={user?.email ?? ""}
                onRefresh={fetchRequests}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
