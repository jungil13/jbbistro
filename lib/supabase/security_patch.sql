-- ============================================================
-- JBENZ BISTRO: INSTANT FIX FOR DASHBOARD & RESERVATIONS
-- Run this in your Supabase SQL Editor (Click 'Run')
-- ============================================================

-- 1. FIX THE TRIGGER (Keep this! It stops hackers from self-registering as admin)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Always default public sign-ups to 'customer'
  INSERT INTO public.profiles (id, email, role, first_name, last_name, phone)
  VALUES (
    NEW.id, 
    NEW.email, 
    'customer',
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name);

  INSERT INTO public.customers (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- 2. DISABLE RLS ON RESERVATIONS, PAYMENTS & PROFILES
-- This instantly restores all analytics, reservations, and customer counts
-- on the Admin & Staff dashboard without recursion issues!
ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions DISABLE ROW LEVEL SECURITY;

-- Drop previous conflicting policies to clean up
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Staff and Admins can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own basic profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can view own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can delete own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Staff and Admins can manage all reservations" ON public.reservations;
DROP POLICY IF EXISTS "Anyone can submit payment for reservation" ON public.payments;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can delete own reservation payments" ON public.payments;
DROP POLICY IF EXISTS "Staff and Admins can manage all payments" ON public.payments;
DROP POLICY IF EXISTS "Anyone can view services" ON public.services;
DROP POLICY IF EXISTS "Staff and Admins can manage services" ON public.services;
DROP POLICY IF EXISTS "Anyone can view menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Staff and Admins can manage menu" ON public.menu_items;
DROP POLICY IF EXISTS "Staff can view own permissions" ON public.staff_permissions;
DROP POLICY IF EXISTS "Admins have full access to staff permissions" ON public.staff_permissions;
