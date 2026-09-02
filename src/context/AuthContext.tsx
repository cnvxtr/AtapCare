import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { setAuditActor } from '../services/master-data'

export interface UserProfile {
    id: string
    email: string
    full_name: string
    username: string
    role: string
    roles: string
    last_login: string | null
    avatar_url?: string | null
    wa_number?: string | null
    customer_id?: string | null
}

interface AuthContextType {
    isAuthenticated: boolean
    user: UserProfile | null
    lastLoginTime: string | null
    loading: boolean
    login: (username: string, password: string) => Promise<{ error: string | null }>
    register: (name: string, email: string, phone: string, password: string, companyCode?: string) => Promise<{ error: string | null; ok?: boolean }>
    logout: () => Promise<void>
    switchRole: (role: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Petakan error umum Supabase (Inggris) → pesan Indonesia; sisanya pesan generik.
const AUTH_ERRORS: Record<string, string> = {
    'Invalid login credentials': 'Nama pengguna atau kata sandi salah.',
    'Email not confirmed': 'Email belum dikonfirmasi. Cek kotak masuk Anda.',
    'User already registered': 'Email sudah terdaftar. Silakan masuk atau gunakan email lain.',
    'Password should be at least 6 characters': 'Kata sandi minimal 6 karakter.',
    'New password should be different from the old password.': 'Kata sandi baru harus berbeda dari yang lama.',
}
// eslint-disable-next-line react-refresh/only-export-components
export const authErrorMessage = (message?: string | null): string =>
    (message && AUTH_ERRORS[message]) || 'Terjadi kesalahan. Silakan coba lagi.'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [user, setUser] = useState<UserProfile | null>(null)
    const [lastLoginTime, setLastLoginTime] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    // Selama proses daftar, abaikan event sesi buatan signUp (konfirmasi email
    // nonaktif → signUp langsung membuat sesi) agar tidak dianggap sudah login.
    const registeringRef = useRef(false)

    const fetchUserProfile = async (userId: string) => {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single()

        if (error) {
            console.error('Error fetching user profile:', error)
            return null
        }
        return data as UserProfile
    }

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                const profile = await fetchUserProfile(session.user.id)
                if (profile) {
                    setUser(profile)
                    setAuditActor(profile.full_name)
                    setIsAuthenticated(true)
                    if (profile.last_login) {
                        const date = new Date(profile.last_login)
                        setLastLoginTime(`${date.getDate()} ${date.toLocaleString('id-ID', { month: 'short' })} ${date.getFullYear()}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`)
                    }
                }
            }
            setLoading(false)
        }
        getSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (registeringRef.current) return
            if (session?.user) {
                const profile = await fetchUserProfile(session.user.id)
                if (profile) {
                    setUser(profile)
                    setAuditActor(profile.full_name)
                    setIsAuthenticated(true)
                }
            } else {
                setUser(null)
                setAuditActor(null)
                setIsAuthenticated(false)
                setLastLoginTime(null)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const login = async (username: string, password: string) => {
        // Resolusi nama pengguna → email dilakukan di server (Edge Function) dan
        // hanya setelah kata sandi terverifikasi, sehingga browser tidak dapat
        // memanen email milik pengguna lain dari nama penggunanya.
        const invoke = await supabase.functions.invoke<{ email?: string }>('login-email', {
            body: { identifier: username, password },
        })
        const userEmail = invoke.data?.email || null

        if (!userEmail) {
            return { error: 'Nama pengguna atau kata sandi salah.' }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password,
        })

        if (error) {
            return { error: authErrorMessage(error.message) }
        }

        if (data.user) {
            const now = new Date()
            const timeString = `${now.getDate()} ${now.toLocaleString('id-ID', { month: 'short' })} ${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
            await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', data.user.id)

            setLastLoginTime(timeString)
            const profile = await fetchUserProfile(data.user.id)
            if (profile) setAuditActor(profile.full_name)
            if (profile?.role === 'admin') navigate('/admin')
            else if (profile?.role === 'teknisi') navigate('/tugas')
            else if (profile?.role === 'customer') navigate('/customer')
            else if (profile?.role === 'executive') navigate('/executive')
            else navigate('/dashboard')
            return { error: null }
        }
        return { error: 'Login gagal' }
    }

    const logout = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setAuditActor(null)
        setIsAuthenticated(false)
        setLastLoginTime(null)
        navigate('/')
    }

    const register = async (name: string, email: string, phone: string, password: string, companyCode?: string) => {
        registeringRef.current = true
        try {
            // 0. Pre-check server-side SEBELUM signUp agar akun Auth tidak dibuat
            //    bila validasi gagal (anti akun "yatim" yang menempati email).
            const pre = await supabase.rpc('precheck_register', {
                p_name: name,
                p_email: email,
                p_company_code: companyCode || null,
            })
            if (pre.error) return { error: authErrorMessage(pre.error.message) }
            const pv = pre.data as { error?: string; ok?: boolean }
            if (pv?.error) return { error: pv.error }

            // 1. Buat auth user lewat Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            })
            if (authError) return { error: authErrorMessage(authError.message) }
            if (!authData.user) return { error: 'Gagal membuat akun.' }

            // Konfirmasi email nonaktif → signUp membuat sesi langsung. Tutup sesi
            // itu agar pelanggan masuk sendiri lewat halaman masuk (bukan auto-login).
            if (authData.session) await supabase.auth.signOut()

            // 2. Insert ke tabel users lewat RPC (pakai auth UUID)
            const { data, error } = await supabase.rpc('register_customer', {
                p_name: name,
                p_email: email,
                p_phone: phone,
                p_user_id: authData.user.id,
                p_company_code: companyCode || null,
            })
            if (error) return { error: authErrorMessage(error.message) }
            const res = data as { error?: string; ok?: boolean }
            if (res?.error) return { error: res.error }

            // 3. Selesai — tanpa auto-login: pengguna diarahkan ke halaman masuk
            return { error: null }
        } finally {
            registeringRef.current = false
        }
    }

    const switchRole = async (role: string) => {
        if (!user) return { error: 'Tidak ada sesi' }
        const { data, error } = await supabase.rpc('switch_role', { p_role: role })
        if (error) return { error: error.message }
        const res = data as { ok?: boolean; error?: string } | null
        if (res?.error) return { error: res.error }
        const profile = await fetchUserProfile(user.id)
        if (profile) {
            setUser(profile)
            setAuditActor(profile.full_name)
        }
        return { error: null }
    }

    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-muted">Memuat sistem...</div>
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, lastLoginTime, loading, login, register, logout, switchRole }}>
            {children}
        </AuthContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider')
    return context
}