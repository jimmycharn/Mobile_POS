# ระบบขายซ้อน / บิลค้าง (Parallel Carts / Suspend Sale)

เปลี่ยนระบบตะกร้าจากตะกร้าเดียวเป็น **หลายตะกร้าพร้อมกัน** เพื่อรองรับสถานการณ์ที่ลูกค้าคนที่ 1 ยังเลือกของไม่เสร็จ แต่มีลูกค้าคนที่ 2 รีบซื้อ สามารถเปิดบิลใหม่ บริการลูกค้าที่ 2 ก่อนได้

---

## 1. Data Model

### `cartService` (`mockData.js`)

เปลี่ยนจากเก็บ cart เดียว เป็นเก็บ **รายการบิล (tabs)**:

```js
const DEFAULT_CARTS = [{ id: 'cart-1', name: 'บิล 1', items: [] }]

export const cartService = {
  getCarts() {
    return JSON.parse(sessionStorage.getItem(DB_KEYS.CARTS) || JSON.stringify(DEFAULT_CARTS))
  },
  setCarts(carts) {
    sessionStorage.setItem(DB_KEYS.CARTS, JSON.stringify(carts))
  },
  getActiveCartId() {
    return sessionStorage.getItem(DB_KEYS.ACTIVE_CART) || 'cart-1'
  },
  setActiveCartId(id) {
    sessionStorage.setItem(DB_KEYS.ACTIVE_CART, id)
  },
  clear() {
    sessionStorage.removeItem(DB_KEYS.CARTS)
    sessionStorage.removeItem(DB_KEYS.ACTIVE_CART)
  },
}
```

เพิ่ม constants:
```js
CARTS: 'mp_carts',
ACTIVE_CART: 'mp_active_cart',
```

---

## 2. State Changes in `PosPage.jsx`

### State ใหม่
```js
const [carts, setCarts] = useState([])        // [{ id, name, items: [] }, ...]
const [activeCartId, setActiveCartId] = useState('')
```

### Derived Values
```js
const activeCart = carts.find(c => c.id === activeCartId) || { items: [] }
const cart = activeCart.items                 // ใช้ชื่อเดิมเพื่อง่ายต่อการ refactor UI
const cartTotal = cart.reduce(...)
const cartItems = cart.reduce(...)
```

### ฟังก์ชันหลัก

#### `addToCart(product)`
- ใช้ `activeCartId` อัปเดต items ของ cart นั้น

#### `updateQty(id, delta)` / `removeFromCart(id)`
- ทำงานกับ `activeCart.items`

#### `createNewCart()`
- สร้าง cart ใหม่ด้วย id = `cart-${Date.now()}`
- ตั้งชื่อ "บิล N" (N = จำนวนบิล + 1)
- เปลี่ยน `activeCartId` ไปยังบิลใหม่

#### `switchCart(id)`
- เปลี่ยน `activeCartId`

#### `closeCart(id)`
- ลบ cart ออกจาก `carts`
- ถ้าลบบิลที่ active → สลับไปบิลก่อนหน้า/ถัดไป
- ถ้าเหลือ 0 บิล → สร้าง "บิล 1" เปล่าให้อัตโนมัติ

#### `renameCart(id, name)`
- อาจใช้เปลี่ยนชื่อบิล (optional)

#### `handleCheckout()`
- Checkout เฉพาะ `activeCart`
- หลัง checkout เสร็จ → `closeCart(activeCartId)` แล้วสร้างบิลใหม่ (หรือเหลือบิลอื่นไว้)
- ไม่กระทบบิลค้างอื่น

---

## 3. UI Changes

### A. แถบบิล (Cart Tabs)
แสดงเหนือตะกร้าสินค้า (desktop + mobile) เป็นแถวปุ่มเลื่อน:

```
┌──────────────────────────────────────────────┐
│ [บิล 1] [บิล 2] [บิล 3] [+]                │  ← แถบเลือกบิล
│    ▲ active (primary-600)                     │
├──────────────────────────────────────────────┤
│  [รูป] น้ำดื่ม 600ml              ฿10  [1]  │
│  [รูป] มาม่า รสต้มยำ              ฿12  [1]  │
├──────────────────────────────────────────────┤
│  รวม 2 ชิ้น                        ฿22      │
│  [         ชำระเงิน         ]               │
└──────────────────────────────────────────────┘
```

- แต่ละ tab: แสดงชื่อบิล + จำนวนชิ้น เช่น `บิล 1 (2)`
- Tab active: สี primary-600 กับ border
- Tab ที่มีสินค้า: badge จำนวนชิ้น
- ปุ่ม `[+]` ขวาสุด: สร้างบิลใหม่
- ปุ่ม `x` บนแต่ละ tab: ปิดบิลนั้น (ถาม confirm ถ้ามีสินค้า)

### B. Desktop Cart Panel
แถว cart tabs อยู่เหนือ header "ตะกร้าสินค้า" ใน desktop panel

### C. Mobile Cart Sheet
แถว cart tabs อยู่ใต้ header "ตะกร้าสินค้า" ใน bottom sheet

### D. Scanner Modal
Scanner ยังเพิ่มสินค้าเข้า `activeCart` เหมือนเดิม — ไม่เปลี่ยน

---

## 4. Files to Modify

| File | Changes |
|------|---------|
| `src/services/mockData.js` | เพิ่ม `DB_KEYS.CARTS`, `DB_KEYS.ACTIVE_CART`, แก้ `cartService` เป็น multi-cart |
| `src/pages/PosPage.jsx` | Refactor `cart` state → `carts` + `activeCartId`, เพิ่มฟังก์ชัน `createNewCart`, `switchCart`, `closeCart`, แสดง cart tabs UI, แก้ `handleCheckout` ให้ close active cart หลังจ่าย |

---

## 5. ข้อควรระวัง

- **Session persistence**: `sessionStorage` ยังคงใช้ได้ดี (หายเมื่อปิด tab) ไม่ต้องเปลี่ยน
- **Cart max limit**: อาจจำกัดไม่เกิน 5-8 บิลพร้อมกัน เพื่อไม่ให้ UI แน่น
- **Empty cart**: บิลที่สร้างใหม่ items ว่างเปล่า ไม่ต้อง validate
- **Checkout**: ถ้า active cart ว่างเปล่า → ปุ่มชำระเงิน disabled
- **Stock check**: `addToCart` ยังเช็ค stock ของ product ปัจจุบัน (ไม่ lock stock ขณะค้างบิล — คือระบบนี้ไม่ได้ reserve stock สำหรับบิลค้าง ถ้าของหมดระหว่างค้าง จะ add ไม่ได้ตอน checkout)

---

## 6. ตัวอย่าง UX Flow

1. เปิด POS → `บิล 1` ว่างเปล่า
2. สแกน/เพิ่มสินค้า 3 รายการ → `บิล 1 (3)`
3. ลูกค้าคนที่ 1 ยังเลือกไม่เสร็จ → กด `[+]` → เปิด `บิล 2`
4. สแกนสินค้าให้ลูกค้าคนที่ 2 → `บิล 2 (2)`
5. กด `บิล 2` tab → แสดงรายการ → กดชำระเงิน → checkout → `บิล 2` หายไป → กลับมา `บิล 1`
6. ลูกค้าคนที่ 1 เลือกเสร็จ → checkout `บิล 1`

