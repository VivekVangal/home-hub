import { useState } from 'react'
import { GROCERY_CATEGORIES } from '../db.js'

export default function GroceryAddForm({ onAdd }) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [category, setCategory] = useState('Other')

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), quantity: quantity.trim(), category })
    setName('')
    setQuantity('')
  }

  return (
    <form onSubmit={submit} className="grocery-add-form">
      <input
        placeholder="Add an item…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ flex: 2 }}
      />
      <input
        placeholder="Qty"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        style={{ flex: 1 }}
      />
      <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ flex: 1 }}>
        {GROCERY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button type="submit" className="btn btn-primary">Add</button>
    </form>
  )
}
