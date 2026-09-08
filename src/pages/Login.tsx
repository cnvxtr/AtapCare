import { useEffect, useRef, useState } from "react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { Button } from "@/components/ui/button";
import { Input, PhoneInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import logo from "../assets/logo2.png";

// Pin token tema light di panel kanan agar kartu selalu putih walau dark mode aktif
// (dipakai ulang oleh halaman ResetPassword agar tampilannya konsisten)
export const LIGHT =
  "[--background:0_0%_98.5%] [--foreground:0_0%_14.5%] [--card:0_0%_100%] [--card-foreground:0_0%_14.5%] [--primary:0_0%_14.5%] [--primary-foreground:0_0%_98.5%] [--secondary:0_0%_95.5%] [--secondary-foreground:0_0%_14.5%] [--muted:0_0%_95.5%] [--muted-foreground:0_0%_48%] [--accent:0_0%_93%] [--accent-foreground:0_0%_14.5%] [--border:0_0%_72%] [--ring:0_0%_14.5%] [--destructive:27_24.5%_57.7%] [--destructive-foreground:0_0%_98.5%]";

/* ---------------- Schemas ---------------- */

const signInSchema = z.object({
  username: z.string().min(2, "Username atau email minimal 2 karakter"),
  password: z.string().min(6, "Kata sandi minimal 6 karakter"),
});

const signUpSchema = z.object({
  // Nama Pengguna = username (kunci login, unik); full_name menyalinnya di DB
  name: z.string().regex(/^[a-z0-9_]{3,20}$/, "Nama pengguna: 3–20 karakter, huruf kecil/angka/underscore"),
  email: z.string().email("Format email tidak valid"),
  phone: z.string().regex(/^\d{8,12}$/, "Nomor telepon tidak valid"),
  companyCode: z.string().min(1, "Kode unik perusahaan wajib diisi"),
  password: z.string().min(6, "Kata sandi minimal 6 karakter"),
  terms: z.boolean().refine((v) => v, {
    message: "Anda harus menyetujui syarat & ketentuan",
  }),
});

type SignInValues = z.infer<typeof signInSchema>;
type SignUpValues = z.infer<typeof signUpSchema>;

/* ---------------- Shared ---------------- */

function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </div>
  );
}

const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { id: string; error?: boolean }
>(function PasswordInput({ id, disabled, error, ...props }, forwardedRef) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        ref={forwardedRef}
        type={show ? "text" : "password"}
        autoComplete={id === "password-signup" ? "new-password" : "current-password"}
        disabled={disabled}
        className={cn("pr-10", error && "border-destructive")}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        tabIndex={-1}
        className="absolute right-0 top-0 h-full hover:bg-transparent"
        onClick={() => setShow((v) => !v)}
        disabled={disabled}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
});

const viewMotion = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3, ease: "easeInOut" as const },
};

/* ---------------- Sign In ---------------- */

function SignInView({
  onSignUp,
  onForgot,
  justRegistered,
}: {
  onSignUp: () => void;
  onForgot: () => void;
  justRegistered?: boolean;
}) {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (data: SignInValues) => {
    setIsLoading(true);
    setError(null);
    const result = await login(data.username, data.password);
    if (result.error) setError(result.error);
    setIsLoading(false);
  };

  return (
    <motion.div {...viewMotion} className="p-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Selamat Datang Kembali</h1>
        <p className="mt-2 text-sm text-muted-foreground">Masuk ke akun Atap Care Anda</p>
      </div>

      {justRegistered && (
        <div className="mb-6 rounded-lg border border-emerald-600/20 bg-emerald-50 p-3 text-sm text-emerald-700">
          Pendaftaran berhasil. Silakan masuk dengan nama pengguna Anda.
        </div>
      )}

      <AuthError message={error} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="username">Nama Pengguna / Email</Label>
          <Input
            id="username"
            placeholder="Nama pengguna / email Anda"
            autoComplete="username"
            disabled={isLoading}
            className={cn(errors.username && "border-destructive")}
            {...register("username")}
          />
          {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Kata Sandi</Label>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            disabled={isLoading}
            error={!!errors.password}
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline cursor-pointer"
              onClick={onForgot}
            >
              Lupa kata sandi?
            </button>
          )}
        </div>

        <Button type="submit" className="w-full h-11" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              Memproses...
            </>
          ) : (
            "Masuk"
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <Button variant="link" className="h-auto p-0 text-sm" onClick={onSignUp} disabled={isLoading}>
          Daftar
        </Button>
      </p>
    </motion.div>
  );
}

