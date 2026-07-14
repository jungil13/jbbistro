-- ============================================================
-- JBENZ BISTRO — SUPABASE DATABASE SCHEMA
-- Run this in your Supabase SQL Editor (once)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- PROFILES (extends Supabase auth.users)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin','manager','staff','customer')),
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  dob DATE,
  photo_url TEXT,
  username TEXT UNIQUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');

  -- Insert into profiles
  INSERT INTO public.profiles (id, email, role, first_name, last_name, phone)
  VALUES (
    NEW.id, 
    NEW.email, 
    v_role,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone'
  );

  -- Auto-create customer or staff record
  IF v_role = 'customer' THEN
    INSERT INTO public.customers (profile_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.staff_permissions (staff_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────
-- STAFF PERMISSIONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  can_dashboard BOOLEAN DEFAULT false,
  can_reservations BOOLEAN DEFAULT false,
  can_services BOOLEAN DEFAULT false,
  can_billing BOOLEAN DEFAULT false,
  UNIQUE(staff_id)
);

-- ─────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tier TEXT DEFAULT 'regular' CHECK (tier IN ('vip','regular','member')),
  total_spend NUMERIC(10,2) DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  services_used TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id)
);

-- ─────────────────────────────────────────
-- SERVICES (rooms & tables)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('karaoke','billiards','dining')),
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('vip','standard','regular')),
  hourly_rate NUMERIC(8,2) DEFAULT 0,
  capacity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'available' CHECK (status IN ('available','occupied','maintenance')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default services
INSERT INTO services (type, name, category, hourly_rate, capacity, status) VALUES
  ('karaoke', 'VIP Karaoke Suite A', 'vip', 800, 15, 'available'),
  ('karaoke', 'VIP Karaoke Suite B', 'vip', 800, 15, 'available'),
  ('karaoke', 'Standard Karaoke Room 1', 'standard', 400, 8, 'available'),
  ('karaoke', 'Standard Karaoke Room 2', 'standard', 400, 8, 'available'),
  ('billiards', 'VIP Billiard Table 1', 'vip', 300, 4, 'available'),
  ('billiards', 'VIP Billiard Table 2', 'vip', 300, 4, 'occupied'),
  ('billiards', 'Standard Table 1', 'standard', 150, 4, 'available'),
  ('billiards', 'Standard Table 2', 'standard', 150, 4, 'maintenance'),
  ('dining', 'Main Dining Area', 'regular', 0, 60, 'available')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────
-- RESERVATIONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_code TEXT UNIQUE DEFAULT 'JB-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8)),
  customer_id UUID REFERENCES profiles(id),
  service_id UUID REFERENCES services(id),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  guests INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
  total_amount NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- PAYMENTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  method TEXT DEFAULT 'gcash' CHECK (method IN ('gcash','cash')),
  gcash_number TEXT,
  reference_number TEXT,
  receipt_url TEXT,
  amount NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'info' CHECK (type IN ('info','success','warning','error','reservation','payment')),
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SETTINGS (key-value store)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO settings (key, value) VALUES
  ('business_name', 'Jbenz Bistro'),
  ('open_time', '11:00'),
  ('close_time', '23:00'),
  ('auto_approve', 'false'),
  ('ai_enabled', 'true'),
  ('realtime_notifications', 'true'),
  ('gcash_number', '09XX XXX XXXX'),
  ('gcash_qr_url', ''),
  ('chatbot_name', 'JB Assistant'),
  ('chatbot_greeting', 'Hi! Welcome to Jbenz Bistro! How can I help you today?')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────
-- CHAT MESSAGES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT CHECK (role IN ('user','bot')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- REALTIME SUBSCRIPTIONS
-- ─────────────────────────────────────────
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE services;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "profiles_own" ON profiles;
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_admin" ON profiles;
CREATE POLICY "profiles_admin" ON profiles FOR ALL USING (
  get_my_role() IN ('admin', 'manager', 'staff')
);

-- Reservations: public insert, admin/manager see all
DROP POLICY IF EXISTS "reservations_insert" ON reservations;
CREATE POLICY "reservations_insert" ON reservations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "reservations_admin_select" ON reservations;
CREATE POLICY "reservations_admin_select" ON reservations FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager','staff'))
  OR customer_email = auth.email()
);

DROP POLICY IF EXISTS "reservations_admin_update" ON reservations;
CREATE POLICY "reservations_admin_update" ON reservations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager'))
);

-- Services: public read
DROP POLICY IF EXISTS "services_public_read" ON services;
CREATE POLICY "services_public_read" ON services FOR SELECT USING (true);

