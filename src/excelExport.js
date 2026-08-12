import * as XLSX from 'xlsx'

function formatMonthLabel(monthStr) {
  if (!monthStr) return ''
  const [y, m] = monthStr.split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function exportToExcel({ expenses, month, total, dailyAverage, byCategory }) {
  if (!expenses || expenses.length === 0) return

  const monthName = formatMonthLabel(month)

  // 1. Executive Summary Block
  const summaryRows = [
    ['SPENDWISE EXECUTIVE EXPENSE REPORT'],
    ['Statement Period:', monthName],
    ['Report Generated Date:', new Date().toLocaleString()],
    ['Total Monthly Spend:', Number(total)],
    ['Daily Average Spend:', Number(dailyAverage)],
    ['Total Transactions Recorded:', expenses.length],
    [], // Blank row
  ]

  // 2. Category Summary Table
  const categoryHeader = ['Category Name', 'Transaction Count', 'Total Spent (Rs)', 'Share (%)']
  const categoryData = byCategory.map((cat) => [
    cat.name,
    cat.count,
    Number(cat.total),
    `${Math.round((cat.total / (total || 1)) * 100)}%`,
  ])
  const categoryTotalRow = [
    'TOTAL ALLOCATED',
    expenses.length,
    Number(total),
    '100%',
  ]

  // 3. Itemized Expense Log Table
  const expenseHeader = ['S.No', 'Date', 'Category', 'Description / Note', 'Amount (Rs)']
  const expenseData = expenses.map((item, index) => [
    index + 1,
    item.spent_on,
    item.categories?.name || 'Uncategorised',
    item.note || '-',
    Number(item.amount),
  ])
  const expenseTotalRow = [
    '',
    '',
    '',
    'GRAND TOTAL SPEND',
    Number(total),
  ]

  // Combine rows into sheet structure
  const sheetData = [
    ...summaryRows,
    ['CATEGORY BREAKDOWN SUMMARY'],
    categoryHeader,
    ...categoryData,
    categoryTotalRow,
    [], // Blank row
    ['ITEMIZED TRANSACTION LOG'],
    expenseHeader,
    ...expenseData,
    expenseTotalRow,
  ]

  // Create Worksheet
  const ws = XLSX.utils.aoa_to_sheet(sheetData)

  // Set explicit column widths for crisp formatting in Excel
  ws['!cols'] = [
    { wch: 8 },  // S.No
    { wch: 14 }, // Date
    { wch: 25 }, // Category
    { wch: 42 }, // Description / Note
    { wch: 18 }, // Amount (Rs)
    { wch: 12 }, // Share (%)
  ]

  // Create Workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Expenses_${month}`)

  // Write .xlsx file directly
  XLSX.writeFile(wb, `SpendWise_Expense_Report_${month}.xlsx`)
}
