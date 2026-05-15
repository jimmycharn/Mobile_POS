-- ============================================================
-- Storage Setup สำหรับรูปภาพสินค้า
-- รันใน Supabase SQL Editor
-- ============================================================

-- สร้าง bucket แบบ public (อ่านได้ทุกคน อัปโหลดได้เฉพาะผู้ login)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policies สำหรับ bucket product-images
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated upload product images" ON storage.objects;
CREATE POLICY "Authenticated upload product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated update product images" ON storage.objects;
CREATE POLICY "Authenticated update product images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated delete product images" ON storage.objects;
CREATE POLICY "Authenticated delete product images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');
