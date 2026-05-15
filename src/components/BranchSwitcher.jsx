import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Store } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function BranchSwitcher({ variant = 'default' }) {
  const { user, branches, switchBranch } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Staff cannot switch branches; owner/superadmin can
  const canSwitch = user && (user.role === 'owner' || user.role === 'superadmin')

  const currentBranch = branches.find(b => b.id === user?.branchId)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user?.shopId) return null

  const isLight = variant === 'light'

  return (
    <div ref={ref} className="relative flex justify-center">
      {canSwitch ? (
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isLight
              ? 'bg-white/20 text-white hover:bg-white/30'
              : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
          }`}
        >
          <Store size={14} />
          <span className="max-w-[120px] truncate">{currentBranch?.name || 'เลือกสาขา'}</span>
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
          isLight ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
        }`}>
          <Store size={14} />
          <span className="max-w-[120px] truncate">{currentBranch?.name || user.branchId || 'สาขาหลัก'}</span>
        </div>
      )}

      {open && canSwitch && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 animate-scale-in">
          {branches.map(branch => (
            <button
              key={branch.id}
              onClick={() => {
                switchBranch(branch.id)
                setOpen(false)
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                branch.id === user.branchId ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{branch.name}</span>
              {branch.id === user.branchId && (
                <span className="w-2 h-2 rounded-full bg-primary-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
