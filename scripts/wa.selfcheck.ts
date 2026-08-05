// Self-check helper wa.me. Jalankan: npx tsx scripts/wa.selfcheck.ts
import assert from "node:assert";
import { normalizeWaNumber, waMeLink } from "../src/services/wa.ts";

assert.equal(normalizeWaNumber("081234567890"), "6281234567890");
assert.equal(normalizeWaNumber("+62 812-3456-7890"), "6281234567890");
assert.equal(normalizeWaNumber("6281234567890"), "6281234567890");
assert.equal(normalizeWaNumber("81234567890"), "81234567890");

const link = waMeLink("081234567890", "Tiket ATC-1 telah diproses");
assert.ok(link.startsWith("https://wa.me/6281234567890?text="));
assert.ok(link.includes(encodeURIComponent("Tiket ATC-1 telah diproses")));

console.log("wa selfcheck: OK");
