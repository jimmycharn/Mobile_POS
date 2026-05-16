import { useState, useEffect } from 'react'
import { Store, Users, Plus, Trash2, User, Shield, Smartphone, LogOut, Edit3, MapPin, Building2, Landmark, CreditCard, PenLine, X, ChevronDown, ChevronUp, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { shopService, userService, authService, packageService, branchService, bankAccountService } from '../services/supabaseApi'

export default function ShopSettingsPage() {
  const { user, logout } = useAuth()
  const [shop, setShop] = useState(null)
  const [staff, setStaff] = useState([])
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', branchId: '' })
  const [pkg, setPkg] = useState(null)
  const [branches, setBranches] = useState([])
  const [showAddBranch, setShowAddBranch] = useState(false)
  const [newBranch, setNewBranch] = useState({ name: '', address: '', phone: '' })
  const [editingStaff, setEditingStaff] = useState(null)
  const [bankAccounts, setBankAccounts] = useState([])
  const [showAddBank, setShowAddBank] = useState(false)
  const [editingBank, setEditingBank] = useState(null)
  const [newBank, setNewBank] = useState({ name: '', bankName: '', accountNo: '', accountHolder: '', type: 'bank' })
  const [editingBranch, setEditingBranch] = useState(null)
  const [editingShop, setEditingShop] = useState(false)
  const [shopForm, setShopForm] = useState({ name: '', phone: '', packageId: '' })
  const [allPackages, setAllPackages] = useState([])
  const [showPackageSelector, setShowPackageSelector] = useState(false)
  const [expandedBranchIds, setExpandedBranchIds] = useState(new Set())

  const refreshBranches = async () => {
    if (user?.shopId) {
      const list = await branchService.getByShop(user.shopId)
      setBranches(list)
      setExpandedBranchIds(prev => {
        const next = new Set(prev)
        list.forEach(b => next.add(b.id))
        return next
      })
    }
  }

  const refreshBankAccounts = async () => {
    if (user?.shopId) setBankAccounts(await bankAccountService.getByShop(user.shopId))
  }

  const refreshPackages = async () => {
    const data = await packageService.getAll()
    setAllPackages(data.filter(p => p.isVisible !== false))
  }

  const toggleBranch = (id) => {
    setExpandedBranchIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    const load = async () => {
      if (user?.shopId) {
        const s = await shopService.getById(user.shopId)
        setShop(s)
        const staffList = await userService.getByShop(user.shopId)
        setStaff(staffList.filter(u => u.id !== user.id))
        if (s) setPkg(await packageService.getById(s.packageId))
        await refreshBranches()
        await refreshBankAccounts()
      }
    }
    load()
    refreshPackages()
    const onFocus = () => refreshPackages()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [user])

  useEffect(() => {
    if (showPackageSelector) refreshPackages()
  }, [showPackageSelector])

  const handleAddStaff = async () => {
    try {
      const result = await userService.create({
        ...newStaff,
        role: 'staff',
        shopId: user.shopId,
        branchId: newStaff.branchId || branches[0]?.id,
        avatar: null,
      })
      await authService.logActivity('ADD_STAFF', `เพิ่มพนักงาน ${newStaff.name}`)
      const staffList = await userService.getByShop(user.shopId)
      setStaff(staffList.filter(u => u.id !== user.id))
      setShowAddStaff(false)
      setNewStaff({ name: '', email: '', password: '', branchId: '' })
    } catch (err) {
      alert('เพิ่มพนักงานไม่สำเร็จ: ' + err.message)
    }
  }

  const handleRemoveStaff = async (id, name) => {
    if (!confirm(`ลบพนักงาน ${name}?`)) return
    try {
      await userService.remove(id)
      await authService.logActivity('REMOVE_STAFF', `ลบพนักงาน ${name}`)
      const staffList = await userService.getByShop(user.shopId)
      setStaff(staffList.filter(u => u.id !== user.id))
    } catch (err) {
      alert('ลบพนักงานไม่สำเร็จ: ' + err.message)
    }
  }

  const toggleStaffPermission = async (staffMember, field) => {
    try {
      const updated = { ...staffMember, [field]: !staffMember[field] }
      await userService.update(staffMember.id, { [field]: updated[field] })
      setStaff(prev => prev.map(s => s.id === staffMember.id ? updated : s))
      await authService.logActivity('UPDATE_STAFF_PERM', `เปลี่ยนสิทธิ์ ${field} ของ ${staffMember.name} เป็น ${updated[field] ? 'เปิด' : 'ปิด'}`)
    } catch (err) {
      alert('อัปเดตสิทธิ์ไม่สำเร็จ: ' + err.message)
    }
  }

  return (
    <div className="min-h-full pb-24 md:pb-0">
      <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4">
        <h1 className="text-lg md:text-xl font-bold text-slate-800">ตั้งค่าร้านค้า</h1>
        <p className="text-sm text-slate-400">ข้อมูลร้านค้าและการจัดการพนักงาน</p>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* Shop Info */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center">
                <Store size={28} className="text-primary-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">{shop?.name || 'ร้านค้า'}</h2>
                <p className="text-sm text-slate-400">{shop?.email}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setShopForm({
                  name: shop?.name || '',
                  phone: shop?.phone || '',
                  packageId: shop?.packageId || '',
                })
                setEditingShop(true)
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary-50 text-slate-300 hover:text-primary-500"
            >
              <PenLine size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 text-xs mb-1">เบอร์โทร</p>
              <p className="font-medium text-slate-700">{shop?.phone || '-'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 cursor-pointer hover:bg-primary-50 transition-colors"
                 onClick={() => setShowPackageSelector(true)}>
              <p className="text-slate-400 text-xs mb-1">แพ็คเกจ</p>
              <p className="font-medium text-primary-600">{pkg?.name || '-'} <span className="text-xs text-primary-400">(ดูรายละเอียด)</span></p>
            </div>
          </div>
        </div>

        {/* Owner card — below shop info */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-200 rounded-full flex items-center justify-center">
              <Shield size={18} className="text-primary-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
            <span className="px-2.5 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-lg">เจ้าของร้าน</span>
          </div>
        </div>

        {/* Edit Shop Modal */}
        {editingShop && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in my-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">แก้ไขข้อมูลร้าน</h3>
                <button onClick={() => setEditingShop(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">ชื่อร้าน</label>
                  <input
                    value={shopForm.name}
                    onChange={e => setShopForm({ ...shopForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">เบอร์โทร</label>
                  <input
                    value={shopForm.phone}
                    onChange={e => setShopForm({ ...shopForm, phone: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">แพ็คเกจ</label>
                  <select
                    value={shopForm.packageId}
                    onChange={e => setShopForm({ ...shopForm, packageId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm bg-white"
                  >
                    <option value="">เลือกแพ็คเกจ</option>
                    {allPackages.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex space-x-3 mt-5">
                <button onClick={() => setEditingShop(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ยกเลิก</button>
                <button
                  onClick={async () => {
                    if (!shopForm.name.trim()) return
                    await shopService.update(user.shopId, {
                      name: shopForm.name.trim(),
                      phone: shopForm.phone,
                      packageId: shopForm.packageId || null,
                    })
                    await authService.logActivity('EDIT_SHOP', `แก้ไขข้อมูลร้าน ${shopForm.name}`)
                    const s = await shopService.getById(user.shopId)
                    setShop(s)
                    if (s) setPkg(await packageService.getById(s.packageId))
                    setEditingShop(false)
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Package Selector Modal */}
        {showPackageSelector && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 animate-scale-in my-auto">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-slate-800">เลือกแพ็คเกจ</h3>
                <button onClick={() => setShowPackageSelector(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-slate-400 mb-4">เปรียบเทียบและเลือกแพ็คเกจที่เหมาะกับร้านคุณ</p>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {allPackages.map(p => {
                  const isCurrent = p.id === shop?.packageId
                  return (
                    <div key={p.id} className={`border-2 rounded-2xl p-4 ${isCurrent ? 'border-primary-500 bg-primary-50/50' : 'border-slate-100'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-slate-800">{p.name}</h4>
                        <span className="text-lg font-bold text-primary-600">
                          {p.price === 0 ? 'ฟรี' : `฿${p.price.toLocaleString()}/เดือน`}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-slate-500 mb-3">
                        <span>พนักงานสูงสุด {p.maxUsers || '-'} คน</span>
                        <span>สินค้าสูงสุด {p.maxProducts || '-'} รายการ</span>
                      </div>
                      <ul className="space-y-1 mb-4">
                        {(p.features || []).map((f, i) => (
                          <li key={i} className="flex items-center space-x-2 text-sm text-slate-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <span className="inline-block px-4 py-2 rounded-xl bg-primary-100 text-primary-700 text-sm font-medium">แพ็คเกจปัจจุบัน</span>
                      ) : (
                        <button
                          onClick={async () => {
                            await shopService.update(user.shopId, { packageId: p.id })
                            await authService.logActivity('EDIT_SHOP', `เปลี่ยนแพ็คเกจเป็น ${p.name}`)
                            const s = await shopService.getById(user.shopId)
                            setShop(s)
                            if (s) setPkg(await packageService.getById(s.packageId))
                            setShowPackageSelector(false)
                          }}
                          className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium"
                        >
                          เลือกแพ็คเกจนี้
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex space-x-3 mt-5">
                <button onClick={() => setShowPackageSelector(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ปิด</button>
              </div>
            </div>
          </div>
        )}

        {/* Bank Account Management */}
        {user?.role === 'owner' && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Landmark size={20} className="text-primary-600" />
                <h3 className="font-semibold text-slate-800">บัญชีธนาคาร / PromptPay ({bankAccounts.length})</h3>
              </div>
              <button
                onClick={() => { setShowAddBank(true); setNewBank({ name: '', bankName: '', accountNo: '', accountHolder: '', type: 'bank' }) }}
                className="flex items-center space-x-1 bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-xl text-sm font-medium"
              >
                <Plus size={16} />
                <span>เพิ่ม</span>
              </button>
            </div>
            <div className="space-y-2">
              {bankAccounts.map(acc => (
                <div key={acc.id} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <CreditCard size={18} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{acc.name}</p>
                    <p className="text-xs text-slate-400 truncate">{acc.bankName} · {acc.accountNo} · {acc.accountHolder}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${acc.type === 'promptpay' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {acc.type === 'promptpay' ? 'PromptPay' : 'ธนาคาร'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setEditingBank(acc)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary-50 text-slate-300 hover:text-primary-500"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`ลบบัญชี ${acc.name}?`)) return
                        try {
                          await bankAccountService.remove(acc.id)
                          await authService.logActivity('DELETE_BANK', `ลบบัญชี ${acc.name}`)
                          await refreshBankAccounts()
                        } catch (err) {
                          alert('ลบบัญชีไม่สำเร็จ: ' + err.message)
                        }
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {bankAccounts.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">ยังไม่มีบัญชีธนาคาร</p>
              )}
            </div>
          </div>
        )}

        {/* Branches & Members (Unified) */}
        {user?.role === 'owner' && (
          <div className="bg-white rounded-2xl border border-slate-100 px-2 py-5">
            <div className="flex items-center justify-between mb-4 px-3">
              <div className="flex items-center space-x-3">
                <Building2 size={20} className="text-primary-600" />
                <div>
                  <h3 className="font-semibold text-slate-800">สาขาและพนักงาน</h3>
                  <p className="text-xs text-slate-400">{branches.length} สาขา · {staff.length + 1} คน (รวมเจ้าของ)</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddBranch(true)}
                className="flex items-center space-x-1 bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-xl text-sm font-medium"
              >
                <Plus size={16} />
                <span>เพิ่มสาขา</span>
              </button>
            </div>

            <div className="space-y-3">
              {/* Branch cards with grouped staff */}
              {branches.map(b => {
                const branchStaff = staff.filter(s => s.branchId === b.id)
                const isOpen = expandedBranchIds.has(b.id)
                const bank = bankAccounts.find(a => a.id === b.bankAccountId)
                return (
                  <div key={b.id} className="border border-slate-100 rounded-2xl overflow-hidden">
                    {/* Branch Header */}
                    <button
                      onClick={() => toggleBranch(b.id)}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center shrink-0">
                          <Store size={18} className="text-primary-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{b.name}</p>
                          <p className="text-xs text-slate-400 truncate">{branchStaff.length} คน · {b.address || 'ไม่มีที่อยู่'}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        <button
                          onClick={e => { e.stopPropagation(); setEditingBranch(b) }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-300 hover:text-primary-500"
                        >
                          <Edit3 size={16} />
                        </button>
                        {branches.length > 1 && (
                          <button
                            onClick={async e => {
                              e.stopPropagation()
                              if (!confirm(`ลบสาขา "${b.name}"?\nพนักงาน ${branchStaff.length} คนจะยังคงอยู่แต่ต้องย้ายสาขาใหม่`)) return
                              try {
                                await branchService.remove(b.id)
                                await authService.logActivity('DELETE_BRANCH', `ลบสาขา ${b.name}`)
                                await refreshBranches()
                              } catch (err) {
                                alert('ลบสาขาไม่สำเร็จ: ' + err.message)
                              }
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-300 hover:text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isOpen && (
                      <div className="p-4 space-y-3 border-t border-slate-50">
                        {/* Branch info */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                          {b.phone && <span>📞 {b.phone}</span>}
                          {bank && <span>🏦 บัญชี: {bank.name}</span>}
                        </div>

                        {/* Add staff button */}
                        <button
                          onClick={() => {
                            setNewStaff({ name: '', email: '', password: '', branchId: b.id })
                            setShowAddStaff(true)
                          }}
                          className="flex items-center space-x-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          <UserPlus size={16} />
                          <span>เพิ่มพนักงานในสาขานี้</span>
                        </button>

                        {/* Staff list */}
                        {branchStaff.length === 0 ? (
                          <p className="text-sm text-slate-300 text-center py-2">ยังไม่มีพนักงานในสาขานี้</p>
                        ) : (
                          <div className="space-y-2">
                            {branchStaff.map(s => (
                              <div key={s.id} className="bg-slate-50 rounded-xl p-3 space-y-2">
                                <div className="flex items-center space-x-3">
                                  <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center">
                                    <User size={16} className="text-slate-500" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                                    <p className="text-xs text-slate-400 truncate">{s.email}</p>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <button
                                      onClick={() => setEditingStaff(s)}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-300 hover:text-primary-500"
                                    >
                                      <Edit3 size={16} />
                                    </button>
                                    <button
                                      onClick={() => handleRemoveStaff(s.id, s.name)}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-300 hover:text-red-500"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 ml-12">
                                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={s.canManageInventory ?? true}
                                      onChange={() => toggleStaffPermission(s, 'canManageInventory')}
                                      className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-xs text-slate-600">จัดการสินค้า/สต็อก</span>
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Add Staff Modal */}
        {showAddStaff && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in my-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">เพิ่มพนักงาน</h3>
                <button onClick={() => setShowAddStaff(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  placeholder="ชื่อพนักงาน"
                  value={newStaff.name}
                  onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <input
                  placeholder="อีเมล"
                  value={newStaff.email}
                  onChange={e => setNewStaff({...newStaff, email: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <input
                  placeholder="รหัสผ่าน"
                  type="password"
                  value={newStaff.password}
                  onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <select
                  value={newStaff.branchId}
                  onChange={e => setNewStaff({...newStaff, branchId: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm bg-white"
                >
                  <option value="">เลือกสาขา</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-3 mt-5">
                <button onClick={() => setShowAddStaff(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ยกเลิก</button>
                <button onClick={handleAddStaff} className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm">บันทึก</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Staff Modal */}
        {editingStaff && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in my-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">แก้ไขพนักงาน</h3>
                <button onClick={() => setEditingStaff(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  placeholder="ชื่อพนักงาน"
                  value={editingStaff.name}
                  onChange={e => setEditingStaff({...editingStaff, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <input
                  placeholder="อีเมล"
                  value={editingStaff.email}
                  onChange={e => setEditingStaff({...editingStaff, email: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <input
                  placeholder="รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)"
                  type="password"
                  value={editingStaff._newPassword || ''}
                  onChange={e => setEditingStaff({...editingStaff, _newPassword: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <select
                  value={editingStaff.branchId || ''}
                  onChange={e => setEditingStaff({...editingStaff, branchId: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm bg-white"
                >
                  <option value="">เลือกสาขา</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-3 mt-5">
                <button onClick={() => setEditingStaff(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ยกเลิก</button>
                <button
                  onClick={async () => {
                    try {
                      const updates = {
                        name: editingStaff.name,
                        email: editingStaff.email,
                        branchId: editingStaff.branchId,
                      }
                      if (editingStaff._newPassword) updates.password = editingStaff._newPassword
                      await userService.update(editingStaff.id, updates)
                      await authService.logActivity('EDIT_STAFF', `แก้ไขพนักงาน ${editingStaff.name}`)
                      const staffList = await userService.getByShop(user.shopId)
                      setStaff(staffList.filter(u => u.id !== user.id))
                      setEditingStaff(null)
                    } catch (err) {
                      alert('แก้ไขพนักงานไม่สำเร็จ: ' + err.message)
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Branch Modal */}
        {showAddBranch && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in my-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">เพิ่มสาขา</h3>
                <button onClick={() => setShowAddBranch(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  placeholder="ชื่อสาขา"
                  value={newBranch.name}
                  onChange={e => setNewBranch({...newBranch, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <input
                  placeholder="ที่อยู่"
                  value={newBranch.address}
                  onChange={e => setNewBranch({...newBranch, address: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <input
                  placeholder="เบอร์โทร"
                  value={newBranch.phone}
                  onChange={e => setNewBranch({...newBranch, phone: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <div className="flex space-x-3 mt-5">
                <button onClick={() => setShowAddBranch(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ยกเลิก</button>
                <button
                  onClick={async () => {
                    if (!newBranch.name.trim()) return
                    try {
                      await branchService.create({ shopId: user.shopId, name: newBranch.name.trim(), address: newBranch.address, phone: newBranch.phone })
                      await authService.logActivity('CREATE_BRANCH', `เพิ่มสาขา ${newBranch.name}`)
                      setNewBranch({ name: '', address: '', phone: '' })
                      setShowAddBranch(false)
                      await refreshBranches()
                    } catch (err) {
                      alert('เพิ่มสาขาไม่สำเร็จ: ' + err.message)
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Bank Modal */}
        {showAddBank && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in my-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">เพิ่มบัญชีธนาคาร / PromptPay</h3>
                <button onClick={() => setShowAddBank(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  placeholder="ชื่อบัญชี (สำหรับแสดง)"
                  value={newBank.name}
                  onChange={e => setNewBank({...newBank, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <select
                  value={newBank.type}
                  onChange={e => setNewBank({...newBank, type: e.target.value, bankName: e.target.value === 'promptpay' ? 'PromptPay' : newBank.bankName})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm bg-white"
                >
                  <option value="bank">ธนาคาร</option>
                  <option value="promptpay">PromptPay</option>
                </select>
                <input
                  placeholder={newBank.type === 'promptpay' ? 'เบอร์โทร / บัตรประชาชน / Tax ID' : 'เลขบัญชี'}
                  value={newBank.accountNo}
                  onChange={e => setNewBank({...newBank, accountNo: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                {newBank.type === 'bank' && (
                  <input
                    placeholder="ชื่อธนาคาร"
                    value={newBank.bankName}
                    onChange={e => setNewBank({...newBank, bankName: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                  />
                )}
                <input
                  placeholder="ชื่อเจ้าของบัญชี"
                  value={newBank.accountHolder}
                  onChange={e => setNewBank({...newBank, accountHolder: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <div className="flex space-x-3 mt-5">
                <button onClick={() => setShowAddBank(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ยกเลิก</button>
                <button
                  onClick={async () => {
                    if (!newBank.name.trim() || !newBank.accountNo.trim() || !newBank.accountHolder.trim()) return
                    try {
                      await bankAccountService.create({
                        shopId: user.shopId,
                        name: newBank.name.trim(),
                        bankName: newBank.bankName || (newBank.type === 'promptpay' ? 'PromptPay' : ''),
                        accountNo: newBank.accountNo.trim(),
                        accountHolder: newBank.accountHolder.trim(),
                        type: newBank.type,
                      })
                      await authService.logActivity('ADD_BANK', `เพิ่มบัญชี ${newBank.name}`)
                      setNewBank({ name: '', bankName: '', accountNo: '', accountHolder: '', type: 'bank' })
                      setShowAddBank(false)
                      await refreshBankAccounts()
                    } catch (err) {
                      alert('เพิ่มบัญชีไม่สำเร็จ: ' + err.message)
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Bank Modal */}
        {editingBank && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in my-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">แก้ไขบัญชี</h3>
                <button onClick={() => setEditingBank(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  placeholder="ชื่อบัญชี"
                  value={editingBank.name}
                  onChange={e => setEditingBank({...editingBank, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <select
                  value={editingBank.type}
                  onChange={e => setEditingBank({...editingBank, type: e.target.value, bankName: e.target.value === 'promptpay' ? 'PromptPay' : editingBank.bankName})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm bg-white"
                >
                  <option value="bank">ธนาคาร</option>
                  <option value="promptpay">PromptPay</option>
                </select>
                <input
                  placeholder={editingBank.type === 'promptpay' ? 'เบอร์โทร / บัตรประชาชน / Tax ID' : 'เลขบัญชี'}
                  value={editingBank.accountNo}
                  onChange={e => setEditingBank({...editingBank, accountNo: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                {editingBank.type === 'bank' && (
                  <input
                    placeholder="ชื่อธนาคาร"
                    value={editingBank.bankName}
                    onChange={e => setEditingBank({...editingBank, bankName: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                  />
                )}
                <input
                  placeholder="ชื่อเจ้าของบัญชี"
                  value={editingBank.accountHolder}
                  onChange={e => setEditingBank({...editingBank, accountHolder: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <div className="flex space-x-3 mt-5">
                <button onClick={() => setEditingBank(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ยกเลิก</button>
                <button
                  onClick={async () => {
                    try {
                      await bankAccountService.update(editingBank.id, {
                        name: editingBank.name,
                        bankName: editingBank.bankName,
                        accountNo: editingBank.accountNo,
                        accountHolder: editingBank.accountHolder,
                        type: editingBank.type,
                      })
                      await authService.logActivity('EDIT_BANK', `แก้ไขบัญชี ${editingBank.name}`)
                      setEditingBank(null)
                      await refreshBankAccounts()
                    } catch (err) {
                      alert('แก้ไขบัญชีไม่สำเร็จ: ' + err.message)
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Branch Modal */}
        {editingBranch && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto pb-24">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in my-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">แก้ไขสาขา</h3>
                <button onClick={() => setEditingBranch(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  placeholder="ชื่อสาขา"
                  value={editingBranch.name}
                  onChange={e => setEditingBranch({...editingBranch, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <input
                  placeholder="ที่อยู่"
                  value={editingBranch.address || ''}
                  onChange={e => setEditingBranch({...editingBranch, address: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <input
                  placeholder="เบอร์โทร"
                  value={editingBranch.phone || ''}
                  onChange={e => setEditingBranch({...editingBranch, phone: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm"
                />
                <select
                  value={editingBranch.bankAccountId || ''}
                  onChange={e => setEditingBranch({...editingBranch, bankAccountId: e.target.value || null})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm bg-white"
                >
                  <option value="">เลือกบัญชีรับเงิน</option>
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.type === 'promptpay' ? 'PromptPay' : a.bankName})</option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-3 mt-5">
                <button onClick={() => setEditingBranch(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">ยกเลิก</button>
                <button
                  onClick={async () => {
                    try {
                      await branchService.update(editingBranch.id, {
                        name: editingBranch.name,
                        address: editingBranch.address,
                        phone: editingBranch.phone,
                        bankAccountId: editingBranch.bankAccountId || null,
                      })
                      await authService.logActivity('EDIT_BRANCH', `แก้ไขสาขา ${editingBranch.name}`)
                      setEditingBranch(null)
                      await refreshBranches()
                    } catch (err) {
                      alert('แก้ไขสาขาไม่สำเร็จ: ' + err.message)
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        )}

        {/* App Info */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center space-x-3 mb-3">
            <Smartphone size={20} className="text-slate-400" />
            <h3 className="font-semibold text-slate-800">เกี่ยวกับแอป</h3>
          </div>
          <p className="text-sm text-slate-400">Mobile POS v1.0.0</p>
          <p className="text-sm text-slate-400">ระบบจัดการขายหน้าร้านสำหรับมือถือและแท็บเล็ต</p>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center space-x-2 bg-red-50 hover:bg-red-100 text-red-600 py-3.5 rounded-xl font-medium transition-colors"
        >
          <LogOut size={18} />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </div>
  )
}
