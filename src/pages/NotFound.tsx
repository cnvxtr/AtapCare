import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SiteHeader } from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function NotFound() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <SiteHeader />
      <div className="relative flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <p className="text-6xl font-display font-bold text-muted-foreground/30">404</p>
          <h1 className="text-xl font-display font-bold mt-4">Halaman tidak ditemukan.</h1>
          <p className="text-sm text-muted-foreground mt-2">
            URL yang Anda akses tidak tersedia atau telah dipindahkan.
          </p>
          <Link
            to={isAuthenticated ? "/dashboard" : "/"}
            className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-[3px] bg-foreground text-background font-medium hover:bg-foreground/90 transition text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            {isAuthenticated ? "Kembali ke Dashboard" : "Kembali ke Beranda"}
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
