import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { createTicket, type CreateTicketPayload } from '../../services/ticketService'
import { Camera, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Combobox, type ComboboxOption } from '../../components/ui/combobox'

interface CustomerRow { id: string; name: string }
interface SiteRow { id: string; name: string }
interface UnitRow { id: string; name: string }

export default function CustomerReport() {
    const navigate = useNavigate()
    const { user } = useAuth()

    const [customers, setCustomers] = useState<ComboboxOption[]>([])
    const [selectedCustomerId, setSelectedCustomerId] = useState('')
    const [sites, setSites] = useState<ComboboxOption[]>([])
    const [selectedSiteId, setSelectedSiteId] = useState('')
    const [units, setUnits] = useState<ComboboxOption[]>([])
    const [selectedUnitId, setSelectedUnitId] = useState('')

    const [description, setDescription] = useState('')
    const [photos, setPhotos] = useState<File[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        supabase.from('customers').select('id, name').order('name').then(({ data }) => {
            setCustomers((data || []).map((c: CustomerRow) => ({ value: c.id, label: c.name })))
        })
    }, [])

    useEffect(() => {
        if (!selectedCustomerId) { setSites([]); setSelectedSiteId(''); setUnits([]); setSelectedUnitId(''); return }
        supabase.from('sites').select('id, name').eq('customer_id', selectedCustomerId).order('name').then(({ data }) => {
            setSites((data || []).map((s: SiteRow) => ({ value: s.id, label: s.name })))
        })
        setSelectedSiteId(''); setUnits([]); setSelectedUnitId('')
    }, [selectedCustomerId])

    useEffect(() => {
        if (!selectedSiteId) { setUnits([]); setSelectedUnitId(''); return }
        supabase.from('units').select('id, name').eq('site_id', selectedSiteId).order('name').then(({ data }) => {
            setUnits((data || []).map((u: UnitRow) => ({ value: u.id, label: u.name })))
        })
        setSelectedUnitId('')
    }, [selectedSiteId])

    const selectedCustomer = customers.find(c => c.value === selectedCustomerId)
    const selectedSite = sites.find(s => s.value === selectedSiteId)
    const selectedUnit = units.find(u => u.value === selectedUnitId)

    const removePhoto = (idx: number) => setPhotos(prev => prev.filter((_, i) => i !== idx))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!description.trim() || !selectedCustomer || !selectedSite) {
            setError('Perusahaan, site, dan deskripsi wajib diisi.'); return
        }
        if (photos.length === 0) { setError('Foto & File Pendukung wajib diunggah.'); return }
        setIsLoading(true); setError('')
        const payload: CreateTicketPayload = {
            reporterName: user?.full_name || '',
            position: 'Pelanggan',
            phone: user?.wa_number || '',
            site: selectedSite.label,
            unit: selectedUnit?.label || '',
            description,
            photos: photos.length > 0 ? photos : undefined,
        }
        const result = await createTicket(payload)
        setIsLoading(false)
        if (result.error) { setError(result.error); return }
        toast.success('Tiket berhasil dibuat!')
        navigate('/customer')
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-display font-bold tracking-tight mb-6">Lapor Kendala</h1>
            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-4">
                <div>
                    <label className="block text-xs font-medium mb-1.5">Perusahaan</label>
                    <Combobox options={customers} value={selectedCustomerId} onChange={setSelectedCustomerId}
                        placeholder="Ketik nama perusahaan..." emptyText="Perusahaan tidak ditemukan" minChars={4} />
                </div>
                <div>
                    <label className="block text-xs font-medium mb-1.5">Site</label>
                    <Combobox options={sites} value={selectedSiteId} onChange={setSelectedSiteId}
                        placeholder={selectedCustomerId ? "Ketik nama site..." : "Pilih perusahaan terlebih dahulu"}
                        disabled={!selectedCustomerId} emptyText="Site tidak ditemukan" />
                </div>
                <div>
                    <label className="block text-xs font-medium mb-1.5">Unit</label>
                    <Combobox options={units} value={selectedUnitId} onChange={setSelectedUnitId}
                        placeholder={selectedSiteId ? "Ketik nama unit..." : "Pilih site terlebih dahulu"}
                        disabled={!selectedSiteId} emptyText="Unit tidak ditemukan" />
                </div>
                <div>
                    <label className="block text-xs font-medium mb-1.5">No. WhatsApp</label>
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
                    <label className="block text-xs font-medium mb-1.5">Foto & File Pendukung (wajib)</label>
                    <div className="border border-border rounded-lg p-4 text-center hover:border-foreground transition-colors cursor-pointer"
                        onClick={() => document.getElementById('customer-foto-upload')?.click()}>
                        <Camera className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Ketuk untuk upload foto atau file</p>
                        <input id="customer-foto-upload" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" multiple className="hidden"
                            onChange={e => {
                                const files = Array.from(e.target.files || [])
                                setPhotos(prev => [...prev, ...files])
                                e.target.value = ''
                            }} />
                    </div>
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
