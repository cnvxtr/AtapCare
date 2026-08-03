import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTickets, type Ticket } from '../../context/TicketContext'
import { Archive as ArchiveIcon, RotateCcw, Download, Search, Filter, Info, X } from 'lucide-react'
import TicketDrawer, { parseDescription, InfoCard, TicketDescription, TicketTimeline, TicketActivityLog, type DrawerTab } from '../../components/TicketDrawer'
import { Badge, STATUS_LABELS } from '../../components/Badge'
import { selectTriggerFilter } from '../../components/ui/select'
import MultiSelectFilter, { toggleFilter } from '../../components/MultiSelectFilter'

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

// Label final sesuai SOP Helpdesk: Selesai / Dibatalkan / Digabungkan
const ARCHIVE_LABELS: Record<string, string> = {
    CLOSED: 'Selesai',
    VOID: 'Dibatalkan',
    DUPLICATE: 'Digabungkan',
}

const HEADERS = ['Kode', 'Pelapor', 'Jabatan', 'No WA', 'Site', 'Unit/Perangkat', 'Prioritas', 'Status', 'Selesai', 'Tanggal Tiket Baru', 'Tanggal Tiket Tutup']

function formatDate(iso?: string): string {
    if (!iso) return ''
    const d = new Date(iso)
    const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000)
    const hh = String(wib.getUTCHours()).padStart(2, '0')
    const min = String(wib.getUTCMinutes()).padStart(2, '0')
    const dd = String(wib.getUTCDate()).padStart(2, '0')
    const mm = wib.toLocaleString('id-ID', { month: 'short', timeZone: 'UTC' })
    return `${hh}:${min}-${dd}-${mm}-${wib.getUTCFullYear()}`
}

// Periode (tahun/bulan) sebuah tiket arsip, berbasis Tanggal Tutup, dihitung WIB (UTC+7)
function closedPeriod(t: Ticket): { y: number; m: number } {
    const wib = new Date(new Date(t.closedAt || t.createdAt).getTime() + 7 * 60 * 60 * 1000)
    return { y: wib.getUTCFullYear(), m: wib.getUTCMonth() + 1 }
}

