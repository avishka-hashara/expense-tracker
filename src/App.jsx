import { useEffect, useState, useMemo } from 'react'
import { supabase } from './supabase'
import CategoryManager from './CategoryManager'
import {
  Wallet,
  Calendar,
  PlusCircle,
  Search,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  Tag,
  FileText,
  PieChart,
  AlertCircle,
  RefreshCw,
  Clock,
  ArrowUpRight,
  Database,
  HardDrive,
  LayoutDashboard,
  FolderKanban
} from 'lucide-react'

const todayStr = () => new Date().toISOString().slice(0, 10)
const monthOf = (dateStr) => dateStr.slice(0, 7)

// Fallback Default Categories when Supabase is unreachable or RLS fails
const DEFAULT_CATEGORIES = [
  { id: 'cat-food', name: 'Food & Dining', color: '#f59e0b' },
  { id: 'cat-transport', name: 'Transport', color: '#3b82f6' },
  { id: 'cat-housing', name: 'Housing & Utilities', color: '#ef4444' },
  { id: 'cat-shopping', name: 'Shopping & Apparel', color: '#ec4899' },
  { id: 'cat-entertainment', name: 'Entertainment', color: '#8b5cf6' },
  { id: 'cat-health', name: 'Health & Fitness', color: '#10b981' },
  { id: 'cat-work', name: 'Work & Education', color: '#6366f1' },
  { id: 'cat-misc', name: 'Miscellaneous', color: '#64748b' },
]

function monthAfter(month) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

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