DROP POLICY IF EXISTS "services_admin_write" ON services;
CREATE POLICY "services_admin_write" ON services FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager'))
);

-- Notifications: users see their own
DROP POLICY IF EXISTS "notifications_own" ON notifications;
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (user_id = auth.uid());

-- Settings: admin only
DROP POLICY IF EXISTS "settings_admin" ON settings;
CREATE POLICY "settings_admin" ON settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP POLICY IF EXISTS "settings_public_read" ON settings;
CREATE POLICY "settings_public_read" ON settings FOR SELECT USING (true);

-- Payments: insert public, admin reads all
DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "payments_admin" ON payments;
CREATE POLICY "payments_admin" ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager'))
);

-- Customers: admin/manager read
DROP POLICY IF EXISTS "customers_admin" ON customers;
CREATE POLICY "customers_admin" ON customers FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager','staff'))
);

-- ─────────────────────────────────────────
-- STORAGE BUCKET POLICIES (uploads bucket)
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "uploads_public_read" ON storage.objects;
CREATE POLICY "uploads_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'uploads');

DROP POLICY IF EXISTS "uploads_auth_insert" ON storage.objects;
CREATE POLICY "uploads_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads');

DROP POLICY IF EXISTS "uploads_auth_update" ON storage.objects;
CREATE POLICY "uploads_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'uploads');

DROP POLICY IF EXISTS "uploads_auth_delete" ON storage.objects;
CREATE POLICY "uploads_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'uploads');


-- ─────────────────────────────────────────
-- AUTOMATION & TRIGGERS FOR STATISTICS & NOTIFICATIONS
-- ─────────────────────────────────────────

-- Trigger function to update customer stats when a reservation is confirmed/cancelled
CREATE OR REPLACE FUNCTION public.handle_reservation_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_service_type TEXT;
BEGIN
  -- Resolve user_id from reservation
  v_user_id := NEW.customer_id;
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM public.profiles WHERE email = NEW.customer_email LIMIT 1;
  END IF;

  IF v_user_id IS NOT NULL THEN
    -- Ensure customer record exists
    INSERT INTO public.customers (profile_id) VALUES (v_user_id) ON CONFLICT DO NOTHING;

    -- Get service type (e.g. dining, karaoke, billiards)
    SELECT type INTO v_service_type FROM public.services WHERE id = NEW.service_id;

    IF TG_OP = 'INSERT' THEN
      IF NEW.status = 'confirmed' THEN
        UPDATE public.customers
        SET 
          total_spend = total_spend + NEW.total_amount,
          total_bookings = total_bookings + 1,
          services_used = ARRAY(SELECT DISTINCT unnest(array_append(services_used, v_service_type)))
        WHERE profile_id = v_user_id;
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      -- If status changed to confirmed, add stats
      IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status <> 'confirmed') THEN
        UPDATE public.customers
        SET 
          total_spend = total_spend + NEW.total_amount,
          total_bookings = total_bookings + 1,
          services_used = ARRAY(SELECT DISTINCT unnest(array_append(services_used, v_service_type)))
        WHERE profile_id = v_user_id;
      
      -- If status changed FROM confirmed to something else, subtract stats
      ELSIF OLD.status = 'confirmed' AND NEW.status <> 'confirmed' THEN
        UPDATE public.customers
        SET 
          total_spend = GREATEST(0, total_spend - NEW.total_amount),
          total_bookings = GREATEST(0, total_bookings - 1)
        WHERE profile_id = v_user_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to automatically create user notifications on reservation submission and updates
CREATE OR REPLACE FUNCTION public.handle_reservation_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := NEW.customer_id;
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM public.profiles WHERE email = NEW.customer_email LIMIT 1;
  END IF;

  IF v_user_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        v_user_id,
        'reservation',
        'Reservation Submitted',
        'Your reservation request (' || NEW.reservation_code || ') has been submitted.'
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.status <> OLD.status THEN
        INSERT INTO public.notifications (user_id, type, title, message)
        VALUES (
          v_user_id,
          'reservation',
          'Reservation ' || INITCAP(NEW.status),
          'Your reservation (' || NEW.reservation_code || ') is now ' || NEW.status || '.'
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop triggers if they already exist
DROP TRIGGER IF EXISTS on_reservation_status_change ON public.reservations;
DROP TRIGGER IF EXISTS on_reservation_notification ON public.reservations;

-- Bind triggers to the reservations table
CREATE TRIGGER on_reservation_status_change
  AFTER INSERT OR UPDATE OF status ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.handle_reservation_confirmed();

CREATE TRIGGER on_reservation_notification
  AFTER INSERT OR UPDATE OF status ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.handle_reservation_notification();

