import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIAssistantPanel } from './AIAssistantPanel';

describe('AIAssistantPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('fills the prompt from quick actions and sends a new message with a simulated response', () => {
    render(<AIAssistantPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Generate Testbench/i }));

    const textarea = screen.getByPlaceholderText(/Ask a question about your RTL code/i);
    expect(textarea).toHaveValue('Generate Testbench');

    fireEvent.click(screen.getByTitle(/Send \(Enter\)/i));
    expect(textarea).toHaveValue('');

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByText(/I understand your question/i)).toBeInTheDocument();
    expect(screen.getByText(/AI-generated code example/i)).toBeInTheDocument();
  });

  it('switches agent and model selections through their dropdowns', () => {
    render(<AIAssistantPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Agent/i }));
    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    expect(screen.getByText((_, element) => element?.textContent === 'edit · Claude Opus 4.6')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Claude Opus 4\.6/i }));
    fireEvent.click(screen.getByRole('button', { name: /GPT-5\.4/i }));
    expect(screen.getByText((_, element) => element?.textContent === 'edit · GPT-5.4')).toBeInTheDocument();
  });

  it('opens and closes the attachment menu', () => {
    render(<AIAssistantPanel />);

    fireEvent.click(screen.getByTitle(/Add attachment/i));
    expect(screen.getByRole('button', { name: /Add Image/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Add Image/i }));
    expect(screen.queryByRole('button', { name: /Add Image/i })).not.toBeInTheDocument();
  });
});