---
description: สร้างระบบ PromptPay QR Code สำหรับรับชำระเงินผ่านแอปธนาคารในไทย
---

# PromptPay QR Code System

ระบบสร้าง QR Code มาตรฐาน EMVCo สำหรับชำระเงินผ่าน PromptPay ในไทย รองรับการสแกนผ่านแอปธนาคารทุกสถาบัน

---

## 1. ติดตั้ง Dependencies

```bash
npm install promptpay-qr qrcode
npm install -D @types/qrcode
```

| Package | หน้าที่ |
|---------|---------|
| `promptpay-qr` | สร้าง payload string ตามมาตรฐาน EMVCo QR MPM |
| `qrcode` | แปลง payload เป็น QR Code image (Data URL / Canvas) |

---

## 2. PromptPay ID ที่รองรับ

| ประเภท | รูปแบบ | ตัวอย่าง |
|--------|--------|---------|
| เบอร์โทรศัพท์ | 10 หลัก ขึ้นต้นด้วย `0` | `0812345678` |
| เลขบัตรประชาชน | 13 หลัก | `1234567890123` |
| เลขประจำตัวผู้เสียภาษี | 13 หลัก | `1234567890123` |
| e-Wallet ID | 15 หลัก | `123456789012345` |

> **สำคัญ:** ตัดอักขระที่ไม่ใช่ตัวเลขออกก่อนตรวจสอบ (เช่น ช่องว่าง, `-`, `/`)

---

## 3. Utility Function (Copy-Paste)

สร้างไฟล์ `lib/promptpay.ts`:

```typescript
import promptpayQr from 'promptpay-qr';

// Handle CJS/ESM interop
const generatePayload =
  typeof (promptpayQr as any) === 'function'
    ? (promptpayQr as any)
    : (promptpayQr as any).default;

/**
 * Generate a PromptPay-compatible QR payload (EMVCo QR MPM standard).
 * @param id   - PromptPay ID (phone 10d, citizen/tax ID 13d, e-Wallet 15d)
 * @param amount - Amount in THB (optional)
 * @returns EMVCo QR payload string, or raw ID if not valid PromptPay ID
 */
export function generatePromptPayPayload(id: string, amount?: number): string {
  const cleanId = id.replace(/[^0-9]/g, '');
  const isPromptPay =
    /^0\d{9}$/.test(cleanId) ||   // mobile
    /^\d{13}$/.test(cleanId) ||   // citizen / tax ID
    /^\d{15}$/.test(cleanId);     // e-wallet

  if (!isPromptPay || !generatePayload) {
    return id; // fallback: plain text
  }

  try {
    return generatePayload(cleanId, {
      amount: amount && amount > 0 ? amount : undefined,
    });
  } catch {
    return id;
  }
}

/**
 * Check if a bank account number is a PromptPay ID.
 */
export function isPromptPayId(accountNo: string): boolean {
  const clean = accountNo.replace(/[^0-9]/g, '');
  return /^0\d{9}$/.test(clean) || /^\d{13}$/.test(clean) || /^\d{15}$/.test(clean);
}
```

---

## 4. สร้าง QR Code Image (React)

### 4.1 แบบ Data URL (แนะนำ)

```typescript
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { generatePromptPayPayload, isPromptPayId } from '@/lib/promptpay';

function PromptPayQr({ accountNo, amount }: { accountNo: string; amount?: number }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isPromptPayId(accountNo)) {
      setQrUrl(null);
      return;
    }
    const payload = generatePromptPayPayload(accountNo, amount);
    QRCode.toDataURL(payload, { width: 200, margin: 2 })
      .then((url) => setQrUrl(url))
      .catch(() => setQrUrl(null));
  }, [accountNo, amount]);

  if (!qrUrl) return <div>ไม่สามารถสร้าง QR Code ได้</div>;

  return <img src={qrUrl} alt="PromptPay QR" style={{ width: 200, height: 200 }} />;
}
```

### 4.2 แบบ Canvas (เล็ก / ไม่ต้องโหลด image)

```typescript
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { generatePromptPayPayload, isPromptPayId } from '@/lib/promptpay';

function PromptPayQrCanvas({ accountNo, amount }: { accountNo: string; amount?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !isPromptPayId(accountNo)) return;
    const payload = generatePromptPayPayload(accountNo, amount);
    QRCode.toCanvas(canvasRef.current, payload, { width: 200, margin: 2 });
  }, [accountNo, amount]);

  return <canvas ref={canvasRef} />;
}
```

---

## 5. ตัวอย่างการใช้งานในหน้าชำระเงิน

```tsx
export default function PaymentPage() {
  const [bank, setBank] = useState({
    account_no: '0812345678',
    account_name: 'สมชาย ใจดี',
    bank_name: 'PromptPay',
  });
  const [amount, setAmount] = useState(1000);

  return (
    <div>
      <h2>ชำระเงิน {amount.toLocaleString()} ฿</h2>
      <p>ชื่อบัญชี: {bank.account_name}</p>
      <p>หมายเลข: {bank.account_no}</p>
      <PromptPayQr accountNo={bank.account_no} amount={amount} />
      <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
        สแกนด้วยแอปธนาคารเพื่อโอนเงิน
      </p>
    </div>
  );
}
```

---

## 6. รวมกับระบบ Bank Assignment

ถ้ามีระบบเลือกบัญชีธนาคาร → ตรวจสอบ PromptPay อัตโนมัติ:

```typescript
const [myBank, setMyBank] = useState<Bank | null>(null);
const [isPromptPay, setIsPromptPay] = useState(false);
const [qrUrl, setQrUrl] = useState<string | null>(null);

useEffect(() => {
  setIsPromptPay(isPromptPayId(myBank?.account_no || ''));
}, [myBank]);

useEffect(() => {
  if (!isPromptPay || !myBank?.account_no || !amount) {
    setQrUrl(null);
    return;
  }
  const payload = generatePromptPayPayload(myBank.account_no, amount);
  QRCode.toDataURL(payload, { width: 200, margin: 2 })
    .then(setQrUrl)
    .catch(() => setQrUrl(null));
}, [isPromptPay, myBank, amount]);
```

---

## 7. หมายเหตุสำคัญ

- **PromptPay ไม่มี Webhook / Callback อัตโนมัติ** ต้องให้ผู้ใช้ส่งสลิปมายืนยันเอง
- แนะนำให้มีปุ่ม **"แจ้งชำระแล้ว / อัปโหลดสลิป"** แยกต่างหาก
- ถ้าต้องการ auto-confirm จริง ๆ ต้องใช้บริการเช่น Omise, Stripe, 2C2P แทน
- `amount` เป็น optional — ถ้าไม่ใส่ ผู้โอนจะพิมพ์จำนวนเงินเองในแอปธนาคาร
- แพ็กเกจ `promptpay-qr` ไม่มี dependency ภายนอก น้ำหนักเบา (~5KB)
