-- Run after the core schema and the existing refunds_schema.sql migration.
-- All mutations are performed through SECURITY DEFINER RPCs exposed only to service_role.

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'verified', 'paid', 'rejected', 'refunded', 'partially_refunded'));

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  paymongo_payment_id TEXT NOT NULL,
  amount_centavos BIGINT NOT NULL CHECK (amount_centavos > 0),
  reason TEXT NOT NULL CHECK (reason IN ('duplicate', 'fraudulent', 'requested_by_customer', 'others')),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 500),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'rejected', 'processing', 'pending', 'completed', 'failed', 'ambiguous')),
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_notes TEXT,
  provider_refund_id TEXT UNIQUE,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  CHECK (status <> 'rejected' OR length(trim(COALESCE(admin_notes, ''))) > 0)
);

ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.refund_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_request_id
  ON public.refunds(request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_idempotency_key
  ON public.refunds(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refund_requests_customer_created
  ON public.refund_requests(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status_created
  ON public.refund_requests(status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_requests_one_active_per_payment
  ON public.refund_requests(payment_id)
  WHERE status IN ('requested', 'approved', 'processing', 'pending', 'ambiguous');

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers read their refund requests" ON public.refund_requests;
CREATE POLICY "Customers read their refund requests"
  ON public.refund_requests FOR SELECT TO authenticated
  USING (customer_id = auth.uid());
DROP POLICY IF EXISTS "Admins read refund requests" ON public.refund_requests;
CREATE POLICY "Admins read refund requests"
  ON public.refund_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager') AND p.status = 'active'
    )
  );
REVOKE INSERT, UPDATE, DELETE ON public.refund_requests FROM anon, authenticated;
GRANT SELECT ON public.refund_requests TO authenticated;

DROP POLICY IF EXISTS "Customers read payments for their reservations" ON public.payments;
CREATE POLICY "Customers read payments for their reservations"
  ON public.payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = payments.reservation_id AND r.customer_id = auth.uid()
    )
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.refund_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.refunds;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS event_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_event_key
  ON public.notifications(event_key) WHERE event_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_refund_request(
  p_reservation_id UUID,
  p_payment_id UUID,
  p_customer_id UUID,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reservation public.reservations%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_request public.refund_requests%ROWTYPE;
  v_amount_centavos BIGINT;
  v_refunded_centavos BIGINT;
BEGIN
  IF p_reason NOT IN ('duplicate', 'fraudulent', 'requested_by_customer', 'others')
     OR length(COALESCE(p_notes, '')) > 500 THEN
    RAISE EXCEPTION 'invalid_refund_request';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_customer_id AND role = 'customer' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'customer_not_authorized';
  END IF;

  SELECT * INTO v_reservation
  FROM public.reservations
  WHERE id = p_reservation_id AND customer_id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation_not_owned';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id AND reservation_id = p_reservation_id
  FOR UPDATE;
  IF NOT FOUND
     OR v_payment.status NOT IN ('verified', 'paid')
     OR left(COALESCE(v_payment.reference_number, ''), 4) <> 'pay_' THEN
    RAISE EXCEPTION 'payment_not_eligible';
  END IF;

  v_amount_centavos := round(COALESCE(v_payment.amount, 0) * 100)::BIGINT;
  IF v_amount_centavos <= 0 THEN
    RAISE EXCEPTION 'payment_not_eligible';
  END IF;

  SELECT COALESCE(sum(amount_centavos), 0)::BIGINT INTO v_refunded_centavos
  FROM public.refunds
  WHERE payment_id = p_payment_id
    AND status IN ('pending', 'processing', 'succeeded');
  IF v_refunded_centavos + v_amount_centavos > v_amount_centavos THEN
    RAISE EXCEPTION 'payment_not_eligible';
  END IF;

  INSERT INTO public.refund_requests (
    reservation_id, payment_id, customer_id, paymongo_payment_id,
    amount_centavos, reason, notes
  )
  VALUES (
    p_reservation_id, p_payment_id, p_customer_id, v_payment.reference_number,
    v_amount_centavos, p_reason, NULLIF(trim(p_notes), '')
  )
  RETURNING * INTO v_request;

  INSERT INTO public.notifications (user_id, type, title, message, read, event_key)
  VALUES (
    p_customer_id,
    'payment',
    'Refund request submitted',
    format('Your refund request for reservation #%s is pending review.', COALESCE(v_reservation.reservation_code, left(v_reservation.id::TEXT, 8))),
    false,
    'refund:' || v_request.id::TEXT || ':requested'
  )
  ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING;

  RETURN to_jsonb(v_request);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'refund_request_already_active';
END;
$$;

CREATE OR REPLACE FUNCTION public.review_refund_request(
  p_request_id UUID,
  p_admin_id UUID,
  p_approve BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.refund_requests%ROWTYPE;
  v_reservation_code TEXT;
  v_status TEXT;
  v_reason TEXT := trim(COALESCE(p_rejection_reason, ''));
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_admin_id AND role IN ('admin', 'manager') AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'admin_not_authorized';
  END IF;
  IF NOT p_approve AND (length(v_reason) = 0 OR length(v_reason) > 500) THEN
    RAISE EXCEPTION 'rejection_reason_required';
  END IF;

  SELECT * INTO v_request
  FROM public.refund_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'requested' THEN
    RAISE EXCEPTION 'refund_request_not_pending';
  END IF;

  v_status := CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
  UPDATE public.refund_requests
  SET status = v_status,
      admin_id = p_admin_id,
      admin_notes = CASE WHEN p_approve THEN NULL ELSE v_reason END,
      decided_at = now(),
      updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  SELECT reservation_code INTO v_reservation_code
  FROM public.reservations WHERE id = v_request.reservation_id;

  INSERT INTO public.notifications (user_id, type, title, message, read, event_key)
  VALUES (
    v_request.customer_id,
    CASE WHEN p_approve THEN 'payment' ELSE 'warning' END,
    CASE WHEN p_approve THEN 'Refund request approved' ELSE 'Refund request rejected' END,
    CASE WHEN p_approve
      THEN format('Your refund request for reservation #%s was approved. The refund has not yet been processed.', COALESCE(v_reservation_code, left(v_request.reservation_id::TEXT, 8)))
      ELSE format('Your refund request for reservation #%s was rejected: %s', COALESCE(v_reservation_code, left(v_request.reservation_id::TEXT, 8)), v_reason)
    END,
    false,
    'refund:' || v_request.id::TEXT || ':' || v_status
  )
  ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING;

  RETURN to_jsonb(v_request);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_refund_for_processing(
  p_request_id UUID,
  p_admin_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.refund_requests%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_admin_email TEXT;
  v_used_centavos BIGINT;
  v_available_centavos BIGINT;
  v_idempotency_key TEXT;
  v_refund public.refunds%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_admin_id AND role IN ('admin', 'manager') AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'admin_not_authorized';
  END IF;

  SELECT * INTO v_request
  FROM public.refund_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'approved' THEN
    RAISE EXCEPTION 'refund_request_not_approved';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = v_request.payment_id AND reservation_id = v_request.reservation_id
  FOR UPDATE;
  IF NOT FOUND OR v_payment.status NOT IN ('verified', 'paid')
     OR v_payment.reference_number <> v_request.paymongo_payment_id THEN
    RAISE EXCEPTION 'payment_not_eligible';
  END IF;

  v_available_centavos := round(COALESCE(v_payment.amount, 0) * 100)::BIGINT;
  SELECT COALESCE(sum(amount_centavos), 0)::BIGINT INTO v_used_centavos
  FROM public.refunds
  WHERE payment_id = v_payment.id
    AND status IN ('pending', 'processing', 'succeeded');
  IF v_request.amount_centavos <= 0
     OR v_request.amount_centavos + v_used_centavos > v_available_centavos THEN
    RAISE EXCEPTION 'refund_exceeds_remaining_balance';
  END IF;

  SELECT email INTO v_admin_email FROM public.profiles WHERE id = p_admin_id;
  v_idempotency_key := 'refund-request-' || v_request.id::TEXT;
  INSERT INTO public.refunds (
    reservation_id, payment_id, paymongo_payment_id, amount, amount_centavos,
    currency, reason, notes, status, admin_id, admin_email, request_id,
    idempotency_key
  )
  VALUES (
    v_request.reservation_id, v_request.payment_id, v_request.paymongo_payment_id,
    v_request.amount_centavos::NUMERIC / 100, v_request.amount_centavos,
    'PHP', v_request.reason, v_request.notes, 'processing', p_admin_id,
    v_admin_email, v_request.id, v_idempotency_key
  )
  RETURNING * INTO v_refund;

  UPDATE public.refund_requests
  SET status = 'processing', admin_id = p_admin_id, updated_at = now()
  WHERE id = v_request.id;

  RETURN jsonb_build_object(
    'id', v_request.id,
    'refund_id', v_refund.id,
    'idempotency_key', v_idempotency_key,
    'paymongo_payment_id', v_request.paymongo_payment_id,
    'amount_centavos', v_request.amount_centavos,
    'reason', v_request.reason,
    'notes', v_request.notes,
    'customer_id', v_request.customer_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_refund_attempt(
  p_request_id UUID,
  p_provider_refund_id TEXT,
  p_provider_status TEXT,
  p_failure_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.refund_requests%ROWTYPE;
  v_refund public.refunds%ROWTYPE;
  v_new_request_status TEXT;
  v_new_refund_status TEXT;
  v_reservation_code TEXT;
BEGIN
  SELECT * INTO v_request
  FROM public.refund_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'refund_request_not_found';
  END IF;

  SELECT * INTO v_refund
  FROM public.refunds
  WHERE request_id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'refund_attempt_not_found';
  END IF;

  IF v_request.status = 'completed' THEN
    RETURN jsonb_build_object('status', v_request.status);
  END IF;

  IF p_provider_refund_id IS NOT NULL
     AND (left(p_provider_refund_id, 4) <> 'ref_' OR length(p_provider_refund_id) > 100) THEN
    RAISE EXCEPTION 'invalid_provider_refund_id';
  END IF;
  IF p_provider_status NOT IN ('succeeded', 'pending', 'processing', 'failed', 'ambiguous') THEN
    RAISE EXCEPTION 'invalid_provider_refund_status';
  END IF;

  IF p_provider_status = 'succeeded' THEN
    v_new_request_status := 'completed';
    v_new_refund_status := 'succeeded';
  ELSIF p_provider_status = 'failed' THEN
    v_new_request_status := 'failed';
    v_new_refund_status := 'failed';
  ELSIF p_provider_status = 'ambiguous' THEN
    v_new_request_status := 'ambiguous';
    v_new_refund_status := 'pending';
  ELSE
    v_new_request_status := 'pending';
    v_new_refund_status := 'processing';
  END IF;

  UPDATE public.refunds
  SET paymongo_refund_id = COALESCE(p_provider_refund_id, paymongo_refund_id),
      status = v_new_refund_status,
      failure_reason = p_failure_reason,
      metadata = COALESCE(p_metadata, '{}'::JSONB),
      updated_at = now()
  WHERE id = v_refund.id;

  UPDATE public.refund_requests
  SET provider_refund_id = COALESCE(p_provider_refund_id, provider_refund_id),
      status = v_new_request_status,
      failure_reason = p_failure_reason,
      updated_at = now()
  WHERE id = v_request.id;

  IF v_new_request_status = 'completed' THEN
    UPDATE public.payments SET status = 'refunded' WHERE id = v_request.payment_id;
    UPDATE public.reservations SET status = 'cancelled' WHERE id = v_request.reservation_id;
  END IF;

  IF v_new_request_status IN ('completed', 'failed') THEN
    SELECT reservation_code INTO v_reservation_code
    FROM public.reservations WHERE id = v_request.reservation_id;
    INSERT INTO public.notifications (user_id, type, title, message, read, event_key)
    VALUES (
      v_request.customer_id,
      CASE WHEN v_new_request_status = 'completed' THEN 'success' ELSE 'error' END,
      CASE WHEN v_new_request_status = 'completed' THEN 'Refund completed' ELSE 'Refund failed' END,
      CASE WHEN v_new_request_status = 'completed'
        THEN format('Your refund for reservation #%s is confirmed by PayMongo.', COALESCE(v_reservation_code, left(v_request.reservation_id::TEXT, 8)))
        ELSE format('Your refund for reservation #%s could not be completed. Please contact the bistro for assistance.', COALESCE(v_reservation_code, left(v_request.reservation_id::TEXT, 8)))
      END,
      false,
      'refund:' || v_request.id::TEXT || ':' || v_new_request_status
    )
    ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING;
  END IF;

  RETURN jsonb_build_object('status', v_new_request_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_paymongo_refund_webhook(
  p_provider_refund_id TEXT,
  p_paymongo_payment_id TEXT,
  p_amount_centavos BIGINT,
  p_currency TEXT,
  p_provider_status TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_refund public.refunds%ROWTYPE;
  v_request public.refund_requests%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_status TEXT := lower(COALESCE(p_provider_status, ''));
BEGIN
  IF left(COALESCE(p_provider_refund_id, ''), 4) <> 'ref_'
     OR left(COALESCE(p_paymongo_payment_id, ''), 4) <> 'pay_'
     OR p_amount_centavos <= 0
     OR upper(COALESCE(p_currency, '')) <> 'PHP'
     OR v_status NOT IN ('succeeded', 'pending', 'processing', 'failed') THEN
    RAISE EXCEPTION 'invalid_refund_webhook_data';
  END IF;

  SELECT * INTO v_refund
  FROM public.refunds
  WHERE paymongo_refund_id = p_provider_refund_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('matched', false);
  END IF;
  IF v_refund.paymongo_payment_id <> p_paymongo_payment_id
     OR v_refund.amount_centavos <> p_amount_centavos THEN
    RAISE EXCEPTION 'refund_webhook_mismatch';
  END IF;

  IF v_refund.request_id IS NOT NULL THEN
    SELECT * INTO v_request
    FROM public.refund_requests WHERE id = v_refund.request_id;
    PERFORM public.finish_refund_attempt(
      v_request.id, p_provider_refund_id, v_status, NULL, p_metadata
    );
    RETURN jsonb_build_object(
      'matched', true,
      'request_id', v_request.id,
      'customer_id', v_request.customer_id,
      'reservation_id', v_request.reservation_id,
      'status', v_status
    );
  END IF;

  UPDATE public.refunds
  SET status = CASE WHEN v_status = 'succeeded' THEN 'succeeded'
                    WHEN v_status = 'failed' THEN 'failed'
                    ELSE 'processing' END,
      metadata = COALESCE(p_metadata, '{}'::JSONB),
      updated_at = now()
  WHERE id = v_refund.id;

  IF v_status = 'succeeded' THEN
    UPDATE public.payments SET status = 'refunded' WHERE id = v_refund.payment_id;
    UPDATE public.reservations SET status = 'cancelled' WHERE id = v_refund.reservation_id;
  END IF;
  RETURN jsonb_build_object('matched', true, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.create_refund_request(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_refund_request(UUID, UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_refund_for_processing(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_refund_attempt(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_paymongo_refund_webhook(TEXT, TEXT, BIGINT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_refund_request(UUID, UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_refund_request(UUID, UUID, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_refund_for_processing(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_refund_attempt(UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_paymongo_refund_webhook(TEXT, TEXT, BIGINT, TEXT, TEXT, JSONB) TO service_role;
