-- ============================================================
-- CampusSync — Migration 002: Booking RPC functions
-- Run this AFTER 001_init.sql in Supabase SQL Editor
-- ============================================================

/**
 * book_slot(p_user_id, p_slot_id, p_resource_id, p_seats)
 * Atomically:
 *   1. Checks booked_seats + p_seats <= total_seats
 *   2. Inserts booking row
 *   3. Returns the new booking id + qr_token
 */
CREATE OR REPLACE FUNCTION public.book_slot(
  p_user_id    UUID,
  p_slot_id    UUID,
  p_resource_id UUID,
  p_seats      INTEGER DEFAULT 1
)
RETURNS TABLE(booking_id UUID, qr_token TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total    INTEGER;
  v_booked   INTEGER;
  v_token    TEXT;
  v_id       UUID;
BEGIN
  -- Lock the slot row
  SELECT total_seats, booked_seats
    INTO v_total, v_booked
    FROM public.slots
   WHERE id = p_slot_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;

  IF v_booked + p_seats > v_total THEN
    RAISE EXCEPTION 'Not enough seats available (% remaining)', (v_total - v_booked);
  END IF;

  -- Generate unique token
  v_token := encode(gen_random_bytes(24), 'hex');

  -- Insert booking (trigger will handle booked_seats increment)
  INSERT INTO public.bookings (user_id, slot_id, resource_id, status, qr_token)
  VALUES (p_user_id, p_slot_id, p_resource_id, 'active', v_token)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_token;
END;
$$;

/**
 * cancel_booking(p_booking_id, p_user_id)
 * Safely cancels a booking (only if active and owned by user).
 */
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id UUID,
  p_user_id    UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.bookings
     SET status = 'cancelled'
   WHERE id = p_booking_id
     AND user_id = p_user_id
     AND status = 'active';

  RETURN FOUND;
END;
$$;

/**
 * checkin_booking(p_qr_token, p_admin_id)
 * Validates QR token ± 15-minute window and sets signed_in_at.
 */
CREATE OR REPLACE FUNCTION public.checkin_booking(
  p_qr_token TEXT
)
RETURNS TABLE(
  ok BOOLEAN,
  message TEXT,
  booking_id UUID,
  user_name TEXT,
  resource_name TEXT,
  slot_start TIME,
  slot_end TIME,
  slot_date DATE
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking   public.bookings%ROWTYPE;
  v_slot      public.slots%ROWTYPE;
  v_resource  public.resources%ROWTYPE;
  v_user      public.users%ROWTYPE;
  v_now_time  TIME := NOW()::TIME;
  v_now_date  DATE := NOW()::DATE;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE qr_token = p_qr_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Invalid QR code', NULL::UUID, NULL, NULL, NULL::TIME, NULL::TIME, NULL::DATE;
    RETURN;
  END IF;

  IF v_booking.status <> 'active' THEN
    RETURN QUERY SELECT FALSE, 'Booking is ' || v_booking.status::TEXT, v_booking.id, NULL, NULL, NULL::TIME, NULL::TIME, NULL::DATE;
    RETURN;
  END IF;

  SELECT * INTO v_slot FROM public.slots WHERE id = v_booking.slot_id;
  SELECT * INTO v_resource FROM public.resources WHERE id = v_booking.resource_id;
  SELECT * INTO v_user FROM public.users WHERE id = v_booking.user_id;

  -- Date check
  IF v_slot.date <> v_now_date THEN
    RETURN QUERY SELECT FALSE, 'This booking is for ' || v_slot.date::TEXT, v_booking.id, v_user.name, v_resource.name, v_slot.start_time, v_slot.end_time, v_slot.date;
    RETURN;
  END IF;

  -- ±15 min window
  IF v_now_time < (v_slot.start_time - INTERVAL '15 minutes') OR
     v_now_time > (v_slot.end_time + INTERVAL '15 minutes') THEN
    RETURN QUERY SELECT FALSE, 'Outside slot window (±15 min)', v_booking.id, v_user.name, v_resource.name, v_slot.start_time, v_slot.end_time, v_slot.date;
    RETURN;
  END IF;

  -- Sign in (if not already)
  IF v_booking.signed_in_at IS NULL THEN
    UPDATE public.bookings SET signed_in_at = NOW() WHERE id = v_booking.id;
  END IF;

  RETURN QUERY SELECT TRUE, 'Check-in successful', v_booking.id, v_user.name, v_resource.name, v_slot.start_time, v_slot.end_time, v_slot.date;
END;
$$;

/**
 * checkout_booking(p_qr_token)
 * Sets signed_out_at and status='completed'.
 */
CREATE OR REPLACE FUNCTION public.checkout_booking(p_qr_token TEXT)
RETURNS TABLE(ok BOOLEAN, message TEXT, booking_id UUID)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE qr_token = p_qr_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Invalid QR code', NULL::UUID;
    RETURN;
  END IF;

  IF v_booking.status <> 'active' THEN
    RETURN QUERY SELECT FALSE, 'Booking already ' || v_booking.status::TEXT, v_booking.id;
    RETURN;
  END IF;

  UPDATE public.bookings
     SET signed_out_at = NOW(), status = 'completed'
   WHERE id = v_booking.id;

  RETURN QUERY SELECT TRUE, 'Check-out successful', v_booking.id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.book_slot(UUID, UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_booking(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_booking(TEXT) TO authenticated;
