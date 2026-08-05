import { STATUS_LABELS } from "@/components/Badge";

export type ExportCell = string | number | null | undefined;

function downloadBlob(blob: Blob, filename: string) {
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

export function exportCsv(rows: ExportCell[][], baseName: string): void {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), `${baseName}.csv`);
}

// ponytail: SpreadsheetML 2003 (.xls), bukan XLSX zip — Excel/LibreOffice membuka dengan benar tanpa
// dependensi zip; upgrade ke real xlsx (JSZip/xlsx lib) bila format asli dibutuhkan.
export function exportXlsx(rows: ExportCell[][], baseName: string, sheetName: string): void {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = rows
    .map(
      (r) =>
        `<Row>${r
          .map((c) => `<Cell><Data ss:Type="String">${esc(String(c ?? ""))}</Data></Cell>`)
          .join("")}</Row>`,
    )
    .join("");
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
<Worksheet ss:Name="${esc(sheetName)}"><Table>${body}</Table></Worksheet></Workbook>`;
  downloadBlob(
    new Blob(["\uFEFF" + xml], { type: "application/vnd.ms-excel;charset=utf-8;" }),
    `${baseName}.xls`,
  );
}

// Template XLSX bergaya Arsip helpdesk: kop perusahaan + logo, band periode,
// header uppercase + autoFilter, zebra, ID Consolas, fill prioritas & pill
// status. priorityCols/statusCols 1-based, opsional.
export async function exportStyledXlsx({
  rows,
  headers,
  sheetName,
  baseName,
  bandTitle,
  priorityCols = [],
  statusCols = [],
}: {
  rows: ExportCell[][];
  headers: string[];
  sheetName: string;
  baseName: string;
  bandTitle: string;
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

  // Band judul
  ws.getRow(3).height = 28;
  ws.mergeCells(3, 1, 3, lastCol);
  const band = ws.getCell("A3");
  band.value = bandTitle;
  band.font = { name: "Arial", size: 12, bold: true, color: { argb: ink } };
  band.alignment = { horizontal: "center", vertical: "middle" };
  band.fill = { type: "pattern", pattern: "solid", fgColor: { argb: mutedBg } };
  band.border = { bottom: { style: "medium" as const, color: { argb: black } } };

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
  const priorityFills: Record<string, string> = { P1: "DC2626", P2: "F59E0B", P3: "3B82F6" };
  rows.forEach((r, idx) => {
    const row = ws.getRow(idx + 5);
    row.height = 18;
    r.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.border = thin();
      cell.font = { name: "Arial", size: 10, color: { argb: ink } };
      cell.alignment = { horizontal: "left", vertical: "middle" };
      if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } };
    });
    // ID (kolom 1): monospace
    row.getCell(1).font = { name: "Consolas", size: 10, bold: true, color: { argb: ink } };
    // Prioritas: solid sesuai badge web
    priorityCols.forEach((c) => {
      const cell = row.getCell(c);
      const fill = priorityFills[String(r[c - 1] ?? "")];
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
