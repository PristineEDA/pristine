import { type CSSProperties, useEffect } from 'react';
import {
  editorFontFamilyOptions,
  getEditorFontFamilyLabel,
  getEditorFontFamilyStack,
  type EditorFontFamilyId,
} from '../../../editor/editorSettings';
import { ensureEditorFontFamilyLoaded } from '../../../editor/fontLoader';
import { cn } from '../../../../lib/utils';
import { Button } from '../../ui/button';
import { Card, CardContent, CardFooter } from '../../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { ScrollArea } from '../../ui/scroll-area';

type EditorFontAdvancedDialogProps = {
  dialogStyle?: CSSProperties;
  onOpenChange: (open: boolean) => void;
  onSelectFontFamily: (fontFamily: EditorFontFamilyId) => void;
  open: boolean;
  selectedFontFamily: EditorFontFamilyId;
};

const fontPreviewLetters = 'AaBbCcDdEe';
const fontPreviewDigits = '0123456789';

function FontPreviewCard({
  fontFamily,
  isSelected,
  onSelect,
}: {
  fontFamily: EditorFontFamilyId;
  isSelected: boolean;
  onSelect: (fontFamily: EditorFontFamilyId) => void;
}) {
  const label = getEditorFontFamilyLabel(fontFamily);
  const stack = getEditorFontFamilyStack(fontFamily);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    onSelect(fontFamily);
  };

  return (
    <Card
      aria-label={`Select ${label}`}
      aria-pressed={isSelected}
      className={cn(
        'gap-0 overflow-hidden py-0 transition-[border-color,background-color,box-shadow] hover:cursor-pointer hover:border-accent-foreground/20 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isSelected && 'border-primary/60 shadow-sm',
      )}
      data-state={isSelected ? 'selected' : 'unselected'}
      data-testid={`settings-editor-font-family-preview-card-${fontFamily}`}
      onClick={() => onSelect(fontFamily)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <CardContent className="flex min-h-32 items-center justify-center px-3 py-6 sm:px-4">
        <div className="space-y-1.5 text-center text-foreground" style={{ fontFamily: stack }}>
          <p
            className="text-[1.35rem] leading-none font-medium tracking-[0.02em]"
            data-testid={`settings-editor-font-family-preview-letters-${fontFamily}`}
          >
            {fontPreviewLetters}
          </p>
          <p
            className="text-[0.95rem] leading-none tracking-[0.08em]"
            data-testid={`settings-editor-font-family-preview-digits-${fontFamily}`}
          >
            {fontPreviewDigits}
          </p>
        </div>
      </CardContent>
      <CardFooter className="justify-center border-t border-border/70 bg-muted/35 px-3 py-2.5 text-[13px] font-medium text-foreground">
        {label}
      </CardFooter>
    </Card>
  );
}

export function EditorFontAdvancedDialog({
  dialogStyle,
  onOpenChange,
  onSelectFontFamily,
  open,
  selectedFontFamily,
}: EditorFontAdvancedDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    for (const option of editorFontFamilyOptions) {
      void ensureEditorFontFamilyLoaded(option.value).catch(() => undefined);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="settings-editor-font-family-advanced-dialog"
        className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-6xl"
        style={dialogStyle}
      >
        <DialogHeader>
          <DialogTitle>Advanced font picker</DialogTitle>
          <DialogDescription>
            Preview the bundled editor fonts and pick the one that fits your coding layout.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0" data-testid="settings-editor-font-family-advanced-scroll-area">
          <div className="pr-4">
            <div data-testid="settings-editor-font-family-advanced-grid" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {editorFontFamilyOptions.map((option) => (
                <FontPreviewCard
                  key={option.value}
                  fontFamily={option.value}
                  isSelected={option.value === selectedFontFamily}
                  onSelect={onSelectFontFamily}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            data-testid="settings-editor-font-family-advanced-close-button"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}