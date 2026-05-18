-- ============================================================
-- Mobile POS - Restaurant Mode Migration
-- Run this AFTER supabase-schema.sql in Supabase SQL Editor
-- Idempotent: safe to re-run
-- ============================================================

-- ============================================================
-- 1) New columns on existing tables
-- ============================================================

-- Branch operating mode: 'pos' (default) or 'restaurant'
ALTER TABLE branches ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'pos';

-- Per-product department assignment (used in restaurant mode)
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS department_id UUID;

-- ============================================================
-- 2) Kitchen Departments
-- ============================================================
CREATE TABLE IF NOT EXISTS kitchen_departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,  -- slug used in /kitchen/:code URL
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_kitchen_dept_code
  ON kitchen_departments(shop_id, code);

-- FK from shop_products.department_id (added separately to be safe)
DO $$
BEGIN
  ALTER TABLE shop_products
    ADD CONSTRAINT fk_shop_products_department
    FOREIGN KEY (department_id) REFERENCES kitchen_departments(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3) Restaurant Tables
-- ============================================================
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,  -- slug used in /t/:code URL
  seats INTEGER DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  active_order_id UUID,  -- nullable: NULL = closed/free
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_restaurant_table_code
  ON restaurant_tables(shop_id, code);

-- ============================================================
-- 4) Restaurant Orders (one open order per table)
-- ============================================================
CREATE TABLE IF NOT EXISTS restaurant_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  parent_order_id UUID,  -- for merged tables; secondary points to primary
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','awaiting_payment','paid','cancelled')),
  opened_at TIMESTAMPTZ DEFAULT now(),
  opened_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Now add the FK from restaurant_tables.active_order_id (deferred)
DO $$
BEGIN
  ALTER TABLE restaurant_tables
    ADD CONSTRAINT fk_table_active_order
    FOREIGN KEY (active_order_id) REFERENCES restaurant_orders(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE restaurant_orders
    ADD CONSTRAINT fk_order_parent
    FOREIGN KEY (parent_order_id) REFERENCES restaurant_orders(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_table ON restaurant_orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON restaurant_orders(status);

-- ============================================================
-- 5) Order Items
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES restaurant_orders(id) ON DELETE CASCADE NOT NULL,
  shop_product_id UUID REFERENCES shop_products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  qty NUMERIC(12,3) NOT NULL DEFAULT 1,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  department_id UUID REFERENCES kitchen_departments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'cart'
    CHECK (status IN ('cart','pending','preparing','ready','served','cancelled','cancel_requested')),
  added_by_session TEXT,
  confirmed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_dept ON order_items(department_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);

-- ============================================================
-- 6) RLS Policies
-- ============================================================

-- Kitchen Departments
ALTER TABLE kitchen_departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kdept read" ON kitchen_departments;
CREATE POLICY "kdept read" ON kitchen_departments
  FOR SELECT USING (
    shop_id = get_my_shop_id()
    OR get_my_role() = 'superadmin'
    -- Allow public read so customer can resolve product departments
    OR true
  );
DROP POLICY IF EXISTS "kdept write" ON kitchen_departments;
CREATE POLICY "kdept write" ON kitchen_departments
  FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin')
  WITH CHECK (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');

-- Restaurant Tables: public read (so customer can resolve table_code), staff write
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rtables read" ON restaurant_tables;
CREATE POLICY "rtables read" ON restaurant_tables FOR SELECT USING (true);
DROP POLICY IF EXISTS "rtables write" ON restaurant_tables;
CREATE POLICY "rtables write" ON restaurant_tables
  FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin')
  WITH CHECK (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');

-- Restaurant Orders: public read (for customer realtime), insert/update via RPC only or staff
ALTER TABLE restaurant_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rorders read" ON restaurant_orders;
CREATE POLICY "rorders read" ON restaurant_orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "rorders write" ON restaurant_orders;
CREATE POLICY "rorders write" ON restaurant_orders
  FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin')
  WITH CHECK (shop_id = get_my_shop_id() OR get_my_role() = 'superadmin');

-- Order Items: public read, staff write (customer mutations go via RPC SECURITY DEFINER)
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oitems read" ON order_items;
CREATE POLICY "oitems read" ON order_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "oitems write" ON order_items;
CREATE POLICY "oitems write" ON order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM restaurant_orders o WHERE o.id = order_id
      AND (o.shop_id = get_my_shop_id() OR get_my_role() = 'superadmin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM restaurant_orders o WHERE o.id = order_id
      AND (o.shop_id = get_my_shop_id() OR get_my_role() = 'superadmin'))
  );

-- Allow public read of shop_products so customer menu works (only branch products needed)
-- (Existing shop_products RLS is too strict — add a permissive read for menu use)
-- We keep the existing strict policy and rely on RPC for sensitive ops.
-- For simplicity, expose a public "menu" via RPC instead of opening shop_products.

-- ============================================================
-- 7) RPC functions
-- ============================================================

