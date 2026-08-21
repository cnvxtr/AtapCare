import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Camera, Lock, Save, User, Mail, Phone, AtSign, Shield, Clock, X, Upload } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getAdminActivities, getTicketActivities, type AdminActivityRow } from '../services/dashboard'
import { ROLE_LABELS } from '../services/users'
import { resolvePhotos } from '../services/photoService'

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Profile edit state
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [username, setUsername] = useState(user?.username || '')
  const [waNumber, setWaNumber] = useState(user?.wa_number || '')
  const [saving, setSaving] = useState(false)

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)

  // Avatar state
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Activities state
  const [activities, setActivities] = useState<AdminActivityRow[]>([])

  // Load activities
  useEffect(() => {
    if (!user) return
    const loader = user.role === 'admin' ? getAdminActivities(20, user.full_name) : getTicketActivities(20, user.full_name)
    loader.then(setActivities).catch(() => setActivities([]))
  }, [user])

  // Resolve avatar URL
  const [resolvedAvatar, setResolvedAvatar] = useState<string | null>(null)
  useEffect(() => {
    if (user?.avatar_url) {
      resolvePhotos([user.avatar_url]).then(m => {
        setResolvedAvatar(m[user.avatar_url!] || null)
      })
    } else {
      setResolvedAvatar(null)
    }
  }, [user?.avatar_url])

  const initials = (user?.full_name || 'U').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
  const roleLabel = ROLE_LABELS[user?.role || ''] || user?.role || '-'
  const isChanged = fullName !== (user?.full_name || '') || username !== (user?.username || '') || waNumber !== (user?.wa_number || '')

  const handleSaveProfile = async () => {
    if (!user || !fullName.trim() || !username.trim()) {
      toast.error('Nama lengkap dan username wajib diisi.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('users').update({
      full_name: fullName.trim(),
      name: fullName.trim(),
      username: username.trim(),
      wa_number: waNumber.trim() || null,
    }).eq('id', user.id)
    setSaving(false)
    if (error) {
      if (error.message.includes('users_username_key')) {
        toast.error('Username sudah digunakan.')
      } else {
        toast.error('Gagal menyimpan: ' + error.message)
      }
      return
    }
    toast.success('Profil berhasil disimpan.')
    window.location.reload()
  }

  const handleChangePassword = async () => {
    if (!currentPassword) { toast.error('Password lama wajib diisi.'); return }
    if (newPassword.length < 6) { toast.error('Password baru minimal 6 karakter.'); return }
    if (newPassword !== confirmPassword) { toast.error('Konfirmasi password tidak cocok.'); return }

    setChangingPassword(true)
    // Verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || '',
      password: currentPassword,
    })
    if (signInError) {
      setChangingPassword(false)
      toast.error('Password lama salah.')
      return
    }
    // Update password
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPassword(false)
    if (error) {
      toast.error('Gagal mengubah password: ' + error.message)
      return
    }
    toast.success('Password berhasil diubah.')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran maksimal 2MB.')
      return
    }
    setAvatarUploading(true)

    // Compress image
    const compressed = await compressImage(file, 400, 0.8)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/avatar.${ext}`

    // Upload
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, compressed, { upsert: true })

    if (uploadError) {
      setAvatarUploading(false)
      toast.error('Gagal upload avatar.')
      return
    }

    // Get signed URL
    const { data: urlData } = await supabase.storage.from('avatars').createSignedUrl(path, 3600 * 24 * 365)

    // Update users table
    const { error: updateError } = await supabase.from('users').update({ avatar_url: path }).eq('id', user.id)

    if (updateError) {
      setAvatarUploading(false)
      toast.error('Foto tersimpan, tapi gagal memperbarui profil.')
      return
    }

    setAvatarUploading(false)
    toast.success('Foto profil berhasil diubah.')
    window.location.reload()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-display font-bold tracking-tight">Profile</h1>
        <span className="text-xs text-muted-foreground">{roleLabel}</span>
      </div>

      {/* Avatar Card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-5">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="relative group shrink-0"
          >
            {resolvedAvatar ? (
              <img src={resolvedAvatar} alt="Avatar" className="h-20 w-20 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-foreground to-foreground/60 grid place-items-center text-background text-2xl font-bold">
                {initials}
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              {avatarUploading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
          </button>
          <div className="min-w-0">
            <p className="text-lg font-bold text-foreground truncate">{user?.full_name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              {user?.last_login && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Login terakhir: {new Date(user.last_login).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Informasi Akun */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">Informasi Akun</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nama Lengkap" value={fullName} onChange={setFullName} icon={<User className="h-3.5 w-3.5" />} />
          <Field label="Username" value={username} onChange={setUsername} icon={<AtSign className="h-3.5 w-3.5" />} />
          <Field label="Email" value={user?.email || ''} onChange={() => {}} icon={<Mail className="h-3.5 w-3.5" />} disabled />
          <Field label="No. Telepon" value={waNumber} onChange={setWaNumber} icon={<Phone className="h-3.5 w-3.5" />} />
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveProfile}
            disabled={saving || !isChanged}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[5px] bg-foreground text-primary-foreground text-sm font-bold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      {/* Ganti Kata Sandi */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">Ganti Kata Sandi</h2>
        </div>

        <PasswordField label="Password Lama" value={currentPassword} onChange={setCurrentPassword} show={showCurrentPw} onToggle={() => setShowCurrentPw(!showCurrentPw)} />
        <PasswordField label="Password Baru" value={newPassword} onChange={setNewPassword} show={showNewPw} onToggle={() => setShowNewPw(!showNewPw)} />
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">Konfirmasi Password Baru</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-[5px] bg-muted/60 border border-border text-sm outline-none transition-all focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
            placeholder="Ulangi password baru"
          />
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-[11px] text-red-500 mt-1">Password tidak cocok</p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[5px] bg-foreground text-primary-foreground text-sm font-bold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Lock className="h-4 w-4" />
            {changingPassword ? 'Mengubah...' : 'Ubah Password'}
          </button>
        </div>
      </div>

      {/* Aktivitas Terbaru */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">Aktivitas Terbaru</h2>
        </div>
        <div className="space-y-0 divide-y divide-border">
          {activities.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada aktivitas</p>
          ) : (
            activities.map((a, i) => (
              <div key={i} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{a.user}</span> {a.aktivitas}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.waktu}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, icon, disabled }: {
  label: string; value: string; onChange: (v: string) => void; icon?: React.ReactNode; disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">{label}</label>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full ${icon ? 'pl-9' : 'pl-3'} pr-3 py-2 rounded-[5px] bg-muted/60 border border-border text-sm outline-none transition-all focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>
    </div>
  )
}

function PasswordField({ label, value, onChange, show, onToggle }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void
}) {
  return (
    <div>
      <label className="block text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-9 pr-10 py-2 rounded-[5px] bg-muted/60 border border-border text-sm outline-none transition-all focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
          placeholder={label}
        />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
          {show ? <X className="h-3.5 w-3.5" /> : <span className="text-[10px] font-mono">SHOW</span>}
        </button>
      </div>
    </div>
  )
}

function compressImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        resolve(blob || file)
      }, 'image/jpeg', quality)
    }
    img.src = url
  })
}
