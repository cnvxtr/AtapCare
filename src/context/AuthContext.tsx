import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export interface UserProfile {
    id: string
    email: string
    full_name: string
    username: string
    role: string
    last_login: string | null
}

interface AuthContextType {
    isAuthenticated: boolean
    user: UserProfile | null
    lastLoginTime: string | null
    loading: boolean // <-- PERBAIKAN: Ditambahkan ke interface
    login: (username: string, password: string) => Promise<{ error: string | null }>
    logout: () => Promise<void>
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
                    setIsAuthenticated(true)
                }
            } else {
                setUser(null)
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
        let { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('username', username)
            .maybeSingle()

        if (!userData) {
            const { data } = await supabase
                .from('users')
                .select('email')
                .eq('email', username)
                .maybeSingle()
            userData = data
        }

        if (!userData) {
            const { data } = await supabase
                .from('users')
                .select('email')
                .eq('full_name', username)
                .maybeSingle()
            userData = data
        }

        if (!userData) {
            return { error: 'Username tidak ditemukan' }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: userData.email,
            password,
        })

        if (error) {
            return { error: error.message }
        }

        if (data.user) {
            const timeString = formatLoginTime()
            await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', data.user.id)

            setLastLoginTime(timeString)
            navigate('/dashboard')
            return { error: null }
        }
        return { error: 'Login gagal' }
    }

    const logout = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setIsAuthenticated(false)
        setLastLoginTime(null)
        navigate('/login')
    }

    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-muted">Memuat sistem...</div>
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, lastLoginTime, loading, login, logout }}>
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