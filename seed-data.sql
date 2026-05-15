-- ============================================================
-- Mobile POS - Seed Data
-- ============================================================
-- ขั้นตอน:
-- 1. ไปที่ Supabase Dashboard → Authentication → Users
-- 2. สร้าง 3 users ด้วย email/password ตามด้านล่าง
-- 3. คัดลอก UUID ของแต่ละ user มาใส่แทน placeholder ด้านล่าง
-- 4. วาง SQL นี้ใน Supabase SQL Editor แล้กด Run
-- ============================================================

-- สร้างตารางชั่วคราวเพื่อเก็บ UUID
CREATE TABLE IF NOT EXISTS _seed_uuids (
  role TEXT PRIMARY KEY,
  user_id UUID
);

-- ⚠️ แก้ไข UUID ตรงนี้ให้ตรงกับที่ได้จาก Supabase Dashboard
INSERT INTO _seed_uuids (role, user_id) VALUES
  ('superadmin', '11111111-1111-1111-1111-111111111111'),
  ('owner',      '22222222-2222-2222-2222-222222222222'),
  ('staff',      '33333333-3333-3333-3333-333333333333')
ON CONFLICT (role) DO UPDATE SET user_id = EXCLUDED.user_id;

-- ============================================================
-- STEP 1: Packages (ไม่มี dependencies)
-- ============================================================
INSERT INTO packages (id, name, price, max_users, max_products, features)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Starter', 0, 2, 50, ARRAY['POS ขายหน้าร้าน', 'จัดการสต็อกพื้นฐาน', 'รายงานยอดขาย']),
  ('550e8400-e29b-41d4-a716-446655440001', 'Basic', 299, 5, 200, ARRAY['ทุกอย่างใน Starter', 'จัดการพนักงาน', 'รายงานขั้นสูง', 'ซัพพอร์ตอีเมล']),
  ('550e8400-e29b-41d4-a716-446655440002', 'Pro', 599, 15, 1000, ARRAY['ทุกอย่างใน Basic', 'API เชื่อมต่อ', 'ซัพพอร์ตโทรศัพท์', 'ระบบสาขา']),
  ('550e8400-e29b-41d4-a716-446655440003', 'Enterprise', 1299, 999, 9999, ARRAY['ทุกอย่างใน Pro', 'Dedicated Support', 'Custom Integration', 'On-premise Option'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 2: Profiles (ไม่มี shop_id/branch_id ก่อน เพราะยังไม่มีร้าน)
-- ============================================================
INSERT INTO profiles (id, email, name, role, is_active)
VALUES
  ((SELECT user_id FROM _seed_uuids WHERE role = 'superadmin'), 'yuttasakk@gmail.com', 'Super Admin', 'superadmin', true),
  ((SELECT user_id FROM _seed_uuids WHERE role = 'owner'),      'owner@demo.com',      'เจ้าของร้าน', 'owner',      true),
  ((SELECT user_id FROM _seed_uuids WHERE role = 'staff'),      'staff@demo.com',      'พนักงาน 1',   'staff',      true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 3: Shops (อ้างอิง owner_id จาก profiles)
-- ============================================================
INSERT INTO shops (id, name, owner_id, phone, address, package_id)
VALUES
  ('660e8400-e29b-41d4-a716-446655440000', 'ร้านตัวอย่าง 1', (SELECT user_id FROM _seed_uuids WHERE role = 'owner'), '081-234-5678', '123 ถนนสุขุมวิท กรุงเทพฯ', '550e8400-e29b-41d4-a716-446655440001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 4: Branches (อ้างอิง shop_id)
-- ============================================================
INSERT INTO branches (id, shop_id, name, address)
VALUES
  ('770e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', 'สาขาหลัก', '123 ถนนสุขุมวิท กรุงเทพฯ'),
  ('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440000', 'สาขาย่อย', '456 ถนนเพชรบุรี กรุงเทพฯ')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 5: Update Profiles ด้วย shop_id และ branch_id
-- ============================================================
UPDATE profiles SET shop_id = '660e8400-e29b-41d4-a716-446655440000', branch_id = '770e8400-e29b-41d4-a716-446655440000'
WHERE id = (SELECT user_id FROM _seed_uuids WHERE role = 'owner');

UPDATE profiles SET shop_id = '660e8400-e29b-41d4-a716-446655440000', branch_id = '770e8400-e29b-41d4-a716-446655440000'
WHERE id = (SELECT user_id FROM _seed_uuids WHERE role = 'staff');

-- ============================================================
-- STEP 6: Seed Bank Accounts
-- ============================================================
INSERT INTO bank_accounts (id, shop_id, name, bank_name, account_no, type)
VALUES
  ('880e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', 'บัญชีรับเงิน', 'ไทยพาณิชย์', '123-4-56789-0', 'bank'),
  ('880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440000', 'PromptPay', 'PromptPay', '0812345678', 'promptpay')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 7: Seed Global Products (คลังกลาง)
-- ============================================================
INSERT INTO products (id, barcode, name, category, unit, is_standard)
VALUES
  ('990e8400-e29b-41d4-a716-446655440000', '8850000000001', 'น้ำดื่ม 600ml', 'เครื่องดื่ม', 'ขวด', true),
  ('990e8400-e29b-41d4-a716-446655440001', '8850000000002', 'ขนมปังแซนวิช', 'อาหาร', 'ชิ้น', true),
  ('990e8400-e29b-41d4-a716-446655440002', '8850000000003', 'มาม่า ต้มยำ', 'อาหารแห้ง', 'ซอง', true),
  ('990e8400-e29b-41d4-a716-446655440003', '8850000000004', 'กาแฟ 3in1', 'เครื่องดื่ม', 'ซอง', true),
  ('990e8400-e29b-41d4-a716-446655440004', '8850000000005', 'ทิชชู่ แพ็ค', 'ของใช้', 'แพ็ค', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 8: Seed Shop Products (สินค้าในร้าน)
-- ============================================================
INSERT INTO shop_products (id, shop_id, branch_id, product_id, name, barcode, category, unit, cost_price, sale_price, stock, min_stock, is_standard)
VALUES
  ('aa0e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', '990e8400-e29b-41d4-a716-446655440000', 'น้ำดื่ม 600ml', '8850000000001', 'เครื่องดื่ม', 'ขวด', 8.00, 15.00, 50, 10, true),
  ('aa0e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', '990e8400-e29b-41d4-a716-446655440001', 'ขนมปังแซนวิช', '8850000000002', 'อาหาร', 'ชิ้น', 25.00, 45.00, 20, 5, true),
  ('aa0e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', '990e8400-e29b-41d4-a716-446655440002', 'มาม่า ต้มยำ', '8850000000003', 'อาหารแห้ง', 'ซอง', 6.50, 12.00, 100, 20, true),
  ('aa0e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', '990e8400-e29b-41d4-a716-446655440003', 'กาแฟ 3in1', '8850000000004', 'เครื่องดื่ม', 'ซอง', 4.00, 8.00, 80, 15, true),
  ('aa0e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', '990e8400-e29b-41d4-a716-446655440004', 'ทิชชู่ แพ็ค', '8850000000005', 'ของใช้', 'แพ็ค', 35.00, 55.00, 30, 5, true),
  ('aa0e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', NULL, 'สินค้าพิเศษร้าน', 'SHOP001', 'ทั่วไป', 'ชิ้น', 100.00, 150.00, 10, 2, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 9: Seed Sales (ตัวอย่างการขาย)
-- ============================================================
INSERT INTO sales (id, shop_id, branch_id, items, total, payment_method, received, change, staff_id)
VALUES
  ('bb0e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000',
    '[{"name":"น้ำดื่ม 600ml","qty":2,"price":15},{"name":"ขนมปังแซนวิช","qty":1,"price":45}]'::jsonb,
    75.00, 'cash', 100.00, 25.00, (SELECT user_id FROM _seed_uuids WHERE role = 'staff')),
  ('bb0e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000',
    '[{"name":"มาม่า ต้มยำ","qty":5,"price":12},{"name":"กาแฟ 3in1","qty":3,"price":8}]'::jsonb,
    84.00, 'promptpay', 84.00, 0.00, (SELECT user_id FROM _seed_uuids WHERE role = 'owner'))
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 10: Seed Activity Logs
-- ============================================================
INSERT INTO activity_logs (shop_id, branch_id, user_id, action, details)
VALUES
  ('660e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', (SELECT user_id FROM _seed_uuids WHERE role = 'owner'), 'LOGIN', 'เจ้าของร้านเข้าสู่ระบบ'),
  ('660e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', (SELECT user_id FROM _seed_uuids WHERE role = 'staff'), 'LOGIN', 'พนักงานเข้าสู่ระบบ'),
  ('660e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', (SELECT user_id FROM _seed_uuids WHERE role = 'staff'), 'SALE', 'ขายสินค้า 2 รายการ ยอดรวม ฿75'),
  ('660e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', (SELECT user_id FROM _seed_uuids WHERE role = 'owner'), 'SALE', 'ขายสินค้า 2 รายการ ยอดรวม ฿84');

-- ============================================================
-- ลบตารางชั่วคราว (ถ้าต้องการ)
-- DROP TABLE _seed_uuids;
-- ============================================================
