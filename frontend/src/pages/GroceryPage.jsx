import { useState, useMemo } from 'react'
import { useLiveData } from '../hooks/useLiveData.js'
import {
  getGroceryItems, addGroceryItem, updateGroceryItem, deleteGroceryItem, clearCheckedGroceryItems,
} from '../db.js'
import { getWeekStart, addDaysISO, formatShortDate } from '../utils/dates.js'
import GroceryAddForm from '../components/GroceryAddForm.jsx'

export default function GroceryPage() {
  const [weekStart, setWeekStart] = useState(getWeekStart())
  const { data: items } = useLiveData(() => getGroceryItems(weekStart), [weekStart])

  const weekEnd = addDaysISO(weekStart, 6)
  const label = `Week of ${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`

  const grouped = useMemo(() => {
    const acc = {}
    for (const item of items || []) {
      acc[item.category] = acc[item.category] || []
      acc[item.category].push(item)
    }
    return acc
  }, [items])

  const checkedCount = (items || []).filter((i) => i.checked).length

  return (
    <div>
      <h1 className="page-title">Grocery Plan</h1>

      <div className="week-nav">
        <div className="week-nav-controls">
          <button className="btn" onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>← Prev</button>
          <div className="week-nav-label">{label}</div>
          <button className="btn" onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>Next →</button>
        </div>
        <button className="btn" onClick={() => setWeekStart(getWeekStart())}>This week</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <GroceryAddForm onAdd={(data) => addGroceryItem({ ...data, weekStart })} />
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            This week's list {items ? `(${checkedCount}/${items.length} picked up)` : ''}
          </div>
          {checkedCount > 0 && (
            <button className="btn" onClick={() => clearCheckedGroceryItems(weekStart)}>
              Clear picked up
            </button>
          )}
        </div>

        {!items ? (
          <div className="empty-state">Loading…</div>
        ) : items.length === 0 ? (
          <div className="empty-state">No items yet. Add what you need above — this list feeds your dashboard automatically.</div>
        ) : (
          Object.entries(grouped).map(([category, catItems]) => (
            <div key={category} style={{ marginTop: 14 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                {category}
              </div>
              {catItems.map((item) => (
                <div className="list-item" key={item.id}>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={item.checked}
                    onChange={(e) => updateGroceryItem(item.id, { checked: e.target.checked })}
                  />
                  <div className="list-item-main">
                    <div className={'list-item-title' + (item.checked ? ' strike' : '')}>
                      {item.name}{item.quantity ? ` — ${item.quantity}` : ''}
                    </div>
                  </div>
                  <button className="btn btn-icon" onClick={() => deleteGroceryItem(item.id)}>✕</button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
