import React from 'react';
import type { ShapeInPagePanelState, ShapeInPagePanelTool } from './types';
import { penSubBarFourth } from './constants';

interface ShapeInPagePanelProps {
  veShapeInPagePanelState: ShapeInPagePanelState;
  veShapeInPagePanelTool: ShapeInPagePanelTool;
}

export const ShapeInPagePanel: React.FC<ShapeInPagePanelProps> = ({
  veShapeInPagePanelState,
  veShapeInPagePanelTool,
}) => {
  return (
    <div
      className="absolute"
      style={{
        top: veShapeInPagePanelState.top,
        left: veShapeInPagePanelState.left,
        display: veShapeInPagePanelState.display,
      }}
    >
      <div className="w-60 h-10 rounded-2xl border-[var(--wb-glass-border)] bg-[var(--wb-glass-bg)] backdrop-blur-[35px] shadow-md">
        <div className="flex items-center text-[var(--wb-glass-text)] h-full gap-1">
          <div>h</div>
          <div>h</div>
          <div className="w-5 h-5 bg-[var(--wb-glass-input-bg)] rounded-full cursor-pointer" />
          <div className="absolute flex flex-col gap-1 w-72 top-12 left-0 p-2 rounded-2xl border-[var(--wb-glass-border)] bg-[var(--wb-glass-bg)] backdrop-blur-[35px] shadow-md">
            <div className="shape-fill-colorpicker" />
            <div className="flex justify-center items-center gap-1 border border-[var(--wb-glass-border)] rounded-xl py-2">
              {penSubBarFourth.map((item, idx) => (
                <div
                  key={idx}
                  className={`w-5 h-5 border border-white rounded-full cursor-pointer ${item.name}`}
                />
              ))}
            </div>
            <div className="flex justify-center items-center">
              <input
                value={veShapeInPagePanelTool.borderColor}
                readOnly
                className="mt-1 w-2/3 text-center rounded-md bg-[var(--wb-glass-btn-bg)] text-[var(--wb-glass-text)] text-base outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
