# Expense Tracker — 60 Minute Build

**Stack:** Vite + React + Supabase (Postgres) + Tailwind
**Scope:** single user, runs locally, no auth yet

| Time | Step |
|---|---|
| 0–8 | Supabase project |
| 8–14 | Database schema |
| 14–22 | Vite app + Tailwind |
| 22–26 | Connect to Supabase |
| 26–45 | The app itself |
| 45–55 | Test with real data |
| 55–60 | CSV export + what's next |

---

## 0–8 min · Supabase project

1. Go to **supabase.com**, sign up, click **New project**.
2. Name it `expenses`. Pick a strong database password (save it in your password manager — you rarely need it, but recovering it is annoying).
3. Choose the region closest to you — Singapore is available and will keep queries snappy.
4. Provisioning takes 1–2 minutes. While it runs, open the next step.

When it's ready, go to **Project Settings → API** and copy two values. You'll need them shortly:

- Project URL
- `anon` `public` key

---

## 8–14 min · Database schema

In the Supabase dashboard, open **SQL Editor → New query**, paste this, and hit Run.

```sql
create table categories (
  id    bigint generated always as identity primary key,
  name  text not null unique,
  color text not null default '#94a3b8'
);

create table expenses (
  id          bigint generated always as identity primary key,
  spent_on    date not null default current_date,
  amount      numeric(12,2) not null check (amount > 0),
  category_id bigint references categories(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);

create index expenses_spent_on_idx on expenses (spent_on desc);

insert into categories (name, color) values
  ('Food',      '#e07a5f'),
  ('Transport', '#3d7ea6'),
  ('Groceries', '#81b29a'),
  ('Bills',     '#8f7bb3'),
  ('Shopping',  '#d9a441'),
  ('Other',     '#94a3b8');
```

Two things worth understanding, because they'll bite you later otherwise:

**`numeric(12,2)`, not `float`.** Floating point can't represent 0.10 exactly, so sums drift by fractions of a cent. `numeric` stores exact decimal values. This is the one schema decision people regret most.

**`on delete set null`.** Delete a category and its expenses survive with no category, rather than being deleted with it.

Row Level Security is off, which is why this stays on your machine for now. See the last section.

---

## 14–22 min · Vite app + Tailwind

```bash
npm create vite@latest expense-tracker -- --template react
cd expense-tracker
npm install
npm install @supabase/supabase-js
npm install tailwindcss @tailwindcss/vite
```

Replace **`vite.config.js`**:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Replace the entire contents of **`src/index.css`** with one line:

```css
@import "tailwindcss";
```

Delete `src/App.css` and remove its import from `App.jsx` — the default Vite styles will fight you otherwise.

Check it runs:

```bash
npm run dev
```

---

## 22–26 min · Connect to Supabase

Create **`.env`** in the project root:

```
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Add `.env` to `.gitignore` before your first commit.

Create **`src/supabase.js`**:

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

**Restart the dev server.** Vite only reads `.env` at startup, and a stale server here produces a confusing "Invalid URL" error that sends people hunting in the wrong place.

---

## 26–45 min · The app

Replace **`src/App.jsx`** entirely:

```jsx
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const todayStr = () => new Date().toISOString().slice(0, 10)
const monthOf = (dateStr) => dateStr.slice(0, 7)

