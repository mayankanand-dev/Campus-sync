-- ============================================================
-- CampusSync — Seed Data
-- Run AFTER 001_init.sql and 002_rpc.sql in Supabase SQL Editor
-- ============================================================

-- ─── Resources ───────────────────────────────────────────────

INSERT INTO public.resources (id, name, type, capacity, location, description, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Central Library',     'library',      120, 'Block A, Ground Floor',  'Main campus library with study tables, journals, and digital access terminals.',       TRUE),
  ('a1000000-0000-0000-0000-000000000002', 'Reading Room',         'reading_room',  40, 'Block A, 1st Floor',     'Quiet reading space for focused study. Silence strictly maintained.',                  TRUE),
  ('a1000000-0000-0000-0000-000000000003', 'Computer Lab A',       'computer_lab',  30, 'Block C, 2nd Floor',     'Windows workstations with MATLAB, AutoCAD, and MS Office.',                          TRUE),
  ('a1000000-0000-0000-0000-000000000004', 'Computer Lab B',       'computer_lab',  30, 'Block C, 3rd Floor',     'Linux workstations with Python, R, and data-science toolchains.',                    TRUE),
  ('a1000000-0000-0000-0000-000000000005', 'Badminton Court 1',    'badminton',      4, 'Sports Complex, Hall 1', 'Full-size indoor badminton court. Racquets and shuttlecocks available at counter.',  TRUE),
  ('a1000000-0000-0000-0000-000000000006', 'Badminton Court 2',    'badminton',      4, 'Sports Complex, Hall 2', 'Full-size indoor badminton court. Racquets and shuttlecocks available at counter.',  TRUE),
  ('a1000000-0000-0000-0000-000000000007', 'Basketball Court',     'basketball',    10, 'Sports Complex, Outdoor','Outdoor basketball court. Balls available at the sports office.',                    TRUE)
ON CONFLICT (id) DO NOTHING;


-- ─── Slots (next 7 days, 08:00–22:00 hourly) ─────────────────

DO $$
DECLARE
  r       RECORD;
  d       DATE;
  h       INTEGER;
  cap     INTEGER;
BEGIN
  FOR r IN SELECT id, type, capacity FROM public.resources WHERE is_active = TRUE LOOP
    cap := r.capacity;
    FOR d IN SELECT generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '6 days', INTERVAL '1 day')::DATE LOOP
      FOR h IN 8..21 LOOP
        INSERT INTO public.slots (resource_id, date, start_time, end_time, total_seats, booked_seats)
        VALUES (
          r.id,
          d,
          make_time(h, 0, 0),
          make_time(h + 1, 0, 0),
          cap,
          0
        )
        ON CONFLICT (resource_id, date, start_time) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;


-- ─── Mock Users ───────────────────────────────────────────────

INSERT INTO public.users (id, name, student_id, email, role, semester, branch) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Aarav Singh',       '21BCE1001', 'aarav.singh2021@vitbhopal.ac.in',       'student', 6, 'B.Tech CSE'),
  ('b0000000-0000-0000-0000-000000000002', 'Priya Sharma',      '21BCE1002', 'priya.sharma2021@vitbhopal.ac.in',      'student', 6, 'B.Tech CSE'),
  ('b0000000-0000-0000-0000-000000000003', 'Rohan Mehta',       '21ECE1001', 'rohan.mehta2021@vitbhopal.ac.in',       'student', 6, 'B.Tech ECE'),
  ('b0000000-0000-0000-0000-000000000004', 'Sneha Patel',       '22BCE1001', 'sneha.patel2022@vitbhopal.ac.in',       'student', 4, 'B.Tech CSE'),
  ('b0000000-0000-0000-0000-000000000005', 'Karan Joshi',       '22BCE1002', 'karan.joshi2022@vitbhopal.ac.in',       'student', 4, 'B.Tech CSE'),
  ('b0000000-0000-0000-0000-000000000006', 'Ananya Reddy',      '22EEE1001', 'ananya.reddy2022@vitbhopal.ac.in',      'student', 4, 'B.Tech EEE'),
  ('b0000000-0000-0000-0000-000000000007', 'Vikram Tiwari',     '23BCE1001', 'vikram.tiwari2023@vitbhopal.ac.in',     'student', 2, 'B.Tech CSE'),
  ('b0000000-0000-0000-0000-000000000008', 'Deepika Yadav',     '23BCE1002', 'deepika.yadav2023@vitbhopal.ac.in',     'student', 2, 'B.Tech CSE'),
  ('b0000000-0000-0000-0000-000000000009', 'Arjun Nair',        '21ME1001',  'arjun.nair2021@vitbhopal.ac.in',        'student', 6, 'B.Tech ME'),
  ('b0000000-0000-0000-0000-000000000010', 'Pooja Gupta',       '21CE1001',  'pooja.gupta2021@vitbhopal.ac.in',       'student', 6, 'B.Tech CE'),
  ('b0000000-0000-0000-0000-000000000011', 'Nikhil Kumar',      '22ME1001',  'nikhil.kumar2022@vitbhopal.ac.in',      'student', 4, 'B.Tech ME'),
  ('b0000000-0000-0000-0000-000000000012', 'Riya Agarwal',      '22IT1001',  'riya.agarwal2022@vitbhopal.ac.in',      'student', 4, 'B.Tech IT'),
  ('b0000000-0000-0000-0000-000000000013', 'Saurabh Mishra',    '23ECE1001', 'saurabh.mishra2023@vitbhopal.ac.in',    'student', 2, 'B.Tech ECE'),
  ('b0000000-0000-0000-0000-000000000014', 'Ishita Chopra',     '23EEE1001', 'ishita.chopra2023@vitbhopal.ac.in',     'student', 2, 'B.Tech EEE'),
  ('b0000000-0000-0000-0000-000000000015', 'Dr. Admin User',    NULL,        'admin@vitbhopal.ac.in',                  'admin',   NULL, NULL)
