// ============================================================
// AI Lookup Service (OpenRouter)
// ============================================================

const STORAGE_KEYS = {
  apiKey: 'mobile_pos_ai_api_key',
  model: 'mobile_pos_ai_model',
}

export const AI_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (OpenAI)', desc: 'รวดเร็ว ราคาประหยัด' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (Google)', desc: 'ฟรีเทียร์มีให้ใช้' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku (Anthropic)', desc: 'รวดเร็ว ราคาประหยัด' },
  { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B (Meta)', desc: 'โมเดลโอเพนซอร์ส' },
]

export async function fetchAiModels() {
  const { apiKey } = getAiSettings()
  const headers = apiKey
    ? { 'Authorization': `Bearer ${apiKey}`, 'HTTP-Referer': window.location.origin, 'X-Title': 'Mobile POS' }
    : { 'HTTP-Referer': window.location.origin, 'X-Title': 'Mobile POS' }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', { headers })
    if (!res.ok) return AI_MODELS
    const data = await res.json()
    const models = data.data || []
    if (!models.length) return AI_MODELS
    return models.map(m => ({
      id: m.id,
      name: m.name || m.id,
      desc: m.description ? m.description.slice(0, 50) + (m.description.length > 50 ? '...' : '') : '',
    })).slice(0, 50)
  } catch {
    return AI_MODELS
  }
}

export function getAiSettings() {
  return {
    apiKey: localStorage.getItem(STORAGE_KEYS.apiKey) || import.meta.env.VITE_OPENROUTER_API_KEY || '',
    model: localStorage.getItem(STORAGE_KEYS.model) || AI_MODELS[0].id,
  }
}

export function setAiSettings(settings) {
  if (settings.apiKey !== undefined) {
    localStorage.setItem(STORAGE_KEYS.apiKey, settings.apiKey)
  }
  if (settings.model !== undefined) {
    localStorage.setItem(STORAGE_KEYS.model, settings.model)
  }
}

export async function lookupProductByBarcode(barcode, signal) {
  const { apiKey, model } = getAiSettings()
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า OpenRouter API Key กรุณาไปที่ ตั้งค่า > AI Model')
  }

  const prompt = `บาร์โค้ดสินค้า: "${barcode}"
กรุณาค้นหาข้อมูลสินค้าจากบาร์โค้ดนี้แล้วตอบกลับเป็น JSON เท่านั้น โดยไม่ต้องมีอธิบายเพิ่มเติม ในรูปแบบ:
{
  "name": "ชื่อสินค้า",
  "category": "หมวดหมู่",
  "unit": "หน่วย เช่น ขวด, ซอง, กล่อง, ชิ้น"
}
ถ้าไม่พบข้อมูล ให้ตอบ:
{
  "name": "",
  "category": "",
  "unit": ""
}`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Mobile POS',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `OpenRouter error ${res.status}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || ''

  // Extract JSON from response
  let jsonStr = content.trim()
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (jsonMatch) jsonStr = jsonMatch[0]

  try {
    const parsed = JSON.parse(jsonStr)
    return {
      name: parsed.name || '',
      category: parsed.category || '',
      unit: parsed.unit || '',
    }
  } catch {
    throw new Error('AI ตอบกลับในรูปแบบที่ไม่ถูกต้อง')
  }
}
