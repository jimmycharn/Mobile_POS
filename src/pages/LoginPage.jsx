import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Store, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = login(email, password)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    if (result.user.role === 'superadmin') {
      navigate('/superadmin')
    } else {
      navigate('/pos')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-200">
            <Store className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Mobile POS</h1>
          <p className="text-slate-400 mt-1">ระบบขายหน้าร้านอัจฉริยะ</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">เข้าสู่ระบบ</h2>
          <p className="text-sm text-slate-400 mb-5">กรอกข้อมูลเพื่อเข้าใช้งาน</p>

          {error && (
            <div className="flex items-center space-x-2 bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">อีเมล</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-400">
              ยังไม่มีบัญชี?{' '}
              <Link to="/signup" className="text-primary-600 font-semibold hover:text-primary-700">
                สมัครใช้งาน
              </Link>
            </p>
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-500">บัญชีทดลอง:</p>
            <p>Superadmin: superadmin@pos.com / admin123</p>
            <p>เจ้าของร้าน: owner@shop.com / owner123</p>
            <p>พนักงาน: staff@shop.com / staff123</p>
          </div>
        </div>
      </div>
    </div>
  )
}
