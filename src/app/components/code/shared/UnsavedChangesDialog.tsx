import { useMemo } from 'react';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { useWorkspace } from '../../../context/WorkspaceContext';

function getFileBaseName(fileId: string): string {
  const normalized = fileId.replace(/\\/g, '/');
  const segments = normalized.split('/');
  return segments[segments.length - 1] ?? fileId;
}

export function UnsavedChangesDialog() {
  const {
    cancelUnsavedChanges,
    confirmUnsavedChangesSave,
    discardUnsavedChanges,
    saveErrors,
    savingFiles,
    unsavedChangesDialog,
  } = useWorkspace();

  const requestedFileIds = unsavedChangesDialog?.fileIds ?? [];
  const isSaving = requestedFileIds.some((fileId) => savingFiles[fileId]);
  const errorMessages = useMemo(
    () => requestedFileIds
      .map((fileId) => saveErrors[fileId])
      .filter((message): message is string => Boolean(message)),
    [requestedFileIds, saveErrors],
  );

  return (
    <Dialog
      open={Boolean(unsavedChangesDialog)}
      onOpenChange={(open) => {
        if (!open && !isSaving) {
          cancelUnsavedChanges();
        }
      }}
    >
      <DialogContent
        data-testid="unsaved-changes-dialog"
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (isSaving) {
            event.preventDefault();
            return;
          }

          cancelUnsavedChanges();
        }}
        onInteractOutside={(event) => {
          if (isSaving) {
            event.preventDefault();
            return;
          }

          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{unsavedChangesDialog?.title ?? 'Save changes?'}</DialogTitle>
          <DialogDescription>{unsavedChangesDialog?.description ?? ''}</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border/80 bg-muted/35 px-3 py-2.5">
          <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Unsaved Files
          </p>
          <ul className="space-y-1.5" data-testid="unsaved-changes-file-list">
            {requestedFileIds.map((fileId) => (
              <li key={fileId} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{getFileBaseName(fileId)}</span>
                <span className="truncate text-xs text-muted-foreground">{fileId}</span>
              </li>
            ))}
          </ul>
        </div>

        {errorMessages.length > 0 && (
          <div
            data-testid="unsaved-changes-save-error"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessages.join(' ')}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            data-testid="unsaved-changes-cancel"
            disabled={isSaving}
            onClick={cancelUnsavedChanges}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid="unsaved-changes-discard"
            disabled={isSaving}
            onClick={discardUnsavedChanges}
          >
            Don't Save
          </Button>
          <Button
            type="button"
            data-testid="unsaved-changes-save"
            disabled={isSaving}
            onClick={() => {
              void confirmUnsavedChangesSave();
            }}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}