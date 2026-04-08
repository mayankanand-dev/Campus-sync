-- ============================================================
-- CampusSync — Demo Reset SQL
-- Run before hackathon demo to set up realistic data
-- ============================================================

-- 1. Reset all today's bookings for demo resources
UPDATE public.bookings SET status = 'cancelled'
WHERE slot_id IN (
  SELECT id FROM public.slots WHERE date = CURRENT_DATE
) AND status = 'active';

-- 2. Make Computer Lab A look "filling up" (~70% booked)
-- Find all today's Computer Lab A slots and set booked_seats = 21 out of 30
UPDATE public.slots
SET booked_seats = 21
WHERE resource_id = 'a1000000-0000-0000-0000-000000000003'
  AND date = CURRENT_DATE;

-- 3. Make Reading Room look "almost full" (~90% booked)
UPDATE public.slots
SET booked_seats = 36
WHERE resource_id = 'a1000000-0000-0000-0000-000000000002'
  AND date = CURRENT_DATE;

-- 4. Make Basketball Court look "available" (~20% booked)
UPDATE public.slots
SET booked_seats = 2
WHERE resource_id = 'a1000000-0000-0000-0000-000000000007'
  AND date = CURRENT_DATE;

-- 5. Create 2 active bookings for demo user (b0000000-0000-0000-0000-000000000001)
-- Booking 1: Library, current hour
INSERT INTO public.bookings (user_id, slot_id, resource_id, status, qr_token)
SELECT
  'b0000000-0000-0000-0000-000000000001',
  s.id,
  s.resource_id,
  'active',
  'DEMO-QR-' || encode(gen_random_bytes(12), 'hex')
FROM public.slots s
WHERE s.resource_id = 'a1000000-0000-0000-0000-000000000001'
  AND s.date = CURRENT_DATE
  AND s.start_time = make_time(EXTRACT(HOUR FROM NOW())::INTEGER, 0, 0)
LIMIT 1
ON CONFLICT DO NOTHING;

-- Booking 2: Computer Lab B, next hour
INSERT INTO public.bookings (user_id, slot_id, resource_id, status, qr_token)
SELECT
  'b0000000-0000-0000-0000-000000000001',
  s.id,
  s.resource_id,
  'active',
  'DEMO-QR-' || encode(gen_random_bytes(12), 'hex')
FROM public.slots s
WHERE s.resource_id = 'a1000000-0000-0000-0000-000000000004'
  AND s.date = CURRENT_DATE
  AND s.start_time = make_time((EXTRACT(HOUR FROM NOW())::INTEGER + 1) % 24, 0, 0)
LIMIT 1
ON CONFLICT DO NOTHING;

-- 6. Create underutilization alerts for admin
DELETE FROM public.notifications WHERE type = 'underutilization';
INSERT INTO public.notifications (user_id, type, message, is_read) VALUES
  ('b0000000-0000-0000-0000-000000000015', 'underutilization', '📊 Badminton Court 2: only 1/4 slots booked for next 3 hours.', FALSE),
  ('b0000000-0000-0000-0000-000000000015', 'underutilization', '📊 Basketball Court: 2/10 booked for 5–7 PM slots.', FALSE),
  ('b0000000-0000-0000-0000-000000000015', 'underutilization', '📊 Computer Lab A: Friday afternoon slots under-utilized (<30%).', FALSE);

-- 7. No-show alert for Badminton Court 1
INSERT INTO public.notifications (user_id, type, message, is_read) VALUES
  ('b0000000-0000-0000-0000-000000000015', 'alert', '⚠️ Badminton Court 1: 2 no-shows in the last hour. Consider grace period policy.', FALSE);
