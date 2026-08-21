import { Link } from 'react-router-dom'

export default function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-muted-foreground">
        <p>&copy; 2026 PT Atap Teknologi Indonesia. Semua hak dilindungi.</p>
        <span className="hidden sm:inline">·</span>
        <div className="flex items-center gap-2">
          <Link to="/privacy" className="hover:text-foreground transition underline underline-offset-2">Privacy Policy</Link>
          <span>|</span>
          <Link to="/terms" className="hover:text-foreground transition underline underline-offset-2">Terms of Service</Link>
        </div>
      </div>
    </footer>
  )
}
