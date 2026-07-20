# increase-grid-bg-opacity - Work Plan

## TL;DR (For humans)

**What you'll get:** Garis grid background di semua halaman (landing, report, track, login) jadi lebih terlihat — opacity dinaikkan dari 4% ke 15%.

**Why this approach:** Cukup ubah satu nilai di CSS utility `grid-bg`. Semua halaman yang pakai utility ini otomatis kebawa. Tidak perlu edit 5 file route satu-satu.

**What it will NOT do:** Tidak mengubah ukuran grid, ketebalan garis, atau warna. Tidak mengubah element `opacity-80`.

**Effort:** Quick (satu baris CSS)
**Risk:** Low — perubahan hanya angka, langsung kelihatan efeknya, mudah di-revert

Your next move: approve plan, atau jalankan `/start-work`.

---

> TL;DR (machine): Quick, Low risk — ubah `4%` → `80%` di utility `grid-bg` styles.css baris 111-112.

## Scope
### Must have
- `src/styles.css:111-112` — ubah `4%` jadi `80%` di kedua linear-gradient

### Must NOT have (guardrails, anti-slop, scope boundaries)
- ❌ Tidak ubah file lain
- ❌ Tidak ubah `background-size`, `1px`, atau properti lain
- ❌ Tidak tambah CSS baru

## Verification strategy
> Zero human intervention — all verification is agent-executed.
- Test decision: tests-after — visual check + grep
- Evidence: `.omo/evidence/increase-grid-bg-opacity/`

## Execution strategy
Single todo, single wave.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |

## Todos
- [ ] 1. `src/styles.css:111-112` — Naikkan opacity grid dari 4% ke 15%
  What to do / Must NOT do: Di file `src/styles.css`, baris 111 dan 112, ubah `color-mix(in oklab, var(--foreground) 4%, transparent)` menjadi `color-mix(in oklab, var(--foreground) 15%, transparent)`. Kedua baris (horizontal & vertical gradient) harus diubah. **Jangan** ubah apapun di luar dua baris ini.
  Parallelization: Wave 1 | Blocked by: none | Blocks: none
  References:
    - `src/styles.css:109-114` — seluruh utility grid-bg:
      ```
      @utility grid-bg {
        background-image:
          linear-gradient(to right, color-mix(in oklab, var(--foreground) 4%, transparent) 1px, transparent 1px),
          linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 4%, transparent) 1px, transparent 1px);
        background-size: 48px 48px;
      }
      ```
  Acceptance criteria (agent-executable): `grep "foreground) 80%," src/styles.css` mengembalikan 2 baris (horizontal + vertical). `grep "foreground) 4%," src/styles.css` mengembalikan 0 baris.
  QA scenarios: Happy — grid lines visible on any page with `grid-bg` class. Failure — wrong value, test: `grep "4%," src/styles.css` must be empty. Evidence: `.omo/evidence/increase-grid-bg-opacity/task-1-css-change.txt`
  Commit: Y | style(css): increase grid-bg opacity from 4% to 80%

## Final verification wave
- [ ] F1. Plan compliance audit — hanya `src/styles.css` yang diubah, tidak ada file lain
- [ ] F2. Code quality review — nilai 80% sesuai permintaan user, konsisten di kedua gradient
- [ ] F3. Real manual QA — buka landing page `/`, lihat grid background lebih jelas dari sebelumnya
- [ ] F4. Scope fidelity — tidak ada perubahan di luar CSS utility grid-bg

## Commit strategy
Satu commit: `style(css): increase grid-bg opacity from 4% to 80%`

## Success criteria
1. `grep "foreground) 80%," src/styles.css` — 2 matches (horizontal + vertical)
2. `grep "foreground) 4%," src/styles.css` — 0 matches
3. Grid lines terlihat jelas di halaman `/`, `/report`, `/track`, `/login`
