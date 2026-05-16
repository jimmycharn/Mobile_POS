// Barcode standard validation
// Standard: EAN-13, EAN-8, UPC-A, ITF-14, SSCC, GS1, URL-based QR codes
// Non-standard: internal codes, random numbers, custom shop codes

function validateEAN13(code) {
  if (!/^\d{13}$/.test(code)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const checksum = (10 - (sum % 10)) % 10
  return checksum === parseInt(code[12])
}

function validateEAN8(code) {
  if (!/^\d{8}$/.test(code)) return false
  let sum = 0
  for (let i = 0; i < 7; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 3 : 1)
  }
  const checksum = (10 - (sum % 10)) % 10
  return checksum === parseInt(code[7])
}

function validateUPCA(code) {
  if (!/^\d{12}$/.test(code)) return false
  let sum = 0
  for (let i = 0; i < 11; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 3 : 1)
  }
  const checksum = (10 - (sum % 10)) % 10
  return checksum === parseInt(code[11])
}

/**
 * Check if a barcode/code is a standard product identifier
 * Standard codes: EAN-13, EAN-8, UPC-A, ITF-14, SSCC, GS1 patterns, URL-based QR
 * Non-standard: internal shop codes, random numbers
 */
export function isStandardBarcode(code) {
  if (!code || typeof code !== 'string') return false
  const trimmed = code.trim()
  if (trimmed.length === 0) return false

  // URL-based QR code (common for payment/product QR)
  if (/^https?:\/\//.test(trimmed)) return true

  // GS1 Application Identifier format, e.g. (01)12345678901234
  if (/^\(\d{2,4}\)/.test(trimmed)) return true

  // Pure numeric checks
  if (/^\d+$/.test(trimmed)) {
    const len = trimmed.length
    // EAN-13
    if (len === 13 && validateEAN13(trimmed)) return true
    // EAN-8
    if (len === 8 && validateEAN8(trimmed)) return true
    // UPC-A
    if (len === 12 && validateUPCA(trimmed)) return true
    // ITF-14 (14 digits, no checksum validation needed for identification)
    if (len === 14) return true
    // SSCC (18 digits)
    if (len === 18) return true
    // EAN-128 / GS1-128 usually starts with specific AI codes
    if (len >= 16 && len <= 48) return true
  }

  return false
}
