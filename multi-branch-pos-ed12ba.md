# Multi-Branch POS (หลายสาขา)

ระบบรองรับเจ้าของร้านหนึ่งร้านที่มีหลายสาขา สต็อกและยอดขายแยกต่อสาขา สินค้ามาตรฐาน (barcode) ร่วมกัน: staff login ติดสาขาเดียว, owner login ครั้งเดียวแล้วสลับสาขาได้ในแอปโดยไม่ต้อง logout

---

## 1. Data Model

### New Table: `BRANCHES`
```js
{ id: 'branch-1', shopId: 'shop-1', name: 'สาขาสุขุมวิท', address: '...', phone: '...', isActive: true }
```

### Modified: `USERS`
เพิ่ม `branchId`:
- `branchId: 'branch-1'` → staff ติดสาขา (login เข้าสาขานั้นเลย, ไม่สามารถสลับได้)
- `branchId: null` → owner/superadmin (login ครั้งเดียว เลือกดูสาขาใดก็ได้ในแอป)

### Modified: `SHOP_PRODUCTS`
เพิ่ม `branchId` field:
- แต่ละสาขามี stock/price เป็นของตัวเอง
- สินค้ามาตรฐาน (`PRODUCTS`) ยังเป็น central catalog (name, category, unit, barcode)
- `SHOP_PRODUCTS` ดึงข้อมูลจาก central + override stock/price ต่อสาขา

### Modified: `SALES`
เพิ่ม `branchId` (ต้องรู้ว่าขายที่สาขาไหน)

### Modified: `CARTS`
เพิ่ม `branchId` (ตะกร้าแยกต่อสาขา)

---

## 2. Auth Flow

### Login (`AuthContext`)
1. Login ตาม email/password → ได้ `user` object
2. **Staff** (`user.branchId` มีค่า) → login เข้าสาขานั้นเลย, **ไม่มี branch switcher** (ป้องกันเลือกผิด)
3. **Owner** (`user.branchId === null`) → login สำเร็จ → เข้าได้ทุกสาขา
4. `user` ใน context เก็บ `shopId` + `branchId` (สาขาที่กำลังทำงานอยู่)

### Branch Selector (Owner only)
- แสดงใน `AppLayout` header เป็น dropdown: `[สาขาสุขุมวิท]`, `[สาขาพระราม 9]...`
- กดเลือก → `setUser(prev => ({ ...prev, branchId: selected }))`
- **ชื่อสาขาแสดงชัดเจน** บน header ทุกหน้า (badge สีเด่น)
- สลับ branch → state ทั้งหมด refresh ตาม branch ใหม่ (carts แยกตาม branch)

### `useAuth()` hook
```js
const { user, branches, switchBranch } = useAuth()
// user.branchId = current working branch (for owner: whichever they selected)
// branches = [{ id, name }, ...] สำหรับ owner
```

---

## 3. POS Changes

- `allProducts` → filter `shop_products` ด้วย `user.branchId`
- **`CARTS`** เก็บเป็น object แยกตาม branch: `{ 'branch-1': [{ id, name, items }, ...], 'branch-2': [...] }`
  - Owner สลับ branch → โหลด carts ของสาขานั้น, activeCartId แยกต่อสาขา
  - Staff ไม่สลับ → ใช้ carts ของสาขาตัวเองอย่างเดียว
- `addToCart` / `cart` → ทำงานกับ `carts[currentBranch]`
- `handleCheckout` → บันทึก `branchId` ใน sale record
- Owner มี branch switcher ใน POS header (dropdown เล็กๆ มุมขวาบน)
- Staff แสดงชื่อสาขาแบบ read-only

---

## 4. Inventory Changes

- `shopProductService.getByShop(shopId)` → `getByBranch(branchId)`
- Owner สลับ branch → โหลด stock ของสาขานั้น
- Staff ดู/แก้ไข ได้แค่สาขาตัวเอง
- เพิ่มสินค้าใหม่ → ถ้ามี barcode ใน `PRODUCTS` → ดึง name/category/unit มาใช้ แต่ stock/price เป็นของสาขา
- Owner มี branch switcher ใน Inventory header เช่นเดียวกัน

---

## 5. Dashboard & Reports

- Stats (`getStats`) → filter ด้วย `branchId`
- Owner → dropdown เลือกดู `ทุกสาขา` (รวมยอด) หรือ `สาขาเฉพาะ`
- Staff → ดูเฉพาะสาขาตัวเอง

---

## 6. Migration Plan

1. `seedData` เพิ่ม `BRANCHES` table เริ่มต้น (1 สาขา) พร้อม `branchId` default
2. ถ้า `SHOP_PRODUCTS` เก่าไม่มี `branchId` → default ไปยังสาขาแรก
3. ถ้า `SALES` เก่าไม่มี `branchId` → default ไปยังสาขาแรก
4. `USERS` เก่า → `branchId: null` (owner) หรือ `branchId: 'branch-1'` (staff)

---

## 7. Files to Modify

| File | Changes |
|------|---------|
| `src/services/mockData.js` | เพิ่ม `BRANCHES` table, `branchService`, `branchId` ใน `SHOP_PRODUCTS`/`SALES`, carts เป็น object แยก branch |
| `src/context/AuthContext.jsx` | เก็บ `branchId`, `switchBranch()`, `branches` list สำหรับ owner |
| `src/components/BranchSwitcher.jsx` | Dropdown เลือกสาขา (owner only) |
| `src/pages/PosPage.jsx` | ใช้ `branchId` filter products, carts แยก branch, checkout บันทึก branch |
| `src/pages/InventoryPage.jsx` | ใช้ `branchId` filter stock, branch switcher สำหรับ owner |
| `src/pages/DashboardPage.jsx` | filter stats ตาม branch, dropdown ทุกสาขา/สาขาเฉพาะ |
| `src/components/layout/AppLayout.jsx` | แสดง `BranchSwitcher` ใน header |

---

## 8. ข้อควรระวัง

- **สิทธิ์**: staff ติดสาขา เพิ่ม/ลบสินค้าได้แค่ในสาขาตัวเอง, owner จัดการได้ทุกสาขา
- **สินค้ามาตรฐาน**: เพิ่มสินค้ามาตรฐานทำได้แค่ owner/superadmin (เพราะกระทบทุกสาขา)
- **สลับสาขา**: owner สลับได้ในแอปโดยไม่ต้อง logout, staff ติดสาขาไม่สามารถสลับได้
- **Carts**: ตะกร้าแยกต่อสาขา — owner สลับ branch แล้วตะกร้าเปลี่ยนตาม
- **Migration**: ข้อมูลเก่า default ไปสาขาแรกโดยอัตโนมัติ
