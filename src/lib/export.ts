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
