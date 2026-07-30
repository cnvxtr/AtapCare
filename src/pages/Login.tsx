import { useState } from 'react'
import { ArrowRight, Zap, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const result = await login(username, password)
    if (result.error) {
      setError(result.error)
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      <div className="bg-neutral-900 relative hidden flex-col border-r p-10 md:p-12 lg:flex min-h-full">
        <div className="absolute inset-0 noise-overlay pointer-events-none" />
        <div className="absolute inset-0 z-[1]">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>
        <div className="relative z-10 flex flex-col min-h-full">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Atap Care" className="h-9 w-9 rounded-xl object-contain" />
            <div className="flex flex-col leading-tight">
              <span className="font-display font-bold text-white">Atap Care</span>
              <span className="text-[10px] uppercase tracking-widest text-white/50">PT Atap Teknologi Indonesia</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-xs font-mono uppercase tracking-widest text-white/60">
              PORTAL KARYAWAN INTERNAL
            </p>
            <h1 className="text-4xl md:text-5xl font-display font-bold mt-6 tracking-tight leading-[1.05] text-white">
              Command Center Operasional.
            </h1>
            <p className="mt-6 text-base text-white/60 max-w-md">
              Sistem Ticketing Keluhan &amp; Manajemen Operasional Internal PT Atap Teknologi Indonesia.
            </p>
            <div className="mt-10 inline-flex items-center gap-2 text-xs text-white/50 font-mono uppercase tracking-widest">
              <Zap className="h-3 w-3" /> SLA · Race-safe inventory · WA close
            </div>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden bg-muted grid-bg flex items-center justify-center p-6 md:p-10">
        <div className="absolute inset-0 noise-overlay pointer-events-none" />
        <div aria-hidden className="absolute inset-0 isolate contain-strict -z-10 opacity-60">
          <div className="bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsl(var(--foreground)/.06)_0,hsla(0, 0%, 55%, 0.07)_50%,hsl(var(--foreground)/.01)_80%)] absolute top-0 right-0 h-320 w-140 -translate-y-87.5 rounded-full" />
          <div className="bg-[radial-gradient(50%_50%_at_50%_50%,hsl(var(--foreground)/.04)_0,hsl(var(--foreground)/.01)_80%,transparent_100%)] absolute top-0 right-0 h-320 w-60 [translate:5%_-50%] rounded-full" />
          <div className="bg-[radial-gradient(50%_50%_at_50%_50%,hsl(var(--foreground)/.04)_0,hsl(var(--foreground)/.01)_80%,transparent_100%)] absolute top-0 right-0 h-320 w-60 -translate-y-87.5 rounded-full" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-neutral-900 p-6 md:p-7 w-full max-w-lg relative">
          <div className="relative">
            <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-center mb-8 text-white">
              Welcome Back
            </h2>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  Username
                </label>
                <input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm placeholder:text-white/30 outline-none transition-all duration-150 focus:border-white/40 focus:ring-2 focus:ring-white/10"
                  placeholder=""
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm placeholder:text-white/30 outline-none transition-all duration-150 focus:border-white/40 focus:ring-2 focus:ring-white/10"
                    placeholder=""
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/50 hover:text-white/70 transition"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-5 py-2.5 rounded-lg bg-white text-neutral-900 font-medium hover:bg-white/90 transition inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Memproses...' : 'Masuk'} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position
      } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position
      } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position
      } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    opacity: 0.04 + i * 0.005,
    width: 0.5 + i * 0.03,
  }))

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full text-white" viewBox="0 0 696 316" fill="none">
        <title>Background Paths</title>
        {paths.map((p, i) => (
          <path key={i} d={p.d} stroke="currentColor" strokeWidth={p.width} strokeOpacity={p.opacity} />
        ))}
      </svg>
    </div>
  )
}
