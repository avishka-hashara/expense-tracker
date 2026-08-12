import { useState } from 'react'
import { Tag, PlusCircle, Trash2, RefreshCw, Palette, Layers, AlertCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from './supabase'

const PRESET_COLORS = [
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#64748b', // Slate
]

const money = (n) =>
  `Rs. ${Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

export default function CategoryManager({
  categories,
  expenses,
  onCategoriesUpdated,
  isLocalStorageMode,
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Compute category stats
  const categoryStats = categories.map((cat) => {
    const catExpenses = expenses.filter((e) => e.category_id === cat.id || e.categories?.name === cat.name)
    const totalSpent = catExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    return {
      ...cat,
      count: catExpenses.length,
      totalSpent,
    }
  })

  async function handleCreateCategory(e) {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    setError(null)
    setSuccessMsg(null)

    const newCat = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      color: color,
    }

    if (isLocalStorageMode) {
      saveLocalCategory(newCat)
    } else {
      try {
        const { error } = await supabase.from('categories').insert({
          name: newCat.name,
          color: newCat.color,
        })

        if (error) {
          console.warn('Supabase category insert failed, fallback to LocalStorage:', error.message)
          saveLocalCategory(newCat)
        }
      } catch (err) {
        saveLocalCategory(newCat)
      }
    }

    setSubmitting(false)
    setName('')
    setSuccessMsg(`Category "${newCat.name}" created successfully!`)
    onCategoriesUpdated()
  }

  function saveLocalCategory(newCat) {
    try {
      const raw = localStorage.getItem('spendwise_local_categories')
      const existing = raw ? JSON.parse(raw) : categories
      const updated = [...existing, newCat]
      localStorage.setItem('spendwise_local_categories', JSON.stringify(updated))
    } catch (err) {
      console.error('Failed to save category locally:', err)
    }
  }

  async function handleDeleteCategory(catId, catName) {
    setDeletingId(catId)
    setError(null)
    setSuccessMsg(null)

    if (isLocalStorageMode) {
      deleteLocalCategory(catId)
    } else {
      try {
        const { error } = await supabase.from('categories').delete().eq('id', catId)
        if (error) {
          console.warn('Supabase delete category failed, fallback to local delete:', error.message)
          deleteLocalCategory(catId)
        }
      } catch (err) {
        deleteLocalCategory(catId)
      }
    }

    setDeletingId(null)
    setSuccessMsg(`Category "${catName}" removed. Associated expenses moved to Uncategorised.`)
    onCategoriesUpdated()
  }

  function deleteLocalCategory(catId) {
    try {
      const raw = localStorage.getItem('spendwise_local_categories')
      const existing = raw ? JSON.parse(raw) : categories
      const updated = existing.filter((c) => c.id !== catId)
      localStorage.setItem('spendwise_local_categories', JSON.stringify(updated))
    } catch (err) {
      console.error('Failed to delete category locally:', err)
    }
  }

  return (
    <div className="space-y-8">
      {/* NOTIFICATIONS */}
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-rose-500/10 p-4 ring-1 ring-rose-500/30 text-rose-300 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs text-rose-300 underline">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 p-4 ring-1 ring-emerald-500/30 text-emerald-300 text-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-xs text-emerald-300 underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* CREATE CATEGORY FORM (5 cols) */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <PlusCircle className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Create Category</h2>
          </div>

          <form onSubmit={handleCreateCategory} className="space-y-5">
            {/* Category Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Category Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Tag className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="e.g. Travel, Gym, Subscriptions..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input w-full rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition"
                  required
                />
              </div>
            </div>

            {/* Color Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Color Palette
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full transition-transform transform hover:scale-110 flex items-center justify-center ${
                      color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950 scale-110 shadow-lg' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              {/* Custom Color Hex Input */}
              <div className="flex items-center gap-2 mt-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Palette className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="glass-input w-full rounded-xl pl-9 pr-3 py-1.5 text-xs font-mono"
                    placeholder="#6366f1"
                  />
                </div>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-10 bg-transparent cursor-pointer rounded overflow-hidden border border-slate-700"
                />
              </div>
            </div>

            {/* Preview Pill */}
            <div className="pt-2">
              <span className="text-xs text-slate-400 block mb-1.5">Preview Badge</span>
              <div className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium bg-slate-900 ring-1 ring-white/10">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-slate-200">{name.trim() || 'New Category'}</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold py-3 px-4 text-sm shadow-lg shadow-indigo-600/30 transition hover:shadow-indigo-600/50 active:scale-[0.99] disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Adding Category...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="h-4 w-4" />
                  <span>Add Category</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* MANAGED CATEGORIES GRID (7 cols) */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Existing Categories</h2>
            </div>
            <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full ring-1 ring-indigo-500/20">
              {categories.length} Total
            </span>
          </div>

          {categories.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Tag className="h-10 w-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm">No categories found. Create your first category using the form.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categoryStats.map((cat) => (
                <div
                  key={cat.id}
                  className="rounded-xl bg-slate-900/60 p-4 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-3.5 w-3.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: cat.color }}
                        />
                        <h3 className="font-bold text-sm text-slate-100 truncate">{cat.name}</h3>
                      </div>

                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        disabled={deletingId === cat.id}
                        className="rounded-lg p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition opacity-60 group-hover:opacity-100"
                        title="Delete Category"
                      >
                        {deletingId === cat.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-rose-400" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="text-xs text-slate-400">
                      {cat.count} {cat.count === 1 ? 'transaction' : 'transactions'}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">Total Spent</span>
                    <span className="text-sm font-bold text-slate-200 tabular-nums">{money(cat.totalSpent)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
