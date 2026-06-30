'use client';

import React from 'react';
import { ExportColumn, exportRowsAsExcel, exportRowsAsPdf } from '@/utils/reportExport';

export default function ReportExportButtons({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: ExportColumn[];
  rows: any[];
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return (
    <>
      <button
        type="button"
        onClick={() => exportRowsAsExcel(title, columns, safeRows)}
        className="px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
      >
        Excel
      </button>
      <button
        type="button"
        onClick={() => exportRowsAsPdf(title, columns, safeRows)}
        className="px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap bg-white text-red-700 border border-red-200 hover:bg-red-50"
      >
        PDF
      </button>
    </>
  );
}
