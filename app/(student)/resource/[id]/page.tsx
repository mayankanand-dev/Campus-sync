"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, addDays, isSameDay } from "date-fns";
import { MapPin, Users, ChevronLeft } from "lucide-react";
import {
  BookOpen, Coffee, Monitor, Zap, Circle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookingQR } from "@/components/qr/BookingQR";
import type { Resource, Slot } from "@/lib/types";

// ─── Resource icon map ────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  library: BookOpen,
  reading_room: Coffee,
  computer_lab: Monitor,
  badminton: Zap,
  basketball: Circle,
};

const TYPE_STYLES: Record<string, string> = {
  library:      "bg-teal-100   text-teal-700",
  reading_room: "bg-purple-100 text-purple-700",
  computer_lab: "bg-blue-100   text-blue-700",
  badminton:    "bg-green-100  text-green-700",
  basketball:   "bg-orange-100 text-orange-700",
};

// ─── Slot card ────────────────────────────────────────────────────────────────
function SlotCard({ slot, onClick }: { slot: Slot; onClick: () => void }) {
  const available = slot.total_seats - slot.booked_seats;
  const pct = slot.booked_seats / slot.total_seats;
  const isFull = available <= 0;

  const color = isFull
    ? "border-red-200 bg-red-50 text-red-400"
    : pct >= 0.5
    ? "border-amber-200 bg-amber-50 hover:border-amber-400 cursor-pointer"
    : "border-green-200 bg-green-50 hover:border-green-400 cursor-pointer";

  const pill = isFull
    ? "bg-red-100 text-red-700"
    : pct >= 0.5
    ? "bg-amber-100 text-amber-700"
    : "bg-green-100 text-green-700";

  return (
    <button
      disabled={isFull}
      onClick={onClick}
      className={`flex flex-col items-center p-3 rounded-xl border text-center transition-all ${color}`}
    >
      <span className="text-sm font-semibold">
        {slot.start_time.slice(0, 5)}
      </span>
      <span className="text-[10px] text-muted-foreground mt-0.5">
        –{slot.end_time.slice(0, 5)}
      </span>
      <span className={`mt-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pill}`}>
        {isFull ? "Full" : `${available} left`}
      </span>
    </button>
  );
}

