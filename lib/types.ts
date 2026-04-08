// ─── Enum / Union Types ────────────────────────────────────────────────────────

export type UserRole = "student" | "admin";

export type ResourceType =
  | "library"
  | "reading_room"
  | "computer_lab"
  | "badminton"
  | "basketball"
  | "volleyball"
  | "club_event_venue"
  | "misc";

export type BookingStatus = "active" | "completed" | "cancelled" | "no_show";

export type NotificationType = "reminder" | "alert" | "underutilization";

export type EquipmentUrgency = "low" | "normal" | "high";
export type EquipmentStatus  = "open" | "fulfilled" | "closed";

// ─── Table Interfaces ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  student_id: string | null;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  semester: number | null;
  branch: string | null;
  created_at: string;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  capacity: number;
  location: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
}

export interface Slot {
  id: string;
  resource_id: string;
  date: string;          // YYYY-MM-DD
  start_time: string;    // HH:MM:SS
  end_time: string;      // HH:MM:SS
  total_seats: number;
  booked_seats: number;
}

export interface Booking {
  id: string;
  user_id: string;
  slot_id: string;
  resource_id: string;
  status: BookingStatus;
  qr_token: string;
  signed_in_at: string | null;
  signed_out_at: string | null;
  check_in_reminder_sent: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  booking_id: string | null;
  type: NotificationType;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface EquipmentRequest {
  id: string;
  user_id: string;
  item_name: string;
  description: string | null;
  urgency: EquipmentUrgency;
  status: EquipmentStatus;
  created_at: string;
  // joined
  user?: Pick<User, "id" | "name" | "email">;
  comment_count?: number;
}

export interface EquipmentComment {
  id: string;
  request_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  // joined
  user?: Pick<User, "id" | "name" | "email">;
}

// ─── Joined / Helper Types ─────────────────────────────────────────────────────

export type SlotWithResource = Slot & {
  resource: Resource;
};

export type BookingWithDetails = Booking & {
  slot: Slot;
  resource: Resource;
  user?: User;
};

// ─── Supabase Database Type Map ────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "created_at"> & { created_at?: string };
        Update: Partial<User>;
      };
      resources: {
        Row: Resource;
        Insert: Omit<Resource, "id"> & { id?: string };
        Update: Partial<Resource>;
      };
      slots: {
        Row: Slot;
        Insert: Omit<Slot, "id"> & { id?: string };
        Update: Partial<Slot>;
      };
      bookings: {
        Row: Booking;
        Insert: Omit<Booking, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Booking>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Notification>;
      };
      equipment_requests: {
        Row: EquipmentRequest;
        Insert: Omit<EquipmentRequest, "id" | "created_at" | "user" | "comment_count"> & { id?: string };
        Update: Partial<EquipmentRequest>;
      };
      equipment_comments: {
        Row: EquipmentComment;
        Insert: Omit<EquipmentComment, "id" | "created_at" | "user"> & { id?: string };
        Update: Partial<EquipmentComment>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      resource_type: ResourceType;
      booking_status: BookingStatus;
      notification_type: NotificationType;
    };
  };
};
