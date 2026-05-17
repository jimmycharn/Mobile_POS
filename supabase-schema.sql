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
  email TEXT,
  phone TEXT,
  address TEXT,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add missing columns for existing databases
ALTER TABLE shops ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES packages(id) ON DELETE SET NULL;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Packages table
CREATE TABLE IF NOT EXISTS packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER DEFAULT 0,
  max_users INTEGER DEFAULT 2,
  max_products INTEGER DEFAULT 50,
  sales_limit INTEGER, -- NULL = unlimited
  is_visible BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  features TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Branches table
CREATE TABLE IF NOT EXISTS branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  bank_account_id UUID,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES packages(id) ON DELETE SET NULL;

-- Migrate existing shop-level packages to default branch
-- UPDATE branches SET package_id = s.package_id
-- FROM shops s
-- WHERE branches.shop_id = s.id
--   AND branches.package_id IS NULL
--   AND s.package_id IS NOT NULL;

-- Bank accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT,
  account_no TEXT,
  account_holder TEXT,
  type TEXT CHECK (type IN ('promptpay', 'bank')) DEFAULT 'bank',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_holder TEXT;

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
  stock NUMERIC(12,3) DEFAULT 0,
  min_stock NUMERIC(12,3) DEFAULT 0,
  color TEXT,
  size TEXT,
  image_url TEXT,
  is_standard BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add image_url to existing shop_products (safe migration)
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Migration: change stock/min_stock to numeric for fractional recipe tracking
DO $$
BEGIN
  ALTER TABLE shop_products ALTER COLUMN stock TYPE NUMERIC(12,3);
  ALTER TABLE shop_products ALTER COLUMN min_stock TYPE NUMERIC(12,3);
EXCEPTION WHEN others THEN
  -- columns may already be numeric or do not exist; ignore errors
  NULL;
END $$;

-- Sales / transactions
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  discount_type TEXT,
  payment_method TEXT,
  received NUMERIC(12,2) DEFAULT 0,
  change NUMERIC(12,2) DEFAULT 0,
  staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Migration: add discount columns if not exists
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_type TEXT;

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
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL AND EXISTS (SELECT 1 FROM shops WHERE owner_id = auth.uid()) THEN
    v_role := 'owner';
  END IF;
  RETURN v_role;
END
$$;

CREATE OR REPLACE FUNCTION get_my_shop_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  SELECT shop_id INTO v_shop_id FROM profiles WHERE id = auth.uid();
  IF v_shop_id IS NULL THEN
    SELECT id INTO v_shop_id FROM shops WHERE owner_id = auth.uid() LIMIT 1;
  END IF;
  RETURN v_shop_id;
END
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
  FOR INSERT WITH CHECK (
    auth.uid() = id
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'owner' AND shop_id = get_my_shop_id())
  );

DROP POLICY IF EXISTS "Profiles update policy" ON profiles;
CREATE POLICY "Profiles update policy" ON profiles
  FOR UPDATE USING (
    auth.uid() = id
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'owner' AND shop_id = get_my_shop_id())
  )
  WITH CHECK (
    auth.uid() = id
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'owner' AND shop_id = get_my_shop_id())
  );

DROP POLICY IF EXISTS "Profiles delete policy" ON profiles;
CREATE POLICY "Profiles delete policy" ON profiles
  FOR DELETE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'owner' AND shop_id = get_my_shop_id())
  );

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
DROP POLICY IF EXISTS "Branches insert policy" ON branches;
CREATE POLICY "Branches insert policy" ON branches
  FOR INSERT WITH CHECK (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Branches update policy" ON branches;
CREATE POLICY "Branches update policy" ON branches
  FOR UPDATE USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin')
  WITH CHECK (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Branches delete policy" ON branches;
CREATE POLICY "Branches delete policy" ON branches
  FOR DELETE USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');

-- Products (global / central warehouse)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Products read all" ON products;
CREATE POLICY "Products read all" ON products FOR SELECT USING (true);
-- Drop legacy combined policy if exists
DROP POLICY IF EXISTS "Products superadmin write" ON products;
-- Allow any authenticated user to contribute new standard products to central warehouse
DROP POLICY IF EXISTS "Products insert authenticated" ON products;
CREATE POLICY "Products insert authenticated" ON products
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
-- Only superadmin can edit central products
DROP POLICY IF EXISTS "Products superadmin update" ON products;
CREATE POLICY "Products superadmin update" ON products
  FOR UPDATE USING (get_my_role() = 'superadmin')
  WITH CHECK (get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Products superadmin delete" ON products;
CREATE POLICY "Products superadmin delete" ON products
  FOR DELETE USING (get_my_role() = 'superadmin');

-- Shop products
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shop products read policy" ON shop_products;
CREATE POLICY "Shop products read policy" ON shop_products
  FOR SELECT USING (
    shop_id = get_my_shop_id()
    OR branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
    OR get_my_role() = 'superadmin'
  );
DROP POLICY IF EXISTS "Shop products write policy" ON shop_products;
DROP POLICY IF EXISTS "Shop products insert policy" ON shop_products;
CREATE POLICY "Shop products insert policy" ON shop_products
  FOR INSERT WITH CHECK (
    shop_id = get_my_shop_id()
    OR branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
    OR auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id)
    OR get_my_role() = 'superadmin'
  );
DROP POLICY IF EXISTS "Shop products update policy" ON shop_products;
CREATE POLICY "Shop products update policy" ON shop_products
  FOR UPDATE USING (
    shop_id = get_my_shop_id()
    OR branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
    OR auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id)
    OR get_my_role() = 'superadmin'
  )
  WITH CHECK (
    shop_id = get_my_shop_id()
    OR branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
    OR auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id)
    OR get_my_role() = 'superadmin'
  );
