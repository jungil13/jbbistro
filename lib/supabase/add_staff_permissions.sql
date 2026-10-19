-- ============================================================
-- JBENZ BISTRO: ADD STAFF MODULE PERMISSIONS (MESSAGES, PROMOTIONS, ANNOUNCEMENTS)
-- Run this in your Supabase SQL Editor (Click 'Run')
-- ============================================================

ALTER TABLE public.staff_permissions 
ADD COLUMN IF NOT EXISTS can_messages BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_promotions BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_announcements BOOLEAN DEFAULT false;
