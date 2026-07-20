import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, LogIn, Phone, Loader2 } from "lucide-react";
import { login, getDemoAccounts } from "@/services";
import { loginAs } from "@/lib/demo-accounts";
import type { DemoAccount } from "@/lib/demo-accounts";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Atap Care" },
      { name: "description", content: "Portal login karyawan PT Atap Teknologi Indonesia untuk mengakses konsol operasi Atap Care." },
      { property: "og:title", content: "Login — Atap Care" },
      { property: "og:description", content: "Masuk ke konsol operasi Atap Care untuk mengelola tiket, teknisi, dan inventaris." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const demoAccounts = getDemoAccounts();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    navigate({ to: "/app" });
  }

  function quickLogin(acc: DemoAccount) {
    loginAs(acc);
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-80" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-foreground/10 via-foreground/5 to-transparent blur-3xl pointer-events-none" />

      {/* Header */}
      <SiteHeader />

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Login card */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-7 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-foreground/5 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <LogIn className="h-4 w-4" />
                <h3 className="font-display font-bold text-lg">Login</h3>
              </div>

              <form onSubmit={submit} className="mt-5 space-y-4">
                <Field label="Email" required>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="Masukkan email"
                    autoComplete="email"
                  />
                </Field>
                <Field label="Password" required>
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </Field>

                {error && <p className="text-xs text-destructive">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-5 py-2.5 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 transition inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Memproses…</> : <>Masuk <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Pilihan Cepat Akun Demo
                  </p>
                  <span className="text-[10px] text-muted-foreground">Quick-Access</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {demoAccounts.map((acc) => (
                    <button
                      key={acc.username}
                      type="button"
                      onClick={() => quickLogin(acc)}
                      title={`${acc.roleLabel} · ${acc.scope}`}
                      className="group text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-foreground hover:text-background hover:border-foreground transition inline-flex items-center gap-1.5"
                    >
                      <span className="font-medium">{acc.username}</span>
                      <span className="text-muted-foreground group-hover:text-background/70 font-mono text-[9px] uppercase tracking-wider">
                        {acc.roleLabel}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
                  Klik salah satu badge untuk masuk instan tanpa mengetik kredensial. Setiap akun
                  membuka dasbor sesuai hak akses role-nya.
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-muted-foreground mt-6 font-mono uppercase tracking-widest">
            Hanya untuk karyawan PT Atap Teknologi Indonesia
          </p>
        </div>
      </div>

      {/* Footer */}
      <SiteFooter />

      <style>{`
        .input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid var(--color-border);
          background: var(--color-background);
          font-size: 0.875rem;
          outline: none;
          transition: all 0.15s;
        }
        .input:focus {
          border-color: var(--color-foreground);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--foreground) 10%, transparent);
        }
      `}</style>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="relative z-10 max-w-7xl mx-auto px-6 h-20 flex items-center justify-between w-full">
      <Link to="/" className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-xl bg-foreground text-background grid place-items-center font-display font-bold">A</div>
        <div className="flex flex-col leading-tight">
          <span className="font-display font-bold">Atap Care</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">PT Atap Teknologi Indonesia</span>
        </div>
      </Link>
      <div className="flex items-center gap-4">
        <a href="tel:0812421414" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
          <Phone className="h-3.5 w-3.5" />
          <span className="font-mono">0812421414</span>
        </a>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2.5">
          <SocialIcon href="https://facebook.com" label="Facebook">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
          </SocialIcon>
          <SocialIcon href="https://twitter.com" label="Twitter">
            <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
          </SocialIcon>
          <SocialIcon href="https://linkedin.com" label="LinkedIn">
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
            <rect width="4" height="12" x="2" y="9" />
            <circle cx="4" cy="4" r="2" />
          </SocialIcon>
          <SocialIcon href="https://instagram.com" label="Instagram">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
          </SocialIcon>
        </div>
      </div>
    </header>
  );
}

function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="text-muted-foreground hover:text-foreground transition"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </a>
  );
}

function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <p>&copy; 2026 PT Atap Teknologi Indonesia. Semua hak dilindungi.</p>
        <span className="font-mono uppercase tracking-widest">v1.0</span>
      </div>
    </footer>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium mb-1.5 block">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}
