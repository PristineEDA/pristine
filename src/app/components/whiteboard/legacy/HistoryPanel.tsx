import React from 'react';
import type { HistoryItem, HistoryState } from './types';
import { veHistoryItemActionMap as historyItemActionMap, veHistoryItemShapeMap as historyItemShapeMap } from './constants';

interface HistoryPanelProps {
  className?: string;
  historyState: HistoryState;
  historyItemList: HistoryItem[];
  historyListPanelRef: React.RefObject<HTMLDivElement | null>;
  onHistoryItemClick: (idx: number) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  className, historyState, historyItemList, historyListPanelRef, onHistoryItemClick,
}) => {
  return (
    <div className={`absolute bottom-1/4 right-4 ${className ?? ''}`}>
      <div className="flex flex-col w-48 h-72 border border-[var(--wb-panel-border)] bg-[var(--wb-panel-bg)] text-[var(--wb-panel-text)] rounded-xl shadow-md">
        <div className="flex justify-between items-center mx-2 mt-2 h-fit bg-[var(--wb-panel-active)] rounded-md px-1">
          <div className="text-base">{historyState.num}/100</div>
          <div className="text-base">{historyState.memUsage}KB/8MB</div>
        </div>
        <div className="flex h-3 bg-[var(--wb-progress-track)] mt-1 rounded-md mx-2">
          <div
            className="bg-[var(--wb-progress-fill)] rounded-md transition-all"
            style={{ width: `${historyState.progress}%` }}
          />
        </div>
        <div
          ref={historyListPanelRef}
          className="m-2 flex-1 overflow-y-auto rounded-md border border-[var(--wb-panel-border)] scroll-smooth"
        >
          {historyItemList.map((item, idx) => (
            <div
              key={idx}
              className={`flex justify-between text-sm font-normal mx-1 mt-1 px-1 border border-[var(--wb-panel-border)] rounded-md hover:bg-[var(--wb-panel-hover)] cursor-pointer transition-all ${
                item.active ? 'bg-[var(--wb-panel-active)]' : ''
              }`}
              title={item.action}
              onClick={() => onHistoryItemClick(idx)}
            >
              <div className="flex items-center gap-1">
                <div className={historyItemActionMap[item.action] ?? ''} />
                <div className={historyItemShapeMap[item.shapeClass] ?? ''} />
              </div>
              <div>{item.timestamp}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
