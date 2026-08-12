// Seed 20 tiket uji (status NEW) via jalur portal (RPC create_public_ticket),
// lengkap dengan foto placeholder (PNG murni, tanpa dependency). Site/unit
// diverifikasi terhadap master data asli lewat RPC get_sites_for_report agar
// FK valid. Tiap submit memicu notif "Tiket baru" ke Helpdesk (migrasi 31).
// Jalankan: node scripts/seed-tickets.mjs
import fs from "node:fs";
import zlib from "node:zlib";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// ── Data 20 tiket portal (site/unit divalidasi ulang terhadap master data) ──
const TICKETS = [
  { name: "Andi Saputra", pos: "Operator VMS", site: "PAMA", unit: "AMBON 1.1", color: [220, 60, 60], desc: "Layar VMS menampilkan garis-garis (no signal) sejak pagi. Sudah dicek kabel power masih normal, perlu pengecekan koneksi video dan sumber sinyal." },
  { name: "Budi Hartono", pos: "Teknisi Mesin", site: "PAMA", unit: "sensor", color: [230, 140, 40], desc: "Sensor level berkedip dan mengirim alarm palsu setiap 5 menit. Pembacaan tidak stabil walaupun kondisi tangki normal." },
  { name: "Citra Dewi", pos: "Admin Site", site: "SMMS", unit: "SMMS MTS-1", color: [220, 200, 40], desc: "Unit tidak terdeteksi di dashboard monitoring. Sudah dicoba refresh browser dan restart aplikasi, tetap tidak muncul." },
  { name: "Dedi Kurniawan", pos: "Operator", site: "SMMS", unit: "SMMS MTS-2", color: [60, 160, 220], desc: "Overheating pada modul utama, indikator LED merah menyala dan ada bau hangus dari dalam unit. Diminta pengecekan segera." },
  { name: "Eka Prasetyo", pos: "Supervisor", site: "SMMS", unit: "SMMS MTS-3", color: [90, 200, 130], desc: "Suara berdengung abnormal dari unit dan getaran meningkat sejak tadi siang. Sempat mati sendiri lalu nyala lagi." },
  { name: "Fitri Handayani", pos: "Admin Operasional", site: "cobtiuj", unit: "contoh unit 1.1", color: [150, 100, 220], desc: "Unit mati total setelah listrik padam 30 menit. Setelah listrik normal unit tidak nyala kembali, indikator tidak hidup." },
  { name: "Gilang Ramadhan", pos: "Teknisi", site: "PAMA", unit: "AMBON 1.1", color: [220, 100, 160], desc: "Koneksi jaringan terputus-putus sehingga transmisi data ke server sering gagal. Sudah cek kabel LAN, dicurigai port perangkat." },
  { name: "Hendra Wijaya", pos: "Operator", site: "PAMA", unit: "sensor", color: [120, 160, 60], desc: "Pembacaan sensor loncat-loncat tidak stabil, kadang 0 kadang 999. Dicurigai kabel sensor longgar atau sensor perlu kalibrasi." },
  { name: "Indah Lestari", pos: "Admin", site: "SMMS", unit: "SMMS MTS-1", color: [200, 90, 60], desc: "Tombol reset pada unit tidak berfungsi. Sudah ditekan beberapa kali tidak ada respons, indikator tetap menyala kuning." },
  { name: "Joko Susilo", pos: "Supervisor", site: "SMMS", unit: "SMMS MTS-2", color: [70, 140, 220], desc: "Indikator status menunjukkan error E-04 dan unit berhenti merespons perintah dari aplikasi. Mohon pengecekan lapangan." },
  { name: "Kartika Putri", pos: "Operator", site: "SMMS", unit: "SMMS MTS-3", color: [210, 120, 40], desc: "Tampilan angka di panel tidak sesuai dengan kondisi aktual di lapangan. Selisih cukup besar dan terus bertambah." },
  { name: "Lukman Hakim", pos: "Teknisi", site: "cobtiuj", unit: "contoh unit 1.1", color: [90, 130, 220], desc: "Unit mengeluarkan bunyi alarm terus-menerus meskipun tidak ada kondisi darurat. Tombol mute tidak berpengaruh." },
  { name: "Maya Sari", pos: "Admin Site", site: "PAMA", unit: "AMBON 1.1", color: [40, 180, 160], desc: "Log error di sistem mencatat kegagalan komunikasi berulang dengan unit. Data historis tidak tersinkron." },
  { name: "Nanda Pratama", pos: "Operator", site: "PAMA", unit: "sensor", color: [180, 90, 160], desc: "Sensor menunjukkan nilai negatif secara berkala. Terjadi saat cuaca hujan, diduga ada kelembaban masuk ke konektor." },
  { name: "Okta Ramadhani", pos: "Supervisor", site: "SMMS", unit: "SMMS MTS-1", color: [60, 120, 80], desc: "Kipas pendingin unit tidak berputar normal dan suhu casing terasa panas. Perlu pengecekan dan penggantian kipas bila perlu." },
  { name: "Putra Ardiansyah", pos: "Teknisi Mesin", site: "SMMS", unit: "SMMS MTS-2", color: [220, 160, 60], desc: "Switchboard panel mengalami korosi pada terminal. Koneksi kendor dan berpotensi gangguan suplai daya." },
  { name: "Rina Marlina", pos: "Admin", site: "cobtiuj", unit: "contoh unit 1.1", color: [120, 80, 200], desc: "Layar panel berkedip dan terkadang mati total lalu nyala sendiri. Pola tidak menentu, terjadi sekitar 2 hari terakhir." },
  { name: "Slamet Riyadi", pos: "Operator", site: "SMMS", unit: "SMMS MTS-3", color: [50, 170, 220], desc: "Data pengukuran tidak tercatat di log harian. Dicurigai jam internal unit bergeser sehingga penjadwalan terganggu." },
  { name: "Taufik Hidayat", pos: "Supervisor", site: "PAMA", unit: "AMBON 1.1", color: [200, 80, 120], desc: "Baut pengaman panel longgar dan panel terlihat miring. Perlu pengecekan pemasangan kembali untuk keamanan." },
  { name: "Yuni Astuti", pos: "Admin Operasional", site: "PAMA", unit: "sensor", color: [140, 180, 50], desc: "Tidak ada komunikasi data dari unit ke server sejak kemarin sore. Indikator di panel tetap menyala normal." },
];

