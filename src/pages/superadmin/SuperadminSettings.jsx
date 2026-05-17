import { useState, useEffect } from 'react'
import { Settings, Cpu, Palette, Landmark, Globe, Bell, Database, X, Save, Check, AlertTriangle, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { AI_MODELS, getAiSettings, setAiSettings, fetchAiModels } from '../../services/aiService'

export default function SuperadminSettings() {
  const { logout } = useAuth()
  const [activeCard, setActiveCard] = useState(null)
  const [aiModels, setAiModels] = useState(AI_MODELS)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiForm, setAiForm] = useState({ apiKey: '', model: AI_MODELS[0].id })
  const [themeForm, setThemeForm] = useState({ primaryColor: '#6366f1' })
  const [bankForm, setBankForm] = useState({ name: '', bankName: '', accountNo: '', accountHolder: '' })
  const [systemForm, setSystemForm] = useState({ appName: 'Mobile POS', companyName: '' })
  const [notifForm, setNotifForm] = useState({ emailAlerts: true, salesReport: false })
  const [toast, setToast] = useState('')

  useEffect(() => {
    const ai = getAiSettings()
    setAiForm(ai)
  }, [])

  const openAiCard = async () => {
    setActiveCard('ai')
    setAiLoading(true)
    const models = await fetchAiModels()
    setAiModels(models)
    setAiLoading(false)
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const settingsCards = [
    {
      id: 'ai',
      title: 'AI Model',
      icon: Cpu,
      desc: 'ตั้งค่า OpenRouter API และเลือกโมเดล',
      color: 'bg-violet-50 text-violet-600',
    },
    {
      id: 'theme',
      title: 'ธีม',
      icon: Palette,
      desc: 'สีหลักของระบบ',
      color: 'bg-pink-50 text-pink-600',
    },
    {
      id: 'bank',
      title: 'บัญชีธนาคาร',
      icon: Landmark,
      desc: 'บัญชีรับเงินค่าสมัครสมาชิก',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      id: 'system',
      title: 'ระบบ',
      icon: Globe,
      desc: 'ชื่อแอป ข้อมูลบริษัท',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      id: 'notification',
      title: 'การแจ้งเตือน',
      icon: Bell,
      desc: 'อีเมลแจ้งเตือนและรายงาน',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      id: 'data',
      title: 'ข้อมูลสำรอง',
      icon: Database,
      desc: 'สำรองและกู้คืนข้อมูล',
      color: 'bg-slate-50 text-slate-600',
    },
  ]

  return (
    <div className="h-full pb-20 md:pb-0 overflow-y-auto">
      <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4">
        <h1 className="text-lg md:text-xl font-bold text-slate-800">ตั้งค่าระบบ</h1>
        <p className="text-sm text-slate-400">จัดการการตั้งค่าสำหรับผู้ดูแลระบบ</p>
      </div>

      <div className="p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {settingsCards.map(card => {
            const Icon = card.icon
            return (
              <button
                key={card.id}
                onClick={() => card.id === 'ai' ? openAiCard() : setActiveCard(card.id)}
                className="bg-white rounded-2xl border border-slate-100 p-5 text-left hover:border-primary-200 hover:shadow-sm transition-all"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                  <Icon size={20} />
                </div>
                <h3 className="font-bold text-slate-800 mb-1">{card.title}</h3>
                <p className="text-sm text-slate-400">{card.desc}</p>
              </button>
            )
          })}
        </div>

        {/* Logout */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={logout}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">ออกจากระบบ</span>
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg flex items-center space-x-2">
          <Check size={16} />
          <span>{toast}</span>
        </div>
      )}

      {/* AI Model Modal */}
      {activeCard === 'ai' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-scale-in my-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                  <Cpu size={20} className="text-violet-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">AI Model</h3>
              </div>
              <button onClick={() => setActiveCard(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-xl text-sm text-slate-600">
                <span>API Key อ่านจาก <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200">.env</code> โดยอัตโนมัติ</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">โมเดล AI</label>
                <select
                  value={aiForm.model}
                  onChange={e => setAiForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm bg-white"
                >
                  {aiModels.map(m => (
                    <option key={m.id} value={m.id}>ชื่อ: {m.name}, model: {m.id}</option>
                  ))}
                </select>
                {aiLoading && <p className="text-xs text-slate-400 mt-1">กำลังโหลดรายชื่อโมเดลจาก OpenRouter...</p>}
              </div>
            </div>
            <div className="flex space-x-3 mt-5">
              <button onClick={() => setActiveCard(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ปิด</button>
              <button
                onClick={() => {
                  setAiSettings({ model: aiForm.model })
                  showToast('บันทึกการตั้งค่า AI เรียบร้อย')
                  setActiveCard(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Theme Modal */}
      {activeCard === 'theme' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-scale-in my-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center">
                  <Palette size={20} className="text-pink-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">ธีม</h3>
              </div>
              <button onClick={() => setActiveCard(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">สีหลัก</label>
              <div className="flex space-x-3">
                {['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'].map(color => (
                  <button
                    key={color}
                    onClick={() => setThemeForm(f => ({ ...f, primaryColor: color }))}
                    className={`w-10 h-10 rounded-xl border-2 ${themeForm.primaryColor === color ? 'border-slate-800' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex space-x-3 mt-5">
              <button onClick={() => setActiveCard(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ปิด</button>
              <button
                onClick={() => {
                  showToast('บันทึกธีมเรียบร้อย')
                  setActiveCard(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Account Modal */}
      {activeCard === 'bank' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-scale-in my-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <Landmark size={20} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">บัญชีธนาคาร</h3>
              </div>
              <button onClick={() => setActiveCard(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input placeholder="ชื่อบัญชี (สำหรับแสดง)" value={bankForm.name} onChange={e => setBankForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
              <input placeholder="ชื่อธนาคาร" value={bankForm.bankName} onChange={e => setBankForm(f => ({ ...f, bankName: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
              <input placeholder="เลขบัญชี" value={bankForm.accountNo} onChange={e => setBankForm(f => ({ ...f, accountNo: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
              <input placeholder="ชื่อเจ้าของบัญชี" value={bankForm.accountHolder} onChange={e => setBankForm(f => ({ ...f, accountHolder: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
            </div>
            <div className="flex space-x-3 mt-5">
              <button onClick={() => setActiveCard(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ปิด</button>
              <button
                onClick={() => {
                  showToast('บันทึกบัญชีธนาคารเรียบร้อย')
                  setActiveCard(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System Modal */}
      {activeCard === 'system' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-scale-in my-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Globe size={20} className="text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">ระบบ</h3>
              </div>
              <button onClick={() => setActiveCard(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ชื่อแอป</label>
                <input value={systemForm.appName} onChange={e => setSystemForm(f => ({ ...f, appName: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ชื่อบริษัท / ผู้พัฒนา</label>
                <input value={systemForm.companyName} onChange={e => setSystemForm(f => ({ ...f, companyName: e.target.value }))} placeholder="เช่น ABC Technology Co., Ltd." className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm" />
              </div>
            </div>
            <div className="flex space-x-3 mt-5">
              <button onClick={() => setActiveCard(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ปิด</button>
              <button
                onClick={() => {
                  showToast('บันทึกการตั้งค่าระบบเรียบร้อย')
                  setActiveCard(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {activeCard === 'notification' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-scale-in my-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Bell size={20} className="text-amber-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">การแจ้งเตือน</h3>
              </div>
              <button onClick={() => setActiveCard(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                <input type="checkbox" checked={notifForm.emailAlerts} onChange={e => setNotifForm(f => ({ ...f, emailAlerts: e.target.checked }))} className="w-5 h-5 rounded accent-primary-600" />
                <span className="text-sm text-slate-700">แจ้งเตือนทางอีเมลเมื่อมีเหตุสำคัญ</span>
              </label>
              <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                <input type="checkbox" checked={notifForm.salesReport} onChange={e => setNotifForm(f => ({ ...f, salesReport: e.target.checked }))} className="w-5 h-5 rounded accent-primary-600" />
                <span className="text-sm text-slate-700">ส่งรายงานยอดขายประจำวันทางอีเมล</span>
              </label>
            </div>
            <div className="flex space-x-3 mt-5">
              <button onClick={() => setActiveCard(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ปิด</button>
              <button
                onClick={() => {
                  showToast('บันทึกการตั้งค่าแจ้งเตือนเรียบร้อย')
                  setActiveCard(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Backup Modal */}
      {activeCard === 'data' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-scale-in my-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                  <Database size={20} className="text-slate-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">ข้อมูลสำรอง</h3>
              </div>
              <button onClick={() => setActiveCard(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-sm font-medium text-slate-700 mb-1">สำรองข้อมูล</p>
                <p className="text-xs text-slate-400 mb-3">ดาวน์โหลดข้อมูลร้านค้า สินค้า และรายงานเป็นไฟล์ JSON</p>
                <button
                  onClick={() => showToast('ฟีเจอร์สำรองข้อมูลจะพร้อมใช้งานเร็วๆ นี้')}
                  className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium"
                >
                  ดาวน์โหลดข้อมูล
                </button>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-sm font-medium text-slate-700 mb-1">กู้คืนข้อมูล</p>
                <p className="text-xs text-slate-400 mb-3">อัปโหลดไฟล์ JSON เพื่อกู้คืนข้อมูลระบบ</p>
                <button
                  onClick={() => showToast('ฟีเจอร์กู้คืนข้อมูลจะพร้อมใช้งานเร็วๆ นี้')}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium"
                >
                  อัปโหลดไฟล์
                </button>
              </div>
            </div>
            <div className="flex space-x-3 mt-5">
              <button onClick={() => setActiveCard(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
