import React from 'react';
import type { VeConfig, VeStageState } from './types';

interface MiniMapProps {
  veConfig: VeConfig;
  veStageState: VeStageState;
  previewImgRef: React.RefObject<HTMLImageElement | null>;
  onZoom: (delta: number) => void;
  onZoomReset: () => void;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  veConfig, veStageState, previewImgRef, onZoom, onZoomReset,
}) => {
  return (
    <div className="absolute bottom-4 right-4">
      <div className="flex flex-col w-40 h-32 border border-[var(--wb-panel-border)] bg-[var(--wb-panel-bg)] text-[var(--wb-panel-text)] rounded-xl shadow-md">
        <div className="flex justify-center items-center mx-2 mt-2 h-6">
          <button
            className="p-2 rounded-md hover:bg-[var(--wb-panel-hover)] ri-add-line"
            title="zoom in"
            onClick={() => onZoom(veConfig.zoominScale)}
          />
          <button className="flex-1 text-base rounded-md hover:bg-[var(--wb-panel-hover)]" title="reset zoom" onClick={onZoomReset}>
            {Math.round(veStageState.scale * 100)}%
          </button>
          <button
            className="p-2 rounded-md hover:bg-[var(--wb-panel-hover)] ri-subtract-line"
            title="zoom out"
            onClick={() => onZoom(veConfig.zoomoutScale)}
          />
        </div>
        <div className="m-2 flex-1 overflow-hidden rounded-md border border-[var(--wb-panel-border)]">
          <img ref={previewImgRef} className="w-full h-full" alt="preview" />
        </div>
      </div>
    </div>
  );
};
