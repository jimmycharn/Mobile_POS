-- ============================================================
-- Mobile POS - Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'owner', 'staff')),
  avatar TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Shops table
CREATE TABLE IF NOT EXISTS shops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Packages table
CREATE TABLE IF NOT EXISTS packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER DEFAULT 0,
  max_users INTEGER DEFAULT 2,
  max_products INTEGER DEFAULT 50,
  features TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Branches table
CREATE TABLE IF NOT EXISTS branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  bank_account_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bank accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT,
  account_no TEXT,
  type TEXT CHECK (type IN ('promptpay', 'bank')) DEFAULT 'bank',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add deferred foreign keys after all tables exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES packages(id) ON DELETE SET NULL;

ALTER TABLE branches
  DROP CONSTRAINT IF EXISTS fk_branch_bank_account;
ALTER TABLE branches
  ADD CONSTRAINT fk_branch_bank_account
  FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL;

-- Global products (central warehouse)
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT,
  description TEXT,
  image_url TEXT,
  is_standard BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Shop products (inventory with pricing per branch)
CREATE TABLE IF NOT EXISTS shop_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  barcode TEXT,
  category TEXT,
  unit TEXT,
  cost_price NUMERIC(12,2) DEFAULT 0,
  sale_price NUMERIC(12,2) DEFAULT 0,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  color TEXT,
  size TEXT,
  is_standard BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sales / transactions
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(12,2) DEFAULT 0,
  payment_method TEXT,
  received NUMERIC(12,2) DEFAULT 0,
  change NUMERIC(12,2) DEFAULT 0,
  staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Helper Functions (SECURITY DEFINER เพื่อหลีกเลี่ยง RLS recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_my_shop_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT shop_id FROM profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- Row Level Security Policies
-- ============================================================

-- Profiles: ใช้ policy ง่าย ๆ ไม่มี recursion
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles read policy" ON profiles;
CREATE POLICY "Profiles read policy" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR get_my_role() = 'superadmin'
    OR shop_id = get_my_shop_id()
  );

DROP POLICY IF EXISTS "Profiles insert policy" ON profiles;
CREATE POLICY "Profiles insert policy" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id OR get_my_role() = 'superadmin');

DROP POLICY IF EXISTS "Profiles update policy" ON profiles;
CREATE POLICY "Profiles update policy" ON profiles
  FOR UPDATE USING (auth.uid() = id OR get_my_role() = 'superadmin');

-- Shops
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shops read policy" ON shops;
CREATE POLICY "Shops read policy" ON shops
  FOR SELECT USING (
    owner_id = auth.uid()
    OR id = get_my_shop_id()
    OR get_my_role() = 'superadmin'
  );
DROP POLICY IF EXISTS "Shops write policy" ON shops;
CREATE POLICY "Shops write policy" ON shops
  FOR ALL USING (owner_id = auth.uid() OR get_my_role() = 'superadmin');

-- Branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branches read policy" ON branches;
CREATE POLICY "Branches read policy" ON branches
  FOR SELECT USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Branches write policy" ON branches;
CREATE POLICY "Branches write policy" ON branches
  FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');

-- Products (global)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Products read all" ON products;
CREATE POLICY "Products read all" ON products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Products superadmin write" ON products;
CREATE POLICY "Products superadmin write" ON products
  FOR ALL USING (get_my_role() = 'superadmin');

-- Shop products
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shop products read policy" ON shop_products;
CREATE POLICY "Shop products read policy" ON shop_products
  FOR SELECT USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Shop products write policy" ON shop_products;
CREATE POLICY "Shop products write policy" ON shop_products
  FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');

-- Sales
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sales read policy" ON sales;
CREATE POLICY "Sales read policy" ON sales
  FOR SELECT USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Sales write policy" ON sales;
CREATE POLICY "Sales write policy" ON sales
  FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');

-- Activity logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Logs read policy" ON activity_logs;
CREATE POLICY "Logs read policy" ON activity_logs
  FOR SELECT USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Logs write policy" ON activity_logs;
CREATE POLICY "Logs write policy" ON activity_logs
  FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');

-- Packages
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Packages read all" ON packages;
CREATE POLICY "Packages read all" ON packages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Packages superadmin write" ON packages;
CREATE POLICY "Packages superadmin write" ON packages
  FOR ALL USING (get_my_role() = 'superadmin');

-- Bank accounts
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bank accounts read policy" ON bank_accounts;
CREATE POLICY "Bank accounts read policy" ON bank_accounts
  FOR SELECT USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Bank accounts write policy" ON bank_accounts;
CREATE POLICY "Bank accounts write policy" ON bank_accounts
  FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');

-- ============================================================
-- Seed data: packages (for new installs)
-- ============================================================
INSERT INTO packages (name, price, max_users, max_products, features)
VALUES
  ('Starter', 0, 2, 50, ARRAY['POS ขายหน้าร้าน', 'จัดการสต็อกพื้นฐาน', 'รายงานยอดขาย']),
  ('Basic', 299, 5, 200, ARRAY['ทุกอย่างใน Starter', 'จัดการพนักงาน', 'รายงานขั้นสูง', 'ซัพพอร์ตอีเมล']),
  ('Pro', 599, 15, 1000, ARRAY['ทุกอย่างใน Basic', 'API เชื่อมต่อ', 'ซัพพอร์ตโทรศัพท์', 'ระบบสาขา']),
  ('Enterprise', 1299, 999, 9999, ARRAY['ทุกอย่างใน Pro', 'Dedicated Support', 'Custom Integration', 'On-premise Option'])
ON CONFLICT DO NOTHING;
