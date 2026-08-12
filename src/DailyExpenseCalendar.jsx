import { useState, useMemo, useEffect } from 'react'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Tag,
  Trash2,
  Sparkles
} from 'lucide-react'

function formatMonthLabel(monthStr) {
  if (!monthStr) return ''
  const [y, m] = monthStr.split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDateFull(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const money = (n) =>
  `Rs. ${Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

function prevMonthStr(month) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonthStr(month) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function DailyExpenseCalendar({
  expenses = [],
  month,
  setMonth,
  categories = [],
  onDeleteExpense,
}) {
  const [selectedDateStr, setSelectedDateStr] = useState(null)

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedDateStr(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Parse Month parameters
  const [year, monthNum] = useMemo(() => {
    if (!month) {
      const now = new Date()
      return [now.getFullYear(), now.getMonth() + 1]
    }
    const [y, m] = month.split('-').map(Number)
    return [y, m]
  }, [month])

  // Calculate Days Grid
  const { calendarDays, maxDailyTotal } = useMemo(() => {
    const daysInMonth = new Date(year, monthNum, 0).getDate()
    // First day index (0 = Sunday, 1 = Monday...)
    const firstDayIndex = new Date(year, monthNum - 1, 1).getDay()

    // Group expenses by YYYY-MM-DD
    const expByDate = {}
    expenses.forEach((e) => {
      if (!e.spent_on) return
      expByDate[e.spent_on] ??= { total: 0, items: [] }
      expByDate[e.spent_on].items.push(e)
      expByDate[e.spent_on].total += Number(e.amount || 0)
    })

    let maxTotal = 0
    Object.values(expByDate).forEach((val) => {
      if (val.total > maxTotal) maxTotal = val.total
    })

    const days = []

    // Padding empty cells before day 1
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ isPadding: true, key: `pad-${i}` })
    }

    const todayStr = new Date().toISOString().slice(0, 10)

    // Month Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayData = expByDate[dateStr] || { total: 0, items: [] }
      days.push({
        isPadding: false,
        dayNum: d,
        dateStr,
        total: dayData.total,
        items: dayData.items,
        isToday: dateStr === todayStr,
      })
    }

    return { calendarDays: days, maxDailyTotal: maxTotal }
  }, [year, monthNum, expenses])

  // Get selected day details
  const selectedDayData = useMemo(() => {
    if (!selectedDateStr) return null
    const dayItems = expenses.filter((e) => e.spent_on === selectedDateStr)
    const dayTotal = dayItems.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    return {
      dateStr: selectedDateStr,
      total: dayTotal,
      items: dayItems,
    }
  }, [selectedDateStr, expenses])

  // Dynamic Intensity Classifier
  const getIntensityClass = (total) => {
    if (total === 0) {
      return 'bg-white/[0.02] text-white/40 border-white/[0.06] hover:bg-white/[0.06]'
    }

    if (maxDailyTotal === 0) return 'bg-white/[0.04]'

    const ratio = total / maxDailyTotal

    if (ratio < 0.25) {
      // Low Spend
      return 'bg-[#007aff]/15 text-[#0a84ff] border-[#007aff]/30 hover:bg-[#007aff]/25'
    } else if (ratio < 0.65) {
      // Medium Spend
      return 'bg-[#af52de]/25 text-[#bf5af2] border-[#af52de]/40 hover:bg-[#af52de]/35'
    } else {
      // High / Peak Spend
      return 'bg-gradient-to-br from-[#007aff] to-[#5856d6] text-white border-[#007aff] shadow-lg shadow-[#007aff]/30 font-bold hover:brightness-110'
    }
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="apple-card p-6 sm:p-7 relative overflow-hidden">
      {/* HEADER & MONTH NAVIGATION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#007aff] to-[#af52de] text-white shadow-lg shadow-[#007aff]/20">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Daily Expense Calendar</h2>
            <p className="text-xs text-white/50">Visual spending heatmap & day-by-day drilldown</p>
          </div>
        </div>

        {/* Month Selector & Heatmap Legend */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Legend */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-white/60">
            <span>Spend Heatmap:</span>
            <div className="flex items-center gap-1.5 ml-1">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-white/[0.05] border border-white/10 inline-block" /> $0
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#007aff]/20 border border-[#007aff]/40 inline-block" /> Low
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#af52de]/30 border border-[#af52de]/50 inline-block" /> Med
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-[#007aff] to-[#5856d6] inline-block" /> High
              </span>
            </div>
          </div>

          {/* Month Stepper Controls */}
          <div className="flex items-center rounded-full bg-white/[0.06] p-1 border border-white/10">
            <button
              onClick={() => setMonth(prevMonthStr(month))}
              className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="text-xs font-semibold text-white px-3 min-w-[110px] text-center">
              {formatMonthLabel(month)}
            </span>

            <button
              onClick={() => setMonth(nextMonthStr(month))}
              className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* WEEKDAY HEADERS */}
      <div className="grid grid-cols-7 gap-2 mb-2 text-center">
        {weekDays.map((wd, idx) => (
          <div
            key={wd}
            className={`text-[11px] font-bold uppercase tracking-wider py-1 ${
              idx === 0 || idx === 6 ? 'text-white/40' : 'text-white/60'
            }`}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* CALENDAR DAYS GRID */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((cell) => {
          if (cell.isPadding) {
            return (
              <div
                key={cell.key}
                className="h-20 sm:h-24 rounded-2xl bg-white/[0.01] border border-transparent pointer-events-none"
              />
            )
          }

          const intensityClass = getIntensityClass(cell.total)
          const isSelected = selectedDateStr === cell.dateStr

          return (
            <button
              key={cell.dateStr}
              onClick={() => setSelectedDateStr(cell.dateStr)}
              className={`h-20 sm:h-24 rounded-2xl border p-2 sm:p-2.5 flex flex-col justify-between text-left transition-all duration-200 group relative ${intensityClass} ${
                isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#050507] scale-[1.02] z-10' : ''
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-xs font-bold ${
                    cell.isToday
                      ? 'bg-white text-black h-5 w-5 rounded-full flex items-center justify-center shadow-md'
                      : 'opacity-80'
                  }`}
                >
                  {cell.dayNum}
                </span>

                {cell.items.length > 0 && (
                  <span className="text-[10px] font-semibold opacity-75 bg-black/20 px-1.5 py-0.5 rounded-full">
                    {cell.items.length} {cell.items.length === 1 ? 'tx' : 'txs'}
                  </span>
                )}
              </div>

              <div className="mt-auto">
                {cell.total > 0 ? (
                  <div className="font-extrabold text-xs sm:text-sm tracking-tight tabular-nums truncate">
                    {money(cell.total)}
                  </div>
                ) : (
                  <div className="text-[11px] opacity-40 font-mono">-</div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* DRILL-DOWN MODAL / POPUP */}
      {selectedDateStr && selectedDayData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          {/* Backdrop Click Area */}
          <div
            className="absolute inset-0"
            onClick={() => setSelectedDateStr(null)}
          />

          {/* Modal Container */}
          <div className="apple-card w-full max-w-lg p-6 relative z-10 shadow-2xl border border-white/20 animate-scaleUp">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-white/10">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#0a84ff]">
                  Daily Expense Summary
                </span>
                <h3 className="text-xl font-bold text-white tracking-tight mt-0.5">
                  {formatDateFull(selectedDateStr)}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDateStr(null)}
                className="rounded-full p-2 text-white/50 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Total Spent Banner */}
            <div className="my-5 p-4 rounded-2xl bg-gradient-to-r from-[#007aff]/20 to-[#af52de]/20 border border-[#007aff]/30 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-white/60">Total Spent On This Day</div>
                <div className="text-2xl font-extrabold text-white tracking-tight tabular-nums mt-0.5">
                  {money(selectedDayData.total)}
                </div>
              </div>
              <div className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/10 text-white border border-white/10">
                {selectedDayData.items.length} {selectedDayData.items.length === 1 ? 'Record' : 'Records'}
              </div>
            </div>

            {/* Expenses List */}
            <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
              {selectedDayData.items.length === 0 ? (
                <div className="py-12 text-center text-white/40">
                  <Sparkles className="h-10 w-10 mx-auto text-white/20 mb-2" />
                  <p className="text-sm font-semibold text-white/70">No expenses recorded for this day.</p>
                  <p className="text-xs text-white/40 mt-1">Enjoy your zero-spend day!</p>
                </div>
              ) : (
                selectedDayData.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3 group hover:bg-white/[0.07] transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                        style={{
                          backgroundColor: `${item.categories?.color ?? '#007aff'}20`,
                        }}
                      >
                        <Tag
                          className="h-4.5 w-4.5"
                          style={{ color: item.categories?.color ?? '#0a84ff' }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-white truncate">
                          {item.note || item.categories?.name || 'Expense'}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/50 mt-0.5">
                          {item.categories?.name && (
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border border-white/10"
                              style={{
                                backgroundColor: `${item.categories.color}20`,
                                color: item.categories.color,
                              }}
                            >
                              {item.categories.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-base font-bold text-white tabular-nums">
                        {money(item.amount)}
                      </span>
                      {onDeleteExpense && (
                        <button
                          onClick={() => onDeleteExpense(item.id)}
                          className="rounded-full p-1.5 text-white/40 hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition opacity-60 group-hover:opacity-100"
                          title="Delete expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-5 pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setSelectedDateStr(null)}
                className="px-5 py-2 text-xs font-semibold rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
