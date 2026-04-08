"use client";

import { type Slot } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SlotPickerProps {
  slots: Slot[];
  selectedSlotId: string | null;
  onSelect: (slotId: string) => void;
}

export function SlotPicker({ slots, selectedSlotId, onSelect }: SlotPickerProps) {
  if (slots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No slots available for this date. Try a different day.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot) => {
        const available = slot.total_seats - slot.booked_seats;
        const full = available === 0;
        const selected = selectedSlotId === slot.id;

        return (
          <button
            key={slot.id}
            disabled={full}
            onClick={() => onSelect(slot.id)}
            className={cn(
              "rounded-xl border px-2 py-3 text-center text-xs transition-all",
              full
                ? "border-muted bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                : selected
                ? "border-primary bg-primary text-primary-foreground font-semibold shadow-md"
                : "border-input bg-card hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
            )}
          >
            <span className="block font-medium">{slot.start_time.slice(0, 5)}</span>
            <span className="block mt-0.5 text-[10px] opacity-75">
              {full ? "Full" : `${available} left`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
