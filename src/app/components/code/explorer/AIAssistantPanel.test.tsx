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

    fireEvent.click(screen.getByRole('button', { name: /Generate Testbench/i }));

    const textarea = screen.getByPlaceholderText(/Ask a question about your RTL code/i);
    expect(textarea).toHaveValue('Generate Testbench');

    fireEvent.click(screen.getByRole('button', { name: /Send \(Enter\)/i }));
    expect(textarea).toHaveValue('');

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByText(/I understand your question/i)).toBeInTheDocument();
    expect(screen.getByText(/AI-generated code example/i)).toBeInTheDocument();
  });

  it('switches agent and model selections through their dropdowns', () => {
    render(<AIAssistantPanel />);

    openDropdown(/Agent/i);
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Edit/i }));
    expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();

    openDropdown(/Claude Opus 4\.6/i);
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
    expect(screen.getByRole('menuitemradio', { name: /Edit/i })).toBeInTheDocument();
  });

  it('renders the shadcn primitives used by the assistant input', () => {
    const { container } = render(<AIAssistantPanel />);

    expect(screen.getByPlaceholderText(/Ask a question about your RTL code/i)).toHaveAttribute('data-slot', 'textarea');
    expect(screen.getByLabelText('Token usage')).toHaveAttribute('data-slot', 'progress');
    expect(screen.getByRole('button', { name: /Generate Testbench/i })).toHaveAttribute('data-slot', 'button');
    expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(2);
    expect(screen.queryByText(/Enter to send/i)).not.toBeInTheDocument();
  });
});