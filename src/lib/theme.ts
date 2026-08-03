const KEY = "atap-theme";

export function getStoredTheme(): "light" | "dark" {
  return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
}

export function applyTheme(): void {
  document.documentElement.classList.toggle("dark", getStoredTheme() === "dark");
}

export function setTheme(mode: "light" | "dark"): void {
  localStorage.setItem(KEY, mode);
  applyTheme();
}
