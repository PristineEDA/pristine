import { useEffect, useRef, useState } from 'react';
import type { AIMessage } from '../../../data/mockData';
import { DEFAULT_SIMULATED_RESPONSE } from './config';

function createTimestamp() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shouldIncludeCodeBlock(input: string) {
  const normalizedInput = input.toLowerCase();
  return normalizedInput.includes('code') || normalizedInput.includes('generate');
}

export function useAIConversation() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const responseTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (responseTimerRef.current !== null) {
      window.clearTimeout(responseTimerRef.current);
    }
  }, []);

  const sendMessage = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return;
    }

    const userMessage: AIMessage = {
      id: `m${Date.now()}`,
      role: 'user',
      content: trimmedInput,
      timestamp: createTimestamp(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsTyping(true);

    responseTimerRef.current = window.setTimeout(() => {
      const assistantMessage: AIMessage = {
        id: `m${Date.now() + 1}`,
        role: 'assistant',
        content: DEFAULT_SIMULATED_RESPONSE,
        timestamp: createTimestamp(),
        codeBlock: shouldIncludeCodeBlock(trimmedInput)
          ? `// AI-generated code example\nalways @(posedge clk or negedge rst_n) begin\n    if (!rst_n)\n        q <= '0;\n    else\n        q <= d;\nend`
          : undefined,
      };

      setMessages((current) => [...current, assistantMessage]);
      setIsTyping(false);
      responseTimerRef.current = null;
    }, 1200);
  };

  const clearConversation = () => {
    if (responseTimerRef.current !== null) {
      window.clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }

    setMessages([]);
    setInput('');
    setIsTyping(false);
  };

  return {
    input,
    isTyping,
    messages,
    setInput,
    sendMessage,
    clearConversation,
  };
}