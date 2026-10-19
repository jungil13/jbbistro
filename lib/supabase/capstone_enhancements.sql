-- ============================================================
-- JBENZ BISTRO: CAPSTONE ENHANCEMENTS & BUG FIXES SCHEMA
-- Idempotent script for stock, promotions, reviews & permissions
-- ============================================================

-- 1. MENU STOCK MANAGEMENT
-- Add stock column to menu_items if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'menu_items' 
      AND column_name = 'stock'
  ) THEN
    ALTER TABLE public.menu_items ADD COLUMN stock INTEGER NOT NULL DEFAULT 50 CHECK (stock >= 0);
  END IF;
END $$;

-- 2. PROMOTION CLAIMS TABLE
CREATE TABLE IF NOT EXISTS public.promotion_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id TEXT NOT NULL,
  promotion_title TEXT NOT NULL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'used')),
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(promotion_id, customer_id)
);

-- Indexes for promotion claims
CREATE INDEX IF NOT EXISTS idx_promo_claims_customer ON public.promotion_claims(customer_id);
CREATE INDEX IF NOT EXISTS idx_promo_claims_status ON public.promotion_claims(status);

-- 3. CUSTOMER RATINGS ENHANCEMENTS
-- Add customer_id and reservation_id to customer_ratings if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'customer_ratings' 
      AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.customer_ratings ADD COLUMN customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'customer_ratings' 
      AND column_name = 'reservation_id'
  ) THEN
    ALTER TABLE public.customer_ratings ADD COLUMN reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'customer_ratings' 
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.customer_ratings ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. ANNOUNCEMENTS EXPIRATION DATE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'announcements' 
      AND column_name = 'valid_until'
  ) THEN
    ALTER TABLE public.announcements ADD COLUMN valid_until DATE;
  END IF;
END $$;

-- 5. ENABLE REALTIME FOR PROMOTION CLAIMS
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE promotion_claims;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. DISABLE RLS ON NEW TABLES TO AVOID RECURSION ISSUES
ALTER TABLE public.promotion_claims DISABLE ROW LEVEL SECURITY;
