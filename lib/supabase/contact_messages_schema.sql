-- ============================================================
-- CONTACT MESSAGES SUPABASE TABLE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT DEFAULT 'General Inquiry',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON public.contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages(status);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Allow anyone (public/customer) to submit contact forms
DROP POLICY IF EXISTS "Public can submit contact messages" ON public.contact_messages;
CREATE POLICY "Public can submit contact messages"
  ON public.contact_messages
  FOR INSERT
  WITH CHECK (true);

-- Allow admins, managers, and staff to view contact messages
DROP POLICY IF EXISTS "Admins and staff can view contact messages" ON public.contact_messages;
CREATE POLICY "Admins and staff can view contact messages"
  ON public.contact_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'staff')
    )
  );

-- Allow admins and managers to update contact messages (change status)
DROP POLICY IF EXISTS "Admins and staff can update contact messages" ON public.contact_messages;
CREATE POLICY "Admins and staff can update contact messages"
  ON public.contact_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'staff')
    )
  );

-- Allow admins and managers to delete contact messages
DROP POLICY IF EXISTS "Admins and staff can delete contact messages" ON public.contact_messages;
CREATE POLICY "Admins and staff can delete contact messages"
  ON public.contact_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- 4. Enable Supabase Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE contact_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

