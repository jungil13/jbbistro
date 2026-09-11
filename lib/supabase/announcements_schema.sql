-- ============================================================
-- ANNOUNCEMENTS & PROMOTIONS SUPABASE TABLE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'announcement' CHECK (type IN ('announcement', 'promotion')),
  title TEXT NOT NULL,
  badge TEXT,
  description TEXT,
  image_url TEXT,
  validity TEXT,
  link_url TEXT DEFAULT '/reserve',
  link_text TEXT DEFAULT 'Claim Offer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_banner BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Allow anyone to read active announcements
DROP POLICY IF EXISTS "Public can view active announcements" ON public.announcements;
CREATE POLICY "Public can view active announcements"
  ON public.announcements
  FOR SELECT
  USING (true);

-- Allow authenticated admins and managers to insert, update, delete
DROP POLICY IF EXISTS "Admins and managers can manage announcements" ON public.announcements;
CREATE POLICY "Admins and managers can manage announcements"
  ON public.announcements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- Service role bypasses RLS automatically.

-- 4. Enable Supabase Realtime for announcements
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;

-- 5. Seed initial announcement and promotion data
INSERT INTO public.announcements (type, title, badge, description, image_url, validity, link_url, link_text, is_active, show_banner, sort_order)
VALUES
  (
    'announcement',
    'Special Weekend Announcement',
    'Notice',
    'Special Promo: 20% Off All VIP Karaoke Suites this Weekend! Free Pulutan Platter with every booking.',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80',
    'This Weekend Only',
    '/reserve',
    'View Announcement',
    true,
    true,
    1
  ),
  (
    'promotion',
    'Weekend VIP Karaoke & Pulutan Fiesta',
    'Exclusive Promo',
    'Book any VIP Karaoke Suite or Dining Table this Friday through Sunday and enjoy 20% off your booking, plus a complimentary signature Pulutan Platter and drinks on the house!',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80',
    'Every Fri - Sun • 5:00 PM to Midnight',
    '/reserve',
    'Claim This Offer',
    true,
    false,
    2
  )
ON CONFLICT DO NOTHING;
