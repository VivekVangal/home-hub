import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GroceryAddForm from '../../components/GroceryAddForm.jsx'

describe('GroceryAddForm', () => {
  test('submits name, quantity, and category, then clears name/quantity', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<GroceryAddForm onAdd={onAdd} />)

    await user.type(screen.getByPlaceholderText('Add an item…'), 'Bananas')
    await user.type(screen.getByPlaceholderText('Qty'), '6')
    await user.selectOptions(screen.getByDisplayValue('Other'), 'Produce')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).toHaveBeenCalledWith({ name: 'Bananas', quantity: '6', category: 'Produce' })
    expect(screen.getByPlaceholderText('Add an item…')).toHaveValue('')
    expect(screen.getByPlaceholderText('Qty')).toHaveValue('')
  })

  test('does not submit when the name is blank', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<GroceryAddForm onAdd={onAdd} />)

    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).not.toHaveBeenCalled()
  })

  test('trims whitespace from the item name', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<GroceryAddForm onAdd={onAdd} />)

    await user.type(screen.getByPlaceholderText('Add an item…'), '  Milk  ')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Milk' }))
  })
})