// ── Encoder PNG murni (zlib bawaan Node; CRC32 tabel) ──
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function makePng(w, h, [r, g, b]) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // truecolor RGB
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 3);
    raw[row] = 0; // filter None
    for (let x = 0; x < w; x++) {
      raw[row + 1 + x * 3] = r;
      raw[row + 1 + x * 3 + 1] = g;
      raw[row + 1 + x * 3 + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

async function main() {
  // ── Validasi master data: site/unit harus PERSIS di tabel sites/units ──
  const { data: masterRaw } = await supabase.rpc("get_sites_for_report");
  const validPairs = new Set();
  for (const s of masterRaw ?? []) {
    for (const u of s.units ?? []) validPairs.add(`${s.site_name}\u0000${u}`);
  }
  if (validPairs.size === 0) {
    console.error("Master data kosong — tidak ada site/unit terdaftar untuk portal.");
    process.exit(1);
  }
  console.log(`Master data: ${validPairs.size} pasang site/unit tersedia.\n`);

  const codes = [];
  let i = 0;
  for (const t of TICKETS) {
    i++;
    const key = `${t.site}\u0000${t.unit}`;
    if (!validPairs.has(key)) {
      console.error(`[${i}] ${t.name}: site/unit "${t.site}/${t.unit}" tidak ada di master data. Dilewati.`);
      continue;
    }
    const photo = `data:image/png;base64,${makePng(640, 480, t.color).toString("base64")}`;

    const { data, error } = await supabase.rpc("create_public_ticket", {
      p_reporter_name: t.name,
      p_position: t.pos,
      p_phone: `08120000${String(2000 + i)}`,
      p_site: t.site,
      p_unit: t.unit,
      p_description: t.desc,
      p_photos: [photo],
    });

    const res = data || {};
    if (error || res.error) {
      console.error(`[${i}] ${t.name} gagal: ${(res.error || error?.message)}`);
      continue;
    }
    codes.push(res.code);
    console.log(`[${i}] dibuat: ${res.code} (${t.name} / ${t.site} / ${t.unit})`);
  }

  // Verifikasi lewat jalur lacak publik.
  console.log("\nVerifikasi:");
  for (const code of codes) {
    const { data } = await supabase.rpc("get_ticket_for_tracking", { p_code: code });
    const d = data || {};
    console.log(`${code} | status: ${d.status} | site: ${d.site} | unit: ${d.unit}`);
  }

  console.log(`\nSelesai: ${codes.length}/${TICKETS.length} tiket dibuat.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
