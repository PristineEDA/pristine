import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { AIMessage } from '../../../data/mockData';
import { Button } from '../ui/button';

interface MessageThreadProps {
  messages: AIMessage[];
  isTyping: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
}

function MessageBubble({ message }: { message: AIMessage }) {
  const isUser = message.role === 'user';
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isWrappedUserMessage, setIsWrappedUserMessage] = useState(false);

  useLayoutEffect(() => {
    if (!isUser) {
      return;
    }

    const contentElement = contentRef.current;
    if (!contentElement) {
      return;
    }

    const measureMessageWrap = () => {
      const { height } = contentElement.getBoundingClientRect();
      const lineHeight = Number.parseFloat(window.getComputedStyle(contentElement).lineHeight);
      const normalizedLineHeight = Number.isFinite(lineHeight) ? lineHeight : 16;
      const nextWrappedState = height > normalizedLineHeight * 1.5;

      setIsWrappedUserMessage((currentState) => (
        currentState === nextWrappedState ? currentState : nextWrappedState
      ));
    };

    measureMessageWrap();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      measureMessageWrap();
    });

    resizeObserver.observe(contentElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, [isUser, message.content]);

  return (
    <div className={`flex gap-2 ${isUser && !isWrappedUserMessage ? 'justify-end' : ''}`}>
      <div className={`flex w-full max-w-full flex-col gap-1 ${isUser && !isWrappedUserMessage ? 'items-end' : 'items-start'}`}>
        <div
          className={`${isUser
            ? isWrappedUserMessage
              ? 'w-full text-left'
              : 'ml-auto w-fit max-w-full text-right'
            : 'w-full'} rounded-lg px-2.5 py-2 shadow-xs ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'border border-border bg-card text-card-foreground'
          }`}
        >
          <div ref={contentRef} className="whitespace-pre-wrap text-xs leading-relaxed">
            {message.content.split('\n').map((line, lineIndex) => {
              const parts = line.split(/\*\*(.*?)\*\*/g);
              return (
                <div key={lineIndex}>
                  {parts.map((part, partIndex) => (
                    partIndex % 2 === 1 ? (
                      <strong key={partIndex} className={isUser ? 'font-semibold text-primary-foreground' : 'font-semibold text-foreground'}>
                        {part}
                      </strong>
                    ) : part.includes('`') ? (
                      part.split(/`([^`]+)`/g).map((inlinePart, inlineIndex) => (
                        inlineIndex % 2 === 1 ? (
                          <code
                            key={`${partIndex}-${inlineIndex}`}
                            className="rounded bg-muted px-1 text-[11px] text-foreground"
                          >
                            {inlinePart}
                          </code>
                        ) : (
                          <span key={`${partIndex}-${inlineIndex}`}>{inlinePart}</span>
                        )
                      ))
                    ) : (
                      <span key={partIndex}>{part}</span>
                    )
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {message.codeBlock && (
          <div className="w-full overflow-hidden rounded-md border border-border bg-card shadow-xs">
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-2 py-1">
              <span className="text-[10px] text-muted-foreground">verilog</span>
              <Button variant="ghost" size="xs" className="h-5 px-1.5 text-[10px] text-muted-foreground">
                Copy
              </Button>
            </div>
            <pre className="overflow-x-auto px-3 py-2 font-mono text-[11px] text-foreground">
              <code>{message.codeBlock}</code>
            </pre>
          </div>
        )}

        <span className="text-[10px] text-muted-foreground/70">{message.timestamp}</span>
      </div>
    </div>
  );
}

export function MessageThread({ messages, isTyping, bottomRef }: MessageThreadProps) {
  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-2 py-2">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isTyping && (
        <div className="flex gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 shadow-xs">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                style={{ animationDelay: `${index * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}