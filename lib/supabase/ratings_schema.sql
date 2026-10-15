-- ============================================================
-- CUSTOMER RATINGS & REVIEWS SUPABASE TABLE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.customer_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'Fine Dining',
  is_verified BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure default is 'pending' even if table already existed
ALTER TABLE public.customer_ratings ALTER COLUMN status SET DEFAULT 'pending';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_ratings_created_at ON public.customer_ratings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_ratings_status ON public.customer_ratings(status);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.customer_ratings ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Allow anyone to view approved customer ratings
DROP POLICY IF EXISTS "Public can view approved customer ratings" ON public.customer_ratings;
CREATE POLICY "Public can view approved customer ratings"
  ON public.customer_ratings
  FOR SELECT
  USING (status = 'approved');

-- Allow anyone to submit a rating
DROP POLICY IF EXISTS "Public can submit customer rating" ON public.customer_ratings;
CREATE POLICY "Public can submit customer rating"
  ON public.customer_ratings
  FOR INSERT
  WITH CHECK (true);

-- Allow admins and managers full access (view all, update, delete)
DROP POLICY IF EXISTS "Admins and managers can manage customer ratings" ON public.customer_ratings;
CREATE POLICY "Admins and managers can manage customer ratings"
  ON public.customer_ratings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'staff')
    )
  );

-- 4. Enable Supabase Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE customer_ratings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Seed initial customer ratings
INSERT INTO public.customer_ratings (name, rating, comment, service_type, is_verified, status, created_at)
VALUES
  (
    'Maria Santos',
    5,
    'Celebrated my 30th birthday in their VIP Karaoke Suite! The sound system is top-notch, the mood lighting is fantastic, and the pulutan platter kept coming hot and delicious. Highly recommended!',
    'VIP Karaoke Suite',
    true,
    'approved',
    NOW() - INTERVAL '1 day'
  ),
  (
    'Chef Alejandro D.',
    5,
    'The steaks and wine selection exceeded our expectations. Beautiful intimate dining atmosphere right here in Liloan. The staff made us feel like royalty from start to finish.',
    'Fine Dining & Wine',
    true,
    'approved',
    NOW() - INTERVAL '2 days'
  ),
  (
    'Carlos Mendoza',
    5,
    'Best billiard tables in the area! Professional-grade slate, perfectly leveled, and the craft cocktails served right at the table made for an unforgettable Friday night leisure session.',
    'Billiards Lounge',
    true,
    'approved',
    NOW() - INTERVAL '3 days'
  ),
  (
    'Kristine & Dave',
    5,
    'Booked a dinner and karaoke combo for our anniversary. The ambiance was romantic, the food was exquisite, and the service was genuinely warm. Jbenz Bistro is a true hidden gem in Cebu!',
    'Dining & Karaoke Combo',
    true,
    'approved',
    NOW() - INTERVAL '4 days'
  ),
  (
    'Jayson Tan',
    5,
    'Very accommodating staff, super clean facilities, and the acoustic treatment in the karaoke rooms means you get punchy, crystal-clear vocals without noise bleeds. 10/10 experience.',
    'VIP Karaoke Suite',
    true,
    'approved',
    NOW() - INTERVAL '5 days'
  ),
  (
    'Bea Gomez',
    5,
    'Loved the signature crispy pata and cold local craft beers. Great spot to unwind after a long work week with colleagues. We will definitely be regular diners here!',
    'Pulutan & Beverages',
    true,
    'approved',
    NOW() - INTERVAL '6 days'
  )
ON CONFLICT DO NOTHING;
