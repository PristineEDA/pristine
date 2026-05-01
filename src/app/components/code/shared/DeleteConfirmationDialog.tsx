import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { useWorkspaceDialogs } from '../../../context/WorkspaceContext';
import { getPathBaseName } from '../../../workspace/workspaceFiles';

export function DeleteConfirmationDialog() {
  const {
    cancelDeleteConfirmation,
    confirmDeleteConfirmation,
    deleteConfirmationDialog,
  } = useWorkspaceDialogs();

  if (!deleteConfirmationDialog) {
    return null;
  }

  const {
    description,
    entryType,
    errorMessage,
    isSubmitting,
    targetPath,
    title,
  } = deleteConfirmationDialog;
  const targetName = getPathBaseName(targetPath);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSubmitting) {
          cancelDeleteConfirmation();
        }
      }}
    >
      <DialogContent
        data-testid="delete-confirmation-dialog"
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (isSubmitting) {
            event.preventDefault();
            return;
          }

          cancelDeleteConfirmation();
        }}
        onInteractOutside={(event) => {
          if (isSubmitting) {
            event.preventDefault();
            return;
          }

          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div
          data-testid="delete-confirmation-target"
          className="rounded-md border border-border/80 bg-muted/35 px-3 py-3"
        >
          <p className="text-sm font-medium text-foreground">{targetName}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">{targetPath}</p>
        </div>

        {entryType === 'folder' && (
          <div
            data-testid="delete-confirmation-warning"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            This will recursively delete the folder and all of its contents.
          </div>
        )}

        {errorMessage && (
          <div
            data-testid="delete-confirmation-error"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            data-testid="delete-confirmation-cancel"
            disabled={isSubmitting}
            onClick={cancelDeleteConfirmation}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            data-testid="delete-confirmation-confirm"
            disabled={isSubmitting}
            onClick={() => {
              void confirmDeleteConfirmation();
            }}
          >
            {isSubmitting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
