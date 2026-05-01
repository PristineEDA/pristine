import { WorkspaceFileIcon } from './WorkspaceEntryIcon';

export function FileTypeBadge({
  name,
  path,
  className = '',
  fallbackClassName = '',
  testId,
}: {
  name: string;
  path?: string;
  className?: string;
  fallbackClassName?: string;
  testId?: string;
}) {
  return <WorkspaceFileIcon name={name} path={path} className={[className, fallbackClassName].filter(Boolean).join(' ').trim() || 'h-4 w-4'} testId={testId} />;
}