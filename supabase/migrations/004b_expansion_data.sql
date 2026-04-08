-- ============================================================
-- CampusSync — Migration 004b: Feature Expansion Data
-- ⚠️  Run AFTER 004a_enum_values.sql has been committed
-- ============================================================

-- ─── 1. P2P Equipment Sharing tables ─────────────────────────

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

CREATE INDEX IF NOT EXISTS idx_eq_requests_user ON public.equipment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_eq_comments_req  ON public.equipment_comments(request_id);

-- ─── 2. RLS for new tables ────────────────────────────────────
ALTER TABLE public.equipment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read equipment_requests"
  ON public.equipment_requests FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated insert equipment_requests"
  ON public.equipment_requests FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner update equipment_requests"
  ON public.equipment_requests FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Authenticated read equipment_comments"
  ON public.equipment_comments FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated insert equipment_comments"
  ON public.equipment_comments FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner delete equipment_comments"
  ON public.equipment_comments FOR DELETE USING (user_id = auth.uid() OR public.is_admin());

-- ─── 3. Auto-cancel no-show function ─────────────────────────
CREATE OR REPLACE FUNCTION public.auto_cancel_noshows()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE cancelled_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.bookings b
    SET status = 'no_show'
    FROM public.slots s
    WHERE b.slot_id        = s.id
      AND b.status         = 'active'
      AND b.signed_in_at   IS NULL
      AND (s.date + s.start_time)::TIMESTAMPTZ < (now() - INTERVAL '10 minutes')
    RETURNING b.id
  )
  SELECT COUNT(*) INTO cancelled_count FROM updated;
  RETURN cancelled_count;
END;
$$;

-- ─── 4. Rename existing resources ────────────────────────────
UPDATE public.resources SET name = 'Library - Academic Block 1',   location = 'Academic Block 1, Ground Floor' WHERE name = 'Central Library';
UPDATE public.resources SET name = 'Reading Room - Academic Block 1', location = 'Academic Block 1, 1st Floor'   WHERE name = 'Reading Room';
UPDATE public.resources SET name = 'Lab Complex',                   location = 'Block C, 2nd Floor'             WHERE name = 'Computer Lab A';
UPDATE public.resources SET name = 'Lab Complex B',                 location = 'Block C, 3rd Floor'             WHERE name = 'Computer Lab B';
UPDATE public.resources SET name = 'Badminton Court 1',             location = 'MPH' WHERE name ILIKE '%Badminton Court 1%' AND location NOT ILIKE '%MPH%';
UPDATE public.resources SET name = 'Badminton Court 2',             location = 'MPH' WHERE name ILIKE '%Badminton Court 2%' AND location NOT ILIKE '%MPH%';

-- Rename basketball → volleyball (safe now that enum is committed)
UPDATE public.resources
SET name = 'Volleyball Court', type = 'volleyball', location = 'MPH'
WHERE name ILIKE '%Basketball%';

-- ─── 5. New academic block 2 resources ───────────────────────
INSERT INTO public.resources (name, type, capacity, location, description, is_active) VALUES
  ('Library - Academic Block 2',    'library',          80,  'Academic Block 2, Ground Floor', 'Branch library with study tables and reference materials.', TRUE),
  ('Reading Room - Academic Block 2','reading_room',     30,  'Academic Block 2, 1st Floor',   'Quiet reading zone near AB2. No food or noise allowed.',   TRUE)
ON CONFLICT DO NOTHING;

-- ─── 6. New auditoria ────────────────────────────────────────
INSERT INTO public.resources (name, type, capacity, location, description, is_active) VALUES
  ('Audi 1 - Academic Block 1', 'club_event_venue', 200, 'Academic Block 1, Ground Floor', 'Main auditorium at AB1. Projector, PA system, and stage.', TRUE),
  ('Audi 2 - Academic Block 1', 'club_event_venue', 150, 'Academic Block 1, 1st Floor',    'Seminar auditorium at AB1. Ideal for club presentations.',  TRUE),
  ('Audi 1 - Academic Block 2', 'club_event_venue', 200, 'Academic Block 2, Ground Floor', 'Main auditorium at AB2. Suitable for fests and competitions.', TRUE),
  ('Audi 2 - Academic Block 2', 'club_event_venue', 150, 'Academic Block 2, 1st Floor',    'Seminar hall at AB2. Air-conditioned with projector.',      TRUE)
ON CONFLICT DO NOTHING;

-- ─── 7. New classrooms AB1 ───────────────────────────────────
INSERT INTO public.resources (name, type, capacity, location, description, is_active) VALUES
  ('Room 023 - Academic Block 1', 'misc', 40, 'Academic Block 1, Ground Floor', 'General-purpose classroom. Whiteboard and projector.', TRUE),
  ('Room 025 - Academic Block 1', 'misc', 40, 'Academic Block 1, Ground Floor', 'General-purpose classroom. Whiteboard and projector.', TRUE),
  ('Room 503 - Academic Block 1', 'misc', 30, 'Academic Block 1, 5th Floor',    'Small seminar room with AC and display screen.',      TRUE)
ON CONFLICT DO NOTHING;

-- ─── 8. New classrooms AB2 ───────────────────────────────────
INSERT INTO public.resources (name, type, capacity, location, description, is_active) VALUES
  ('Room 001 - Academic Block 2', 'misc', 40, 'Academic Block 2, Ground Floor', 'Large classroom near main entrance. Projector equipped.', TRUE),
  ('Room 004 - Academic Block 2', 'misc', 40, 'Academic Block 2, Ground Floor', 'General-purpose classroom with whiteboard.',             TRUE)
ON CONFLICT DO NOTHING;

-- ─── 9. Generate 7-day slots for all new resources ───────────
DO $$
DECLARE
  r RECORD; d DATE; h INTEGER;
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

-- ─── 10. Sample equipment requests ───────────────────────────
-- NOTE: Replace user UUIDs below with real user IDs from your users table,
-- or skip this block if you have no users yet.
-- INSERT INTO public.equipment_requests (user_id, item_name, description, urgency, status) VALUES
--   ('<your-user-uuid>', 'Scientific Calculator', 'Need for maths exam this Friday.', 'high', 'open'),
--   ('<your-user-uuid>', 'Digital Multimeter', 'ECE lab project, need for 2-3 days.', 'normal', 'open');
