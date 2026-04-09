import { useEffect, useCallback } from 'react';
import type { VeSelectedBtn } from './types';

interface UseKeyboardOptions {
  veSelectedBtn: VeSelectedBtn;
  setVeSelectedBtn: (btn: VeSelectedBtn) => void;
  setVeKeyboardKey: (key: string) => void;
  setVeStageStatePartial: (patch: { isShiftPressed?: boolean; isCtrlPressed?: boolean }) => void;
  isTopBarLeftHomeBtnClick: boolean;
  setIsTopBarLeftHomeBtnClick: (v: boolean) => void;
  onSelectAll: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onDeselectAll: () => void;
}

const toolShortcuts: Record<string, VeSelectedBtn> = {
  s: 'select', g: 'grab', q: 'pen', e: 'eraser',
  t: 'text', i: 'image', d: 'shape',
};

export function useKeyboard({
  veSelectedBtn, setVeSelectedBtn, setVeKeyboardKey,
  setVeStageStatePartial,
  isTopBarLeftHomeBtnClick, setIsTopBarLeftHomeBtnClick,
  onSelectAll, onCopy, onPaste, onUndo, onRedo, onDelete, onDeselectAll,
}: UseKeyboardOptions) {

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isInputElement = (e.target as HTMLElement).matches('input, textarea, [contenteditable]');
    if (isInputElement) return;

    e.preventDefault();

    if (e.ctrlKey && e.key === 'a') {
      setVeKeyboardKey('CTRL+A');
      onSelectAll();
    } else if (e.ctrlKey && e.key === 's') {
      setVeKeyboardKey('CTRL+S');
    } else if (e.ctrlKey && e.key === 'f') {
      setVeKeyboardKey('CTRL+F');
    } else if (e.ctrlKey && e.key === 'g') {
      setVeKeyboardKey('CTRL+G');
    } else if (e.ctrlKey && e.key === 'z') {
      setVeKeyboardKey('CTRL+Z');
      onUndo();
    } else if (e.ctrlKey && e.key === 'y') {
      setVeKeyboardKey('CTRL+Y');
      onRedo();
    } else if (e.ctrlKey && e.key === 'x') {
      setVeKeyboardKey('CTRL+X');
    } else if (e.ctrlKey && e.key === 'c') {
      setVeKeyboardKey('CTRL+C');
      onCopy();
    } else if (e.ctrlKey && e.key === 'v') {
      setVeKeyboardKey('CTRL+V');
      onPaste();
    } else if (e.ctrlKey && e.key === 'b') {
      setVeKeyboardKey('CTRL+B');
    } else {
      setVeKeyboardKey(e.key);
      if (e.key === 'Delete') {
        onDelete();
      } else if (e.key === 'Escape') {
        if (isTopBarLeftHomeBtnClick) {
          setIsTopBarLeftHomeBtnClick(false);
        }
        if (veSelectedBtn !== 'select') {
          setVeSelectedBtn('select');
        } else {
          onDeselectAll();
        }
      } else if (e.key === 'Shift') {
        setVeStageStatePartial({ isShiftPressed: true });
      } else if (e.key === 'Control') {
        setVeStageStatePartial({ isCtrlPressed: true });
      } else {
        const tool = toolShortcuts[e.key];
        if (tool) setVeSelectedBtn(tool);
      }
    }
  }, [
    veSelectedBtn, setVeSelectedBtn, setVeKeyboardKey, setVeStageStatePartial,
    isTopBarLeftHomeBtnClick, setIsTopBarLeftHomeBtnClick,
    onSelectAll, onCopy, onPaste, onUndo, onRedo, onDelete, onDeselectAll,
  ]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const isInputElement = (e.target as HTMLElement).matches('input, textarea, [contenteditable]');
    if (isInputElement) return;

    e.preventDefault();

    if (e.key === 'Shift') {
      setVeStageStatePartial({ isShiftPressed: false });
    } else if (e.key === 'Control') {
      setVeStageStatePartial({ isCtrlPressed: false });
    }
    setVeKeyboardKey('none');
  }, [setVeStageStatePartial, setVeKeyboardKey]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
}
