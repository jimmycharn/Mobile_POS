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

function getBarcodeCountry(barcode) {
  const b = barcode.replace(/\D/g, '')
  const prefix3 = b.slice(0, 3)
  const prefix2 = b.slice(0, 2)
  if (prefix3 === '885') return 'ประเทศไทย (Thailand)'
  if (prefix3 >= '690' && prefix3 <= '699') return 'ประเทศจีน (China)'
  if (prefix3 >= '880' && prefix3 <= '881') return 'ประเทศเกาหลีใต้ (South Korea)'
  if (prefix3 === '890') return 'ประเทศอินเดีย (India)'
  if (prefix3 === '93') return 'ประเทศออสเตรเลีย (Australia)'
  if (prefix3 === '94') return 'ประเทศนิวซีแลนด์ (New Zealand)'
  if (prefix2 >= '00' && prefix2 <= '09') return 'สหรัฐอเมริกา/แคนาดา (USA/Canada)'
  if (prefix2 >= '30' && prefix2 <= '37') return 'ฝรั่งเศส (France)'
  if (prefix2 >= '40' && prefix2 <= '44') return 'เยอรมนี (Germany)'
  if (prefix2 >= '45' && prefix2 <= '49') return 'ญี่ปุ่น (Japan)'
  if (prefix2 === '50') return 'สหราชอาณาจักร (UK)'
  if (prefix2 === '76') return 'สวิตเซอร์แลนด์ (Switzerland)'
  if (prefix2 >= '80' && prefix2 <= '83') return 'อิตาลี (Italy)'
  if (prefix2 === '84') return 'สเปน (Spain)'
  if (prefix2 === '87') return 'เนเธอร์แลนด์ (Netherlands)'
  return 'ไม่ทราบประเทศ'
}

export async function lookupProductByBarcode(barcode, signal) {
  const { apiKey, model } = getAiSettings()
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า OpenRouter API Key กรุณาไปที่ ตั้งค่า > AI Model')
  }

  const country = getBarcodeCountry(barcode)
  const prompt = `ฉันมีบาร์โค้ดสินค้า: "${barcode}"
บาร์โค้ดนี้ลงทะเบียนในประเทศ: ${country}

คุณเป็นผู้เชี่ยวชาญด้านสินค้าอุปโภคบริโภคและบาร์โค้ด EAN/UPC กรุณาช่วยระบุข้อมูลสินค้าจากบาร์โค้ดนี้ให้ได้มากที่สุด

ถ้าคุณรู้จักสินค้านี้ (แม้จะไม่แน่ใจ 100% แต่มีความเป็นไปได้สูง):
- ชื่อสินค้า: ระบุชื่อยี่ห้อและรุ่น/ขนาด เช่น "Coca-Cola 325ml", "Lay's รสดั้งเดิม 50g", "ยาสีฟัน Colgate 150g"
- หมวดหมู่: ระบุหมวดหมู่ที่เหมาะสม เช่น เครื่องดื่ม, ขนม, อาหารแห้ง, ของใช้ในบ้าน, ยาและเวชภัณฑ์, เครื่องสำอาง, อาหารสด
- หน่วย: ระบุหน่วยบรรจุภัณฑ์ เช่น ขวด, กล่อง, ซอง, ชิ้น, แพ็ค, กระป๋อง, ถุง

ถ้าคุณไม่รู้จักบาร์โค้ดนี้เลย หรือไม่มีข้อมูลใดๆ ให้ตอบกลับเป็น JSON ว่าง:
{"name":"","category":"","unit":""}

ถ้ารู้จัก ตอบกลับเป็น JSON เท่านั้น โดยไม่ต้องมีอธิบายเพิ่มเติม:
{"name":"ชื่อสินค้า","category":"หมวดหมู่","unit":"หน่วย"}`

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
      messages: [
        { role: 'system', content: 'คุณเป็นผู้เชี่ยวชาญด้านสินค้าอุปโภคบริโภคและบาร์โค้ด EAN/UPC คุณสามารถระบุชื่อสินค้า หมวดหมู่ และหน่วยจากบาร์โค้ดได้ ตอบกลับเป็น JSON เท่านั้น' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
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
