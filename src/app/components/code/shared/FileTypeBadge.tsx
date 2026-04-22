import { WorkspaceFileIcon } from './WorkspaceEntryIcon';

export function FileTypeBadge({
  name,
  className = '',
  fallbackClassName = '',
  testId,
}: {
  name: string;
  className?: string;
  fallbackClassName?: string;
  testId?: string;
}) {
  return <WorkspaceFileIcon name={name} className={[className, fallbackClassName].filter(Boolean).join(' ').trim() || 'h-4 w-4'} testId={testId} />;
}