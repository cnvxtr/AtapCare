import { STATUS_LABELS } from "@/components/Badge";
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export type ExportCell = string | number | null | undefined;

// Unduh file: web → blob download; native → share sheet (webview tak mendukung
// anchor download). Tulis ke cache, share, lalu bersihkan.
async function downloadBlob(blob: Blob, filename: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(r.error)
        r.readAsDataURL(blob)
      })
      const data = b64.slice(b64.indexOf(',') + 1)
      const file = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache })
      try {
        await Share.share({ url: file.uri, title: filename, dialogTitle: 'Bagikan Berkas' })
      } finally {
        await Filesystem.deleteFile({ path: filename, directory: Directory.Cache })
      }
    } catch {
      throw new Error('Gagal mengunduh di perangkat.')
    }
    return
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

// Fill prioritas (ARGB tanpa prefix) — dipakai template XLSX dan PDF.
const PRIORITY_FILLS: Record<string, string> = { Critical: "DC2626", Medium: "F59E0B", Low: "3B82F6" };
const hexRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(0, 2), 16),
  parseInt(hex.slice(2, 4), 16),
  parseInt(hex.slice(4, 6), 16),
];

// Template XLSX bergaya Arsip helpdesk: kop perusahaan + logo, band periode,
// header uppercase + autoFilter, zebra, ID Consolas, fill prioritas & pill
// status. priorityCols/statusCols 1-based, opsional.
export async function exportStyledXlsx({
  rows,
  headers,
  sheetName,
  baseName,
  bandTitle,
  filterBox,
  highlightRows = [],
  priorityCols = [],
  statusCols = [],
}: {
  rows: ExportCell[][];
  headers: string[];
  sheetName: string;
  baseName: string;
  bandTitle: string;
  filterBox?: string;
  highlightRows?: number[];
  priorityCols?: number[];
  statusCols?: number[];
}): Promise<void> {
  const [{ default: ExcelJS }, { default: logoBase64 }] = await Promise.all([
    import("exceljs"),
    import("../assets/logo.png?inline"),
  ]);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.views = [{ state: "frozen", ySplit: 4 }];
  ws.columns = headers.map((h) => ({ width: Math.min(40, Math.max(10, h.length + 2)) }));

  const ink = "252525";
  const black = "171717";
  const mutedBg = "F4F4F4";
  const zebra = "FBFBFB";
  const borderColor = "D4D4D4";
  const thin = (color: string = borderColor) => ({
    top: { style: "thin" as const, color: { argb: color } },
    left: { style: "thin" as const, color: { argb: color } },
    bottom: { style: "thin" as const, color: { argb: color } },
    right: { style: "thin" as const, color: { argb: color } },
  });
  const lastCol = headers.length;

  // Lebar kolom ikut konten (per dataset beda kolom).
  rows.forEach((r) =>
    r.forEach((c, i) => {
      const len = String(c ?? "").length + 2;
      if (ws.columns[i] && len > (ws.columns[i].width ?? 0)) ws.columns[i].width = Math.min(40, len);
    }),
  );

  // Kop: logo + nama perusahaan
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 14;
  ws.mergeCells(1, 1, 2, lastCol);
  const brand = ws.getCell("A1");
  brand.value = {
    richText: [
      { text: "ATAP CARE", font: { name: "Arial", size: 14, bold: true, color: { argb: ink } } },
      { text: "\nPT ATAP TEKNOLOGI INDONESIA", font: { name: "Arial", size: 9, color: { argb: "7A7A7A" } } },
    ],
  };
  brand.alignment = { vertical: "middle", wrapText: true, indent: 7 };

  // Band judul — bila ada filterBox, judul dibelah (kolom 1..n-2) dan 2 kolom
  // terakhir jadi kotak berisi lingkup filter (perusahaan/site/unit).
  const splitBand = Boolean(filterBox) && lastCol > 2;
  ws.getRow(3).height = splitBand ? 34 : 28;
  ws.mergeCells(3, 1, 3, splitBand ? lastCol - 2 : lastCol);
  const band = ws.getCell("A3");
  band.value = bandTitle;
  band.font = { name: "Arial", size: 12, bold: true, color: { argb: ink } };
  band.alignment = { horizontal: "center", vertical: "middle" };
  band.fill = { type: "pattern", pattern: "solid", fgColor: { argb: mutedBg } };
  band.border = { bottom: { style: "medium" as const, color: { argb: black } } };
  if (splitBand && filterBox) {
    ws.mergeCells(3, lastCol - 1, 3, lastCol);
    const box = ws.getCell(3, lastCol - 1);
    box.value = filterBox;
    box.font = { name: "Arial", size: 8, bold: true, color: { argb: ink } };
    box.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    box.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF" } };
    box.border = {
      top: { style: "thin" as const, color: { argb: borderColor } },
      left: { style: "thin" as const, color: { argb: borderColor } },
      right: { style: "thin" as const, color: { argb: borderColor } },
      bottom: { style: "medium" as const, color: { argb: black } },
    };
  }

  // Header tabel
  const headerRow = ws.getRow(4);
  headerRow.height = 24;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h.toUpperCase();
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: ink } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E5E5E5" } };
    cell.border = thin("525252");
  });
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: lastCol } };

  // Data
  rows.forEach((r, idx) => {
    const row = ws.getRow(idx + 5);
    row.height = 18;
    r.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.border = thin();
      cell.font = { name: "Arial", size: 10, color: { argb: highlightRows.includes(idx) ? "A16207" : ink } };
      cell.alignment = { horizontal: "left", vertical: "middle" };
      if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } };
    });
    // ID (kolom 1): monospace
    row.getCell(1).font = { name: "Consolas", size: 10, bold: true, color: { argb: ink } };
    // Prioritas: solid sesuai badge web
    priorityCols.forEach((c) => {
      const cell = row.getCell(c);
      const fill = PRIORITY_FILLS[String(r[c - 1] ?? "")];
      if (fill) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
        cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
      }
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    // Status: pill hitam + label Indonesia
    statusCols.forEach((c) => {
      const cell = row.getCell(c);
      cell.value = STATUS_LABELS[String(r[c - 1] ?? "")] || r[c - 1];
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: black } };
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
  });

  // Logo (float di atas cell A1)
  const logoId = wb.addImage({ base64: logoBase64, extension: "png" });
  ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 44, height: 44 } });

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${baseName}.xlsx`,
  );
}

// Template PDF mirror XLSX: kop + logo, band judul, tabel landscape
// (A4) dengan header abu, zebra, fill prioritas & status hitam.
export async function exportStyledPdf({
  rows,
  headers,
  sheetName,
  baseName,
  bandTitle,
  filterBox,
  highlightRows = [],
  priorityCols = [],
  statusCols = [],
}: {
  rows: ExportCell[][];
  headers: string[];
  sheetName: string;
  baseName: string;
  bandTitle: string;
  filterBox?: string;
  highlightRows?: number[];
  priorityCols?: number[];
  statusCols?: number[];
}): Promise<void> {
  const [{ jsPDF }, { default: autoTable }, { default: logoBase64 }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("../assets/logo.png?inline"),
  ]);

  const ink: [number, number, number] = [37, 37, 37];
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setProperties({ title: sheetName });

  doc.addImage(logoBase64, "PNG", 14, 9, 15, 15);
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(23, 23, 23).text("ATAP CARE", 33, 15);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(122, 122, 122)
    .text("PT ATAP TEKNOLOGI INDONESIA", 33, 20);

  // Status pill hitam → label Indonesia (spt XLSX), sekali sebelum render.
  // `?? ""` wajib: undefined tidak diterima tipe RowInput autotable.
  const body = rows.map((r) =>
    r.map((v, i) =>
      (statusCols.includes(i + 1) ? STATUS_LABELS[String(v ?? "")] || v : v) ?? "",
    ),
  );

  // Lebar kolom ikut konten (cap 10–40 char) persis aturan XLSX, dikonversi ke
  // mm (1 char Excel ≈ 7px ≈ 1,85mm); kalau total melebihi halaman landscape,
  // skala turun proporsional. Tabel sempit dibiarkan (mirip XLSX, tak dipaksa
  // melebar penuh).
  const MM_PER_CHAR = 1.85;
  const usable = 269; // A4 landscape 297mm − margin kiri/kanan 14mm
  const widths = headers.map((h, i) => {
    let chars = Math.min(40, Math.max(10, h.length + 2));
    for (const r of rows) {
      const len = String(r[i] ?? "").length + 2;
      if (len > chars) chars = Math.min(40, len);
    }
    return chars * MM_PER_CHAR;
  });
  const total = widths.reduce((s, w) => s + w, 0);
  const scale = total > usable ? usable / total : 1;
  const columnStyles: Record<number, { cellWidth: number }> = Object.fromEntries(
    widths.map((w, i) => [i, { cellWidth: w * scale }]),
  );

  // Band judul — bila ada filterBox, 2 kolom terakhir (Jam Masuk/Keluar) jadi
  // kotak putih berisi lingkup filter; judul di-center di sisa ruang kiri.
  const wS = widths.map((w) => w * scale);
  const tableW = wS.reduce((s, w) => s + w, 0);
  const splitBand = Boolean(filterBox) && headers.length > 2;
  const boxW = headers.length > 2 ? wS[wS.length - 1] + wS[wS.length - 2] : 0;
  const boxX = 14 + tableW - boxW;
  doc.setFillColor(244, 244, 244);
  doc.rect(14, 26, 269, 9, "F");
  if (splitBand && filterBox) {
    doc.setFillColor(255, 255, 255);
    doc.rect(boxX, 26, boxW, 9, "F");
    doc.setDrawColor(82, 82, 82).setLineWidth(0.15).rect(boxX, 26, boxW, 9, "S");
  }
  doc.setDrawColor(23, 23, 23).setLineWidth(0.5).line(14, 35, 283, 35);
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(23, 23, 23);
  doc.text(bandTitle, splitBand ? 14 + (boxX - 14) / 2 : 148.5, 32, { align: "center" });
  if (splitBand && filterBox) {
    doc.setFontSize(7).setTextColor(37, 37, 37);
    doc.text(filterBox, boxX + boxW / 2, 30.5, {
      align: "center",
      maxWidth: boxW - 3,
      baseline: "middle",
    });
  }

  autoTable(doc, {
    head: [headers.map((h) => h.toUpperCase())],
    body,
    startY: 40,
    margin: { left: 14, right: 14 },
    columnStyles,
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 1.5,
      overflow: "linebreak",
      lineWidth: 0.05,
      lineColor: [212, 212, 212],
      textColor: ink,
    },
    headStyles: {
      fillColor: [229, 229, 229],
      textColor: [23, 23, 23],
      fontStyle: "bold",
      halign: "center",
      lineWidth: 0.1,
      lineColor: [82, 82, 82],
    },
    alternateRowStyles: { fillColor: [251, 251, 251] },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const col = data.column.index + 1;
      // ID (kolom 1) bold
      if (col === 1) data.cell.styles.fontStyle = "bold";
      const fill = priorityCols.includes(col) && PRIORITY_FILLS[String(data.cell.raw ?? "")];
      if (fill) {
        data.cell.styles.fillColor = hexRgb(fill);
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.halign = "center";
      } else if (statusCols.includes(col)) {
        data.cell.styles.fillColor = [23, 23, 23];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.halign = "center";
      } else if (highlightRows.includes(data.row.index)) {
        data.cell.styles.textColor = [161, 98, 7];
      }
    },
  });

  downloadBlob(doc.output("blob"), `${baseName}.pdf`);
}
