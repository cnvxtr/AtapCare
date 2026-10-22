import logo from '../assets/logo.png'
import logo2 from '../assets/logo2.png'

export default function Logo({ className }: { className?: string }) {
  return (
    <>
      <img src={logo} alt="Atap Care" className={`logo-black ${className}`} />
      <img src={logo2} alt="Atap Care" className={`logo-white ${className}`} />
    </>
  )
}