-- Public function: resolve table by code and return info incl. active order
DROP FUNCTION IF EXISTS public.customer_get_table(TEXT);
CREATE OR REPLACE FUNCTION public.customer_get_table(p_table_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table restaurant_tables%ROWTYPE;
  v_order restaurant_orders%ROWTYPE;
  v_shop_name TEXT;
  v_branch_name TEXT;
BEGIN
  SELECT * INTO v_table FROM restaurant_tables WHERE code = p_table_code LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'table_not_found');
  END IF;
  SELECT name INTO v_shop_name FROM shops WHERE id = v_table.shop_id;
  SELECT name INTO v_branch_name FROM branches WHERE id = v_table.branch_id;
  IF v_table.active_order_id IS NOT NULL THEN
    SELECT * INTO v_order FROM restaurant_orders WHERE id = v_table.active_order_id LIMIT 1;
  END IF;
  RETURN jsonb_build_object(
    'table_id', v_table.id,
    'table_name', v_table.name,
    'table_code', v_table.code,
    'shop_id', v_table.shop_id,
    'shop_name', v_shop_name,
    'branch_id', v_table.branch_id,
    'branch_name', v_branch_name,
    'active_order_id', v_table.active_order_id,
    'order_status', v_order.status
  );
END $$;
GRANT EXECUTE ON FUNCTION public.customer_get_table(TEXT) TO anon, authenticated;

