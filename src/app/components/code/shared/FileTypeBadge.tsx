import { File } from 'lucide-react';

interface FileTypeBadgeInfo {
  label?: string;
  className?: string;
}

function getFileTypeBadgeInfo(name: string): FileTypeBadgeInfo {
  const lowerName = name.toLowerCase();
  const ext = lowerName.includes('.') ? lowerName.split('.').pop() : '';

  if (lowerName === '.gitignore') return { label: 'IG', className: 'text-ide-file-git' };
  if (lowerName === '.gitmodules') return { label: 'GM', className: 'text-ide-file-git' };
  if (lowerName === 'license') return { label: 'LC', className: 'text-ide-file-license' };

  if (ext === 'v') return { label: 'V', className: 'text-ide-file-v' };
  if (ext === 'sv') return { label: 'SV', className: 'text-ide-file-sv' };
  if (ext === 'vh') return { label: 'VH', className: 'text-ide-file-hdl-header' };
  if (ext === 'svh') return { label: 'SH', className: 'text-ide-file-hdl-header' };
  if (ext === 'c' || ext === 'cpp') return { label: 'C', className: 'text-ide-file-software' };
  if (ext === 'h' || ext === 'hpp') return { label: 'H', className: 'text-ide-file-software' };
  if (ext === 'py') return { label: 'Py', className: 'text-ide-file-python' };
  if (ext === 'xdc') return { label: 'X', className: 'text-ide-file-xdc' };
  if (ext === 'sdc') return { label: 'SD', className: 'text-ide-file-xdc' };
  if (ext === 'tcl') return { label: 'TC', className: 'text-ide-file-script' };
  if (ext === 'sh') return { label: 'SH', className: 'text-ide-file-shell' };
  if (lowerName === 'makefile' || ext === 'mk') return { label: 'MK', className: 'text-ide-file-build' };
  if (ext === 'ys') return { label: 'YS', className: 'text-ide-file-build' };
  if (ext === 's') return { label: 'AS', className: 'text-ide-file-asm' };
  if (ext === 'ld' || ext === 'lds') return { label: 'LD', className: 'text-ide-file-linker' };
  if (ext === 'f' || ext === 'fl') return { label: 'FL', className: 'text-ide-file-filelist' };
  if (ext === 'json') return { label: 'J', className: 'text-ide-file-config' };
  if (ext === 'xml') return { label: 'XM', className: 'text-ide-file-config' };
  if (ext === 'yml' || ext === 'yaml') return { label: 'Y', className: 'text-ide-file-yaml' };
  if (ext === 'md') return { label: 'M', className: 'text-ide-file-md' };

  return {};
}

export function FileTypeBadge({
  name,
  className = '',
  fallbackClassName = 'text-foreground',
  testId,
}: {
  name: string;
  className?: string;
  fallbackClassName?: string;
  testId?: string;
}) {
  const badge = getFileTypeBadgeInfo(name);

  if (!badge.label || !badge.className) {
    return <File size={13} className={fallbackClassName} data-testid={testId} />;
  }

  return (
    <span data-testid={testId} className={`${badge.className} ${className}`.trim()}>
      {badge.label}
    </span>
  );
}