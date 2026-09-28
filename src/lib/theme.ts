const KEY = "atap-theme";

export function getStoredTheme(): "light" | "dark" {
  return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
}

export function applyTheme(): void {
  document.documentElement.classList.toggle("dark", getStoredTheme() === "dark");
}

// Halaman publik (pra-login) selalu light: buang class dark tanpa menyentuh
// simpanan, biar preferensi pengguna tetap hidup setelah login masuk sistem.
export function stripDark(): void {
  document.documentElement.classList.remove("dark");
}

export function setTheme(mode: "light" | "dark"): void {
  localStorage.setItem(KEY, mode);
  applyTheme();
}