// ─── Booking modal ────────────────────────────────────────────────────────────
function BookingModal({
  open, slot, resource, onClose, onSuccess,
}: {
  open: boolean;
  slot: Slot | null;
  resource: Resource | null;
  onClose: () => void;
  onSuccess: (bookingId: string, qrToken: string) => void;
}) {
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSports = resource?.type === "badminton" || resource?.type === "basketball";
  const available = slot ? slot.total_seats - slot.booked_seats : 0;
  const maxSeats = isSports ? available : Math.min(4, available);

  useEffect(() => { if (open) { setSeats(1); setError(null); } }, [open]);

  async function handleBook() {
    if (!slot || !resource) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcErr } = await (supabase as any).rpc("book_slot", {
        p_user_id:    user.id,
        p_slot_id:    slot.id,
        p_resource_id: resource.id,
        p_seats:      isSports ? available : seats,
      });

      if (rpcErr) throw new Error(rpcErr.message);
      if (!data || data.length === 0) throw new Error("Booking failed, try again");

      onSuccess(data[0].booking_id, data[0].qr_token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (!slot || !resource) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Booking</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Resource</span>
            <span className="font-medium">{resource.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Time</span>
            <span className="font-medium">
              {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Available</span>
            <span className="font-medium">{available} seats</span>
          </div>

          {!isSports && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Seats needed</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setSeats(Math.max(1, seats - 1))} className="w-7 h-7 rounded-full bg-muted hover:bg-primary/10 font-bold">-</button>
                <span className="w-4 text-center font-semibold">{seats}</span>
                <button onClick={() => setSeats(Math.min(maxSeats, seats + 1))} className="w-7 h-7 rounded-full bg-muted hover:bg-primary/10 font-bold">+</button>
              </div>
            </div>
          )}

          {isSports && (
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
              Full court booking — all {available} available slots reserved.
            </p>
          )}

          <div className="flex justify-between font-semibold border-t pt-2">
            <span>Total cost</span>
            <span className="text-green-600">Free</span>
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleBook} disabled={loading}>
            {loading ? "Booking…" : "Confirm Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({
  bookingId, qrToken, resource, slot, onBack,
}: {
  bookingId: string;
  qrToken: string;
  resource: Resource;
  slot: Slot;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-10 px-4 animate-fade-in">
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="text-xl font-bold mb-1">Booking Confirmed!</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Show this QR code at the entrance.
      </p>
      <BookingQR
        bookingId={bookingId}
        qrToken={qrToken}
        resourceName={resource.name}
        slotDate={slot.date}
        slotStart={slot.start_time}
        slotEnd={slot.end_time}
      />
      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={onBack}>Book another</Button>
        <Link href="/profile">
          <Button>My bookings →</Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ResourcePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [resource, setResource] = useState<Resource | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookingResult, setBookingResult] = useState<{ id: string; token: string } | null>(null);

  const next7 = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

  // Fetch resource
  useEffect(() => {
    supabase.from("resources").select("*").eq("id", params.id).single()
      .then(({ data }) => setResource(data as unknown as Resource));
  }, [params.id]);

  // Fetch slots for selected date
  const fetchSlots = useCallback(async () => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const { data } = await supabase
      .from("slots").select("*")
      .eq("resource_id", params.id)
      .eq("date", dateStr)
      .order("start_time");
    setSlots((data ?? []) as Slot[]);
    setLoading(false);
  }, [selectedDate, params.id]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`slots-resource-${params.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "slots", filter: `resource_id=eq.${params.id}` }, fetchSlots)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [params.id, fetchSlots]);

  const Icon = resource ? (ICON_MAP[resource.type] ?? BookOpen) : BookOpen;

  if (bookingResult && resource && selectedSlot) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur">
          <div className="container flex h-16 items-center gap-3 px-4">
            <button onClick={() => setBookingResult(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          </div>
        </header>
        <SuccessScreen
          bookingId={bookingResult.id}
          qrToken={bookingResult.token}
          resource={resource}
          slot={selectedSlot}
          onBack={() => { setBookingResult(null); fetchSlots(); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur">
        <div className="container flex h-16 items-center gap-3 px-4">
          <button onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Resources
          </button>
        </div>
      </header>

      <div className="container px-4 py-6 max-w-2xl">
        {/* Resource header */}
        {!resource ? (
          <div className="space-y-3 mb-6">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : (
          <div className="flex gap-4 mb-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${TYPE_STYLES[resource.type]?.replace("text-", "bg-").split(" ")[0]} bg-opacity-20`}>
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{resource.name}</h1>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_STYLES[resource.type] ?? ""}`}>
                  {resource.type.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{resource.location}</span>
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{resource.capacity} seats</span>
              </div>
              {resource.description && (
                <p className="text-sm text-muted-foreground mt-2">{resource.description}</p>
              )}
            </div>
          </div>
        )}

        {/* Date picker */}
        <div className="mb-6">
          <h2 className="font-semibold text-sm mb-3">Select Date</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {next7.map((d) => {
              const isSelected = isSameDay(d, selectedDate);
              const isToday = isSameDay(d, new Date());
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelectedDate(d)}
                  className={`shrink-0 flex flex-col items-center px-4 py-3 rounded-xl border text-sm transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-md"
                      : "bg-card border-input hover:border-primary/50"
                  }`}
                >
                  <span className="text-[10px] font-medium uppercase opacity-70">
                    {isToday ? "Today" : format(d, "EEE")}
                  </span>
                  <span className="text-lg font-bold leading-tight">{format(d, "d")}</span>
                  <span className="text-[10px] opacity-70">{format(d, "MMM")}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Slot grid */}
        <div>
          <h2 className="font-semibold text-sm mb-3">
            Available Slots — {format(selectedDate, "MMMM d, yyyy")}
          </h2>

          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No slots available for this date.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((s) => (
                <SlotCard
                  key={s.id}
                  slot={s}
                  onClick={() => { setSelectedSlot(s); setModalOpen(true); }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />Available</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Filling up</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Full</span>
        </div>
      </div>

      {/* Booking modal */}
      <BookingModal
        open={modalOpen}
        slot={selectedSlot}
        resource={resource}
        onClose={() => setModalOpen(false)}
        onSuccess={(id, token) => {
          setModalOpen(false);
          setBookingResult({ id, token });
        }}
      />
    </div>
  );
}
