import { Bot, User } from 'lucide-react';
import type { RefObject } from 'react';
import type { AIMessage } from '../../../data/mockData';
import { Button } from '../ui/button';

interface MessageThreadProps {
  messages: AIMessage[];
  isTyping: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
}

function AssistantAvatar({ role }: { role: AIMessage['role'] }) {
  const Icon = role === 'assistant' ? Bot : User;

  return (
    <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
      <Icon className="size-3.5" />
    </div>
  );
}

export function MessageThread({ messages, isTyping, bottomRef }: MessageThreadProps) {
  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-2 py-2">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';

        return (
          <div
            key={msg.id}
            className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
          >
            <AssistantAvatar role={msg.role} />

            <div className={`flex max-w-[85%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`rounded-lg px-2.5 py-2 shadow-xs ${
                  isUser
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-card text-card-foreground'
                }`}
              >
                <div className="whitespace-pre-wrap text-xs leading-relaxed">
                  {msg.content.split('\n').map((line, lineIndex) => {
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

              {msg.codeBlock && (
                <div className="w-full overflow-hidden rounded-md border border-border bg-card shadow-xs">
                  <div className="flex items-center justify-between border-b border-border bg-muted/50 px-2 py-1">
                    <span className="text-[10px] text-muted-foreground">verilog</span>
                    <Button variant="ghost" size="xs" className="h-5 px-1.5 text-[10px] text-muted-foreground">
                      Copy
                    </Button>
                  </div>
                  <pre className="overflow-x-auto px-3 py-2 font-mono text-[11px] text-foreground">
                    <code>{msg.codeBlock}</code>
                  </pre>
                </div>
              )}

              <span className="text-[10px] text-muted-foreground/70">{msg.timestamp}</span>
            </div>
          </div>
        );
      })}

      {isTyping && (
        <div className="flex gap-2">
          <AssistantAvatar role="assistant" />
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