ON CONFLICT (id) DO NOTHING;


-- ─── Mock Bookings ─────────────────────────────────────────────
-- Explicit ::UUID and ::INTEGER casts fix the operator mismatch error.

INSERT INTO public.bookings (user_id, slot_id, resource_id, status, qr_token, signed_in_at, signed_out_at, check_in_reminder_sent)
SELECT
  b.user_id::UUID,
  (SELECT s.id FROM public.slots s
   WHERE s.resource_id = b.resource_id::UUID
     AND s.date        = CURRENT_DATE + b.day_offset::INTEGER
     AND s.start_time  = b.start_h::TIME
   LIMIT 1) AS slot_id,
  b.resource_id::UUID,
  b.status::booking_status,
  encode(gen_random_bytes(18), 'hex'),
  CASE WHEN b.status = 'completed'
    THEN (CURRENT_DATE + b.day_offset::INTEGER)::TIMESTAMPTZ + b.start_h::TIME - INTERVAL '5 min'
    ELSE NULL END,
  CASE WHEN b.status = 'completed'
    THEN (CURRENT_DATE + b.day_offset::INTEGER)::TIMESTAMPTZ + b.start_h::TIME + INTERVAL '58 min'
    ELSE NULL END,
  CASE WHEN b.status IN ('completed','no_show') THEN TRUE ELSE FALSE END
FROM (VALUES
  -- Library bookings
  ('b0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 0, '09:00', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 0, '10:00', 'active'),
  ('b0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 0, '11:00', 'active'),
  ('b0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 1, '09:00', 'active'),
  ('b0000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 1, '14:00', 'active'),
  ('b0000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', 2, '10:00', 'active'),
  ('b0000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000001', 2, '15:00', 'cancelled'),
  -- Reading Room bookings
  ('b0000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 0, '08:00', 'active'),
  ('b0000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000002', 0, '09:00', 'active'),
  ('b0000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 1, '10:00', 'active'),
  ('b0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 1, '13:00', 'cancelled'),
  ('b0000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000002', 2, '11:00', 'active'),
  -- Computer Lab A bookings
  ('b0000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000003', 0, '09:00', 'active'),
  ('b0000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000003', 0, '10:00', 'active'),
  ('b0000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000003', 0, '11:00', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', 1, '14:00', 'active'),
  ('b0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 1, '15:00', 'active'),
  ('b0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003', 2, '09:00', 'cancelled'),
  -- Computer Lab B bookings
  ('b0000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000004', 0, '10:00', 'active'),
  ('b0000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000004', 0, '14:00', 'active'),
  ('b0000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000004', 1, '09:00', 'active'),
  ('b0000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000004', 1, '11:00', 'no_show'),
  ('b0000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000004', 2, '13:00', 'active'),
  -- Badminton Court 1 bookings
  ('b0000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000005', 0, '16:00', 'active'),
  ('b0000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000005', 0, '17:00', 'active'),
  ('b0000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000005', 1, '16:00', 'active'),
  ('b0000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000005', 1, '18:00', 'cancelled'),
  ('b0000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000005', 2, '17:00', 'active'),
  -- Badminton Court 2 bookings
  ('b0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006', 0, '15:00', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000006', 0, '16:00', 'active'),
  ('b0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000006', 1, '17:00', 'active'),
  ('b0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000006', 2, '15:00', 'no_show'),
  -- Basketball Court bookings
  ('b0000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000007', 0, '17:00', 'active'),
  ('b0000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000007', 0, '18:00', 'active'),
  ('b0000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000007', 1, '17:00', 'active'),
  ('b0000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000007', 1, '19:00', 'cancelled'),
  ('b0000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000007', 2, '18:00', 'active'),
  ('b0000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000007', 2, '20:00', 'active'),
  ('b0000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000007', 3, '17:00', 'active'),
  ('b0000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000007', 3, '18:00', 'active'),
  ('b0000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000001', 3, '09:00', 'active'),
  ('b0000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000001', 3, '10:00', 'active')
) AS b(user_id, resource_id, day_offset, start_h, status)
WHERE (
  SELECT s.id FROM public.slots s
  WHERE s.resource_id = b.resource_id::UUID
    AND s.date        = CURRENT_DATE + b.day_offset::INTEGER
    AND s.start_time  = b.start_h::TIME
  LIMIT 1
) IS NOT NULL;


-- ─── Sample notifications ─────────────────────────────────────
INSERT INTO public.notifications (user_id, type, message, is_read) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'reminder',         '⏰ Reminder: Your Library booking starts in 30 minutes.',             FALSE),
  ('b0000000-0000-0000-0000-000000000002', 'reminder',         '⏰ Reminder: Computer Lab A booking at 10:00 AM starts soon.',        FALSE),
  ('b0000000-0000-0000-0000-000000000003', 'alert',            '⚠️ Your Reading Room booking was cancelled due to inactivity.',       TRUE),
  ('b0000000-0000-0000-0000-000000000005', 'underutilization', '📊 Badminton Court 1 is less than 25% booked tomorrow. Book now!',   FALSE),
  ('b0000000-0000-0000-0000-000000000007', 'reminder',         '⏰ Basketball Court booking at 5:00 PM — don''t forget!',            FALSE)
ON CONFLICT DO NOTHING;
