import * as XLSX from 'xlsx';

/**
 * Enterprise Excel Export Utility
 * 
 * @param {Array<Object>} data - Array of row objects to export
 * @param {string} fileName - Output file name (e.g., 'Sales_Returns.xlsx')
 * @param {string} sheetName - Excel sheet name (e.g., 'Returns')
 * @param {Array<{ key: string, label: string, formatter?: (val: any, row: any) => any }>} [columns] - Optional column mapping
 */
export function exportToExcel(data, fileName = 'export.xlsx', sheetName = 'Sheet1', columns = null) {
  if (!Array.isArray(data) || data.length === 0) {
    alert('No data available to export.');
    return;
  }

  // Guard: coerce to strings in case non-string values are passed
  const safeFileName = (typeof fileName === 'string' && fileName) ? fileName : 'export.xlsx';
  const safeSheetName = (typeof sheetName === 'string' && sheetName) ? sheetName : 'Sheet1';

  let rowsToExport;

  if (columns && Array.isArray(columns) && columns.length > 0) {
    // Map data to custom formatted headers
    rowsToExport = data.map((item, index) => {
      const row = {};
      columns.forEach(col => {
        const rawVal = col.key === '#index' ? index + 1 : item[col.key];
        const val = col.formatter ? col.formatter(rawVal, item, index) : rawVal;
        const columnHeader = col.label || col.header || col.key;
        row[columnHeader] = val !== undefined && val !== null ? val : '';
      });
      return row;
    });
  } else {
    rowsToExport = data;
  }

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rowsToExport);

  // Auto-size columns based on maximum text length
  const colWidths = [];
  if (rowsToExport.length > 0) {
    const keys = Object.keys(rowsToExport[0]);
    keys.forEach((key, i) => {
      let maxLen = key.length;
      rowsToExport.forEach(row => {
        const valStr = String(row[key] ?? '');
        if (valStr.length > maxLen) {
          maxLen = Math.min(valStr.length, 50); // Cap at 50 chars width
        }
      });
      colWidths.push({ wch: Math.max(maxLen + 4, 12) });
    });
    worksheet['!cols'] = colWidths;
  }

  // Create workbook and append worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName.substring(0, 31));

  // Ensure fileName ends with .xlsx
  const finalFileName = safeFileName.endsWith('.xlsx') ? safeFileName : `${safeFileName}.xlsx`;

  // Write file and trigger download
  XLSX.writeFile(workbook, finalFileName);
}
