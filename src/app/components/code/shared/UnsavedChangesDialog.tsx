import { useEffect, useMemo, useState } from 'react';
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
import { getPathBaseName } from '../../../workspace/workspaceFiles';

const EMPTY_FILE_IDS: string[] = [];

function areFileIdListsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((fileId, index) => fileId === right[index]);
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

  const requestedFileIds = unsavedChangesDialog?.fileIds ?? EMPTY_FILE_IDS;
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>(requestedFileIds);
  const isSaving = requestedFileIds.some((fileId) => savingFiles[fileId]);
  const isReviewMode = unsavedChangesDialog?.kind === 'review';
  const isSingleCloseFileMode = !isReviewMode && requestedFileIds.length === 1;
  const singleFileId = requestedFileIds[0] ?? '';
  const selectedRequestedFileIds = useMemo(
    () => requestedFileIds.filter((fileId) => selectedFileIds.includes(fileId)),
    [requestedFileIds, selectedFileIds],
  );
  const errorMessages = useMemo(
    () => requestedFileIds
      .map((fileId) => saveErrors[fileId])
      .filter((message): message is string => Boolean(message)),
    [requestedFileIds, saveErrors],
  );

  useEffect(() => {
    setSelectedFileIds((current) => (
      areFileIdListsEqual(current, requestedFileIds) ? current : requestedFileIds
    ));
  }, [requestedFileIds]);

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds((current) => (
      current.includes(fileId)
        ? current.filter((currentFileId) => currentFileId !== fileId)
        : [...current, fileId]
    ));
  };

  if (!unsavedChangesDialog) {
    return null;
  }

  return (
    <Dialog
      open
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
          <DialogTitle>{unsavedChangesDialog.title}</DialogTitle>
          <DialogDescription>{unsavedChangesDialog.description}</DialogDescription>
        </DialogHeader>

        {isSingleCloseFileMode ? (
          <div
            data-testid="unsaved-changes-single-file"
            className="rounded-md border border-border/80 bg-muted/35 px-3 py-3"
          >
            <p className="text-sm font-medium text-foreground">{getPathBaseName(singleFileId)}</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{singleFileId}</p>
          </div>
        ) : (
          <div className="rounded-md border border-border/80 bg-muted/35 px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Unsaved Files
              </p>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <button
                  type="button"
                  data-testid="unsaved-changes-select-all"
                  className="hover:text-foreground disabled:opacity-50"
                  disabled={isSaving || selectedFileIds.length === requestedFileIds.length}
                  onClick={() => setSelectedFileIds(requestedFileIds)}
                >
                  Select All
                </button>
                <button
                  type="button"
                  data-testid="unsaved-changes-clear-selection"
                  className="hover:text-foreground disabled:opacity-50"
                  disabled={isSaving || selectedFileIds.length === 0}
                  onClick={() => setSelectedFileIds([])}
                >
                  Clear
                </button>
              </div>
            </div>
            <p
              data-testid="unsaved-changes-selection-summary"
              className="mb-2 text-xs text-muted-foreground"
            >
              {selectedRequestedFileIds.length} selected • {requestedFileIds.length} total
            </p>
            <ul className="space-y-1.5" data-testid="unsaved-changes-file-list">
              {requestedFileIds.map((fileId) => (
                <li key={fileId}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-transparent px-2 py-1.5 text-sm transition-colors hover:border-border/80 hover:bg-background/35">
                    <input
                      type="checkbox"
                      checked={selectedFileIds.includes(fileId)}
                      disabled={isSaving}
                      aria-label={`${getPathBaseName(fileId)} ${fileId}`}
                      onChange={() => toggleFileSelection(fileId)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{getPathBaseName(fileId)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{fileId}</span>
                    </span>
                    <span
                      data-testid={`unsaved-changes-file-status-${getPathBaseName(fileId)}`}
                      className="rounded-full border border-border/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      {savingFiles[fileId] ? 'Saving' : saveErrors[fileId] ? 'Failed' : 'Unsaved'}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {errorMessages.length > 0 && (
          <div
            data-testid="unsaved-changes-save-error"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessages.join(' ')}
          </div>
        )}

        <DialogFooter>
          {!isSingleCloseFileMode && (
            <div className="mr-auto text-xs text-muted-foreground">
              {selectedRequestedFileIds.length === 0 ? 'Select at least one file to save.' : `${selectedRequestedFileIds.length} file${selectedRequestedFileIds.length === 1 ? '' : 's'} selected`}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            data-testid="unsaved-changes-cancel"
            disabled={isSaving}
            onClick={cancelUnsavedChanges}
          >
            {isReviewMode ? 'Close' : 'Cancel'}
          </Button>
          {!isReviewMode && (
            <Button
              type="button"
              variant="outline"
              data-testid="unsaved-changes-discard"
              disabled={isSaving || selectedRequestedFileIds.length === 0}
              onClick={() => discardUnsavedChanges(isSingleCloseFileMode ? requestedFileIds : selectedRequestedFileIds)}
            >
              {isSingleCloseFileMode
                ? "Don't save"
                : selectedRequestedFileIds.length === requestedFileIds.length
                  ? "Don't Save"
                  : `Don't Save Selected (${selectedRequestedFileIds.length})`}
            </Button>
          )}
          {!isSingleCloseFileMode && requestedFileIds.length > 1 && selectedRequestedFileIds.length !== requestedFileIds.length && (
            <Button
              type="button"
              variant="outline"
              data-testid="unsaved-changes-save-all"
              disabled={isSaving}
              onClick={() => {
                void confirmUnsavedChangesSave(requestedFileIds);
              }}
            >
              Save All
            </Button>
          )}
          <Button
            type="button"
            data-testid="unsaved-changes-save"
            disabled={isSaving || selectedRequestedFileIds.length === 0}
            onClick={() => {
              void confirmUnsavedChangesSave(isSingleCloseFileMode ? requestedFileIds : selectedRequestedFileIds);
            }}
          >
            {isSaving
              ? 'Saving...'
              : isSingleCloseFileMode
                ? 'Save'
                : selectedRequestedFileIds.length === requestedFileIds.length
                  ? 'Save All'
                  : `Save Selected (${selectedRequestedFileIds.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}