DROP POLICY IF EXISTS "Shop products delete policy" ON shop_products;
CREATE POLICY "Shop products delete policy" ON shop_products
  FOR DELETE USING (
    shop_id = get_my_shop_id()
    OR branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
    OR auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id)
    OR get_my_role() = 'superadmin'
  );

-- Sales
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sales read policy" ON sales;
CREATE POLICY "Sales read policy" ON sales
  FOR SELECT USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Sales write policy" ON sales;
DROP POLICY IF EXISTS "Sales insert policy" ON sales;
CREATE POLICY "Sales insert policy" ON sales
  FOR INSERT WITH CHECK (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Sales update policy" ON sales;
CREATE POLICY "Sales update policy" ON sales
  FOR UPDATE USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin')
  WITH CHECK (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Sales delete policy" ON sales;
CREATE POLICY "Sales delete policy" ON sales
  FOR DELETE USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');

-- Activity logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Logs read policy" ON activity_logs;
CREATE POLICY "Logs read policy" ON activity_logs
  FOR SELECT USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Logs write policy" ON activity_logs;
DROP POLICY IF EXISTS "Logs insert policy" ON activity_logs;
CREATE POLICY "Logs insert policy" ON activity_logs
  FOR INSERT WITH CHECK (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Logs update policy" ON activity_logs;
CREATE POLICY "Logs update policy" ON activity_logs
  FOR UPDATE USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Logs delete policy" ON activity_logs;
CREATE POLICY "Logs delete policy" ON activity_logs
  FOR DELETE USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');

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
DROP POLICY IF EXISTS "Bank accounts insert policy" ON bank_accounts;
CREATE POLICY "Bank accounts insert policy" ON bank_accounts
  FOR INSERT WITH CHECK (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Bank accounts update policy" ON bank_accounts;
CREATE POLICY "Bank accounts update policy" ON bank_accounts
  FOR UPDATE USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin')
  WITH CHECK (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Bank accounts delete policy" ON bank_accounts;
CREATE POLICY "Bank accounts delete policy" ON bank_accounts
  FOR DELETE USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');

-- ============================================================
-- Migration: support standard vs non-standard product separation
-- ============================================================
-- Allow shop_products to link to central products optionally
-- and override fields when product_id is set
ALTER TABLE shop_products ALTER COLUMN name DROP NOT NULL;
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS is_recipe BOOLEAN DEFAULT false;

-- Index for fast barcode lookup across shop_products (including internal codes)
CREATE INDEX IF NOT EXISTS idx_shop_products_barcode ON shop_products(barcode);
CREATE INDEX IF NOT EXISTS idx_shop_products_product_id ON shop_products(product_id);

-- ============================================================
-- Recipes & Product Units (BOM for F&B)
-- ============================================================
CREATE TABLE IF NOT EXISTS recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  shop_product_id UUID REFERENCES shop_products(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipe_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  ingredient_shop_product_id UUID REFERENCES shop_products(id) ON DELETE CASCADE NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_product_id UUID REFERENCES shop_products(id) ON DELETE CASCADE NOT NULL,
  unit_name TEXT NOT NULL,
  conversion_rate NUMERIC NOT NULL DEFAULT 1,
  is_base BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipes_branch_id ON recipes(branch_id);
CREATE INDEX IF NOT EXISTS idx_recipes_shop_product_id ON recipes(shop_product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe_id ON recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_product_units_shop_product_id ON product_units(shop_product_id);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_units ENABLE ROW LEVEL SECURITY;

-- Recipes RLS
CREATE POLICY "Recipes read policy" ON recipes
  FOR SELECT USING (
    branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
    OR get_my_role() = 'superadmin'
  );
CREATE POLICY "Recipes insert policy" ON recipes
  FOR INSERT WITH CHECK (
    branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
    OR get_my_role() = 'superadmin'
  );
CREATE POLICY "Recipes update policy" ON recipes
  FOR UPDATE USING (
    branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
    OR get_my_role() = 'superadmin'
  )
  WITH CHECK (
    branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
    OR get_my_role() = 'superadmin'
  );
CREATE POLICY "Recipes delete policy" ON recipes
  FOR DELETE USING (
    branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
    OR get_my_role() = 'superadmin'
  );

-- Recipe items RLS (through parent recipe)
CREATE POLICY "Recipe items read policy" ON recipe_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND (
      r.branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
      OR get_my_role() = 'superadmin'
    ))
  );
CREATE POLICY "Recipe items insert policy" ON recipe_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND (
      r.branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
      OR get_my_role() = 'superadmin'
    ))
  );
CREATE POLICY "Recipe items update policy" ON recipe_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND (
      r.branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
      OR get_my_role() = 'superadmin'
    ))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND (
      r.branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
      OR get_my_role() = 'superadmin'
    ))
  );
