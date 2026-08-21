import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { Camera, Lock, Save, User, Mail, Phone, AtSign, Shield, Clock, Filter, Eye, EyeOff, Trash2, ArrowRight, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { ROLE_LABELS } from '../services/users'
import { resolveAvatarUrl } from '../services/photoService'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../components/ui/dropdown-menu'

type ActivityRow = { id: string; waktu: string; user: string; aktivitas: string; created_at: string }
type FilterKey = 'all' | 'today' | 'week' | 'month'
const FILTER_LABELS: Record<FilterKey, string> = { all: 'Semua', today: 'Hari Ini', week: 'Minggu Ini', month: 'Bulan Ini' }
const HIDDEN_KEY = (uid: string) => `hidden_activities_${uid}`

function loadHidden(uid: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY(uid)) || '[]')) } catch { return new Set() }
}
function saveHidden(uid: string, ids: Set<string>) {
  localStorage.setItem(HIDDEN_KEY(uid), JSON.stringify([...ids]))
}

type ProfileField = { key: string; label: string; oldVal: string; newVal: string }
const FIELD_LABELS: Record<string, string> = { fullName: 'Nama Lengkap', username: 'Username', waNumber: 'No. Telepon' }

export default function Profile() {
  const { user } = useAuth()

  // Profile edit state
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [username, setUsername] = useState(user?.username || '')
  const [waNumber, setWaNumber] = useState(user?.wa_number || '')
  const [saving, setSaving] = useState(false)
  const initRef = useRef({ fullName: user?.full_name || '', username: user?.username || '', waNumber: user?.wa_number || '' })

  // Confirm save
  const [showConfirmSave, setShowConfirmSave] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<ProfileField[]>([])

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
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [activityFilter, setActivityFilter] = useState<FilterKey>('all')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => user ? loadHidden(user.id) : new Set())

  // Load activities (raw from both tables)
  useEffect(() => {
    if (!user) return
    const load = async () => {
      const rows: ActivityRow[] = []
      // ticket activities
      const { data: ticketData } = await supabase
        .from('activities')
        .select('id, user_name, action, created_at')
        .eq('user_name', user.full_name)
        .order('created_at', { ascending: false })
        .limit(50)
      for (const r of ticketData || []) {
        rows.push({
          id: r.id,
          waktu: fmtTime(r.created_at),
          user: r.user_name || '—',
          aktivitas: r.action,
          created_at: r.created_at,
        })
      }
      // admin audit logs
      if (user.role === 'admin') {
        const { data: auditData } = await supabase
          .from('audit_logs')
          .select('id, created_at, actor_name, action, entity_type, metadata')
          .eq('actor_name', user.full_name)
          .order('created_at', { ascending: false })
          .limit(50)
        for (const r of auditData || []) {
          const meta = (r.metadata as Record<string, unknown>) || null
          rows.push({
            id: r.id,
            waktu: fmtTime(r.created_at),
            user: r.actor_name || '—',
            aktivitas: labelAct(r.action, r.entity_type, meta),
            created_at: r.created_at,
          })
        }
      }
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
      setActivities(rows)
    }
    load().catch(() => setActivities([]))
  }, [user])

  // Filtered activities
  const filteredActivities = useMemo(() => {
    let list = activities.filter(a => !hiddenIds.has(a.id))
    if (activityFilter !== 'all') {
      const now = new Date()
      let cutoff: Date
      if (activityFilter === 'today') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else if (activityFilter === 'week') {
        const day = now.getDay()
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((day + 6) % 7))
      } else {
        cutoff = new Date(now.getFullYear(), now.getMonth(), 1)
      }
      const iso = cutoff.toISOString()
      list = list.filter(a => a.created_at >= iso)
    }
    return list
  }, [activities, activityFilter, hiddenIds])

  // Resolve avatar URL
  const [resolvedAvatar, setResolvedAvatar] = useState<string | null>(null)
  useEffect(() => {
    resolveAvatarUrl(user?.avatar_url).then(setResolvedAvatar)
  }, [user?.avatar_url])

  const initials = (user?.full_name || 'U').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
  const roleLabel = ROLE_LABELS[user?.role || ''] || user?.role || '-'
  const isChanged = fullName !== (user?.full_name || '') || username !== (user?.username || '') || waNumber !== (user?.wa_number || '')

  const handleSaveProfile = async () => {
    if (!user || !fullName.trim() || !username.trim()) {
      toast.error('Nama lengkap dan username wajib diisi.')
      return
    }
    const changes: ProfileField[] = []
    if (fullName.trim() !== initRef.current.fullName) changes.push({ key: 'fullName', label: FIELD_LABELS.fullName, oldVal: initRef.current.fullName, newVal: fullName.trim() })
    if (username.trim() !== initRef.current.username) changes.push({ key: 'username', label: FIELD_LABELS.username, oldVal: initRef.current.username, newVal: username.trim() })
    if ((waNumber.trim() || '') !== initRef.current.waNumber) changes.push({ key: 'waNumber', label: FIELD_LABELS.waNumber, oldVal: initRef.current.waNumber || '(kosong)', newVal: waNumber.trim() || '(kosong)' })

    if (changes.length === 0) {
      toast.info('Tidak ada perubahan.')
      return
    }
    setPendingChanges(changes)
    setShowConfirmSave(true)
  }

  const doSaveProfile = async () => {
    setShowConfirmSave(false)
    setSaving(true)
    const { error } = await supabase.from('users').update({
      full_name: fullName.trim(),
      name: fullName.trim(),
      username: username.trim(),
      wa_number: waNumber.trim() || null,
    }).eq('id', user!.id)
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

  // Activity select mode helpers
  const toggleSelectMode = () => { setSelectMode(!selectMode); setSelectedIds(new Set()) }
  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll = () => setSelectedIds(new Set(filteredActivities.map(a => a.id)))
  const hideSelected = () => {
    if (!user) return
    const n = new Set(hiddenIds)
    selectedIds.forEach(id => n.add(id))
    setHiddenIds(n)
    saveHidden(user.id, n)
    toast.success(`${selectedIds.size} aktivitas disembunyikan.`)
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-display font-bold tracking-tight">Profile {roleLabel}</h1>

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
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          {selectMode ? (
            <>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-bold text-foreground">Pilih Aktivitas ({selectedIds.size})</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded hover:bg-accent">
                  Pilih Semua
                </button>
                <button onClick={hideSelected} disabled={selectedIds.size === 0} className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <Trash2 className="h-3.5 w-3.5" /> Sembunyikan ({selectedIds.size})
                </button>
                <button onClick={toggleSelectMode} className="text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded hover:bg-accent">
                  Batal
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-bold text-foreground">Aktivitas Terbaru</h2>
              </div>
              <div className="flex items-center gap-1">
                {hiddenIds.size > 0 && (
                  <button onClick={() => { setHiddenIds(new Set()); user && saveHidden(user.id, new Set()); toast.info('Semua aktivitas ditampilkan kembali.') }} className="text-[11px] text-muted-foreground hover:text-foreground transition px-2 py-1 rounded hover:bg-accent">
                    Tampilkan tersembunyi ({hiddenIds.size})
                  </button>
                )}
                <button onClick={toggleSelectMode} className="h-8 w-8 grid place-items-center rounded-[3px] text-muted-foreground hover:text-foreground hover:bg-accent transition">
                  <Trash2 className="h-4 w-4" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-8 w-8 grid place-items-center rounded-[3px] text-muted-foreground hover:text-foreground hover:bg-accent transition">
                      <Filter className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px] bg-card border-border text-card-foreground space-y-0.5">
                    {(Object.entries(FILTER_LABELS) as [FilterKey, string][]).map(([key, label]) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => setActivityFilter(key)}
                        className={`cursor-pointer ${activityFilter === key ? 'bg-black text-white' : 'focus:bg-black focus:text-white'}`}
                      >
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>

        {/* List */}
        <div className="max-h-[350px] overflow-y-auto space-y-0 divide-y divide-border">
          {filteredActivities.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada aktivitas</p>
          ) : (
            filteredActivities.map((a) => (
              <div key={a.id} onClick={selectMode ? () => toggleSelect(a.id) : undefined} className={`py-3 first:pt-0 last:pb-0 flex items-start gap-3 ${selectMode ? 'cursor-pointer' : ''}`}>
                {selectMode && (
                  <div className={`mt-0.5 h-5 w-5 shrink-0 rounded border flex items-center justify-center transition ${selectedIds.has(a.id) ? 'bg-foreground border-foreground' : 'border-border bg-card'}`}>
                    {selectedIds.has(a.id) && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{a.user}</span> {a.aktivitas}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.waktu}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MODAL KONFIRMASI SIMPAN */}
      {showConfirmSave && createPortal((
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm fade-in" onClick={() => setShowConfirmSave(false)}>
          <div className="bg-card border border-border w-full max-w-sm rounded-lg shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-display font-bold text-foreground mb-1">Konfirmasi Perubahan</h3>
            <p className="text-sm text-muted-foreground mb-4">Perubahan yang akan disimpan:</p>
            <div className="space-y-3 mb-6">
              {pendingChanges.map(c => (
                <div key={c.key} className="rounded bg-muted/60 border border-border p-3">
                  <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">{c.label}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground line-through truncate">{c.oldVal}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-semibold text-foreground truncate">{c.newVal}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmSave(false)} className="flex-1 px-4 py-2.5 bg-card border border-border text-muted-foreground hover:bg-muted rounded text-sm font-semibold transition-colors">
                Batal
              </button>
              <button onClick={doSaveProfile} className="flex-1 px-4 py-2.5 bg-foreground text-primary-foreground hover:opacity-90 rounded text-sm font-bold transition-opacity">
                Simpan
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
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
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Baru saja'
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} jam lalu`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD} hari lalu`
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function labelAct(action: string, entityType: string, meta: Record<string, unknown> | null): string {
  const ticketCode = (meta?.ticket_code as string) || ''
  const suffix = ticketCode ? ` (${ticketCode})` : ''
  const map: Record<string, string> = {
    create_ticket: `Membuat tiket${suffix}`,
    status_change: `Mengubah status tiket${suffix} → ${(meta?.new_status as string) || ''}`,
    assign_teknisi: `Menugaskan teknisi ke tiket${suffix}`,
    update_ticket: `Memperbarui tiket${suffix}`,
    add_comment: `Menambahkan komentar${suffix}`,
    backup_approve: `Menyetujui backup${suffix}`,
    backup_reject: `Menolak backup${suffix}`,
    update_user: 'Memperbarui data pengguna',
    delete_user: 'Menghapus pengguna',
    create_user: 'Membuat pengguna baru',
  }
  return map[action] || `${action} ${entityType}`.trim()
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
