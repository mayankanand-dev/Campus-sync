-- ============================================================
-- CampusSync — Migration 004: Feature Expansion
-- Run in Supabase SQL Editor AFTER 001, 002, and seed.sql
-- ============================================================

-- ─── 1. New resource_type enum values ─────────────────────────
ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'volleyball';
ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'club_event_venue';
ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'misc';

-- ─── 2. P2P Equipment Sharing tables ─────────────────────────

CREATE TABLE IF NOT EXISTS public.equipment_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_name   TEXT NOT NULL,
  description TEXT,
  urgency     TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low','normal','high')),
  status      TEXT NOT NULL DEFAULT 'open'   CHECK (status  IN ('open','fulfilled','closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipment_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  UUID NOT NULL REFERENCES public.equipment_requests(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  comment     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eq_requests_user   ON public.equipment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_eq_comments_req    ON public.equipment_comments(request_id);

-- ─── 3. RLS for new tables ────────────────────────────────────
ALTER TABLE public.equipment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_comments ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read all requests/comments
CREATE POLICY "Authenticated read equipment_requests"
  ON public.equipment_requests FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated insert equipment_requests"
  ON public.equipment_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner update equipment_requests"
  ON public.equipment_requests FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Authenticated read equipment_comments"
  ON public.equipment_comments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated insert equipment_comments"
  ON public.equipment_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner delete equipment_comments"
  ON public.equipment_comments FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin());

-- ─── 4. Auto-cancel no-show function ─────────────────────────
-- Marks active bookings as no_show when 10+ minutes past slot start
-- without a check-in. The trigger will decrement booked_seats.
CREATE OR REPLACE FUNCTION public.auto_cancel_noshows()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cancelled_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.bookings b
    SET status = 'no_show'
    FROM public.slots s
    WHERE b.slot_id     = s.id
      AND b.status      = 'active'
      AND b.signed_in_at IS NULL
      AND (s.date + s.start_time)::TIMESTAMPTZ < (now() - INTERVAL '10 minutes')
    RETURNING b.id, b.user_id
  )
  SELECT COUNT(*) INTO cancelled_count FROM updated;

  RETURN cancelled_count;
END;
$$;

-- ─── 5. Rename existing resources ────────────────────────────
-- Run only if your resources table has the original seed data.
-- Skip safely if names already updated.

UPDATE public.resources SET
  name = 'Library - Academic Block 1',
  location = 'Academic Block 1, Ground Floor'
WHERE name = 'Central Library';

UPDATE public.resources SET
  name = 'Reading Room - Academic Block 1',
  location = 'Academic Block 1, 1st Floor'
WHERE name = 'Reading Room';

UPDATE public.resources SET
  name = 'Lab Complex',
  location = 'Block C, 2nd Floor'
WHERE name = 'Computer Lab A';

UPDATE public.resources SET
  name = 'Lab Complex B',
  location = 'Block C, 3rd Floor'
WHERE name = 'Computer Lab B';

UPDATE public.resources SET
  name = 'Badminton Court 1',
  location = 'MPH'
WHERE name ILIKE '%Badminton Court 1%' AND location NOT ILIKE '%MPH%';

UPDATE public.resources SET
  name = 'Badminton Court 2',
  location = 'MPH'
WHERE name ILIKE '%Badminton Court 2%' AND location NOT ILIKE '%MPH%';

UPDATE public.resources SET
  name = 'Volleyball Court',
  type = 'volleyball',
  location = 'MPH'
WHERE name ILIKE '%Basketball%';

-- ─── 6. New resources: Academic Block 2 ──────────────────────
INSERT INTO public.resources (name, type, capacity, location, description, is_active) VALUES
  ('Library - Academic Block 2',   'library',          80,  'Academic Block 2, Ground Floor', 'Branch library with study tables and reference materials.', TRUE),
  ('Reading Room - Academic Block 2','reading_room',    30,  'Academic Block 2, 1st Floor',   'Quiet reading zone near AB2. No food or noise allowed.',   TRUE)
ON CONFLICT DO NOTHING;

