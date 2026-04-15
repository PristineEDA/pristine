import { type CSSProperties } from 'react';
import {
  ATTRIBUTIONS_DOCUMENT_DESCRIPTION,
  openSourceAttributionSections,
} from '../../../about/attributions';
import { APP_DISPLAY_NAME } from '../../../menu/applicationMenu';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { ScrollArea } from '../../ui/scroll-area';

type AboutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dialogStyle?: CSSProperties;
};

export function AboutDialog({ open, onOpenChange, dialogStyle }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="about-dialog"
        className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-3xl"
        style={dialogStyle}
      >
        <DialogHeader>
          <DialogTitle>{`About ${APP_DISPLAY_NAME}`}</DialogTitle>
          <DialogDescription>{ATTRIBUTIONS_DOCUMENT_DESCRIPTION}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0">
          <div className="space-y-2.5 pr-4">
            {openSourceAttributionSections.map((section) => (
              <section
                key={section.id}
                data-testid={`about-section-${section.id}`}
                className="rounded-md border border-border/85 bg-muted/55 px-3 py-2.5"
              >
                <h3 className="text-[13px] font-medium">{section.title}</h3>
                <div className="mt-2 space-y-1.5 text-[12px] leading-5 text-foreground">
                  {section.items.map((item) => (
                    <p key={item.id} data-testid={`about-item-${section.id}-${item.id}`} className="break-words">
                      {item.name}
                      {'（'}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-4 hover:underline"
                      >
                        {item.url}
                      </a>
                      {'）'}
                      {' '}
                      {item.author}
                      {' '}
                      {item.license}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="outline" data-testid="about-close-button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}