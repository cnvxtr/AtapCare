// Self-check kalkulasi SLA. Jalankan: node src/services/slaCalc.selfcheck.ts
import assert from "node:assert";
import { computeSlaDeadline } from "../src/services/slaCalc.ts";

// 1. Mulai Senin 08:15 WIB, target 4 jam → selesai Senin 12:15 WIB.
assert.equal(
  computeSlaDeadline(new Date("2026-07-20T01:15:00Z"), 4, []).toISOString(),
  "2026-07-20T05:15:00.000Z",
);

// 2. Mulai Senin 15:00 WIB (sisa 2 jam), target 4 jam → lanjut Selasa 10:15 WIB.
assert.equal(
  computeSlaDeadline(new Date("2026-07-20T08:00:00Z"), 4, []).toISOString(),
  "2026-07-21T03:15:00.000Z",
);

// 3. Mulai Sabtu → lewati akhir pekan, target 2 jam → Senin 10:15 WIB.
assert.equal(
  computeSlaDeadline(new Date("2026-07-25T01:15:00Z"), 2, []).toISOString(),
  "2026-07-27T03:15:00.000Z",
);

// 4. Senin libur nasional → mundur ke Selasa, target 4 jam → Selasa 12:15 WIB.
assert.equal(
  computeSlaDeadline(new Date("2026-07-20T01:15:00Z"), 4, ["2026-07-20"]).toISOString(),
  "2026-07-21T05:15:00.000Z",
);

console.log("slaCalc selfcheck: OK");


