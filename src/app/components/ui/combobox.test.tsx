import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Combobox } from './combobox'

const options = Array.from({ length: 20 }, (_, index) => ({
  value: `font-${index + 1}`,
  label: `Font ${index + 1}`,
  description: `Description ${index + 1}`,
}))

describe('Combobox', () => {
  const scrollByMock = vi.fn()
  const scrollIntoViewMock = vi.fn()

  beforeEach(() => {
    scrollByMock.mockReset()
    scrollIntoViewMock.mockReset()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      configurable: true,
      value: scrollByMock,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('scrolls the selected option into view when opened', async () => {
    const user = userEvent.setup()

    render(
      <Combobox
        value="font-15"
        onValueChange={vi.fn()}
        options={options}
        triggerTestId="font-combobox"
        getOptionTestId={(value) => `font-option-${value}`}
      />,
    )

    await user.click(screen.getByTestId('font-combobox'))

    expect(await screen.findByTestId('font-option-font-15')).toBeVisible()
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenLastCalledWith({ block: 'center' })
    })
  })

  it('supports mouse wheel scrolling inside the menu list', async () => {
    const user = userEvent.setup()

    render(
      <Combobox
        value="font-1"
        onValueChange={vi.fn()}
        options={options}
        triggerTestId="theme-combobox"
      />,
    )

    await user.click(screen.getByTestId('theme-combobox'))

    const list = await screen.findByTestId('theme-combobox-list')
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 200 })
    Object.defineProperty(list, 'scrollTop', {
      configurable: true,
      value: 0,
      writable: true,
    })

    fireEvent.wheel(list, { deltaY: 120 })

    expect(scrollByMock).toHaveBeenCalledWith({ top: 120 })
  })
})