CREATE POLICY "Recipe items delete policy" ON recipe_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND (
      r.branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
      OR get_my_role() = 'superadmin'
    ))
  );

-- Product units RLS (through parent shop_product)
CREATE POLICY "Product units read policy" ON product_units
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM shop_products sp WHERE sp.id = shop_product_id AND (
      sp.shop_id = get_my_shop_id()
      OR sp.branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
      OR get_my_role() = 'superadmin'
    ))
  );
CREATE POLICY "Product units insert policy" ON product_units
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM shop_products sp WHERE sp.id = shop_product_id AND (
      sp.shop_id = get_my_shop_id()
      OR sp.branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
      OR get_my_role() = 'superadmin'
    ))
  );
CREATE POLICY "Product units update policy" ON product_units
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM shop_products sp WHERE sp.id = shop_product_id AND (
      sp.shop_id = get_my_shop_id()
      OR sp.branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
      OR get_my_role() = 'superadmin'
    ))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM shop_products sp WHERE sp.id = shop_product_id AND (
      sp.shop_id = get_my_shop_id()
      OR sp.branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
      OR get_my_role() = 'superadmin'
    ))
  );
CREATE POLICY "Product units delete policy" ON product_units
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM shop_products sp WHERE sp.id = shop_product_id AND (
      sp.shop_id = get_my_shop_id()
      OR sp.branch_id IN (SELECT id FROM branches WHERE shop_id = get_my_shop_id())
      OR get_my_role() = 'superadmin'
    ))
  );

-- Seed data: packages (for new installs)
-- ============================================================
INSERT INTO packages (name, price, max_users, max_products, sales_limit, is_visible, is_default, features)
VALUES
  ('Starter', 0, 2, 50, NULL, true, true, ARRAY['POS ขายหน้าร้าน', 'จัดการสต็อกพื้นฐาน', 'รายงานยอดขาย']),
  ('Basic', 299, 5, 200, NULL, true, false, ARRAY['ทุกอย่างใน Starter', 'จัดการพนักงาน', 'รายงานขั้นสูง', 'ซัพพอร์ตอีเมล']),
  ('Pro', 599, 15, 1000, NULL, true, false, ARRAY['ทุกอย่างใน Basic', 'API เชื่อมต่อ', 'ซัพพอร์ตโทรศัพท์', 'ระบบสาขา']),
  ('Enterprise', 1299, 999, 9999, NULL, true, false, ARRAY['ทุกอย่างใน Pro', 'Dedicated Support', 'Custom Integration', 'On-premise Option'])
ON CONFLICT DO NOTHING;

-- ============================================================
-- Storage: product-images bucket policies
-- ============================================================
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'])
ON CONFLICT (id) DO NOTHING;

-- Note: storage.objects already has RLS enabled by default in Supabase.
-- If CREATE POLICY below also fails with "must be owner", use Supabase Dashboard:
-- Storage > product-images > Policies > New Policy (For full customization)

-- Public read access to product images
DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
CREATE POLICY "Product images public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'product-images');

-- Superadmin can upload/manage any image in product-images
DROP POLICY IF EXISTS "Product images superadmin all" ON storage.objects;
CREATE POLICY "Product images superadmin all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'product-images' AND get_my_role() = 'superadmin')
  WITH CHECK (bucket_id = 'product-images' AND get_my_role() = 'superadmin');

-- Shop users can manage images in their own shop folder
DROP POLICY IF EXISTS "Product images shop manage" ON storage.objects;
CREATE POLICY "Product images shop manage" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'product-images'
    AND get_my_shop_id() IS NOT NULL
    AND name LIKE (get_my_shop_id()::text || '/%')
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND get_my_shop_id() IS NOT NULL
    AND name LIKE (get_my_shop_id()::text || '/%')
  );

-- ============================================================
-- Migration: add sales_limit and is_visible to existing packages
-- ============================================================
ALTER TABLE packages ADD COLUMN IF NOT EXISTS sales_limit INTEGER;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
