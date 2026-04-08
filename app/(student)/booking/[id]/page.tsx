"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BookingQR } from "@/components/qr/BookingQR";
import type { Booking, Resource, Slot } from "@/lib/types";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const STATUS_STYLES: Record<string, string> = {
  active:    "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-600",
  no_show:   "bg-red-100 text-red-700",
};

export default function BookingDetailPage({ params }: { params: { id: string } }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [resource, setResource] = useState<Resource | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    async function fetchBooking() {
      const { data } = await supabase
        .from("bookings")
        .select("*, slot:slots(*), resource:resources(*)")
        .eq("id", params.id)
        .single();
      if (data) {
        setBooking(data as unknown as Booking);
        setSlot((data as any).slot as Slot);
        setResource((data as any).resource as Resource);
      }
      setLoading(false);
    }
    fetchBooking();
  }, [params.id]);

  async function handleCancel() {
    if (!booking) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("cancel_booking", { p_booking_id: booking.id, p_user_id: user.id });
    setBooking((b) => b ? { ...b, status: "cancelled" } : b);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur">
        <div className="container flex h-16 items-center gap-3 px-4">
          <Link href="/profile" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" /> My bookings
          </Link>
        </div>
      </header>

      <div className="container px-4 py-8 max-w-md">
        {loading ? (
          <div className="text-center text-muted-foreground">Loading…</div>
        ) : !booking ? (
          <div className="text-center text-muted-foreground">Booking not found.</div>
        ) : (
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            {/* Status */}
            <div className="text-center mb-5">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[booking.status]}`}>
                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </span>
              <h1 className="text-xl font-bold mt-2">{resource?.name}</h1>
              <p className="text-muted-foreground text-sm">
                {slot ? `${new Date(slot.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · ${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}` : ""}
              </p>
            </div>

            {/* Info rows */}
            <div className="space-y-2 text-sm border-t pt-4">
              {[
                { label: "Location", value: resource?.location ?? "—" },
                { label: "Capacity", value: `${resource?.capacity ?? "—"} seats` },
                { label: "Booking ID", value: <span className="font-mono text-xs">{booking.id.slice(0, 12)}…</span> },
                { label: "Booked at", value: new Date(booking.created_at).toLocaleString("en-IN") },
                ...(booking.signed_in_at ? [{ label: "Signed in", value: new Date(booking.signed_in_at).toLocaleTimeString("en-IN") }] : []),
                ...(booking.signed_out_at ? [{ label: "Signed out", value: new Date(booking.signed_out_at).toLocaleTimeString("en-IN") }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            {booking.status === "active" && (
              <div className="mt-5 flex flex-col gap-2">
                <Button className="w-full gap-2" onClick={() => setQrOpen(true)}>
                  Show QR Code
                </Button>
                <Button variant="outline" className="w-full text-destructive border-destructive/40 hover:bg-destructive/5" onClick={handleCancel}>
                  Cancel Booking
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Dialog */}
      {booking && slot && resource && (
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="max-w-sm">
            <BookingQR
              bookingId={booking.id}
              qrToken={booking.qr_token}
              resourceName={resource.name}
              slotDate={slot.date}
              slotStart={slot.start_time}
              slotEnd={slot.end_time}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
