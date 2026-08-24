import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
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
}

interface AuthContextType {
    isAuthenticated: boolean
    user: UserProfile | null
    lastLoginTime: string | null
    loading: boolean
    login: (username: string, password: string) => Promise<{ error: string | null }>
    loginWithGoogle: () => Promise<{ error: string | null }>
    register: (name: string, email: string, phone: string, password: string) => Promise<{ error: string | null; ok?: boolean }>
    logout: () => Promise<void>
    switchRole: (role: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [user, setUser] = useState<UserProfile | null>(null)
    const [lastLoginTime, setLastLoginTime] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

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
        // Lookup email by username lewat RPC SECURITY DEFINER (anon tak bisa
        // baca kolom username setelah RLS 03).
        const { data: loginEmail } = await supabase.rpc('resolve_login_email', {
            p_username: username,
        })
        let userEmail = (loginEmail as string | null) || null

        if (!userEmail) {
            const { data } = await supabase
                .from('users')
                .select('email')
                .eq('email', username)
                .maybeSingle()
            userEmail = data?.email || null
        }

        if (!userEmail) {
            return { error: 'Username tidak ditemukan' }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password,
        })

        if (error) {
            return { error: error.message }
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

    const loginWithGoogle = async () => {
        // Login sekaligus daftar otomatis: user Google baru diprovision
        // oleh trigger DB (supabase/google-user-trigger.sql) sebagai customer.
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
        })
        return { error: error?.message ?? null }
    }

    const logout = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setAuditActor(null)
        setIsAuthenticated(false)
        setLastLoginTime(null)
        navigate('/')
    }

    const register = async (name: string, email: string, phone: string, password: string) => {
        // 1. Buat auth user dulu lewat Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        })
        if (authError) return { error: authError.message }
        if (!authData.user) return { error: 'Gagal membuat akun.' }

        // 2. Insert ke tabel users lewat RPC (pakai auth UUID)
        const { data, error } = await supabase.rpc('register_customer', {
            p_name: name,
            p_email: email,
            p_phone: phone,
            p_user_id: authData.user.id,
        })
        if (error) return { error: error.message }
        const res = data as { error?: string; ok?: boolean }
        if (res?.error) return { error: res.error }

        // 3. Selesai — tanpa auto-login: pengguna diarahkan ke halaman masuk
        //    (menghindari jebakan "Email not confirmed" bila konfirmasi aktif)
        return { error: null }
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
        <AuthContext.Provider value={{ isAuthenticated, user, lastLoginTime, loading, login, loginWithGoogle, register, logout, switchRole }}>
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