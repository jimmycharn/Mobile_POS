import QRCode from 'qrcode'

// promptpay-qr is CJS, handle interop
import promptpayQrPkg from 'promptpay-qr'
const generatePayload =
  typeof promptpayQrPkg === 'function'
    ? promptpayQrPkg
    : promptpayQrPkg.default || promptpayQrPkg

export function isPromptPayId(id) {
  const clean = id.replace(/[^0-9]/g, '')
  return /^0\d{9}$/.test(clean) || /^\d{13}$/.test(clean) || /^\d{15}$/.test(clean)
}

export async function generatePromptPayQrUrl(id, amount) {
  const cleanId = id.replace(/[^0-9]/g, '')
  if (!isPromptPayId(id)) return null

  try {
    const payload = generatePayload(cleanId, { amount: amount && amount > 0 ? amount : undefined })
    return await QRCode.toDataURL(payload, { width: 280, margin: 2 })
  } catch {
    return null
  }
}