// "2026-08" -> "2026-09-01", handling the December rollover
function monthAfter(month) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const money = (n) =>
  Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function App() {
  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [month, setMonth] = useState(monthOf(todayStr()))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    spent_on: todayStr(),
    amount: '',
    category_id: '',
    note: '',
  })

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setCategories(data)
      })
  }, [])

  useEffect(() => {
    loadExpenses()
  }, [month])

  async function loadExpenses() {
    setLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('*, categories(name, color)')
      .gte('spent_on', `${month}-01`)
      .lt('spent_on', monthAfter(month))
      .order('spent_on', { ascending: false })
      .order('id', { ascending: false })

    if (error) setError(error.message)
    else setExpenses(data)
    setLoading(false)
  }

  async function addExpense(e) {
    e.preventDefault()
    if (!form.amount) return

    const { error } = await supabase.from('expenses').insert({
      spent_on: form.spent_on,
      amount: Number(form.amount),
      category_id: form.category_id || null,
      note: form.note.trim() || null,
    })

    if (error) return setError(error.message)

    setForm({ ...form, amount: '', note: '' })
    if (monthOf(form.spent_on) === month) loadExpenses()
  }

  async function deleteExpense(id) {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) return setError(error.message)
    setExpenses(expenses.filter((e) => e.id !== id))
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  const byCategory = Object.values(
    expenses.reduce((acc, e) => {
      const name = e.categories?.name ?? 'Uncategorised'
      acc[name] ??= { name, color: e.categories?.color ?? '#94a3b8', total: 0 }
      acc[name].total += Number(e.amount)
      return acc
    }, {})
  ).sort((a, b) => b.total - a.total)

  const field =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm ' +
    'focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-10">

        <header className="mb-8 flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Expenses</h1>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </header>

        {error && (
          <div className="mb-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
            <button onClick={() => setError(null)} className="ml-3 underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="mb-8 rounded-lg border border-slate-200 bg-white p-5">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Spent this month
          </div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">{money(total)}</div>

          {byCategory.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {byCategory.map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-slate-600">{c.name}</span>
                  <span className="flex-1 border-b border-dotted border-slate-200" />
                  <span className="tabular-nums text-slate-700">{money(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={addExpense}
          className="mb-8 space-y-3 rounded-lg border border-slate-200 bg-white p-5"
        >
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={form.spent_on}
              onChange={(e) => setForm({ ...form, spent_on: e.target.value })}
              className={field}
            />
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Amount"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className={field}
              required
            />
          </div>

          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className={field}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Note (optional)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className={field}
          />

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Add expense
          </button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white">
          {loading ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Loading…</p>
          ) : expenses.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              Nothing recorded this month. Add your first expense above.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {expenses.map((e) => (
                <li key={e.id} className="group flex items-center gap-3 px-5 py-3">
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: e.categories?.color ?? '#e2e8f0' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      {e.note || e.categories?.name || 'Expense'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {e.spent_on}
                      {e.note && e.categories?.name && ` · ${e.categories.name}`}
                    </div>
                  </div>
                  <span className="tabular-nums text-sm">{money(e.amount)}</span>
                  <button
                    onClick={() => deleteExpense(e.id)}
                    className="text-xs text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-red-600 focus:opacity-100"
                    aria-label="Delete expense"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  )
}
```

### What to notice

`.select('*, categories(name, color)')` is Supabase following the foreign key for you and nesting the category on each row. No join to write, no second query.

The month filter uses `>= month-01` and `< first of next month` rather than a `LIKE` on the date. It uses the index and it can't misbehave at month boundaries.

Deleting updates local state directly instead of refetching. Instant, and one fewer network round trip.

---

## 45–55 min · Test with real data

Enter ten or fifteen expenses you actually remember from the past week. Real data surfaces problems that fake data hides.

Watch for:

- Does the total match what you'd get on a calculator?
- Switch to last month — does it go empty and come back correctly?
- Add an expense dated in a different month. It should save without appearing in the current view.
- Reload. Everything should still be there. If not, check the Supabase **Table Editor** to see whether the rows arrived.

If nothing loads, open the browser console. Supabase returns readable error messages, and they're almost always either a typo in `.env` or a forgotten dev-server restart.

---

## 55–60 min · CSV export

Add this inside the component:

```jsx
function exportCsv() {
  const rows = [
    ['date', 'amount', 'category', 'note'],
    ...expenses.map((e) => [e.spent_on, e.amount, e.categories?.name ?? '', e.note ?? '']),
  ]
  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `expenses-${month}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

And a button in the header:

```jsx
<button onClick={exportCsv} className="text-sm text-slate-500 underline">
  Export CSV
</button>
```

Five minutes of work that means you're never locked in, and it opens in Excel or Sheets whenever you want to do something the app can't.

---

## Before you deploy this publicly

Right now anyone with your URL and anon key can read and write your expenses. The anon key ships in the browser bundle, so it is not a secret. Local use is fine. Public deployment is not, until you do this:

**1. Add auth** (about 20 minutes). Supabase Auth with email magic links, then gate the app behind a session check.

**2. Add a user column and turn on RLS:**

```sql
alter table expenses add column user_id uuid references auth.users(id) default auth.uid();
alter table expenses enable row level security;

create policy "own expenses" on expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Now the database itself enforces that you only ever see your own rows, regardless of what the client asks for.

Once that's done, `npm run build` and drop the project on Vercel or Netlify. Set the two environment variables in their dashboard — they won't come from your local `.env`.

## Good next additions

- Recurring expenses (rent, subscriptions) seeded on the 1st
- A monthly budget per category, with the summary turning red past the limit
- Recharts pie chart, if the plain category list stops being enough
- Edit-in-place, which you'll want the first time you fat-finger an amount