-- Public function: get menu (shop_products for the branch where the table is)
-- Merges overrides from shop_products with central products so name/unit/category/image_url
-- are never NULL for standard items.
DROP FUNCTION IF EXISTS public.customer_get_menu(TEXT);
CREATE OR REPLACE FUNCTION public.customer_get_menu(p_table_code TEXT)
RETURNS TABLE (
  id UUID,
  shop_id UUID,
  branch_id UUID,
  product_id UUID,
  name TEXT,
  category TEXT,
  unit TEXT,
  image_url TEXT,
  barcode TEXT,
  sale_price NUMERIC,
  cost_price NUMERIC,
  stock NUMERIC,
  min_stock NUMERIC,
  is_standard BOOLEAN,
  is_recipe BOOLEAN,
  department_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  SELECT t.branch_id INTO v_branch_id FROM restaurant_tables t WHERE t.code = p_table_code LIMIT 1;
  IF v_branch_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    sp.id,
    sp.shop_id,
    sp.branch_id,
    sp.product_id,
    COALESCE(sp.name, p.name)        AS name,
    COALESCE(sp.category, p.category) AS category,
    COALESCE(sp.unit, p.unit)         AS unit,
    COALESCE(sp.image_url, p.image_url) AS image_url,
    COALESCE(sp.barcode, p.barcode)   AS barcode,
    sp.sale_price,
    sp.cost_price,
    sp.stock,
    sp.min_stock,
    sp.is_standard,
    sp.is_recipe,
    sp.department_id
  FROM shop_products sp
  LEFT JOIN products p ON p.id = sp.product_id
  WHERE sp.branch_id = v_branch_id
    AND COALESCE(sp.category, p.category, '') <> 'วัตถุดิบ'
  ORDER BY sp.created_at DESC;
END $$;
GRANT EXECUTE ON FUNCTION public.customer_get_menu(TEXT) TO anon, authenticated;

-- Helper: get active open order by table code (throws if closed)
CREATE OR REPLACE FUNCTION public.assert_table_open(p_table_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_status TEXT;
BEGIN
  SELECT t.active_order_id INTO v_order_id
  FROM restaurant_tables t WHERE t.code = p_table_code;
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'table_closed';
  END IF;
  SELECT status INTO v_status FROM restaurant_orders WHERE id = v_order_id;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'table_closed';
  END IF;
  RETURN v_order_id;
END $$;

-- Customer: add item to cart
DROP FUNCTION IF EXISTS public.customer_add_item(TEXT, UUID, NUMERIC, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.customer_add_item(
  p_table_code TEXT,
  p_shop_product_id UUID,
  p_qty NUMERIC,
  p_note TEXT,
  p_session_id TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_item_id UUID;
  v_name TEXT;
  v_price NUMERIC;
  v_dept UUID;
BEGIN
  v_order_id := public.assert_table_open(p_table_code);
  -- Resolve fields with fallback to central products table for standard items
  SELECT
    COALESCE(sp.name, p.name),
    COALESCE(sp.sale_price, 0),
    sp.department_id
  INTO v_name, v_price, v_dept
  FROM shop_products sp
  LEFT JOIN products p ON p.id = sp.product_id
  WHERE sp.id = p_shop_product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found'; END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'product_name_missing'; END IF;
  INSERT INTO order_items (
    order_id, shop_product_id, name, qty, sale_price, note,
    department_id, status, added_by_session
  ) VALUES (
    v_order_id, p_shop_product_id, v_name, p_qty, v_price, p_note,
    v_dept, 'cart', p_session_id
  ) RETURNING id INTO v_item_id;
  RETURN v_item_id;
END $$;
GRANT EXECUTE ON FUNCTION public.customer_add_item(TEXT, UUID, NUMERIC, TEXT, TEXT) TO anon, authenticated;

-- Customer: update cart item qty (only status='cart')
DROP FUNCTION IF EXISTS public.customer_update_item(TEXT, UUID, NUMERIC);
CREATE OR REPLACE FUNCTION public.customer_update_item(
  p_table_code TEXT, p_item_id UUID, p_qty NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  v_order_id := public.assert_table_open(p_table_code);
  IF p_qty <= 0 THEN
    DELETE FROM order_items WHERE id = p_item_id AND order_id = v_order_id AND status = 'cart';
  ELSE
    UPDATE order_items SET qty = p_qty
      WHERE id = p_item_id AND order_id = v_order_id AND status = 'cart';
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.customer_update_item(TEXT, UUID, NUMERIC) TO anon, authenticated;

-- Customer: remove cart item
DROP FUNCTION IF EXISTS public.customer_remove_item(TEXT, UUID);
CREATE OR REPLACE FUNCTION public.customer_remove_item(
  p_table_code TEXT, p_item_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  v_order_id := public.assert_table_open(p_table_code);
  DELETE FROM order_items
    WHERE id = p_item_id AND order_id = v_order_id AND status = 'cart';
END $$;
GRANT EXECUTE ON FUNCTION public.customer_remove_item(TEXT, UUID) TO anon, authenticated;

-- Customer: confirm order — send cart items to pending
DROP FUNCTION IF EXISTS public.customer_confirm_order(TEXT);
CREATE OR REPLACE FUNCTION public.customer_confirm_order(p_table_code TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_count INTEGER;
BEGIN
  v_order_id := public.assert_table_open(p_table_code);
  UPDATE order_items
    SET status = 'pending', confirmed_at = now()
    WHERE order_id = v_order_id AND status = 'cart';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
GRANT EXECUTE ON FUNCTION public.customer_confirm_order(TEXT) TO anon, authenticated;

-- Customer: cancel pending item (only if still pending and not yet preparing)
DROP FUNCTION IF EXISTS public.customer_cancel_pending(TEXT, UUID);
CREATE OR REPLACE FUNCTION public.customer_cancel_pending(
  p_table_code TEXT, p_item_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  v_order_id := public.assert_table_open(p_table_code);
  UPDATE order_items
    SET status = 'cancelled', cancelled_at = now()
    WHERE id = p_item_id AND order_id = v_order_id AND status = 'pending';
END $$;
GRANT EXECUTE ON FUNCTION public.customer_cancel_pending(TEXT, UUID) TO anon, authenticated;

-- Customer: request cancel for items already preparing/ready (needs staff approval)
DROP FUNCTION IF EXISTS public.customer_request_cancel(TEXT, UUID);
CREATE OR REPLACE FUNCTION public.customer_request_cancel(
  p_table_code TEXT, p_item_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  v_order_id := public.assert_table_open(p_table_code);
  UPDATE order_items
    SET status = 'cancel_requested'
    WHERE id = p_item_id AND order_id = v_order_id
      AND status IN ('preparing','ready');
END $$;
GRANT EXECUTE ON FUNCTION public.customer_request_cancel(TEXT, UUID) TO anon, authenticated;

-- Customer: request bill
DROP FUNCTION IF EXISTS public.customer_request_bill(TEXT);
CREATE OR REPLACE FUNCTION public.customer_request_bill(p_table_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  v_order_id := public.assert_table_open(p_table_code);
  UPDATE restaurant_orders SET status = 'awaiting_payment'
    WHERE id = v_order_id;
END $$;
GRANT EXECUTE ON FUNCTION public.customer_request_bill(TEXT) TO anon, authenticated;

-- Staff: open table — create a new open order and set active_order_id
DROP FUNCTION IF EXISTS public.staff_open_table(UUID);
CREATE OR REPLACE FUNCTION public.staff_open_table(p_table_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table restaurant_tables%ROWTYPE;
  v_order_id UUID;
BEGIN
  SELECT * INTO v_table FROM restaurant_tables WHERE id = p_table_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'table_not_found'; END IF;
  IF v_table.shop_id <> get_my_shop_id() AND get_my_role() <> 'superadmin' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_table.active_order_id IS NOT NULL THEN
    RETURN v_table.active_order_id;
  END IF;
  INSERT INTO restaurant_orders (shop_id, branch_id, table_id, status, opened_by_user_id)
    VALUES (v_table.shop_id, v_table.branch_id, v_table.id, 'open', auth.uid())
    RETURNING id INTO v_order_id;
  UPDATE restaurant_tables SET active_order_id = v_order_id WHERE id = p_table_id;
  RETURN v_order_id;
END $$;
GRANT EXECUTE ON FUNCTION public.staff_open_table(UUID) TO authenticated;

-- Staff: close table without payment (manual close)
DROP FUNCTION IF EXISTS public.staff_close_table(UUID);
CREATE OR REPLACE FUNCTION public.staff_close_table(p_table_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table restaurant_tables%ROWTYPE;
BEGIN
  SELECT * INTO v_table FROM restaurant_tables WHERE id = p_table_id;
  IF v_table.shop_id <> get_my_shop_id() AND get_my_role() <> 'superadmin' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_table.active_order_id IS NOT NULL THEN
    UPDATE restaurant_orders SET status = 'cancelled', closed_at = now()
      WHERE id = v_table.active_order_id;
  END IF;
  UPDATE restaurant_tables SET active_order_id = NULL WHERE id = p_table_id;
END $$;
GRANT EXECUTE ON FUNCTION public.staff_close_table(UUID) TO authenticated;

-- Staff: mark item status (kitchen workflow)
DROP FUNCTION IF EXISTS public.staff_set_item_status(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.staff_set_item_status(
  p_item_id UUID, p_status TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('preparing','ready','served','cancelled') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  UPDATE order_items
    SET status = p_status,
        started_at = CASE WHEN p_status = 'preparing' THEN now() ELSE started_at END,
        ready_at = CASE WHEN p_status = 'ready' THEN now() ELSE ready_at END,
        served_at = CASE WHEN p_status = 'served' THEN now() ELSE served_at END,
        cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() ELSE cancelled_at END
    WHERE id = p_item_id
      AND EXISTS (SELECT 1 FROM restaurant_orders o WHERE o.id = order_id
        AND (o.shop_id = get_my_shop_id() OR get_my_role() = 'superadmin'));
END $$;
GRANT EXECUTE ON FUNCTION public.staff_set_item_status(UUID, TEXT) TO authenticated;

-- Staff: finalize payment — set order paid, clear table.active_order_id, link sale
DROP FUNCTION IF EXISTS public.staff_close_order_paid(UUID, UUID);
CREATE OR REPLACE FUNCTION public.staff_close_order_paid(
  p_order_id UUID, p_sale_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order restaurant_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM restaurant_orders WHERE id = p_order_id;
  IF v_order.shop_id <> get_my_shop_id() AND get_my_role() <> 'superadmin' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE restaurant_orders
    SET status = 'paid', closed_at = now(), sale_id = p_sale_id
    WHERE id = p_order_id;
  IF v_order.table_id IS NOT NULL THEN
    UPDATE restaurant_tables SET active_order_id = NULL WHERE id = v_order.table_id;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.staff_close_order_paid(UUID, UUID) TO authenticated;

-- Staff: merge two tables (move items from secondary into primary, close secondary)
DROP FUNCTION IF EXISTS public.staff_merge_tables(UUID, UUID);
CREATE OR REPLACE FUNCTION public.staff_merge_tables(
  p_primary_order_id UUID, p_secondary_order_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sec restaurant_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_sec FROM restaurant_orders WHERE id = p_secondary_order_id;
  IF v_sec.shop_id <> get_my_shop_id() AND get_my_role() <> 'superadmin' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE order_items SET order_id = p_primary_order_id WHERE order_id = p_secondary_order_id;
  UPDATE restaurant_orders
    SET parent_order_id = p_primary_order_id,
        status = 'cancelled',
        closed_at = now()
    WHERE id = p_secondary_order_id;
  IF v_sec.table_id IS NOT NULL THEN
    UPDATE restaurant_tables SET active_order_id = NULL WHERE id = v_sec.table_id;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.staff_merge_tables(UUID, UUID) TO authenticated;

-- ============================================================
-- 8) Realtime: enable on the new tables
-- ============================================================
-- Add to supabase_realtime publication (idempotent — wrap in DO block)
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_tables;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_orders;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- IMPORTANT: REPLICA IDENTITY FULL so DELETE events carry full row,
-- allowing realtime filters like order_id=eq.X to match on deletes.
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE restaurant_orders REPLICA IDENTITY FULL;
ALTER TABLE restaurant_tables REPLICA IDENTITY FULL;
