import React from 'react';
import type { LayerControl } from './types';

interface LayerPanelProps {
  veGridLayerControl: LayerControl;
  veShapeLayerControl: LayerControl;
  veDesignLayerControl: LayerControl;
  veCommentLayerControl: LayerControl;
  onGridLayerHideClick: () => void;
  onShapeLayerHideClick: () => void;
  onDesignLayerHideClick: () => void;
  onCommentLayerHideClick: () => void;
  onShapeLayerLockToggle: () => void;
  onDesignLayerLockToggle: () => void;
  onCommentLayerLockToggle: () => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  veShapeLayerControl, veDesignLayerControl, veCommentLayerControl,
  onGridLayerHideClick,
  onShapeLayerHideClick, onDesignLayerHideClick, onCommentLayerHideClick,
  onShapeLayerLockToggle, onDesignLayerLockToggle, onCommentLayerLockToggle,
}) => {
  return (
    <div className="absolute bottom-4 left-4">
      <div className="flex flex-col w-40 h-32 border border-[var(--wb-panel-border)] bg-[var(--wb-panel-bg)] text-[var(--wb-panel-text)] rounded-xl shadow-md">
        <div className="flex items-center h-6 rounded-xl text-base justify-between mx-1 my-1">
          <div>Layer</div>
          <div className="flex gap-2">
            <button className="ri-layout-grid-line" title="toggle grid" onClick={onGridLayerHideClick} />
            <button className="ri-add-large-line" />
            <button className="ri-delete-bin-line" />
          </div>
        </div>
        <div className="border-t mb-1" />
        <div className="flex flex-col flex-1 text-base overflow-auto mx-1">
          <div className="flex justify-between font-semibold bg-[var(--wb-panel-active)] rounded-md">
            <div>shape</div>
            <div className="flex gap-2">
              <button
                className={veShapeLayerControl.isHide ? 'ri-eye-off-line' : 'ri-eye-line'}
                title="toggle shape visibility"
                onClick={onShapeLayerHideClick}
              />
              <button
                className={veShapeLayerControl.isLock ? 'ri-lock-line' : 'ri-lock-unlock-line'}
                title="toggle shape lock"
                onClick={onShapeLayerLockToggle}
              />
            </div>
          </div>
          <div className="flex justify-between font-semibold bg-[var(--wb-panel-secondary)] rounded-md">
            <div>design</div>
            <div className="flex gap-2">
              <button
                className={veDesignLayerControl.isHide ? 'ri-eye-off-line' : 'ri-eye-line'}
                title="toggle design visibility"
                onClick={onDesignLayerHideClick}
              />
              <button
                className={veDesignLayerControl.isLock ? 'ri-lock-line' : 'ri-lock-unlock-line'}
                title="toggle design lock"
                onClick={onDesignLayerLockToggle}
              />
            </div>
          </div>
          <div className="flex justify-between font-semibold bg-[var(--wb-panel-active)] rounded-md">
            <div>comment</div>
            <div className="flex gap-2">
              <button
                className={veCommentLayerControl.isHide ? 'ri-eye-off-line' : 'ri-eye-line'}
                title="toggle comment visibility"
                onClick={onCommentLayerHideClick}
              />
              <button
                className={veCommentLayerControl.isLock ? 'ri-lock-line' : 'ri-lock-unlock-line'}
                title="toggle comment lock"
                onClick={onCommentLayerLockToggle}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
