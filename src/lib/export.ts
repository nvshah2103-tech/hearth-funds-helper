import * as XLSX from "xlsx";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadXLSX(filename: string, rows: Array<Record<string, unknown>>, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

/**
 * Print-to-PDF helper: opens a new window with printable HTML then invokes browser Print dialog.
 * User selects "Save as PDF" destination.
 */
export function printHTMLToPDF(title: string, htmlBody: string) {
  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f4f4f5; font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print { @page { size: A4 landscape; margin: 12mm; } }
</style></head><body>${htmlBody}
<script>window.onload=()=>{setTimeout(()=>window.print(),200);};</script>
</body></html>`);
  w.document.close();
}