export default function Archive() {
    const { tickets, updateTicketStatus } = useTickets()
    // Filter hanya tiket yang sudah final: CLOSED, VOID, DUPLICATE
    const archivedTickets = tickets.filter(t => ['CLOSED', 'VOID', 'DUPLICATE'].includes(t.status))
    const availableYears = [...new Set(archivedTickets.map(t => closedPeriod(t).y))].sort((a, b) => b - a)

    const [searchTerm, setSearchTerm] = useState('')
    const [statusSel, setStatusSel] = useState<Record<string, boolean>>({ all: true })
    const [yearSel, setYearSel] = useState<Record<string, boolean>>({ all: true })
    const [monthSel, setMonthSel] = useState<Record<string, boolean>>({ all: true })
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
    const [drawerTab, setDrawerTab] = useState<DrawerTab>('detail')
    const [toastMsg, setToastMsg] = useState<string | null>(null)
    const [reopenTarget, setReopenTarget] = useState<Ticket | null>(null)

    useEffect(() => {
        if (!toastMsg) return
        const t = setTimeout(() => setToastMsg(null), 3000)
        return () => clearTimeout(t)
    }, [toastMsg])

    // Logika Reopen: Hanya CLOSED yang bisa di-reopen dalam 7 hari
    const canReopen = (ticket: Ticket) => {
        if (ticket.status !== 'CLOSED' || !ticket.closedAt) return false
        const closedDate = new Date(ticket.closedAt)
        const now = new Date()
        const diffTime = Math.abs(now.getTime() - closedDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays <= 7
    }

    const handleReopen = (ticket: Ticket) => {
        setReopenTarget(ticket)
    }

    const doReopen = () => {
        if (!reopenTarget) return
        updateTicketStatus(reopenTarget.id, 'WORKING', 'Tiket di-reopen oleh Helpdesk')
        setReopenTarget(null)
        setSelectedTicket(null)
    }

    const filteredTickets = archivedTickets.filter(t => {
        const matchSearch = t.code.toLowerCase().includes(searchTerm.toLowerCase()) || t.customer.toLowerCase().includes(searchTerm.toLowerCase())
        const p = closedPeriod(t)
        const matchStatus = statusSel['all'] || !!statusSel[t.status]
        const matchYear = yearSel['all'] || !!yearSel[String(p.y)]
        const matchMonth = monthSel['all'] || !!monthSel[String(p.m)]
        return matchSearch && matchStatus && matchYear && matchMonth
    })

    const buildPeriodTitle = () => {
        const selMonths = MONTHS.filter((_, i) => monthSel[String(i + 1)])
        const selYears = availableYears.filter(y => yearSel[String(y)])
        if (selMonths.length === 0 && selYears.length === 0) return 'SEMUA PERIODE'
        const m = selMonths.length === 0 ? '' : selMonths.length > 3 ? `${selMonths.length} BULAN` : selMonths.join(', ').toUpperCase()
        const y = selYears.length ? selYears.join(', ') : ''
        return [m, y].filter(Boolean).join(' ')
    }

    const buildFileStem = () => {
        const selMonths = MONTHS.filter((_, i) => monthSel[String(i + 1)])
        const selYears = availableYears.filter(y => yearSel[String(y)])
        const parts = [...selMonths, ...selYears]
        return parts.length === 0 ? 'SemuaPeriode' : parts.join('-')
    }

    const missingSelectedPeriods = () => {
        if (monthSel['all'] && yearSel['all']) return []
        const has = (y?: number, m?: number) =>
            archivedTickets.some(t => {
                const p = closedPeriod(t)
                return (y === undefined || p.y === y) && (m === undefined || p.m === m)
            })
        const years = yearSel['all'] ? [undefined] : availableYears.filter(y => yearSel[String(y)])
        const months = monthSel['all'] ? [undefined] : MONTHS.map((_, i) => i + 1).filter(m => monthSel[String(m)])
        const missing: string[] = []
        for (const y of years) for (const m of months) {
            if (!has(y, m)) {
                const label = y !== undefined
                    ? (m !== undefined ? `${y} ${MONTHS[m - 1]}` : String(y))
                    : (m !== undefined ? MONTHS[m - 1] : '')
                missing.push(label)
            }
        }
        return missing
    }

    const exportSelected = async () => {
        const rows = filteredTickets
        const missing = missingSelectedPeriods()
        if (missing.length) {
            setToastMsg(`Data ${missing.join(', ')} tidak tersedia untuk diunduh.`)
            return
        }
        if (rows.length === 0) {
            setToastMsg('Data tidak tersedia untuk diunduh.')
            return
        }

        const [{ default: ExcelJS }, { default: logoBase64 }] = await Promise.all([
            import('exceljs'),
            import('../../assets/logo.png?inline')
        ])

        const wb = new ExcelJS.Workbook()
        const ws = wb.addWorksheet('Arsip Tiket')
        ws.columns = [{ width: 20 }, { width: 24 }, { width: 20 }, { width: 16 }, { width: 20 }, { width: 20 }, { width: 10 }, { width: 14 }, { width: 10 }, { width: 20 }, { width: 20 }]
        ws.views = [{ state: 'frozen', ySplit: 4 }]

        const ink = '252525'
        const black = '171717'
        const mutedBg = 'F4F4F4'
        const zebra = 'FBFBFB'
        const borderColor = 'D4D4D4'
        const thin = (color: string = borderColor) => ({
            top: { style: 'thin' as const, color: { argb: color } },
            left: { style: 'thin' as const, color: { argb: color } },
            bottom: { style: 'thin' as const, color: { argb: color } },
            right: { style: 'thin' as const, color: { argb: color } },
        })
        const lastCol = HEADERS.length - 1

        // Kop: logo + nama perusahaan (satu blok merge selebar tabel, seperti band)
    ws.getRow(1).height = 22
    ws.getRow(2).height = 14
    ws.mergeCells(1, 1, 2, lastCol + 1)
    const brand = ws.getCell('A1')
    brand.value = {
      richText: [
        { text: 'ATAP CARE', font: { name: 'Arial', size: 14, bold: true, color: { argb: ink } } },
        { text: '\nPT ATAP TEKNOLOGI INDONESIA', font: { name: 'Arial', size: 9, color: { argb: '7A7A7A' } } },
      ],
    }
    brand.alignment = { vertical: 'middle', wrapText: true, indent: 7 }

        // Band periode
        ws.getRow(3).height = 28
        ws.mergeCells(3, 1, 3, lastCol + 1)
        const band = ws.getCell('A3')
        band.value = buildPeriodTitle()
        band.font = { name: 'Arial', size: 12, bold: true, color: { argb: ink } }
        band.alignment = { horizontal: 'center', vertical: 'middle' }
        band.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mutedBg } }
        band.border = { bottom: { style: 'medium' as const, color: { argb: black } } }

        // Header tabel
        const headerRow = ws.getRow(4)
        headerRow.height = 24
        HEADERS.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1)
            cell.value = h.toUpperCase()
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: ink } }
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E5E5E5' } }
            cell.border = thin('525252')
        })
        ws.autoFilter = { from: 'A4', to: `K4` }

        // Data
        const priorityFills: Record<string, string> = { P1: 'DC2626', P2: 'F59E0B', P3: '3B82F6' }
        rows.forEach((t, idx) => {
            const { jabatan, waPelapor } = parseDescription(t.description)
            const selesai = t.resolvedBy ? (t.resolvedBy === 'helpdesk' ? 'Remote' : 'Teknisi') : ''
            const values = [
                t.code, t.customer, jabatan || '', waPelapor || '', t.site || '-', t.unit || '-', t.priority || '',
                STATUS_LABELS[t.status] || t.status, selesai,
                formatDate(t.createdAt), formatDate(t.closedAt),
            ]
            const row = ws.getRow(idx + 5)
            row.height = 18
            values.forEach((v, i) => {
                const cell = row.getCell(i + 1)
                cell.value = v
                cell.border = thin()
                cell.font = { name: 'Arial', size: 10, color: { argb: ink } }
                cell.alignment = { horizontal: 'left', vertical: 'middle' }
                if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } }
            })
            // Kode: monospace
            row.getCell(1).font = { name: 'Consolas', size: 10, bold: true, color: { argb: ink } }
            // Prioritas: solid sesuai badge web
            const pr = row.getCell(7)
            const prFill = priorityFills[t.priority || '']
            if (prFill) {
                pr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: prFill } }
                pr.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } }
            }
            pr.alignment = { horizontal: 'center', vertical: 'middle' }
            // Status: pill hitam sesuai badge web
            const st = row.getCell(8)
            st.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: black } }
            st.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } }
            st.alignment = { horizontal: 'center', vertical: 'middle' }
        })

        // Logo (float di atas cell A1)
        const logoId = wb.addImage({ base64: logoBase64, extension: 'png' })
        ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 44, height: 44 } })

        const buffer = await wb.xlsx.writeBuffer()
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'Arsip_Tiket_' + buildFileStem() + '.xlsx'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const openTicket = (ticket: Ticket) => {
        setSelectedTicket(ticket)
        setDrawerTab('detail')
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
                        <ArchiveIcon className="w-6 h-6 text-muted-foreground" />
                        Arsip
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Selesai, Dibatalkan, Digabungkan</p>
                </div>
                <button
                    onClick={exportSelected}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white border border-emerald-700 hover:bg-emerald-700 rounded text-sm font-medium transition-colors w-full sm:w-auto"
                >
                    <Download className="w-4 h-4" />
                    Unduh
                </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-card p-4 rounded-xl border border-border flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1 min-w-0 lg:max-w-sm">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Cari kode tiket atau pelanggan..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-card border-2 border-border rounded text-sm outline-none focus:border-foreground"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <MultiSelectFilter
                        label="Semua"
                        selected={statusSel}
                        onToggle={v => setStatusSel(prev => toggleFilter(prev, v, ['CLOSED', 'DUPLICATE', 'VOID']))}
                        options={[
                            { value: 'CLOSED', label: 'Selesai' },
                            { value: 'DUPLICATE', label: 'Digabungkan' },
                            { value: 'VOID', label: 'Dibatalkan' },
                        ]}
                        className={selectTriggerFilter}
                    />
                    <MultiSelectFilter
                        label="Semua Tahun"
                        selected={yearSel}
                        onToggle={v => setYearSel(prev => toggleFilter(prev, v, availableYears.map(String)))}
                        options={availableYears.map(y => ({ value: String(y), label: String(y) }))}
                        className={selectTriggerFilter}
                    />
                    <MultiSelectFilter
                        label="Semua Bulan"
                        selected={monthSel}
                        onToggle={v => setMonthSel(prev => toggleFilter(prev, v, MONTHS.map((_, i) => String(i + 1))))}
                        options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
                        className={selectTriggerFilter}
                    />
                </div>
            </div>

            {/* Tabel Arsip */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="min-w-[700px]">
                        <table className="w-full text-left">
                            <thead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-center">Kode</th>
                                    <th className="px-4 py-3 font-medium text-center">Pelapor</th>
                                    <th className="px-4 py-3 font-medium text-center">Site</th>
                                    <th className="px-4 py-3 font-medium text-center">Unit</th>
                                    <th className="px-4 py-3 font-medium text-center">Prioritas</th>
                                    <th className="px-4 py-3 font-medium text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredTickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                            Tidak ada tiket yang diarsipkan.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTickets.map(ticket => (
                                        <tr key={ticket.id} onClick={() => openTicket(ticket)} className="hover:bg-muted transition-colors cursor-pointer">
                                            <td className="p-4 font-mono text-sm text-foreground font-medium whitespace-nowrap">{ticket.code}</td>
                                            <td className="p-4 text-foreground text-sm">{ticket.customer}</td>
                                            <td className="p-4 text-muted-foreground text-sm whitespace-nowrap">{ticket.site || '-'}</td>
                                            <td className="p-4 text-muted-foreground text-sm truncate max-w-[100px]" title={ticket.unit}>{ticket.unit || '-'}</td>
                                            <td className="p-4">
                                                <Badge type="priority" value={ticket.priority || '-'} />
                                            </td>
                                            <td className="p-4">
                                                <Badge type="status" value={ticket.status} label={ARCHIVE_LABELS[ticket.status]} />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="px-4 py-2 bg-muted border-t-2 border-border text-xs text-muted-foreground text-center sm:hidden">
                    ← Geser ke samping untuk lihat semua kolom →
                </div>
            </div>

            {selectedTicket && (
                <TicketDrawer
                    onClose={() => setSelectedTicket(null)}
                    code={selectedTicket.code}
                    status={selectedTicket.status}
                    priority={selectedTicket.priority}
                    createdAt={selectedTicket.createdAt}
                    activeTab={drawerTab}
                    onTabChange={setDrawerTab}
                    activities={selectedTicket.activities}
                    footer={
                        selectedTicket.status === 'CLOSED' && canReopen(selectedTicket) ? (
                            <button
                                onClick={() => handleReopen(selectedTicket)}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-foreground text-primary-foreground hover:opacity-90 rounded text-sm font-semibold transition"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reopen Tiket
                            </button>
                        ) : (
                            <p className="text-center text-xs font-mono uppercase tracking-widest text-muted-foreground">Read Only</p>
                        )
                    }
                >
                    {drawerTab === 'detail' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <InfoCard label="Pelapor" value={selectedTicket.customer} />
                                <InfoCard label="Site / Unit" value={`${selectedTicket.site || '-'} / ${selectedTicket.unit || '-'}`} />
                            </div>
                            <TicketDescription description={selectedTicket.description} />
                        </div>
                    )}
                    {drawerTab === 'timeline' && <TicketTimeline items={selectedTicket.activities} />}
                    {drawerTab === 'activity' && <TicketActivityLog items={selectedTicket.activities} />}
                </TicketDrawer>
            )}

            {reopenTarget && createPortal((
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 fade-in">
                    <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2"><RotateCcw className="w-5 h-5" /> Reopen Tiket</h3>
                            <button onClick={() => setReopenTarget(null)} className="p-2 bg-foreground text-background rounded-lg hover:opacity-80 transition-opacity"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">Yakin ingin membuka kembali tiket ini? Tiket akan kembali ke status <span className="font-semibold text-foreground">WORKING</span> untuk ditindaklanjuti.</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-muted p-4 rounded-lg border border-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Kode Tiket</p>
                                    <p className="font-medium text-sm font-mono">{reopenTarget.code}</p>
                                </div>
                                <div className="bg-muted p-4 rounded-lg border border-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Status</p>
                                    <p className="font-medium text-sm">CLOSED → <span className="font-bold">WORKING</span></p>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setReopenTarget(null)} className="flex-1 py-2 bg-muted rounded font-medium">Batal</button>
                                <button onClick={doReopen} className="flex-1 py-2 bg-foreground text-primary-foreground rounded font-bold">Ya, Reopen</button>
                            </div>
                        </div>
                    </div>
                </div>
            ), document.body)}

            {toastMsg && (
                <div className="fixed bottom-4 right-4 z-[70] bg-foreground text-primary-foreground px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2 text-sm animate-[fade-in_0.2s_ease]">
                    <Info className="w-4 h-4" />
                    {toastMsg}
                </div>
            )}
        </div>
    )
}
