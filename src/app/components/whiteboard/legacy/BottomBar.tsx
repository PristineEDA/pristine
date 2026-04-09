import React from 'react';
import type { VeSelectedBtn, PicUploadData } from './types';
import {
  bottomBarLeft, bottomBarRight,
  penSubBarFirst, penSubBarSecond, penSubBarThird, penSubBarFourth,
  eraserSubBarFirst, shapeSubBarFirst,
} from './constants';
import noteImageSrc from '../../../../assets/images/whiteboard/note.svg';

interface BottomBarProps {
  veSelectedBtn: VeSelectedBtn;
  vePicPreviewDataList: PicUploadData[];
  vePicUploadBtnIdx: number;
  selectedPenSubBarFirst: string;
  selectedPenSubBarSecond: string;
  selectedPenSubBarThird: string;
  selectedPenSubBarFourth: string;
  selectedEraserSubBarFirst: string;
  selectedShapeSubBarFirst: string;
  onBottomBarLeftBtnClick: (tooltip: string) => void;
  onSetVeSelectedBtn: (btn: VeSelectedBtn) => void;
  onPicUploadBtnClick: (idx: number) => void;
  onSetSelectedPenSubBarFirst: (v: string) => void;
  onSetSelectedPenSubBarSecond: (v: string) => void;
  onSetSelectedPenSubBarThird: (v: string) => void;
  onSetSelectedPenSubBarFourth: (v: string) => void;
  onSetSelectedEraserSubBarFirst: (v: string) => void;
  onSetSelectedShapeSubBarFirst: (v: string) => void;

