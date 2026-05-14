import { useState, useEffect } from 'react'
import { ClipboardList, User, ArrowRightLeft, LogIn, LogOut, Package, Pencil, Trash2, AlertTriangle, Ban } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logService, branchService } from '../services/mockData'
import { format, parseISO } from 'date-fns'

const actionConfig = {
  LOGIN: { label: 'เข้าสู่ระบบ', icon: LogIn, color: 'bg-green-50 text-green-600' },
  LOGOUT: { label: 'ออกจากระบบ', icon: LogOut, color: 'bg-slate-50 text-slate-500' },
  SALE: { label: 'ขายสินค้า', icon: Package, color: 'bg-primary-50 text-primary-600' },
  STOCK_IN: { label: 'รับสินค้า', icon: ArrowRightLeft, color: 'bg-blue-50 text-blue-600' },
  STOCK_OUT: { label: 'ตัดสต็อกสูญเสีย', icon: Ban, color: 'bg-red-50 text-red-600' },
  ADD_PRODUCT: { label: 'เพิ่มสินค้า', icon: Package, color: 'bg-purple-50 text-purple-600' },
  EDIT_PRODUCT: { label: 'แก้ไขสินค้า', icon: Pencil, color: 'bg-amber-50 text-amber-600' },
  ADD_STAFF: { label: 'เพิ่มพนักงาน', icon: User, color: 'bg-teal-50 text-teal-600' },
  REMOVE_STAFF: { label: 'ลบพนักงาน', icon: Trash2, color: 'bg-red-50 text-red-600' },
}

export default function ActivityLogsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [logs, setLogs] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('all')

  const branches = user?.shopId ? branchService.getByShop(user.shopId) : []
  const canFilterBranch = user && (user.role === 'owner' || user.role === 'superadmin') && branches.length > 1

  useEffect(() => {
    if (user && user.role !== 'owner') {
      navigate('/pos')
      return
    }
    if (user?.shopId) {
      if (canFilterBranch && selectedBranch !== 'all') {
        setLogs(logService.getByBranch(selectedBranch))
      } else {
        setLogs(logService.getByShop(user.shopId))
      }
    }
  }, [user, navigate, selectedBranch, canFilterBranch])

  return (
    <div className="h-full pb-20 md:pb-0">
      <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-slate-800">บันทึกกิจกรรม</h1>
            <p className="text-sm text-slate-400">ประวัติการใช้งานของพนักงานในร้าน</p>
          </div>
          {canFilterBranch && (
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 focus:border-primary-500 outline-none text-sm bg-white"
            >
              <option value="all">ทุกสาขา</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="p-4 md:p-6">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full hidden md:table">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">เวลา</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">ผู้ใช้</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">กิจกรรม</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => {
                  const config = actionConfig[log.action] || { label: log.action, icon: AlertTriangle, color: 'bg-slate-50 text-slate-500' }
                  const Icon = config.icon
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{format(parseISO(log.createdAt), 'dd MMM yyyy HH:mm')}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">{log.userName}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${config.color}`}>
                          <Icon size={14} />
                          <span>{config.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{log.detail}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden divide-y divide-slate-100">
            {logs.map(log => {
              const config = actionConfig[log.action] || { label: log.action, icon: AlertTriangle, color: 'bg-slate-50 text-slate-500' }
              const Icon = config.icon
              return (
                <div key={log.id} className="p-4 flex items-start space-x-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${config.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">{config.label}</p>
                      <span className="text-xs text-slate-400">{format(parseISO(log.createdAt), 'HH:mm')}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{log.detail}</p>
                    <p className="text-xs text-slate-400 mt-1">โดย {log.userName}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {logs.length === 0 && (
            <div className="text-center py-12">
              <ClipboardList size={48} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">ยังไม่มีบันทึกกิจกรรม</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