function formatMonthLabel(monthStr) {
  if (!monthStr) return ''
  const [y, m] = monthStr.split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const money = (n) =>
  `Rs. ${Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

// Helpers for Local Storage Fallback
function getLocalExpenses() {
  try {
    const raw = localStorage.getItem('spendwise_local_expenses')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalExpenses(expenses) {
  try {
    localStorage.setItem('spendwise_local_expenses', JSON.stringify(expenses))
  } catch (err) {
    console.error('Failed to save to localStorage', err)
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('EXPENSES') // 'EXPENSES' | 'CATEGORIES'
  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [month, setMonth] = useState(monthOf(todayStr()))
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [isLocalStorageMode, setIsLocalStorageMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL')
  const [deletingId, setDeletingId] = useState(null)

  const [form, setForm] = useState({
    spent_on: todayStr(),
    amount: '',
    category_id: '',
    note: '',
  })

  useEffect(() => {
    fetchCategories()
  }, [isLocalStorageMode])

  useEffect(() => {
    loadExpenses()
  }, [month, isLocalStorageMode])

  async function fetchCategories() {
    if (isLocalStorageMode) {
      loadLocalCategories()
      return
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')

      if (error || !data || data.length === 0) {
        console.warn('Supabase categories fetch failed or empty, fallback to local categories:', error)
        loadLocalCategories()
      } else {
        setCategories(data)
      }
    } catch (err) {
      console.warn('Supabase network error, using default categories:', err)
      loadLocalCategories()
    }
  }

  function loadLocalCategories() {
    try {
      const raw = localStorage.getItem('spendwise_local_categories')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.length > 0) {
          setCategories(parsed)
          return
        }
      }
    } catch (err) {
      console.error('Error reading local categories', err)
    }
    setCategories(DEFAULT_CATEGORIES)
  }

  async function loadExpenses() {
    setLoading(true)
    setError(null)

    if (isLocalStorageMode) {
      loadFromLocalStorage()
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, categories(name, color)')
        .gte('spent_on', `${month}-01`)
        .lt('spent_on', monthAfter(month))
        .order('spent_on', { ascending: false })
        .order('id', { ascending: false })

      if (error) {
        handleSupabaseError(error)
      } else {
        setExpenses(data || [])
      }
    } catch (err) {
      handleSupabaseError(err)
    }
    setLoading(false)
  }

  function handleSupabaseError(err) {
    const errorMsg = err.message || err.error_description || String(err)
    console.error('Supabase Error:', errorMsg)
    
    setIsLocalStorageMode(true)
    setError(
      `Supabase Connection / Auth Error (${errorMsg}). Switching to Local Storage Mode so you can keep tracking expenses!`
    )
    loadFromLocalStorage()
  }

  function loadFromLocalStorage() {
    const allLocal = getLocalExpenses()
    const startStr = `${month}-01`
    const endStr = monthAfter(month)

    const catMap = new Map((categories.length > 0 ? categories : DEFAULT_CATEGORIES).map((c) => [c.id, c]))

    const filtered = allLocal
      .filter((e) => e.spent_on >= startStr && e.spent_on < endStr)
      .map((e) => {
        const cat = catMap.get(e.category_id)
        return {
          ...e,
          categories: cat ? { name: cat.name, color: cat.color } : null,
        }
      })
      .sort((a, b) => (b.spent_on > a.spent_on ? 1 : b.spent_on < a.spent_on ? -1 : b.id - a.id))

    setExpenses(filtered)
  }

  async function addExpense(e) {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) return

    setSubmitting(true)
    const newExpenseObj = {
      spent_on: form.spent_on,
      amount: Number(form.amount),
      category_id: form.category_id || null,
      note: form.note.trim() || null,
    }

    if (isLocalStorageMode) {
      saveExpenseToLocalStorage(newExpenseObj)
    } else {
      try {
        const { error } = await supabase.from('expenses').insert(newExpenseObj)

        if (error) {
          console.warn('Supabase insert failed, saving to LocalStorage fallback:', error.message)
          setIsLocalStorageMode(true)
          setError(`Supabase insert error (${error.message}). Saved transaction to Local Storage.`)
          saveExpenseToLocalStorage(newExpenseObj)
        }
      } catch (err) {
        setIsLocalStorageMode(true)
        setError('Supabase connection lost. Saved transaction to Local Storage.')
        saveExpenseToLocalStorage(newExpenseObj)
      }
    }

    setSubmitting(false)
    setForm({ ...form, amount: '', note: '' })

    if (monthOf(form.spent_on) === month) {
      loadExpenses()
    } else {
      setMonth(monthOf(form.spent_on))
    }
  }

  function saveExpenseToLocalStorage(expense) {
    const allLocal = getLocalExpenses()
    const newId = Date.now()
    const fullItem = { id: newId, ...expense }
    const updated = [fullItem, ...allLocal]
    saveLocalExpenses(updated)
  }

  async function deleteExpense(id) {
    setDeletingId(id)

    if (isLocalStorageMode) {
      deleteFromLocalStorage(id)
    } else {
      try {
        const { error } = await supabase.from('expenses').delete().eq('id', id)
        if (error) {
          console.warn('Supabase delete failed, removing from local storage:', error.message)
          deleteFromLocalStorage(id)
        } else {
          setExpenses(expenses.filter((e) => e.id !== id))
        }
      } catch (err) {
        deleteFromLocalStorage(id)
      }
    }

    setDeletingId(null)
  }

  function deleteFromLocalStorage(id) {
    const allLocal = getLocalExpenses()
    const updated = allLocal.filter((e) => e.id !== id)
    saveLocalExpenses(updated)
    setExpenses(expenses.filter((e) => e.id !== id))
  }

  // Calculated Metrics
  const total = useMemo(() => {
    return expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  }, [expenses])

  const daysInMonth = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m, 0).getDate()
  }, [month])

  const dailyAverage = useMemo(() => {
    if (expenses.length === 0) return 0
    return total / daysInMonth
  }, [total, daysInMonth, expenses.length])

  const largestExpense = useMemo(() => {
    if (expenses.length === 0) return 0
    return Math.max(...expenses.map((e) => Number(e.amount)))
  }, [expenses])

  const byCategory = useMemo(() => {
    const grouped = expenses.reduce((acc, e) => {
      const name = e.categories?.name ?? 'Uncategorised'
      const color = e.categories?.color ?? '#94a3b8'
      acc[name] ??= { name, color, total: 0, count: 0 }
      acc[name].total += Number(e.amount)
      acc[name].count += 1
      return acc
    }, {})

    return Object.values(grouped).sort((a, b) => b.total - a.total)
  }, [expenses])

  const topCategory = useMemo(() => {
    return byCategory.length > 0 ? byCategory[0] : null
  }, [byCategory])

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        (item.note && item.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.categories?.name && item.categories.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.amount.toString().includes(searchQuery)

      const matchesCategory =
        selectedCategoryFilter === 'ALL' ||
        (selectedCategoryFilter === 'UNCATEGORISED' && !item.category_id) ||
        item.category_id === selectedCategoryFilter

      return matchesSearch && matchesCategory
    })
  }, [expenses, searchQuery, selectedCategoryFilter])

  // Export to CSV
  function downloadCSV() {
    if (expenses.length === 0) return
    const headers = ['Date', 'Category', 'Note', 'Amount (Rs)']
    const rows = expenses.map((e) => [
      e.spent_on,
      `"${e.categories?.name || 'Uncategorised'}"`,
      `"${(e.note || '').replace(/"/g, '""')}"`,
      e.amount,
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `SpendWise_Expenses_${month}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const activeCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  return (
    <div className="min-h-screen bg-[#050507] text-[#f5f5f7] antialiased selection:bg-[#007aff]/30 selection:text-white pb-20">
      {/* Background Apple Ambient Radial Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/4 w-[600px] h-[600px] bg-[#007aff]/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] bg-[#af52de]/10 rounded-full blur-[130px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-[#34c759]/08 rounded-full blur-[150px]" />
      </div>

      {/* Main Expansive Container - Fills screen properly across wide viewports */}
      <div className="relative z-10 w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-10 pt-6">
        
        {/* macOS TOP NAVIGATION TOOLBAR */}
        <header className="apple-card p-4 sm:p-5 mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* macOS Window Traffic Lights */}
            <div className="hidden sm:flex items-center gap-1.5 pr-2 border-r border-white/10">
              <span className="h-3 w-3 rounded-full bg-[#ff5f56] inline-block shadow-sm" />
              <span className="h-3 w-3 rounded-full bg-[#ffbd2e] inline-block shadow-sm" />
              <span className="h-3 w-3 rounded-full bg-[#27c93f] inline-block shadow-sm" />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#007aff] to-[#5856d6] text-white shadow-lg shadow-[#007aff]/20 ring-1 ring-white/20">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-white">
                    SpendWise
                  </h1>
                  <span className="rounded-full bg-[#007aff]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#0a84ff] border border-[#007aff]/30">
                    Pro
                  </span>
                  {isLocalStorageMode ? (
                    <span className="flex items-center gap-1 rounded-full bg-[#ff9500]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#ff9f0a] border border-[#ff9500]/30">
                      <HardDrive className="h-3 w-3" /> Local Engine
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-[#34c759]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#30d158] border border-[#34c759]/30">
                      <Database className="h-3 w-3" /> Supabase Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50">Personal Wealth & Expense Management</p>
              </div>
            </div>
          </div>

          {/* Center Apple Segmented Control Tabs */}
          <div className="flex items-center justify-center">
            <div className="apple-segmented-bar flex items-center gap-1">
              <button
                onClick={() => setActiveTab('EXPENSES')}
                className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-full transition-all duration-200 ${
                  activeTab === 'EXPENSES'
                    ? 'bg-[#007aff] text-white shadow-lg shadow-[#007aff]/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Expenses Dashboard</span>
              </button>
              <button
                onClick={() => setActiveTab('CATEGORIES')}
                className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-full transition-all duration-200 ${
                  activeTab === 'CATEGORIES'
                    ? 'bg-[#007aff] text-white shadow-lg shadow-[#007aff]/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <FolderKanban className="h-4 w-4" />
                <span>Manage Categories</span>
              </button>
            </div>
          </div>

          {/* Right Month Selector & Quick Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center rounded-full bg-white/[0.06] p-1 border border-white/10">
              <button
                onClick={() => setMonth(prevMonthStr(month))}
                className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="relative flex items-center px-3">
                <Calendar className="h-3.5 w-3.5 text-[#0a84ff] mr-2 pointer-events-none" />
                <span className="text-xs font-medium text-white/90 min-w-[110px] text-center">
                  {formatMonthLabel(month)}
                </span>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>

              <button
                onClick={() => setMonth(nextMonthStr(month))}
                className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => setMonth(monthOf(todayStr()))}
              className="rounded-full bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white/80 border border-white/10 hover:bg-white/10 hover:text-white transition"
            >
              Current
            </button>

            <button
              onClick={downloadCSV}
              disabled={expenses.length === 0}
              className="flex items-center gap-1.5 rounded-full bg-[#007aff]/15 px-4 py-1.5 text-xs font-medium text-[#0a84ff] border border-[#007aff]/30 hover:bg-[#007aff] hover:text-white disabled:opacity-40 transition-all duration-200"
              title="Export CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
          </div>
        </header>

        {/* ERROR / DIAGNOSTIC BANNER */}
        {error && (
          <div className="mb-6 rounded-2xl bg-[#ff9500]/10 p-4 border border-[#ff9500]/30 text-amber-200 text-sm backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-[#ff9f0a] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-300">Supabase Connection Notice</div>
                  <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">{error}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setIsLocalStorageMode(false)
                    setError(null)
                    loadExpenses()
                  }}
                  className="rounded-xl bg-[#ff9500]/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-[#ff9500]/30 transition flex items-center gap-1"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry Sync
                </button>
                <button
                  onClick={() => setError(null)}
                  className="rounded-xl bg-white/10 px-2.5 py-1.5 text-xs text-white/60 hover:text-white transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'EXPENSES' ? (
          <>
            {/* EXECUTIVE METRICS STATS GRID - 4 Column Full Width Spread */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {/* Card 1: Total Spent */}
              <div className="apple-card-interactive p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Monthly Spend
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#007aff]/15 text-[#0a84ff] border border-[#007aff]/30">
                    <Wallet className="h-4.5 w-4.5" />
                  </div>
                </div>
                <div className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight tabular-nums">
                  {money(total)}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-white/50">
                  <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/80">
                    {expenses.length} {expenses.length === 1 ? 'transaction' : 'transactions'}
                  </span>
                  <span className="text-[11px] text-[#0a84ff] font-medium">In {formatMonthLabel(month).split(' ')[0]}</span>
                </div>
              </div>

              {/* Card 2: Daily Average */}
              <div className="apple-card-interactive p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Daily Average
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#af52de]/15 text-[#bf5af2] border border-[#af52de]/30">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                </div>
                <div className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight tabular-nums">
                  {money(dailyAverage)}
                </div>
                <div className="mt-4 text-xs text-white/50 flex items-center justify-between">
                  <span>Paced over {daysInMonth} days</span>
                  <span className="text-[11px] text-[#bf5af2] font-medium">Daily Burn</span>
                </div>
              </div>

              {/* Card 3: Top Category */}
              <div className="apple-card-interactive p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Top Category
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#34c759]/15 text-[#30d158] border border-[#34c759]/30">
                    <PieChart className="h-4.5 w-4.5" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight truncate mt-1">
                  {topCategory ? topCategory.name : 'None Recorded'}
                </div>
                <div className="mt-4 text-xs text-white/50">
                  {topCategory ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: topCategory.color }}
                        />
                        <span className="font-semibold text-white/90">{money(topCategory.total)}</span>
                      </div>
                      <span className="text-[11px] font-bold text-[#30d158] bg-[#34c759]/10 px-2 py-0.5 rounded-full">
                        {Math.round((topCategory.total / (total || 1)) * 100)}%
                      </span>
                    </div>
                  ) : (
                    'No expenses logged'
                  )}
                </div>
              </div>

              {/* Card 4: Highest Single Expense */}
              <div className="apple-card-interactive p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Peak Expense
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff9500]/15 text-[#ff9f0a] border border-[#ff9500]/30">
                    <ArrowUpRight className="h-4.5 w-4.5" />
                  </div>
                </div>
                <div className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight tabular-nums">
                  {money(largestExpense)}
                </div>
                <div className="mt-4 text-xs text-white/50 flex items-center justify-between">
                  <span>Single maximum payment</span>
                  <span className="text-[11px] text-[#ff9f0a] font-medium">Max Spend</span>
                </div>
              </div>
            </div>

            {/* MAIN DASHBOARD DUAL PANEL: ADD EXPENSE & CATEGORY BREAKDOWN */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
              
              {/* RECORD EXPENSE FORM CARD (Lg 5 columns) */}
              <div className="lg:col-span-5 apple-card p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-6">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#007aff]/15 text-[#0a84ff]">
                      <PlusCircle className="h-4.5 w-4.5" />
                    </div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Record Expense</h2>
                  </div>

                  <form onSubmit={addExpense} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Date Input */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                          Date
                        </label>
                        <input
                          type="date"
                          value={form.spent_on}
                          onChange={(e) => setForm({ ...form, spent_on: e.target.value })}
                          className="glass-input w-full rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#007aff] transition"
                          required
                        />
                        {/* Quick Shortcuts */}
                        <div className="flex gap-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, spent_on: todayStr() })}
                            className="text-[11px] font-medium text-[#0a84ff] hover:underline"
                          >
                            Today
                          </button>
                          <span className="text-white/20 text-[11px]">·</span>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date()
                              d.setDate(d.getDate() - 1)
                              setForm({ ...form, spent_on: d.toISOString().slice(0, 10) })
                            }}
                            className="text-[11px] font-medium text-white/50 hover:text-white"
                          >
                            Yesterday
                          </button>
                        </div>
                      </div>

                      {/* Amount Input */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                          Amount (Rs)
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40 font-semibold text-xs">
                            Rs.
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            value={form.amount}
                            onChange={(e) => setForm({ ...form, amount: e.target.value })}
                            className="glass-input w-full rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#007aff] transition tabular-nums"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Category Selection */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                        Category
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                          <Tag className="h-4 w-4" />
                        </div>
                        <select
                          value={form.category_id}
                          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                          className="glass-input w-full rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#007aff] transition appearance-none bg-[#0a0a0c]"
                        >
                          <option value="" className="bg-[#141416] text-white/60">
                            Uncategorised
                          </option>
                          {activeCategories.map((c) => (
                            <option key={c.id} value={c.id} className="bg-[#141416] text-white">
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Note / Description */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                        Note / Description
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                          <FileText className="h-4 w-4" />
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. Apple Store purchase, Dinner, Groceries..."
                          value={form.note}
                          onChange={(e) => setForm({ ...form, note: e.target.value })}
                          className="glass-input w-full rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#007aff] transition"
                        />
                      </div>
                    </div>

                    {/* Submit Action */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-white font-semibold py-3 px-4 text-sm shadow-lg shadow-[#007aff]/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 mt-2"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Saving Transaction...</span>
                        </>
                      ) : (
                        <>
                          <PlusCircle className="h-4 w-4" />
                          <span>Add Expense</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* CATEGORY SPENDING ALLOCATION (Lg 7 columns) */}
              <div className="lg:col-span-7 apple-card p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#34c759]/15 text-[#30d158]">
                        <PieChart className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Category Breakdown</h2>
                        <p className="text-xs text-white/50">Spending distribution across categories</p>
                      </div>
                    </div>
                    <span className="text-xs text-white/70 font-semibold bg-white/10 px-3 py-1 rounded-full border border-white/10">
                      {byCategory.length} {byCategory.length === 1 ? 'Category' : 'Categories'} Active
                    </span>
                  </div>

                  {byCategory.length === 0 ? (
                    <div className="py-16 text-center text-white/40 text-sm">
                      No category spending data for this period.
                    </div>
                  ) : (
                    <div className="space-y-4 my-2">
                      {byCategory.map((c) => {
                        const percentage = Math.round((c.total / (total || 1)) * 100)
                        return (
                          <div key={c.name} className="space-y-2 group">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="h-3 w-3 rounded-full shrink-0 shadow-sm"
                                  style={{ backgroundColor: c.color }}
                                />
                                <span className="font-semibold text-white/90 truncate">{c.name}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs text-white/50 font-mono bg-white/5 px-2 py-0.5 rounded">
                                  {percentage}%
                                </span>
                                <span className="font-bold text-white tabular-nums">
                                  {money(c.total)}
                                </span>
                              </div>
                            </div>
                            {/* Apple Progress Bar */}
                            <div className="h-2.5 w-full bg-white/[0.06] rounded-full overflow-hidden p-0.5 border border-white/5">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.max(percentage, 2)}%`,
                                  backgroundColor: c.color,
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {byCategory.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
                    <span>Month total: <strong className="text-white">{money(total)}</strong></span>
                    <span className="font-semibold text-[#30d158] flex items-center gap-1">
                      ✓ 100% Accounted
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* EXPENSES TRANSACTIONS LOG TABLE & FILTERS - Spreads Across Entire Container */}
            <div className="apple-card overflow-hidden">
              {/* Header Controls */}
              <div className="p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Recent Transactions</h2>
                  <p className="text-xs text-white/50">
                    Displaying {filteredExpenses.length} of {expenses.length} records for {formatMonthLabel(month)}
                  </p>
                </div>

                {/* Search & Category Filter Pills */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search Input */}
                  <div className="relative min-w-[220px]">
                    <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-white/40" />
                    <input
                      type="text"
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="glass-input w-full rounded-full pl-9 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-[#007aff]"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                    <button
                      onClick={() => setSelectedCategoryFilter('ALL')}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        selectedCategoryFilter === 'ALL'
                          ? 'bg-[#007aff] text-white shadow-sm'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      All
                    </button>
                    {activeCategories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCategoryFilter(c.id)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition flex items-center gap-1.5 ${
                          selectedCategoryFilter === c.id
                            ? 'bg-[#007aff] text-white shadow-sm'
                            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
                        }`}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transactions List Content */}
              {loading ? (
                <div className="py-20 text-center text-white/50">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[#007aff] mb-3" />
                  <p className="text-sm font-medium">Syncing transaction records...</p>
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="py-20 text-center text-white/40 px-4">
                  <FileText className="h-12 w-12 mx-auto text-white/20 mb-3" />
                  <h3 className="text-base font-semibold text-white/80 mb-1">No transactions recorded</h3>
                  <p className="text-xs text-white/40 max-w-sm mx-auto">
                    {searchQuery || selectedCategoryFilter !== 'ALL'
                      ? 'No matching expenses found for your search or filter selection.'
                      : 'Use the form above to record your first transaction for this period.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.06]">
                  {filteredExpenses.map((e) => (
                    <li
                      key={e.id}
                      className="group flex items-center justify-between gap-4 p-4.5 sm:px-6 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 border border-white/10"
                          style={{
                            backgroundColor: `${e.categories?.color ?? '#64748b'}20`,
                          }}
                        >
                          <Tag
                            className="h-5 w-5"
                            style={{ color: e.categories?.color ?? '#94a3b8' }}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-white truncate">
                            {e.note || e.categories?.name || 'Expense'}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-white/50 mt-0.5">
                            <span className="font-medium">
                              {formatDateDisplay(e.spent_on)}
                            </span>
                            {e.categories?.name && (
                              <>
                                <span>·</span>
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border border-white/10"
                                  style={{
                                    backgroundColor: `${e.categories.color}20`,
                                    color: e.categories.color,
                                  }}
                                >
                                  {e.categories.name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-5 shrink-0">
                        <span className="text-base sm:text-lg font-bold text-white tabular-nums tracking-tight">
                          {money(e.amount)}
                        </span>

                        <button
                          onClick={() => deleteExpense(e.id)}
                          disabled={deletingId === e.id}
                          className="rounded-full p-2 text-white/40 hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-all duration-200 opacity-60 group-hover:opacity-100"
                          title="Delete expense"
                        >
                          {deletingId === e.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin text-[#ff3b30]" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <CategoryManager
            categories={activeCategories}
            expenses={expenses}
            onCategoriesUpdated={() => {
              fetchCategories()
              loadExpenses()
            }}
            isLocalStorageMode={isLocalStorageMode}
          />
        )}
      </div>
    </div>
  )
}