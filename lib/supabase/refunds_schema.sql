-- ==============================================================================
-- JBENZ BISTRO: PAYMONGO REFUND SYSTEM SCHEMA MIGRATION
-- Run this migration in the Supabase SQL Editor (Dashboard -> SQL Editor)
-- ==============================================================================

-- 1. Ensure payments status constraint allows 'refunded' and 'partially_refunded'
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check 
  CHECK (status IN ('pending', 'verified', 'rejected', 'refunded', 'partially_refunded'));

-- 2. Create the official 'refunds' audit trail table
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  paymongo_payment_id TEXT NOT NULL,
  paymongo_refund_id TEXT UNIQUE,
  amount NUMERIC(10, 2) NOT NULL,
  amount_centavos BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  reason TEXT NOT NULL CHECK (reason IN ('duplicate', 'fraudulent', 'requested_by_customer', 'others')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_email TEXT,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for high performance, reporting, and idempotency lookups
CREATE INDEX IF NOT EXISTS idx_refunds_reservation_id ON public.refunds(reservation_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON public.refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_paymongo_payment_id ON public.refunds(paymongo_payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_paymongo_refund_id ON public.refunds(paymongo_refund_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON public.refunds(created_at DESC);

-- Publish refund updates so customer and admin views can stay current in real time.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.refunds;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Policy A: Admins and Managers have full visibility over refund logs
DROP POLICY IF EXISTS "Admins and Managers can view all refunds" ON public.refunds;
CREATE POLICY "Admins and Managers can view all refunds"
  ON public.refunds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')
    )
  );

-- Policy B: Customers can only view refunds belonging to their own reservations
DROP POLICY IF EXISTS "Customers can view their own refunds" ON public.refunds;
CREATE POLICY "Customers can view their own refunds"
  ON public.refunds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = refunds.reservation_id AND r.customer_id = auth.uid()
    )
  );

-- Policy C: Disallow direct client-side insertions or updates.
-- The Next.js server actions use the service role key which bypasses RLS securely.