-- ─── 7. New resources: Auditoria ─────────────────────────────
INSERT INTO public.resources (name, type, capacity, location, description, is_active) VALUES
  ('Audi 1 - Academic Block 1', 'club_event_venue', 200, 'Academic Block 1, Ground Floor', 'Main auditorium at AB1. Projector, PA system, and stage available.', TRUE),
  ('Audi 2 - Academic Block 1', 'club_event_venue', 150, 'Academic Block 1, 1st Floor',   'Smaller seminar auditorium at AB1. Ideal for club presentations.',  TRUE),
  ('Audi 1 - Academic Block 2', 'club_event_venue', 200, 'Academic Block 2, Ground Floor', 'Main auditorium at AB2. Suitable for fests and competitions.',      TRUE),
  ('Audi 2 - Academic Block 2', 'club_event_venue', 150, 'Academic Block 2, 1st Floor',   'Seminar hall at AB2. Air-conditioned with projector.',              TRUE)
ON CONFLICT DO NOTHING;

-- ─── 8. New resources: Rooms at AB1 ──────────────────────────
INSERT INTO public.resources (name, type, capacity, location, description, is_active) VALUES
  ('Room 023 - Academic Block 1', 'misc', 40, 'Academic Block 1, Ground Floor', 'General-purpose classroom. Whiteboard and projector available.', TRUE),
  ('Room 025 - Academic Block 1', 'misc', 40, 'Academic Block 1, Ground Floor', 'General-purpose classroom. Whiteboard and projector available.', TRUE),
  ('Room 503 - Academic Block 1', 'misc', 30, 'Academic Block 1, 5th Floor',    'Small seminar room with AC and display screen.',               TRUE)
ON CONFLICT DO NOTHING;

-- ─── 9. New resources: Rooms at AB2 ──────────────────────────
INSERT INTO public.resources (name, type, capacity, location, description, is_active) VALUES
  ('Room 001 - Academic Block 2', 'misc', 40, 'Academic Block 2, Ground Floor', 'Large classroom near main entrance. Projector equipped.', TRUE),
  ('Room 004 - Academic Block 2', 'misc', 40, 'Academic Block 2, Ground Floor', 'General-purpose classroom with whiteboard.',              TRUE)
ON CONFLICT DO NOTHING;

-- ─── 10. Generate 7-day slots for all new resources ──────────
DO $$
DECLARE
  r   RECORD;
  d   DATE;
  h   INTEGER;
BEGIN
  FOR r IN
    SELECT id, capacity FROM public.resources
    WHERE is_active = TRUE
      AND id NOT IN (SELECT DISTINCT resource_id FROM public.slots WHERE date >= CURRENT_DATE)
  LOOP
    FOR d IN SELECT generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '6 days', INTERVAL '1 day')::DATE LOOP
      FOR h IN 8..21 LOOP
        INSERT INTO public.slots (resource_id, date, start_time, end_time, total_seats, booked_seats)
        VALUES (r.id, d, make_time(h,0,0), make_time(h+1,0,0), r.capacity, 0)
        ON CONFLICT (resource_id, date, start_time) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

-- ─── 11. Sample equipment sharing data ───────────────────────
INSERT INTO public.equipment_requests (id, user_id, item_name, description, urgency, status) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'Scientific Calculator', 'Need a Casio fx-991ES or similar for my maths exam this Friday. Will return same day.', 'high',   'open'),
  ('e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000007', 'Digital Multimeter',    'Looking for a multimeter for ECE lab project. Need it for 2–3 days.', 'normal', 'open'),
  ('e1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000012', 'Soldering Iron',        'Need soldering iron for PCB assembly. Just for an afternoon.', 'normal', 'open'),
  ('e1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 'Vernier Caliper',       'Need for mechanical measurements in my ME lab. 1-day borrow.', 'low',    'open'),
  ('e1000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000009', 'Oscilloscope Probe',    'Looking for an oscilloscope probe for signal analysis. Lost mine.', 'high',  'open'),
  ('e1000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'Breadboard',            'Need a full-size 830-point breadboard for weekend project.', 'low',    'fulfilled')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.equipment_comments (request_id, user_id, comment) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', 'I have a Casio fx-100MS, will that work? Mail me at karan.joshi2022@vitbhopal.ac.in'),
  ('e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'I have a Fluke 101 multimeter. Contact: rohan.mehta2021@vitbhopal.ac.in'),
  ('e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000013', 'I also have one, reach out at saurabh.mishra2023@vitbhopal.ac.in if still needed'),
  ('e1000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000006', 'I have a spare BNC probe. ananya.reddy2022@vitbhopal.ac.in')
ON CONFLICT DO NOTHING;
