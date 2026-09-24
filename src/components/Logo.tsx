import logo from '../assets/logo.png'
import logo2 from '../assets/logo2.png'

// Logo hitam di mode terang, putih (logo2) di mode gelap.
// Swap via CSS polos html.dark (lihat index.css) agar reaktif terhadap
// class .dark aplikasi, bukan prefers-color-scheme OS.
export default function Logo({ className }: { className?: string }) {
  return (
    <>
      <img src={logo} alt="Atap Care" className={`logo-black ${className}`} />
      <img src={logo2} alt="Atap Care" className={`logo-white ${className}`} />
    </>
  )
}
