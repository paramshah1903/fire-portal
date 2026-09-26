import type { Response } from 'express';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';

/**
 * Shared serialisers for report rows. Each report defines a
 * `ColumnSpec[]` that specifies the header + accessor; the same spec
 * drives both CSV and XLSX outputs so the two formats stay in sync.
 */

export interface ColumnSpec<T> {
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
}

function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_') || 'report';
}

export function sendCsv<T>(
  res: Response,
  filename: string,
  columns: ColumnSpec<T>[],
  rows: T[],
): void {
  const headers = columns.map((c) => c.header);
  const data = rows.map((r) =>
    columns.map((c) => {
      const v = c.accessor(r);
      return v == null ? '' : String(v);
    }),
  );
  const csv = Papa.unparse({ fields: headers, data });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeFilename(filename)}.csv"`,
  );
  // UTF-8 BOM so Excel opens non-ASCII characters correctly.
  res.write('﻿');
  res.end(csv);
}

export async function sendXlsx<T>(
  res: Response,
  filename: string,
  columns: ColumnSpec<T>[],
  rows: T[],
  sheetName = 'Report',
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'UPL Fire Safety Portal';
  wb.created = new Date();

  const sheet = wb.addWorksheet(sheetName.slice(0, 31) || 'Report');
  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.header,
    width: Math.min(60, Math.max(c.header.length + 2, 12)),
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    const record: Record<string, unknown> = {};
    for (const c of columns) record[c.header] = c.accessor(row) ?? '';
    sheet.addRow(record);
  }

  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeFilename(filename)}.xlsx"`,
  );
  res.end(Buffer.from(buffer));
}

/**
 * Parse the `format` query param into a normalised value. Unknown
 * values (or missing) default to "json".
 */
export function parseFormat(raw: unknown): 'json' | 'csv' | 'xlsx' {
  if (typeof raw !== 'string') return 'json';
  const v = raw.toLowerCase();
  if (v === 'csv') return 'csv';
  if (v === 'xlsx' || v === 'excel') return 'xlsx';
  return 'json';
}
