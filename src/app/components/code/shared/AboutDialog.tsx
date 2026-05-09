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
  onRevealBundledNoticeFiles?: () => void;
  canRevealBundledNoticeFiles?: boolean;
  dialogStyle?: CSSProperties;
};

const aboutGridClassName = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-x-3 gap-y-1';
const aboutHeaderCellClassName = 'min-w-0 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground';
const aboutValueCellClassName = 'min-w-0 break-words';

export function AboutDialog({
  open,
  onOpenChange,
  onRevealBundledNoticeFiles,
  canRevealBundledNoticeFiles = false,
  dialogStyle,
}: AboutDialogProps) {
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
                <div className="mt-2 overflow-hidden rounded-md border border-border/70 bg-background/40 text-[12px] leading-5 text-foreground">
                  <div className={`${aboutGridClassName} border-b border-border/60 px-2.5 py-2`}>
                    <span className={aboutHeaderCellClassName}>Project</span>
                    <span className={aboutHeaderCellClassName}>Source</span>
                    <span className={aboutHeaderCellClassName}>Author</span>
                    <span className={aboutHeaderCellClassName}>License</span>
                  </div>
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      data-testid={`about-item-${section.id}-${item.id}`}
                      className={`${aboutGridClassName} border-t border-border/50 px-2.5 py-2 first:border-t-0`}
                    >
                      <span className={`${aboutValueCellClassName} font-medium text-foreground/95`}>{item.name}</span>
                      <span className={aboutValueCellClassName}>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all underline-offset-4 hover:underline"
                        >
                          {item.url}
                        </a>
                      </span>
                      <span className={aboutValueCellClassName}>{item.author}</span>
                      <span className={aboutValueCellClassName}>{item.license}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          {canRevealBundledNoticeFiles ? (
            <Button
              type="button"
              variant="outline"
              data-testid="about-open-notice-files-button"
              onClick={onRevealBundledNoticeFiles}
            >
              Open Notice Files
            </Button>
          ) : null}
          <Button type="button" variant="outline" data-testid="about-close-button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}