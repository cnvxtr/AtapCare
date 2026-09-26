import { useId, useState } from 'react'
import { Camera, FileText, ImagePlus } from 'lucide-react'
import { useIsMobile } from '../lib/platform'

const FILE_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar'

interface CameraFileUploadProps {
  label: string
  onFiles: (files: File[]) => void
}

// Upload foto & file dengan pilihan Kamera/File di mobile (APK + web layar kecil);
// desktop web langsung membuka pemilih file biasa.
export default function CameraFileUpload({ label, onFiles }: CameraFileUploadProps) {
  const isMobile = useIsMobile()
  const fileId = useId()
  const cameraId = useId()
  const [menuOpen, setMenuOpen] = useState(false)

  const addFiles = (list: FileList | null) => {
    if (!list) return
    onFiles(Array.from(list))
  }

  const trigger = (id: string) => {
    document.getElementById(id)?.click()
    setMenuOpen(false)
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      <div className="relative">
        <div
          role="button"
          tabIndex={0}
          onClick={() => { if (isMobile) setMenuOpen((o) => !o); else trigger(fileId) }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (isMobile) setMenuOpen((o) => !o); else trigger(fileId) } }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
          className="group flex flex-col items-center gap-1.5 rounded-xl border border-border p-6 text-center text-sm text-muted-foreground hover:border-foreground/50 hover:bg-muted/40 hover:text-foreground transition cursor-pointer"
        >
          <span className="inline-flex p-2.5 rounded-full bg-muted group-hover:bg-accent transition"><ImagePlus className="w-5 h-5" /></span>
          <span>Tarik & lepas foto atau file di sini, atau klik untuk memilih</span>
        </div>

        {isMobile && menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div className="absolute z-50 mt-2 w-full rounded-lg border border-border bg-card shadow-lg p-1.5 flex flex-col gap-1">
              <button type="button" onClick={() => trigger(cameraId)} className="flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-muted text-left">
                <Camera className="w-4 h-4" /> Kamera
              </button>
              <button type="button" onClick={() => trigger(fileId)} className="flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-muted text-left">
                <FileText className="w-4 h-4" /> File
              </button>
            </div>
          </>
        )}

        <input id={fileId} type="file" accept={FILE_ACCEPT} multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        {isMobile && <input id={cameraId} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />}
      </div>
    </div>
  )
}