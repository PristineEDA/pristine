import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIAssistantPanel } from './AIAssistantPanel';

describe('AIAssistantPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const openDropdown = (name: RegExp) => {
    fireEvent.pointerDown(screen.getByRole('button', { name }), { button: 0, ctrlKey: false });
  };

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('fills the prompt from quick actions and sends a new message with a simulated response', () => {
    render(<AIAssistantPanel />);

    expect(screen.queryByText(/Hello! I'm your RTL development assistant/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Explain/i }));

    const textarea = screen.getByPlaceholderText(/describe your plans or tasks/i);
    expect(textarea).toHaveValue('Explain');

    fireEvent.click(screen.getByRole('button', { name: /Send \(Enter\)/i }));
    expect(textarea).toHaveValue('');

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByText(/I understand your question/i)).toBeInTheDocument();
  });

  it('switches agent and model selections through their dropdowns', () => {
    render(<AIAssistantPanel />);

    openDropdown(/Agent/i);
    expect(screen.getByText('Mode').closest('[data-slot="dropdown-menu-content"]')).toHaveClass('w-48');
    expect(screen.getByRole('menuitemradio', { name: /Plan/i })).toHaveClass('gap-2');
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Plan/i }));
    expect(screen.getByRole('button', { name: /Plan/i })).toBeInTheDocument();

    openDropdown(/Claude Opus 4\.6/i);
    expect(screen.getByText('Model').closest('[data-slot="dropdown-menu-content"]')).toHaveClass('w-48');
    expect(screen.getByRole('menuitemradio', { name: /GPT-5\.4/i })).toHaveClass('gap-2');
    fireEvent.click(screen.getByRole('menuitemradio', { name: /GPT-5\.4/i }));
    expect(screen.getByRole('button', { name: /GPT-5\.4/i })).toBeInTheDocument();
  });

  it('opens and closes the attachment menu', () => {
    render(<AIAssistantPanel />);

    openDropdown(/Add attachment/i);
    expect(screen.getByRole('menuitem', { name: /Add Image/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: /Add Image/i }));
    expect(screen.queryByRole('menuitem', { name: /Add Image/i })).not.toBeInTheDocument();
  });

  it('closes sibling dropdowns when another assistant menu opens', () => {
    render(<AIAssistantPanel />);

    openDropdown(/Add attachment/i);
    expect(screen.getByRole('menuitem', { name: /Add Image/i })).toBeInTheDocument();

    openDropdown(/Agent/i);

    expect(screen.queryByRole('menuitem', { name: /Add Image/i })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Plan/i })).toBeInTheDocument();
  });

  it('renders the shadcn primitives used by the assistant input', () => {
    const { container } = render(<AIAssistantPanel />);

    expect(screen.getByPlaceholderText(/describe your plans or tasks/i)).toHaveAttribute('data-slot', 'textarea');
    expect(screen.getByPlaceholderText(/describe your plans or tasks/i)).toHaveAttribute('spellcheck', 'false');
    expect(screen.getByLabelText('Token usage')).toHaveAttribute('data-slot', 'progress');
    expect(screen.getByRole('button', { name: /Add attachment/i })).toHaveClass('cursor-pointer');
    expect(screen.getByRole('button', { name: /Agent/i })).toHaveClass('cursor-pointer', 'text-muted-foreground');
    expect(screen.getByRole('button', { name: /Claude Opus 4\.6/i })).toHaveClass('cursor-pointer', 'text-muted-foreground');
    expect(screen.getByRole('button', { name: /Send \(Enter\)/i })).toHaveClass('cursor-pointer');
    expect(screen.getByRole('button', { name: /Explain/i })).toHaveAttribute('data-slot', 'button');
    expect(screen.getByRole('button', { name: /Explain/i })).toHaveClass('cursor-pointer', 'hover:brightness-88');
    expect(screen.getByRole('button', { name: /Optimize/i })).toHaveClass('cursor-pointer', 'hover:brightness-88');
    expect(screen.getByRole('button', { name: /Test/i })).toHaveClass('cursor-pointer', 'hover:brightness-88');
    expect(screen.getByRole('button', { name: /Fix/i })).toHaveClass('cursor-pointer', 'hover:brightness-88');
    expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(1);
    expect(screen.queryByText(/Enter to send/i)).not.toBeInTheDocument();
  });
});