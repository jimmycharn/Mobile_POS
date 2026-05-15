import { useState, useEffect } from 'react'
import { Shield, Check, Users, Package } from 'lucide-react'
import { packageService } from '../../services/supabaseApi'

export default function SuperadminPackages() {
  const [packages, setPackages] = useState([])

  useEffect(() => {
    const load = async () => {
      const data = await packageService.getAll()
      setPackages(data)
    }
    load()
  }, [])

  return (
    <div className="h-full">
      <div className="bg-white border-b border-slate-100 px-6 py-4">
        <h1 className="text-xl font-bold text-slate-800">แพ็คเกจราคา</h1>
        <p className="text-sm text-slate-400">จัดการแพ็คเกจและราคาค่าบริการ</p>
      </div>

      <div className="p-6">
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {packages.map(pkg => (
            <div key={pkg.id} className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                  <Shield size={20} className="text-primary-600" />
                </div>
                {pkg.price === 0 && (
                  <span className="px-2.5 py-1 bg-green-50 text-green-600 text-xs font-medium rounded-lg">ฟรี</span>
                )}
              </div>

              <h3 className="text-lg font-bold text-slate-800">{pkg.name}</h3>
              <div className="mt-2 mb-4">
                <span className="text-3xl font-bold text-primary-600">฿{pkg.price.toLocaleString()}</span>
                <span className="text-sm text-slate-400">/เดือน</span>
              </div>

              <div className="space-y-2 mb-5">
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <Users size={16} className="text-slate-400" />
                  <span>ผู้ใช้สูงสุด {pkg.maxUsers} คน</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <Package size={16} className="text-slate-400" />
                  <span>สินค้าสูงสุด {pkg.maxProducts.toLocaleString()} รายการ</span>
                </div>
              </div>

              <div className="flex-1">
                <p className="text-xs font-medium text-slate-400 mb-2">ฟีเจอร์:</p>
                <ul className="space-y-2">
                  {pkg.features.map((f, i) => (
                    <li key={i} className="flex items-start space-x-2 text-sm text-slate-600">
                      <Check size={16} className="text-green-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
