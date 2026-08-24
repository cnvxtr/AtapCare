import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LIGHT } from "./Login";
import logo from "../assets/logo2.png";

type Phase = "checking" | "invalid" | "ready";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Link recovery dari email membawa token di URL; supabase-js menangkapnya
  // otomatis lalu memicu PASSWORD_RECOVERY / membuat sesi.
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => alive && setPhase((p) => (p === "checking" ? "invalid" : p)), 4000);
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && alive) setPhase("ready");
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && alive) setPhase("ready");
    });
    return () => {
      alive = false;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const submit = async () => {
    setMsg(null);
    if (pw.length < 6) return setMsg("Kata sandi minimal 6 karakter.");
    if (pw !== pw2) return setMsg("Konfirmasi tidak sama dengan kata sandi baru.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setBusy(false);
      return setMsg(error.message);
    }
    // Keluar dari sesi recovery agar pengguna membuktikan sandi barunya di halaman masuk
    await supabase.auth.signOut();
    setBusy(false);
    setDone(true);
    setTimeout(() => navigate("/login"), 1500);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center bg-white p-6 ${LIGHT}`}>
      <div className="w-full max-w-md">
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-xl p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="mb-8 text-center">
              <img src={logo} alt="Atap Care" className="h-12 w-12 rounded-xl object-contain mx-auto mb-4" />
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Atur Ulang Kata Sandi</h1>
              <p className="mt-2 text-sm text-muted-foreground">Buat kata sandi baru untuk akun Anda</p>
            </div>

            {phase === "checking" && (
              <p className="text-center text-sm text-muted-foreground">Memverifikasi tautan...</p>
            )}

            {phase === "invalid" && (
              <div className="text-center space-y-4">
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  Tautan tidak valid atau sudah kedaluwarsa. Ajukan tautan atur ulang yang baru.
                </div>
                <Button asChild variant="outline" className="w-full h-11">
                  <Link to="/login">Kembali ke Halaman Masuk</Link>
                </Button>
              </div>
            )}

            {phase === "ready" && done && (
              <div className="rounded-lg border border-emerald-600/20 bg-emerald-50 p-3 text-sm text-emerald-700 text-center">
                Kata sandi berhasil diperbarui — mengarahkan ke halaman masuk...
              </div>
            )}

            {phase === "ready" && !done && (
              <>
                {msg && (
                  <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    {msg}
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="pw">Kata Sandi Baru</Label>
                    <Input
                      id="pw"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Minimal 6 karakter"
                      disabled={busy}
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw2">Konfirmasi Kata Sandi Baru</Label>
                    <Input
                      id="pw2"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Ulangi kata sandi baru"
                      disabled={busy}
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={busy || !pw || !pw2}>
                    {busy ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/login" className="underline underline-offset-2 hover:no-underline">
            Kembali ke Halaman Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
