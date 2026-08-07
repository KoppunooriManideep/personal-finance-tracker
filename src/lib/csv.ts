/**
 * Tiny, dependency-free CSV helpers.
 *
 * Values are RFC-4180 quoted (fields containing a comma, quote, or newline are
 * wrapped in double quotes with internal quotes doubled). A UTF-8 BOM is
 * prepended so Excel reads ₹ and other non-ASCII characters correctly.
 */

/** Quote a single CSV cell if it contains a comma, quote, or newline. */
function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Build a CSV string from a header row and data rows (all cells as strings). */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCell).join(','),
  )
  return lines.join('\r\n')
}

/** Trigger a browser download of `content` as a UTF-8 CSV file. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(['﻿', content], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
