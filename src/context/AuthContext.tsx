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
}

interface AuthContextType {
    isAuthenticated: boolean
    user: UserProfile | null
    lastLoginTime: string | null
    loading: boolean // <-- PERBAIKAN: Ditambahkan ke interface
    login: (username: string, password: string) => Promise<{ error: string | null }>
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

    const formatLoginTime = () => {
        const now = new Date()
        return `${now.getDate()} ${now.toLocaleString('id-ID', { month: 'short' })} ${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    }

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
            const timeString = formatLoginTime()
            await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', data.user.id)

            setLastLoginTime(timeString)
            const profile = await fetchUserProfile(data.user.id)
            if (profile) setAuditActor(profile.full_name)
            if (profile?.role === 'admin') navigate('/admin')
            else if (profile?.role === 'teknisi') navigate('/tugas')
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
        navigate('/login')
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
        <AuthContext.Provider value={{ isAuthenticated, user, lastLoginTime, loading, login, logout, switchRole }}>
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