-- ============================================================
-- CampusSync — Initial Database Migration
-- Run this in Supabase SQL Editor (or via supabase db push)
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enum Types ───────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('student', 'admin');

CREATE TYPE resource_type AS ENUM (
  'library',
  'reading_room',
  'computer_lab',
  'badminton',
  'basketball'
);

CREATE TYPE booking_status AS ENUM ('active', 'completed', 'cancelled', 'no_show');

CREATE TYPE notification_type AS ENUM ('reminder', 'alert', 'underutilization');

-- ─── Tables ───────────────────────────────────────────────────

-- Users (mirrors Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  student_id  TEXT UNIQUE,
  email       TEXT NOT NULL UNIQUE,
  role        user_role NOT NULL DEFAULT 'student',
  avatar_url  TEXT,
  semester    SMALLINT CHECK (semester BETWEEN 1 AND 8),
  branch      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Resources
CREATE TABLE IF NOT EXISTS public.resources (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  type        resource_type NOT NULL,
  capacity    INTEGER NOT NULL CHECK (capacity > 0),
  location    TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- Slots
CREATE TABLE IF NOT EXISTS public.slots (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id  UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  total_seats  INTEGER NOT NULL CHECK (total_seats > 0),
  booked_seats INTEGER NOT NULL DEFAULT 0 CHECK (booked_seats >= 0),
  CONSTRAINT booked_lte_total CHECK (booked_seats <= total_seats),
  UNIQUE (resource_id, date, start_time)
);

-- Bookings
CREATE TABLE IF NOT EXISTS public.bookings (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  slot_id                 UUID NOT NULL REFERENCES public.slots(id) ON DELETE RESTRICT,
  resource_id             UUID NOT NULL REFERENCES public.resources(id) ON DELETE RESTRICT,
  status                  booking_status NOT NULL DEFAULT 'active',
  qr_token                TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  signed_in_at            TIMESTAMPTZ,
  signed_out_at           TIMESTAMPTZ,
  check_in_reminder_sent  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  booking_id  UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  type        notification_type NOT NULL,
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_slots_resource_date     ON public.slots(resource_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id        ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id        ON public.bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status         ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON public.notifications(user_id, is_read);

-- ─── Function: auto-increment booked_seats on INSERT/UPDATE/DELETE bookings ──

CREATE OR REPLACE FUNCTION public.handle_booking_seat_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE public.slots SET booked_seats = booked_seats + 1 WHERE id = NEW.slot_id;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Booking was just activated
    IF OLD.status <> 'active' AND NEW.status = 'active' THEN
      UPDATE public.slots SET booked_seats = booked_seats + 1 WHERE id = NEW.slot_id;
    -- Booking was just cancelled / completed / no_show
    ELSIF OLD.status = 'active' AND NEW.status <> 'active' THEN
      UPDATE public.slots SET booked_seats = GREATEST(booked_seats - 1, 0) WHERE id = NEW.slot_id;
    END IF;

  ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
    UPDATE public.slots SET booked_seats = GREATEST(booked_seats - 1, 0) WHERE id = OLD.slot_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_booking_seat_count
AFTER INSERT OR UPDATE OF status OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.handle_booking_seat_count();

-- ─── Function: auto-create users row on auth signup ──────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'student'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_new_user
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Enable Row Level Security ────────────────────────────────
ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications   ENABLE ROW LEVEL SECURITY;

-- ─── Helper: is_admin() ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ─── RLS Policies: users ─────────────────────────────────────
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

-- ─── RLS Policies: resources ─────────────────────────────────
CREATE POLICY "Authenticated users can read resources"
  ON public.resources FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage resources"
  ON public.resources FOR ALL
  USING (public.is_admin());

-- ─── RLS Policies: slots ─────────────────────────────────────
CREATE POLICY "Authenticated users can read slots"
  ON public.slots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage slots"
  ON public.slots FOR ALL
  USING (public.is_admin());

-- ─── RLS Policies: bookings ──────────────────────────────────
CREATE POLICY "Students can read own bookings"
  ON public.bookings FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Students can create own bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Students can update own bookings"
  ON public.bookings FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can delete bookings"
  ON public.bookings FOR DELETE
  USING (public.is_admin());

-- ─── RLS Policies: notifications ─────────────────────────────
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true); -- Edge Functions use service_role key which bypasses RLS