  // hidden file input ref
  picUploadInputRef: React.RefObject<HTMLInputElement | null>;
  onImageFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // spec note drag
  onSpecNoteDragStart?: (e: React.DragEvent) => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  veSelectedBtn,
  vePicPreviewDataList, vePicUploadBtnIdx,
  selectedPenSubBarFirst, selectedPenSubBarSecond, selectedPenSubBarThird, selectedPenSubBarFourth,
  selectedEraserSubBarFirst, selectedShapeSubBarFirst,
  onBottomBarLeftBtnClick, onSetVeSelectedBtn,
  onPicUploadBtnClick,
  onSetSelectedPenSubBarFirst, onSetSelectedPenSubBarSecond,
  onSetSelectedPenSubBarThird, onSetSelectedPenSubBarFourth,
  onSetSelectedEraserSubBarFirst, onSetSelectedShapeSubBarFirst,
  picUploadInputRef, onImageFileUpload, onSpecNoteDragStart,
}) => {
  return (
    <div className="absolute bottom-4 left-1/2 z-[0] -translate-x-1/2 w-fit h-fit bg-[var(--wb-panel-bg)] text-[var(--wb-panel-text)] rounded-xl flex justify-center items-center gap-2 shadow-md border border-[var(--wb-panel-border)] py-2">
      {/* Left buttons */}
      <div className="flex gap-2 px-2 z-[100]">
        {bottomBarLeft.map((item, idx) => (
          <button
            key={idx}
            className={`p-1 rounded-lg text-xl outline-none ${
              veSelectedBtn === item.tooltip ? 'bg-[var(--wb-btn-selected-bg)] text-[var(--wb-btn-selected-text)]' : 'hover:bg-[var(--wb-panel-hover)]'
            }`}
            title={`${item.tooltip} - ${item.shortcut}`}
            onClick={() => onBottomBarLeftBtnClick(item.tooltip)}
          >
            <i className={item.name} />
          </button>
        ))}
      </div>

      {/* Spec note drag area */}
      <div className="relative w-20">
        <img
          src={noteImageSrc}
          alt="Spec Note"
          width={70}
          className="absolute cursor-pointer left-0 -bottom-7"
          title="Spec Note"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('elem-type', 'spec-note');
            onSpecNoteDragStart?.(e);
          }}
        />
      </div>

      {/* Right buttons */}
      <div className="flex gap-2 px-2 z-[100]">
        {bottomBarRight.map((item, idx) => (
          <button
            key={idx}
            className={`p-1 rounded-lg text-xl outline-none ${
              veSelectedBtn === item.tooltip ? 'bg-[var(--wb-btn-selected-bg)] text-[var(--wb-btn-selected-text)]' : 'hover:bg-[var(--wb-panel-hover)]'
            }`}
            title={`${item.tooltip} - ${item.shortcut}`}
            onClick={() => onSetVeSelectedBtn(item.tooltip as VeSelectedBtn)}
          >
            <i className={item.name} />
          </button>
        ))}
      </div>

      {/* ─── Image sub-bar ──────────────────────────────────────── */}
      <div className={`absolute z-10 rounded-xl border border-[var(--wb-panel-border)] shadow-sm left-1/2 -translate-x-1/2 h-16 w-5/12 bg-[var(--wb-panel-active)] transition-all ${
        veSelectedBtn === 'image' ? 'bottom-16 opacity-100' : 'bottom-0 opacity-0 pointer-events-none'
      }`}>
        <div className="flex gap-3 justify-start items-center mx-2 h-full">
          {vePicPreviewDataList.map((item, idx) => (
            <button
              key={idx}
              className="flex justify-center items-center w-16 h-12 bg-[var(--wb-panel-secondary)] rounded-md border border-[var(--wb-panel-border)] shadow-md hover:border-orange-300 overflow-hidden"
              onClick={() => onPicUploadBtnClick(idx)}
            >
              {item.uploadImg && (
                <img className="w-full" src={item.uploadImg.src} alt="" />
              )}
            </button>
          ))}
          <input
            ref={picUploadInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={onImageFileUpload}
          />
          <div className="flex flex-col text-base font-semibold border border-[var(--wb-panel-border)] bg-[var(--wb-panel-secondary)] px-2 rounded-xl w-[130px] cursor-pointer">
            <div className="flex gap-1 justify-between">
              <div className="font-bold">size:</div>
              <div>
                {vePicPreviewDataList[vePicUploadBtnIdx]?.uploadImg
                  ? `${vePicPreviewDataList[vePicUploadBtnIdx].uploadImg!.width}x${vePicPreviewDataList[vePicUploadBtnIdx].uploadImg!.height}`
                  : '0x0'}
              </div>
            </div>
            <div className="flex gap-1 justify-between">
              <div className="font-bold">file:</div>
              <div>{vePicPreviewDataList[vePicUploadBtnIdx]?.size ?? 0}KB</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Pen sub-bar ────────────────────────────────────────── */}
      <div className={`absolute z-10 rounded-xl border border-[var(--wb-panel-border)] shadow-sm left-1/2 -translate-x-1/2 h-10 w-fit bg-[var(--wb-panel-active)] transition-all ${
        veSelectedBtn === 'pen' ? 'bottom-16 opacity-100' : 'bottom-0 opacity-0 pointer-events-none'
      }`}>
        <div className="flex items-center gap-2 px-2">
          {penSubBarFirst.map((item, idx) => (
            <button
              key={idx}
              className={`p-1 rounded-lg text-xl ${
                selectedPenSubBarFirst === item.tooltip ? 'bg-[var(--wb-btn-selected-bg)] text-[var(--wb-btn-selected-text)]' : 'hover:bg-[var(--wb-panel-hover)]'
              }`}
              title={item.tooltip}
              onClick={() => onSetSelectedPenSubBarFirst(item.tooltip)}
            >
              <i className={item.name} />
            </button>
          ))}
          <div className="border-r-2 border-[var(--wb-panel-border)] h-6" />
          {penSubBarSecond.map((item, idx) => (
            <button
              key={idx}
              className={`p-1 rounded-lg text-xl ${
                selectedPenSubBarSecond === item.tooltip ? 'bg-[var(--wb-btn-selected-bg)] text-[var(--wb-btn-selected-text)]' : 'hover:bg-[var(--wb-panel-hover)]'
              }`}
              title={item.tooltip}
              onClick={() => onSetSelectedPenSubBarSecond(item.tooltip)}
            >
              <i className={item.name} />
            </button>
          ))}
          {penSubBarThird.map((item, idx) => (
            <button
              key={idx}
              className={`p-1 rounded-lg text-xl ${
                selectedPenSubBarThird === item.tooltip ? 'bg-[var(--wb-btn-selected-bg)] text-[var(--wb-btn-selected-text)]' : 'hover:bg-[var(--wb-panel-hover)]'
              }`}
              title={item.tooltip}
              onClick={() => onSetSelectedPenSubBarThird(item.tooltip)}
            >
              <i className="text-xl font-semibold">{item.name}</i>
            </button>
          ))}
          <div className="border-r-2 border-[var(--wb-panel-border)] h-6" />
          {penSubBarFourth.map((item, idx) => (
            <div
              key={idx}
              className={`w-5 h-5 rounded-full cursor-pointer ${item.name} ${
                selectedPenSubBarFourth === item.tooltip ? 'border-2 border-yellow-500' : 'hover:border-2 hover:border-yellow-500'
              }`}
              title={item.tooltip}
              onClick={() => onSetSelectedPenSubBarFourth(item.tooltip)}
            />
          ))}
        </div>
      </div>

      {/* ─── Eraser sub-bar ─────────────────────────────────────── */}
      <div className={`absolute z-10 rounded-xl border border-[var(--wb-panel-border)] shadow-sm left-1/2 -translate-x-1/2 h-10 w-fit bg-[var(--wb-panel-active)] transition-all ${
        veSelectedBtn === 'eraser' ? 'bottom-16 opacity-100' : 'bottom-0 opacity-0 pointer-events-none'
      }`}>
        <div className="flex items-center gap-3 p-2">
          {eraserSubBarFirst.map((item, idx) => (
            <div
              key={idx}
              className={`rounded-full cursor-pointer border border-[var(--wb-panel-border)] bg-[var(--wb-panel-secondary)] ${item.size} ${
                selectedEraserSubBarFirst === item.tooltip ? 'border-2 border-yellow-500' : 'hover:border-2 hover:border-yellow-500'
              }`}
              title={item.tooltip}
              onClick={() => onSetSelectedEraserSubBarFirst(item.tooltip)}
            />
          ))}
        </div>
      </div>

      {/* ─── Shape sub-bar ──────────────────────────────────────── */}
      <div className={`absolute z-10 rounded-xl border border-[var(--wb-panel-border)] shadow-sm left-1/2 -translate-x-1/2 h-10 w-fit bg-[var(--wb-panel-active)] transition-all ${
        veSelectedBtn === 'shape' ? 'bottom-16 opacity-100' : 'bottom-0 opacity-0 pointer-events-none'
      }`}>
        <div className="flex items-center gap-2 px-2">
          {shapeSubBarFirst.map((item, idx) => (
            <button
              key={idx}
              className={`p-1 rounded-lg text-xl ${
                selectedShapeSubBarFirst === item.tooltip ? 'bg-[var(--wb-btn-selected-bg)] text-[var(--wb-btn-selected-text)]' : 'hover:bg-[var(--wb-panel-hover)]'
              }`}
              title={item.tooltip}
              onClick={() => onSetSelectedShapeSubBarFirst(item.tooltip)}
            >
              <i className={item.name} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
