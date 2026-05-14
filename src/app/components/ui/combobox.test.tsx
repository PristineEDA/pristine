import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { calculateComboboxPreviewPlacement, Combobox } from './combobox'

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

  it('keeps the selected label inside a shrinkable truncated slot', () => {
    render(
      <Combobox
        value="font-20"
        onValueChange={vi.fn()}
        options={options}
        triggerTestId="long-label-combobox"
      />,
    )

    const trigger = screen.getByTestId('long-label-combobox')
    const label = screen.getByText('Font 20')

    expect(trigger).toHaveClass('w-full')
    expect(trigger).toHaveClass('min-w-0')
    expect(trigger).toHaveClass('max-w-full')
    expect(trigger).toHaveClass('overflow-hidden')
    expect(label).toHaveClass('flex-1')
    expect(label).toHaveClass('min-w-0')
    expect(label).toHaveClass('truncate')
    expect(label).toHaveClass('text-left')
  })

  it('renders an animated preview pane for hovered options when enabled', async () => {
    const user = userEvent.setup()

    render(
      <Combobox
        value="font-1"
        onValueChange={vi.fn()}
        options={options}
        triggerTestId="preview-combobox"
        previewPaneTestId="preview-combobox-pane"
        renderOptionPreview={(option) => (
          <div data-testid={`preview-content-${option.value}`}>{option.label}</div>
        )}
      />,
    )

    await user.click(screen.getByTestId('preview-combobox'))

    const popoverContent = await screen.findByTestId('preview-combobox-popover-content')
    const previewPane = screen.getByTestId('preview-combobox-pane')
    const hoveredOption = screen.getByText('Font 4')

    expect(previewPane.parentElement).toBe(document.body)
    expect(previewPane).toHaveAttribute('data-state', 'hidden')

    fireEvent.mouseEnter(hoveredOption)

    expect(previewPane).toHaveAttribute('data-state', 'visible')
    expect(previewPane).toHaveAttribute('data-side', 'right')
    expect(screen.getByTestId('preview-content-font-4')).toHaveTextContent('Font 4')

    fireEvent.mouseLeave(popoverContent)

    expect(previewPane).toHaveAttribute('data-state', 'hidden')
  })

  it('keeps the popover width aligned to the trigger when preview mode is enabled', async () => {
    const user = userEvent.setup()

    render(
      <Combobox
        value="font-1"
        onValueChange={vi.fn()}
        options={options}
        triggerTestId="width-preview-combobox"
        previewPaneTestId="width-preview-pane"
        renderOptionPreview={(option) => (
          <div data-testid={`width-preview-content-${option.value}`}>{option.label}</div>
        )}
      />,
    )

    await user.click(screen.getByTestId('width-preview-combobox'))

    expect(screen.getByTestId('width-preview-combobox-popover-surface')).toHaveClass('w-(--radix-popover-trigger-width)')
  })

  it('flips the preview card to the left when the hovered option has no right-side space', () => {
    const placement = calculateComboboxPreviewPlacement({
      optionRect: new DOMRect(900, 200, 120, 32),
      previewRect: { width: 288, height: 180 },
      viewportHeight: 900,
      viewportWidth: 1280,
    })

    expect(placement.side).toBe('left')
    expect(placement.left).toBeLessThan(900)
  })
})