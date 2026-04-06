interface WorkflowPlaceholderProps {
  title?: string;
  description?: string;
  testId?: string;
}

export function WorkflowPlaceholder({
  title = 'Workflow',
  description = 'Coming soon',
  testId = 'workflow-view',
}: WorkflowPlaceholderProps) {
  return (
    <div data-testid={testId} className="flex h-full w-full items-center justify-center bg-background text-muted-foreground">
      <div className="text-center">
        <p className="text-lg font-medium">{title}</p>
        <p className="mt-1 text-sm">{description}</p>
      </div>
    </div>
  );
}
