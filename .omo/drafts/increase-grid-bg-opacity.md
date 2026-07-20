---
slug: increase-grid-bg-opacity
status: approved
intent: clear
pending-action: write .omo/plans/increase-grid-bg-opacity.md
approach: Update satu nilai opacity di CSS utility grid-bg dari 4% ke 80%.
---

# Draft: increase-grid-bg-opacity

## Components (topology ledger)
| id | outcome | status | evidence |
|---|---|---|---|
| css-utility | grid-bg utility di styles.css: opacity naik 4% → 15% | active | src/styles.css:111-112 |

## Open assumptions (announced defaults)
- Tidak ada — user sudah pilih oplah 15%

## Findings (cited - path:lines)
- `src/styles.css:109-114` — utility `grid-bg` menggunakan `color-mix(in oklab, var(--foreground) 4%, transparent)` untuk garis vertikal dan horizontal
- `src/routes/index.tsx:21`, `login.tsx:45`, `report.tsx:61&140`, `track.tsx:73` — semua pakai `grid-bg opacity-80`
- Efektif sekarang: 4% × 80% = 3.2%
- Efektif setelah: 80% × 80% = 64% — garis sangat jelas

## Decisions (with rationale)
- **80% di CSS, bukan di element** — mengubah nilai di CSS utility (4% → 80%) memengaruhi SEMUA halaman yang pakai `grid-bg` secara konsisten.
- **Tidak perlu ubah `opacity-80` di element** — `opacity-80` sudah sengaja diterapkan untuk memberi efek blended dengan konten; mempertahankannya menjaga konsistensi visual.

## Scope IN
- `src/styles.css` — baris 111 dan 112: ubah `4%` menjadi `80%`

## Scope OUT (Must NOT have)
- ❌ Tidak mengubah file route atau component apapun
- ❌ Tidak mengubah ukuran grid (`background-size: 48px 48px`) atau ketebalan garis (`1px`)
- ❌ Tidak menambah/menghapus properti CSS lain

## Open questions
Tidak ada.

## Approval gate
status: awaiting-approval
