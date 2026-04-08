import { useState } from "react"
import { ArrowUpRightIcon, FileTextIcon, FolderCodeIcon, ImageIcon, InfoIcon } from "lucide-react"
import { Button } from "./ui/button"
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty"
import emptyImageSrc from "../../assets/images/empty/tmp.png"
import { centerViewSwitchItemClassName } from "./viewSwitcherStyles"

type EmptyProjectTab = 'info' | 'image' | 'summary'

const emptyProjectTabClassName = `${centerViewSwitchItemClassName} w-8 h-8 rounded-md`

function InfoContent() {
  return (
    <div data-testid="empty-project-info-panel" className="contents">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderCodeIcon />
        </EmptyMedia>
        <EmptyTitle>No Projects Yet</EmptyTitle>
        <EmptyDescription>
          You haven&apos;t opened any projects yet.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button>Create Project</Button>
        <Button variant="outline">Open Project</Button>
      </EmptyContent>
      <Button
        variant="link"
        asChild
        className="text-muted-foreground"
        size="sm"
      >
        <a href="#">
          Learn More <ArrowUpRightIcon />
        </a>
      </Button>
    </div>
  )
}

function ImageContent() {
  return (
    <div className="absolute inset-0" data-testid="empty-project-image-panel">
      <div className="h-full w-full overflow-hidden bg-background">
        <img
          alt="Empty project preview"
          className="h-full w-full object-cover"
          data-testid="empty-project-image"
          src={emptyImageSrc}
        />
      </div>
    </div>
  )
}

function SummaryContent() {
  return (
    <div
      data-testid="empty-project-summary-panel"
      className="flex w-full items-center justify-center text-muted-foreground"
    >
      <div className="text-center">
        <p className="text-lg font-medium">Summary</p>
        <p className="mt-1 text-sm">Coming soon</p>
      </div>
    </div>
  )
}

export function EmptyProject() {
  const [activeTab, setActiveTab] = useState<EmptyProjectTab>('info')
  const isImageTab = activeTab === 'image'

  const renderTabContent = () => {
    if (activeTab === 'image') {
      return <ImageContent />
    }

    if (activeTab === 'summary') {
      return <SummaryContent />
    }

    return <InfoContent />
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="relative flex h-full w-full items-center justify-center">
        <TooltipProvider delayDuration={0}>
          {isImageTab ? (
            <div className="relative h-full w-full">
              {renderTabContent()}
            </div>
          ) : (
            <div className="flex w-full items-center justify-center px-6 pr-20 md:px-12 md:pr-24">
              <Empty className="max-w-4xl">
                {renderTabContent()}
              </Empty>
            </div>
          )}

          <div
            className="absolute top-1/2 right-2 z-10 -translate-y-1/2"
            data-testid="empty-project-tabs"
          >
            <ToggleGroup
              type="single"
              orientation="vertical"
              value={activeTab}
              onValueChange={(value) => {
                if (value) {
                  setActiveTab(value as EmptyProjectTab)
                }
              }}
              className="flex-col rounded bg-muted p-0.5 gap-0.5"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <ToggleGroupItem aria-label="Info" data-testid="empty-project-tab-info" value="info" className={emptyProjectTabClassName}>
                      <InfoIcon size={13} />
                    </ToggleGroupItem>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>Info</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <ToggleGroupItem aria-label="Image" data-testid="empty-project-tab-image" value="image" className={emptyProjectTabClassName}>
                      <ImageIcon size={13} />
                    </ToggleGroupItem>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>Image</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <ToggleGroupItem aria-label="Summary" data-testid="empty-project-tab-summary" value="summary" className={emptyProjectTabClassName}>
                      <FileTextIcon size={13} />
                    </ToggleGroupItem>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>Summary</TooltipContent>
              </Tooltip>
            </ToggleGroup>
          </div>
        </TooltipProvider>
      </div>
    </div>
  )
}
