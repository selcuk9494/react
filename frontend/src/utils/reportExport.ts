'use client';

export type ExportColumn = {
  key: string;
  label: string;
  format?: (value: any, row: any) => string | number;
};

const escapeCell = (value: any) => {
  const text = value === null || typeof value === 'undefined' ? '' : String(value);
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const getValue = (row: any, column: ExportColumn) => {
  const raw = row?.[column.key];
  return column.format ? column.format(raw, row) : raw;
};

export function exportRowsAsExcel(title: string, columns: ExportColumn[], rows: any[]) {
  const tableRows = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${escapeCell(getValue(row, column))}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  const html = `
    <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <table>
          <thead><tr>${columns.map((column) => `<th>${escapeCell(column.label)}</th>`).join('')}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  downloadBlob(blob, `${slugify(title)}.xls`);
}

export function exportRowsAsPdf(title: string, columns: ExportColumn[], rows: any[]) {
  const tableRows = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${escapeCell(getValue(row, column))}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeCell(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { font-size: 20px; margin: 0 0 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>${escapeCell(title)}</h1>
        <table>
          <thead><tr>${columns.map((column) => `<th>${escapeCell(column.label)}</th>`).join('')}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };</script>
      </body>
    </html>
  `;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'rapor';
}
