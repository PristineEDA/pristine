import React from 'react';

export const KeyboardDisplay: React.FC<{ veKeyboardKey: string }> = ({ veKeyboardKey }) => (
  <div className="absolute top-4 left-4">
    <div className="flex flex-col justify-center items-center w-16 h-10 bg-[var(--wb-status-bg)] rounded-md border border-[var(--wb-status-border)] shadow-md text-sm text-[var(--wb-status-text)] opacity-70">
      {veKeyboardKey}
    </div>
  </div>
);
