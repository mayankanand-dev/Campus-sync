import { type ResourceType } from "./types";

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  library: "Library",
  reading_room: "Reading Room",
  computer_lab: "Computer Lab",
  badminton: "Badminton Court",
  basketball: "Basketball Court",
  volleyball: "Volleyball Court",
  club_event_venue: "Event Venue",
  misc: "Classroom / Misc",
};

export const RESOURCE_ICONS: Record<ResourceType, string> = {
  library: "📚",
  reading_room: "📖",
  computer_lab: "💻",
  badminton: "🏸",
  basketball: "🏀",
  volleyball: "🏐",
  club_event_venue: "🎤",
  misc: "🏫",
};

/** Academic resources have hourly slots 08:00–22:00 */
export const ACADEMIC_RESOURCE_TYPES: ResourceType[] = [
  "library",
  "reading_room",
  "computer_lab",
];

/** Sports resources have 1-hour blocks */
export const SPORTS_RESOURCE_TYPES: ResourceType[] = ["badminton", "basketball", "volleyball"];
