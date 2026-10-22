import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { createTicket, type CreateTicketPayload } from '../../services/ticketService'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'
import CameraFileUpload from '../../components/CameraFileUpload'
import { Combobox } from '@/components/ui/combobox'
import { TROUBLE_CARDS } from '../../components/troubleCards'

export default function CustomerReport() {
    const navigate = useNavigate()
    const { user } = useAuth()

    const [companyName, setCompanyName] = useState('')
    const [sites, setSites] = useState<{ id: string; name: string }[]>([])
    const [units, setUnits] = useState<{ id: string; name: string }[]>([])
    const [siteId, setSiteId] = useState('')
    const [unitId, setUnitId] = useState('')

    const [searchParams] = useSearchParams()
    const [description, setDescription] = useState(() => {
        const card = TROUBLE_CARDS.find(c => c.code === searchParams.get('dari'))
        return card ? `${card.title} — ${card.desc}` : ''
    })
    const [photos, setPhotos] = useState<File[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const locked = !!user?.customer_id
    const siteName = sites.find((s) => s.id === siteId)?.name || ''
    const unitName = units.find((u) => u.id === unitId)?.name || ''

    useEffect(() => {
        if (!user?.customer_id) return
        supabase.from('customers').select('name').eq('id', user.customer_id).single()
            .then(({ data }) => setCompanyName((data as { name: string } | null)?.name || ''))
        supabase.from('sites').select('id, name').eq('customer_id', user.customer_id)
            .eq('is_deleted', false).order('name')
            .then(({ data }) => setSites((data as { id: string; name: string }[]) || []))
    }, [user?.customer_id])

    useEffect(() => {
        if (!siteId) return
        supabase.from('units').select('id, name').eq('site_id', siteId)
            .eq('is_deleted', false).order('name')
            .then(({ data }) => setUnits((data as { id: string; name: string }[]) || []))
    }, [siteId])

    const removePhoto = (idx: number) => setPhotos(prev => prev.filter((_, i) => i !== idx))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!description.trim()) { setError('Deskripsi wajib diisi.'); return }
        if (!siteId) { setError('Pilih Site terlebih dahulu.'); return }
        if (!unitId) { setError('Pilih Unit terlebih dahulu.'); return }
        if (photos.length === 0) { setError('Foto & File Pendukung wajib diunggah.'); return }
        setIsLoading(true); setError('')
        const payload: CreateTicketPayload = {
            reporterName: user?.full_name || '',
            position: 'Pelanggan',
            phone: user?.wa_number || '',
            site: siteName,
            unit: unitName,
            description,
            photos: photos.length > 0 ? photos : undefined,
        }
        const result = await createTicket(payload)
        setIsLoading(false)
        if (result.error) { setError(result.error); return }
        toast.success('Tiket berhasil dibuat!')
        navigate('/customer')
    }

    if (!locked) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-card border border-red-300 rounded-lg p-6 text-center space-y-1">
                    <p className="text-sm font-semibold text-red-600">
                        Akun Anda belum terhubung ke perusahaan.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Silakan hubungi admin untuk memasukkan kode perusahaan Anda.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-4">
                <div>
                    <label className="block text-xs font-medium mb-1.5">Perusahaan</label>
                    <input type="text" readOnly value={companyName || '—'}
                        className="w-full px-3 py-2 rounded-md border border-border bg-muted text-sm cursor-not-allowed" />
                </div>
                <div>
                    <label className="block text-xs font-medium mb-1.5">Site</label>
                    <Combobox
                        options={sites.map((s) => ({ value: s.id, label: s.name }))}
                        value={siteId}
                        onChange={(v) => { setSiteId(v); setUnitId('') }}
                        placeholder="Pilih Site…"
                        emptyText="Site tidak ditemukan"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium mb-1.5">Unit</label>
                    <Combobox
                        options={units.map((u) => ({ value: u.id, label: u.name }))}
                        value={unitId}
                        onChange={setUnitId}
                        placeholder={siteId ? 'Pilih Unit…' : 'Pilih Site dulu'}
                        disabled={!siteId}
                        emptyText="Unit tidak ditemukan"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium mb-1.5">No. Telepon</label>
                    <input type="text" readOnly value={user?.wa_number || ''}
                        className="w-full px-3 py-2 rounded-md border border-border bg-muted text-sm cursor-not-allowed" />
                </div>
                <div>
                    <label className="block text-xs font-medium mb-1.5">Deskripsi Kendala</label>
                    <textarea required rows={4} value={description} onChange={e => setDescription(e.target.value)}
                        className="w-full px-3 py-2 rounded-[3px] border border-border bg-background text-sm resize-none"
                        placeholder="Jelaskan kendala yang Anda alami..." />
                </div>
                <div>
                    <CameraFileUpload label="Foto & File Pendukung (wajib)" onFiles={(files) => setPhotos(prev => [...prev, ...files])} />
                    {photos.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {photos.map((f, i) => (
                                <div key={i} className="relative">
                                    {f.type.startsWith('image/') ? (
                                        <img src={URL.createObjectURL(f)} alt={f.name} className="w-16 h-16 object-cover rounded border border-border" />
                                    ) : (
                                        <div className="w-16 h-16 flex flex-col items-center justify-center rounded border border-border bg-muted">
                                            <FileText className="w-5 h-5 text-muted-foreground mb-0.5" />
                                            <span className="text-[8px] font-mono text-muted-foreground truncate max-w-[50px]">{f.name.split('.').pop()?.toUpperCase()}</span>
                                        </div>
                                    )}
                                    <button type="button" onClick={() => removePhoto(i)}
                                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center">✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button type="submit" disabled={isLoading}
                    className="w-full px-5 py-2.5 bg-foreground text-background rounded-[3px] text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
                    {isLoading ? 'Mengirim...' : 'Kirim Tiket'}
                </button>
            </form>
        </div>
    )
}
