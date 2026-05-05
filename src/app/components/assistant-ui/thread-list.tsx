import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
  AuiIf,
  ThreadListItemMorePrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useAuiState,
  useThreadListItemRuntime,
} from "@assistant-ui/react";
import {
  ArchiveIcon,
  MoreHorizontalIcon,
  Pencil,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type FC } from "react";

export const ThreadList: FC = () => {
  return (
    <ThreadListPrimitive.Root className="aui-root aui-thread-list-root flex flex-col gap-1">
      <ThreadListNew />
      <AuiIf condition={(s) => s.threads.isLoading}>
        <ThreadListSkeleton />
      </AuiIf>
      <AuiIf condition={(s) => !s.threads.isLoading}>
        <ThreadListPrimitive.Items>
          {() => <ThreadListItem />}
        </ThreadListPrimitive.Items>
      </AuiIf>
    </ThreadListPrimitive.Root>
  );
};

const ThreadListNew: FC = () => {
  return (
    <ThreadListPrimitive.New asChild>
      <Button
        variant="outline"
        className="aui-thread-list-new h-9 justify-start gap-2 rounded-lg px-3 text-[12px] leading-relaxed hover:bg-muted data-active:bg-muted"
      >
        <PlusIcon className="size-4" />
        New Chat
      </Button>
    </ThreadListPrimitive.New>
  );
};

const ThreadListSkeleton: FC = () => {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          role="status"
          aria-label="Loading threads"
          className="aui-thread-list-skeleton-wrapper flex h-9 items-center px-3"
        >
          <Skeleton className="aui-thread-list-skeleton h-4 w-full" />
        </div>
      ))}
    </div>
  );
};

const ThreadListItem: FC = () => {
  const threadTitle = useAuiState((state) => state.threadListItem.title ?? '');
  const threadId = useAuiState((state) => state.threadListItem.id);
  const threadListItemRuntime = useThreadListItemRuntime();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suppressNextBlurRef = useRef(false);
  const [draftTitle, setDraftTitle] = useState(threadTitle);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    setDraftTitle(threadTitle);
    setIsEditing(false);
    setIsSubmitting(false);
    setRenameError(null);
    suppressNextBlurRef.current = false;
  }, [threadId, threadTitle]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const startEditing = () => {
    if (isSubmitting) {
      return;
    }

    setDraftTitle(threadTitle);
    setRenameError(null);
    setIsEditing(true);
  };

  const stopEditing = ({ suppressBlur = false }: { suppressBlur?: boolean } = {}) => {
    if (isSubmitting) {
      return;
    }

    suppressNextBlurRef.current = suppressBlur;
    setDraftTitle(threadTitle);
    setRenameError(null);
    setIsEditing(false);
  };

  const focusRenameInput = () => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const submitRename = async () => {
    if (isSubmitting) {
      return;
    }

    const nextTitle = draftTitle.replace(/\s+/gu, ' ').trim();
    const currentTitle = threadTitle.replace(/\s+/gu, ' ').trim();

    if (!nextTitle) {
      setRenameError('Chat title cannot be empty.');
      focusRenameInput();
      return;
    }

    if (nextTitle === currentTitle) {
      setRenameError(null);
      setIsEditing(false);
      return;
    }

    setIsSubmitting(true);
    setRenameError(null);

    try {
      await threadListItemRuntime.rename(nextTitle);
      setIsEditing(false);
    } catch (error: unknown) {
      setRenameError(error instanceof Error ? error.message : 'Unable to rename chat.');
      focusRenameInput();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <ThreadListItemPrimitive.Root className="aui-thread-list-item group flex h-9 items-center gap-2 rounded-lg text-[12px] leading-relaxed transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none data-active:bg-muted">
        {isEditing ? (
          <div className="flex min-w-0 flex-1 items-center px-2">
            <Input
              ref={inputRef}
              aria-invalid={renameError ? 'true' : 'false'}
              aria-label="Rename chat"
              className="h-7 text-[12px] leading-relaxed"
              data-testid="thread-list-rename-input"
              disabled={isSubmitting}
              spellCheck={false}
              value={draftTitle}
              onBlur={() => {
                if (suppressNextBlurRef.current) {
                  suppressNextBlurRef.current = false;
                  return;
                }

                if (!isEditing || isSubmitting) {
                  return;
                }

                void submitRename();
              }}
              onChange={(event) => {
                setDraftTitle(event.currentTarget.value);
                setRenameError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void submitRename();
                }

                if (event.key === 'Escape') {
                  event.preventDefault();
                  stopEditing({ suppressBlur: true });
                }
              }}
            />
          </div>
        ) : (
          <ThreadListItemPrimitive.Trigger className="aui-thread-list-item-trigger flex h-full min-w-0 flex-1 items-center px-3 text-start text-[12px] leading-relaxed">
            <span className="aui-thread-list-item-title min-w-0 flex-1 truncate">
              <ThreadListItemPrimitive.Title fallback="New Chat" />
            </span>
          </ThreadListItemPrimitive.Trigger>
        )}
        {isEditing ? null : <ThreadListItemMore onRenameStart={startEditing} />}
      </ThreadListItemPrimitive.Root>
      {renameError ? (
        <p className="px-3 text-[11px] text-destructive" role="alert">
          {renameError}
        </p>
      ) : null}
    </div>
  );
};

const ThreadListItemMore = ({ onRenameStart }: { onRenameStart: () => void }) => {
  return (
    <ThreadListItemMorePrimitive.Root>
      <ThreadListItemMorePrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="aui-thread-list-item-more me-2 size-7 p-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:bg-accent data-[state=open]:opacity-100 group-data-active:opacity-100"
        >
          <MoreHorizontalIcon className="size-4" />
          <span className="sr-only">More options</span>
        </Button>
      </ThreadListItemMorePrimitive.Trigger>
      <ThreadListItemMorePrimitive.Content
        side="bottom"
        align="start"
        className="aui-thread-list-item-more-content z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      >
        <ThreadListItemMorePrimitive.Item
          className="aui-thread-list-item-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] leading-relaxed outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          onSelect={onRenameStart}
        >
          <Pencil className="size-4" />
          Rename
        </ThreadListItemMorePrimitive.Item>
        <ThreadListItemPrimitive.Archive asChild>
          <ThreadListItemMorePrimitive.Item className="aui-thread-list-item-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] leading-relaxed outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
            <ArchiveIcon className="size-4" />
            Archive
          </ThreadListItemMorePrimitive.Item>
        </ThreadListItemPrimitive.Archive>
        <ThreadListItemPrimitive.Delete asChild>
          <ThreadListItemMorePrimitive.Item className="aui-thread-list-item-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] leading-relaxed text-destructive outline-none hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive">
            <TrashIcon className="size-4" />
            Delete
          </ThreadListItemMorePrimitive.Item>
        </ThreadListItemPrimitive.Delete>
      </ThreadListItemMorePrimitive.Content>
    </ThreadListItemMorePrimitive.Root>
  );
};
