 -- ============================================================
-- JBENZ BISTRO: PROMOTION MANAGEMENT SYSTEM SCHEMA
-- Five Promotion Types: Percentage, Fixed Amount, Bundle, Happy Hour, Birthday
-- ============================================================

-- 1. PROMOTIONS TABLE
CREATE TABLE IF NOT EXISTS public.promotions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount', 'bundle', 'happy_hour', 'birthday')),
  description TEXT,
  terms TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'scheduled', 'active', 'expired', 'inactive')),
  start_date DATE,
  end_date DATE,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  min_spend NUMERIC(10,2) DEFAULT 0,
  bundle_price NUMERIC(10,2) DEFAULT 0,
  bundle_items JSONB DEFAULT '[]'::jsonb,
  eligible_menu_item_ids JSONB DEFAULT '[]'::jsonb,
  eligible_categories JSONB DEFAULT '[]'::jsonb,
  applicable_days JSONB DEFAULT '[0,1,2,3,4,5,6]'::jsonb,
  start_time TEXT,
  end_time TEXT,
  birthday_reward_item_id TEXT,
  birthday_reward_name TEXT,
  birthday_window_days INTEGER DEFAULT 7,
  max_total_redemptions INTEGER,
  max_per_customer INTEGER DEFAULT 1,
  current_redemptions_count INTEGER DEFAULT 0,
  allow_stacking BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on type and status
CREATE INDEX IF NOT EXISTS idx_promotions_type ON public.promotions(type);
CREATE INDEX IF NOT EXISTS idx_promotions_status ON public.promotions(status);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(is_active);

-- 2. PROMOTION REDEMPTIONS TABLE (Audit log of all redeemed promotions)
CREATE TABLE IF NOT EXISTS public.promotion_redemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id TEXT NOT NULL,
  promotion_name TEXT NOT NULL,
  promotion_type TEXT NOT NULL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  order_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  reward_details JSONB,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  processed_by TEXT,
  verified_birthday BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_promo ON public.promotion_redemptions(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_customer ON public.promotion_redemptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_order ON public.promotion_redemptions(order_id);

-- 3. DISABLE RLS ON PROMOTION TABLES TO PREVENT RECURSION
ALTER TABLE public.promotions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_redemptions DISABLE ROW LEVEL SECURITY;

-- 4. ENABLE REALTIME
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE promotions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
