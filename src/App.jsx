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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white pb-16">
      {/* Background Subtle Gradient Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 pt-8">
        {/* TOP NAVBAR BRANDING & CONTROLS */}
        <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white font-heading">
                  SpendWise
                </h1>
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
                  Executive
                </span>
                {isLocalStorageMode ? (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/20">
                    <HardDrive className="h-3 w-3" /> Local Mode
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                    <Database className="h-3 w-3" /> Supabase
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Expense Analytics & Wealth Tracking</p>
            </div>
          </div>

          {/* Month Selector & Quick Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl bg-slate-900/90 p-1 ring-1 ring-white/10 shadow-inner">
              <button
                onClick={() => setMonth(prevMonthStr(month))}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="relative flex items-center px-2">
                <Calendar className="h-4 w-4 text-indigo-400 mr-2 pointer-events-none" />
                <span className="text-sm font-semibold text-slate-200 min-w-[120px] text-center">
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
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => setMonth(monthOf(todayStr()))}
              className="rounded-xl bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-300 ring-1 ring-white/10 hover:bg-slate-800 hover:text-white transition"
            >
              Current Month
            </button>

            <button
              onClick={downloadCSV}
              disabled={expenses.length === 0}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900/80 px-3.5 py-2 text-xs font-medium text-slate-300 ring-1 ring-white/10 hover:bg-indigo-600 hover:text-white hover:ring-indigo-500/50 disabled:opacity-40 disabled:hover:bg-slate-900 transition"
              title="Export CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
          </div>
        </header>

        {/* NAVIGATION TAB BAR */}
        <div className="flex items-center gap-2 mb-8 border-b border-slate-800/80 pb-4">
          <button
            onClick={() => setActiveTab('EXPENSES')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition ${
              activeTab === 'EXPENSES'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 ring-1 ring-indigo-500'
                : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/80 ring-1 ring-white/5'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Expenses Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('CATEGORIES')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition ${
              activeTab === 'CATEGORIES'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 ring-1 ring-indigo-500'
                : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/80 ring-1 ring-white/5'
            }`}
          >
            <FolderKanban className="h-4 w-4" />
            <span>Manage Categories</span>
          </button>
        </div>

        {/* ERROR / DIAGNOSTIC BANNER */}
        {error && (
          <div className="mb-6 rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-500/30 text-amber-200 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-300">Supabase Connection Notice</div>
                  <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">{error}</p>
                  <div className="mt-2 text-[11px] text-amber-300/80 bg-amber-950/40 p-2 rounded-lg font-mono">
                    💡 Tip: If your Supabase instance is paused or requires RLS setup, check your Supabase Dashboard or <code>.env</code> file.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setIsLocalStorageMode(false)
                    setError(null)
                    loadExpenses()
                  }}
                  className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/30 transition flex items-center gap-1"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry Supabase
                </button>
                <button
                  onClick={() => setError(null)}
                  className="rounded-lg bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'EXPENSES' ? (
          <>
            {/* EXECUTIVE DASHBOARD STATS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Card 1: Total Spent */}
              <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                  <Wallet className="h-16 w-16 text-indigo-400" />
                </div>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                  Spent This Month
                </div>
                <div className="text-3xl font-extrabold text-white tracking-tight tabular-nums font-heading">
                  {money(total)}
                </div>
                <div className="mt-3 flex items-center text-xs text-slate-400 gap-1.5">
                  <span className="inline-flex items-center rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
                    {expenses.length} {expenses.length === 1 ? 'transaction' : 'transactions'}
                  </span>
                </div>
              </div>

              {/* Card 2: Daily Average */}
              <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                  <Clock className="h-16 w-16 text-blue-400" />
                </div>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                  Daily Average
                </div>
                <div className="text-3xl font-extrabold text-white tracking-tight tabular-nums font-heading">
                  {money(dailyAverage)}
                </div>
                <div className="mt-3 flex items-center text-xs text-slate-400">
                  Across {daysInMonth} days in {formatMonthLabel(month).split(' ')[0]}
                </div>
              </div>

              {/* Card 3: Top Category */}
              <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                  <PieChart className="h-16 w-16 text-emerald-400" />
                </div>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                  Top Category
                </div>
                <div className="text-xl font-bold text-white tracking-tight truncate mt-1">
                  {topCategory ? topCategory.name : 'None'}
                </div>
                <div className="mt-3 flex items-center text-xs text-slate-400">
                  {topCategory ? (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: topCategory.color }}
                      />
                      <span className="font-semibold text-slate-300">{money(topCategory.total)}</span>
                      <span>({Math.round((topCategory.total / (total || 1)) * 100)}%)</span>
                    </div>
                  ) : (
                    'No expenses recorded'
                  )}
                </div>
              </div>

              {/* Card 4: Highest Single Expense */}
              <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                  <ArrowUpRight className="h-16 w-16 text-amber-400" />
                </div>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                  Largest Expense
                </div>
                <div className="text-3xl font-extrabold text-white tracking-tight tabular-nums font-heading">
                  {money(largestExpense)}
                </div>
                <div className="mt-3 flex items-center text-xs text-slate-400">
                  Single maximum spend
                </div>
              </div>
            </div>

            {/* MAIN LAYOUT: CATEGORY ALLOCATION & ADD EXPENSE FORM */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
              {/* CATEGORY SPENDING BREAKDOWN (Lg 5 columns) */}
              <div className="lg:col-span-5 glass-card rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-indigo-400" />
                      <h2 className="text-lg font-bold text-white tracking-tight">Category Breakdown</h2>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      {byCategory.length} {byCategory.length === 1 ? 'Category' : 'Categories'}
                    </span>
                  </div>

                  {byCategory.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-sm">
                      No category data recorded for this period.
                    </div>
                  ) : (
                    <div className="space-y-4 my-2">
                      {byCategory.map((c) => {
                        const percentage = Math.round((c.total / (total || 1)) * 100)
                        return (
                          <div key={c.name} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="h-3 w-3 rounded-full shrink-0 shadow-sm"
                                  style={{ backgroundColor: c.color }}
                                />
                                <span className="font-medium text-slate-200 truncate">{c.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-slate-400 font-mono">{percentage}%</span>
                                <span className="font-semibold text-slate-100 tabular-nums">
                                  {money(c.total)}
                                </span>
                              </div>
                            </div>
                            {/* Progress Bar */}
                            <div className="h-2 w-full bg-slate-800/80 rounded-full overflow-hidden p-0.5 ring-1 ring-white/5">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.max(percentage, 3)}%`,
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
                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span>Distribution for {formatMonthLabel(month)}</span>
                    <span className="font-semibold text-indigo-400">100% Allocated</span>
                  </div>
                )}
              </div>

              {/* ADD EXPENSE FORM CARD (Lg 7 columns) */}
              <div className="lg:col-span-7 glass-card rounded-2xl p-6 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                  <PlusCircle className="h-5 w-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white tracking-tight">Record Expense</h2>
                </div>

                <form onSubmit={addExpense} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Date Input */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Date
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={form.spent_on}
                          onChange={(e) => setForm({ ...form, spent_on: e.target.value })}
                          className="glass-input w-full rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition"
                          required
                        />
                      </div>
                      {/* Quick Helper Shortcuts */}
                      <div className="flex gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, spent_on: todayStr() })}
                          className="text-[11px] text-slate-400 hover:text-indigo-400 transition"
                        >
                          Today
                        </button>
                        <span className="text-slate-600 text-[11px]">·</span>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date()
                            d.setDate(d.getDate() - 1)
                            setForm({ ...form, spent_on: d.toISOString().slice(0, 10) })
                          }}
                          className="text-[11px] text-slate-400 hover:text-indigo-400 transition"
                        >
                          Yesterday
                        </button>
                      </div>
                    </div>

                    {/* Amount Input */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Amount (Rs)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-semibold text-xs">
                          Rs.
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          value={form.amount}
                          onChange={(e) => setForm({ ...form, amount: e.target.value })}
                          className="glass-input w-full rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 transition tabular-nums"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Category Dropdown */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Category
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Tag className="h-4 w-4" />
                      </div>
                      <select
                        value={form.category_id}
                        onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                        className="glass-input w-full rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition appearance-none bg-slate-900"
                      >
                        <option value="" className="bg-slate-900 text-slate-300">
                          No Category (Uncategorised)
                        </option>
                        {activeCategories.map((c) => (
                          <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Note Input */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Note / Description (Optional)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FileText className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Grocery shopping, Starbucks coffee..."
                        value={form.note}
                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                        className="glass-input w-full rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold py-3 px-4 text-sm shadow-lg shadow-indigo-600/30 transition hover:shadow-indigo-600/50 active:scale-[0.99] disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Saving Expense...</span>
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

            {/* EXPENSES LOG TABLE & CONTROLS */}
            <div className="glass-card rounded-2xl overflow-hidden">
              {/* Table Header Controls */}
              <div className="p-6 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Recent Transactions</h2>
                  <p className="text-xs text-slate-400">
                    Showing {filteredExpenses.length} of {expenses.length} records for {formatMonthLabel(month)}
                  </p>
                </div>

                {/* Search & Filter Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search Bar */}
                  <div className="relative min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="glass-input w-full rounded-xl pl-9 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                    <button
                      onClick={() => setSelectedCategoryFilter('ALL')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        selectedCategoryFilter === 'ALL'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-900/80 text-slate-400 hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    {activeCategories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCategoryFilter(c.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
                          selectedCategoryFilter === c.id
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-900/80 text-slate-400 hover:text-white'
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

              {/* List Content */}
              {loading ? (
                <div className="py-16 text-center text-slate-400">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-400 mb-3" />
                  <p className="text-sm font-medium">Fetching transaction history...</p>
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="py-16 text-center text-slate-500 px-4">
                  <FileText className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                  <h3 className="text-base font-semibold text-slate-300 mb-1">No transactions found</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {searchQuery || selectedCategoryFilter !== 'ALL'
                      ? 'Try clearing your search query or category filters.'
                      : 'Nothing recorded this month. Use the form above to add your first expense.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-800/60">
                  {filteredExpenses.map((e) => (
                    <li
                      key={e.id}
                      className="group flex items-center justify-between gap-4 p-4 hover:bg-slate-900/50 transition"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ring-1 ring-white/10"
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
                          <div className="font-semibold text-sm text-slate-100 truncate">
                            {e.note || e.categories?.name || 'Expense'}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <span className="font-medium text-slate-400">
                              {formatDateDisplay(e.spent_on)}
                            </span>
                            {e.categories?.name && (
                              <>
                                <span>·</span>
                                <span
                                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                                  style={{
                                    backgroundColor: `${e.categories.color}15`,
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

                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-base font-bold text-white tabular-nums tracking-tight font-mono">
                          {money(e.amount)}
                        </span>

                        <button
                          onClick={() => deleteExpense(e.id)}
                          disabled={deletingId === e.id}
                          className="rounded-lg p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition opacity-70 group-hover:opacity-100 focus:opacity-100"
                          title="Delete expense"
                        >
                          {deletingId === e.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin text-rose-400" />
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