/* ---------------- Sign Up ---------------- */

function SignUpView({
  onSignIn,
  onRegistered,
}: {
  onSignIn: () => void;
  onRegistered: () => void;
}) {
  const { register: registerUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unameState, setUnameState] = useState<"idle" | "checking" | "taken" | "available">("idle");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", phone: "", companyCode: "", password: "", terms: false },
  });

  const terms = watch("terms");
  const uname = watch("name");
  const nameField = register("name");
  const latestCheck = useRef("");

  // ponytail: cek ketersediaan live ala Instagram — debounce 500ms, hasil basi dibuang
  useEffect(() => {
    const u = (uname || "").trim();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) {
      latestCheck.current = "";
      setUnameState("idle");
      return;
    }
    latestCheck.current = u;
    setUnameState("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("is_username_available", { p_username: u });
      if (latestCheck.current === u) setUnameState(data ? "available" : "taken");
    }, 500);
    return () => clearTimeout(t);
  }, [uname]);

  const onSubmit = async (data: SignUpValues) => {
    setIsLoading(true);
    setError(null);
    const result = await registerUser(data.name, data.email, "62" + data.phone, data.password, data.companyCode);
    if (result.error) setError(result.error);
    else onRegistered();
    setIsLoading(false);
  };

  return (
    <motion.div {...viewMotion} className="p-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Buat Akun</h1>
        <p className="mt-2 text-sm text-muted-foreground">Mulai kelola laporan kendala Anda</p>
      </div>

      <AuthError message={error} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nama Pengguna</Label>
          <Input
            id="name"
            placeholder="Nama pengguna"
            autoComplete="username"
            disabled={isLoading}
            className={cn(errors.name && "border-destructive")}
            {...nameField}
            onChange={(e) => {
              e.currentTarget.value = e.currentTarget.value.toLowerCase();
              nameField.onChange(e);
            }}
          />
          {errors.name ? (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          ) : unameState === "checking" ? (
            <p className="text-xs text-muted-foreground">Memeriksa ketersediaan nama pengguna…</p>
          ) : unameState === "taken" ? (
            <p className="text-xs text-destructive">Nama pengguna sudah dipakai. Coba tambahkan angka atau variasikan.</p>
          ) : unameState === "available" ? (
            <p className="text-xs font-medium text-emerald-600">Nama pengguna tersedia</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="nama@gmail.com"
            autoComplete="email"
            disabled={isLoading}
            className={cn(errors.email && "border-destructive")}
            {...register("email")}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">No. Telepon</Label>
          <PhoneInput
            id="phone"
            autoComplete="tel-national"
            disabled={isLoading}
            className={cn(errors.phone && "border-destructive")}
            value={watch("phone")}
            onChange={(v) => setValue("phone", v)}
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="company-code">Kode Perusahaan</Label>
          <Input
            id="company-code"
            placeholder="Diperoleh dari PIC perusahaan Anda"
            autoComplete="off"
            disabled={isLoading}
            className={cn(errors.companyCode && "border-destructive")}
            {...register("companyCode")}
          />
          {errors.companyCode && <p className="text-xs text-destructive">{errors.companyCode.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password-signup">Kata Sandi</Label>
          <PasswordInput
            id="password-signup"
            placeholder="Minimal 6 karakter"
            disabled={isLoading}
            error={!!errors.password}
            {...register("password")}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="terms"
            checked={terms}
            onCheckedChange={(checked) => setValue("terms", checked === true)}
            disabled={isLoading}
            className="mt-0.5"
          />
          <label htmlFor="terms" className="text-sm leading-snug cursor-pointer">
            Saya menyetujui{" "}
            <Link to="/privacy" className="underline underline-offset-2 hover:no-underline">
              Kebijakan Privasi
            </Link>{" "}
            serta{" "}
            <Link to="/terms" className="underline underline-offset-2 hover:no-underline">
              Syarat &amp; Ketentuan
            </Link>
          </label>
        </div>
        {errors.terms && <p className="text-xs text-destructive">{errors.terms.message}</p>}

        <Button
          type="submit"
          className="w-full h-11"
          disabled={isLoading || unameState === "checking" || unameState === "taken"}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              Memproses...
            </>
          ) : (
            "Daftar"
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Button variant="link" className="h-auto p-0 text-sm" onClick={onSignIn} disabled={isLoading}>
          Masuk
        </Button>
      </p>
    </motion.div>
  );
}

/* ---------------- Lupa Kata Sandi ---------------- */

function ForgotView({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value || busy) return;
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setError("Masukkan alamat email yang valid.");
      return;
    }
    setBusy(true);
    // Diam saja untuk email tak terdaftar (anti-enumeration)
    await supabase.auth.resetPasswordForEmail(value, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    // Pesan generik apa pun hasilnya — jangan bocorkan akun mana yang terdaftar
    setSent(true);
  };

  return (
    <motion.div {...viewMotion} className="p-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Lupa Kata Sandi</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Masukkan email terdaftar Anda, tautan atur ulang akan dikirim ke email tersebut.
        </p>
      </div>

      <AuthError message={error} />

      {sent ? (
        <>
          <div className="rounded-lg border border-emerald-600/20 bg-emerald-50 p-3 text-sm text-emerald-700">
            Jika akun Anda terdaftar, tautan atur ulang sudah dikirim. Cek kotak masuk (dan folder spam) email Anda.
          </div>
          <Button variant="outline" className="w-full h-11 mt-6" onClick={onBack}>
            Kembali ke Halaman Masuk
          </Button>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="Email terdaftar Anda"
              autoComplete="email"
              disabled={busy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full h-11" disabled={busy || !email.trim()}>
            {busy ? (
              <>
                <Loader2 className="animate-spin" />
                Mengirim...
              </>
            ) : (
              "Kirim Tautan Atur Ulang"
            )}
          </Button>
        </form>
      )}

      {!sent && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Button variant="link" className="h-auto p-0 text-sm" onClick={onBack} disabled={busy}>
            Kembali ke Halaman Masuk
          </Button>
        </p>
      )}
    </motion.div>
  );
}

/* ---------------- Page ---------------- */

export default function Login() {
  const [view, setView] = useState<"sign-in" | "sign-up" | "forgot">("sign-in");
  const [justRegistered, setJustRegistered] = useState(false);

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      <div className="bg-neutral-900 relative hidden flex-col p-10 md:p-12 lg:flex min-h-full">
        <div className="absolute inset-0 noise-overlay pointer-events-none" />
        <div className="absolute inset-0 z-[1]">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>
        <div className="relative z-10 flex flex-col min-h-full">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Atap Care" className="h-9 w-9 rounded-xl object-contain" />
            <div className="flex flex-col leading-tight">
              <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-white">Atap Care</span>
              <span className="text-[10px] uppercase tracking-widest text-white/50">PT Atap Teknologi Indonesia</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight leading-[1.05] text-white">
              Kendala Anda, Prioritas Kami.
            </h1>
            <p className="mt-6 text-base text-white/60 max-w-md">
              Laporkan kendala unit Anda, pantau progres perbaikan secara real-time, dan pastikan setiap penanganan terdokumentasi rapi, dari laporan masuk hingga kendala teratasi.
            </p>
            <div className="mt-10 inline-flex items-center gap-2 text-xs text-white/50 font-mono uppercase tracking-widest">
              <ShieldCheck className="h-3 w-3" /> Cepat · Terverifikasi · Terdokumentasi
            </div>
          </div>
        </div>
      </div>

      <div className={cn("relative overflow-hidden bg-white flex items-center justify-center p-6 md:p-10 h-dvh", LIGHT)}>
        <div className="w-full max-w-md max-h-full flex">
          <div className="relative overflow-y-auto rounded-xl border border-border/60 bg-card shadow-xl w-full">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <AnimatePresence mode="wait">
                {view === "sign-in" ? (
                  <SignInView
                    key="sign-in"
                    onSignUp={() => {
                      setJustRegistered(false);
                      setView("sign-up");
                    }}
                    onForgot={() => setView("forgot")}
                    justRegistered={justRegistered}
                  />
                ) : view === "sign-up" ? (
                  <SignUpView
                    key="sign-up"
                    onSignIn={() => setView("sign-in")}
                    onRegistered={() => {
                      setJustRegistered(true);
                      setView("sign-in");
                    }}
                  />
                ) : (
                  <ForgotView key="forgot" onBack={() => setView("sign-in")} />
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position
      } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position
      } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position
      } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    opacity: 0.04 + i * 0.005,
    width: 0.5 + i * 0.03,
  }))

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full text-white" viewBox="0 0 696 316" fill="none">
        <title>Background Paths</title>
        {paths.map((p, i) => (
          <path key={i} d={p.d} stroke="currentColor" strokeWidth={p.width} strokeOpacity={p.opacity} />
        ))}
      </svg>
    </div>
  )
}
