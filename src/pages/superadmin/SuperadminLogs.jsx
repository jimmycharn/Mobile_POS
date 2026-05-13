import { useState, useEffect } from 'react'
import { ClipboardList, LogIn, LogOut, Package, Pencil, ArrowRightLeft, User, Trash2, AlertTriangle } from 'lucide-react'
import { logService } from '../../services/mockData'
import { format, parseISO } from 'date-fns'

const actionConfig = {
  LOGIN: { label: 'เข้าสู่ระบบ', icon: LogIn, color: 'bg-green-50 text-green-600' },
  LOGOUT: { label: 'ออกจากระบบ', icon: LogOut, color: 'bg-slate-50 text-slate-500' },
  SALE: { label: 'ขายสินค้า', icon: Package, color: 'bg-primary-50 text-primary-600' },
  STOCK_IN: { label: 'รับสินค้า', icon: ArrowRightLeft, color: 'bg-blue-50 text-blue-600' },
  ADD_PRODUCT: { label: 'เพิ่มสินค้า', icon: Package, color: 'bg-purple-50 text-purple-600' },
  EDIT_PRODUCT: { label: 'แก้ไขสินค้า', icon: Pencil, color: 'bg-amber-50 text-amber-600' },
  ADD_STAFF: { label: 'เพิ่มพนักงาน', icon: User, color: 'bg-teal-50 text-teal-600' },
  REMOVE_STAFF: { label: 'ลบพนักงาน', icon: Trash2, color: 'bg-red-50 text-red-600' },
}

export default function SuperadminLogs() {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    setLogs(logService.getAll())
  }, [])

  return (
    <div className="h-full">
      <div className="bg-white border-b border-slate-100 px-6 py-4">
        <h1 className="text-xl font-bold text-slate-800">บันทึกกิจกรรมระบบ</h1>
        <p className="text-sm text-slate-400">ประวัติการใช้งานทั้งหมดในระบบ</p>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">เวลา</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">ร้านค้า</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">ผู้ใช้</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">กิจกรรม</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => {
                  const config = actionConfig[log.action] || { label: log.action, icon: AlertTriangle, color: 'bg-slate-50 text-slate-500' }
                  const Icon = config.icon
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">{format(parseISO(log.createdAt), 'dd MMM yyyy HH:mm')}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{log.shopName}</td>
                      <td className="px-5 py-3 text-sm font-medium text-slate-700">{log.userName}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${config.color}`}>
                          <Icon size={14} />
                          <span>{config.label}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">{log.detail}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
