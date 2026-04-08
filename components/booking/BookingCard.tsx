import Link from "next/link";
import { type BookingWithDetails } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-orange-100 text-orange-700",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

interface BookingCardProps {
  booking: BookingWithDetails;
}

export function BookingCard({ booking }: BookingCardProps) {
  const { resource, slot, status } = booking;

  return (
    <Link
      href={`/booking/${booking.id}`}
      className="block rounded-2xl border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm">{resource.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{resource.location}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>📅 {slot.date}</span>
        <span>
          🕐 {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
        </span>
      </div>
    </Link>
  );
}
