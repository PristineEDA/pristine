import React, { useCallback } from 'react';
import { useVisualEditor } from './useVisualEditor';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { LayerPanel } from './LayerPanel';
import { MiniMap } from './MiniMap';
import { HistoryPanel } from './HistoryPanel';
import { ShapeInPagePanel } from './ShapeInPagePanel';

export const WhiteboardView: React.FC = () => {
  const ve = useVisualEditor();

  // ─── TopBar handlers ─────────────────────────────────────────────────
  const handleTopBarLeftBtnClick = useCallback((tooltip: string) => {
    if (tooltip === 'home') {
      ve.setIsTopBarLeftHomeBtnClick((v) => !v);
    }
  }, [ve.setIsTopBarLeftHomeBtnClick]);

  const handleTopBarHomeBtnClick = useCallback((name: string) => {
    switch (name) {
      case 'open': {
        // clear canvas layers
        break;
      }
      case 'export':
        ve.exportCanvas();
        break;
      default:
        break;
    }
    ve.setIsTopBarLeftHomeBtnClick(false);
  }, [ve.exportCanvas, ve.setIsTopBarLeftHomeBtnClick]);

  const handleCodeFreezeToggle = useCallback(() => {
    ve.setVeIsCodeFreeze((v) => !v);
  }, [ve.setVeIsCodeFreeze]);

  // ─── Cursor class mapping ──────────────────────────────────────────
  let cursorClass = 'cursor-auto';
  if (ve.veIsGrabbing) cursorClass = 'cursor-grabbing';
  else if (ve.veSelectedBtn === 'grab') cursorClass = 'cursor-grab';
  else if (ve.veSelectedBtn === 'text') cursorClass = 'cursor-text';
  else if (ve.veSelectedBtn === 'shape') cursorClass = 'cursor-crosshair';

  return (
    <div className="w-full h-full flex justify-center items-center overflow-hidden relative" ref={ve.canvasContainerRef}>
      {/* Konva stage mount point */}
      <div id="konva-veStage" className={`w-full h-full overflow-hidden bg-[var(--wb-canvas-bg)] ${cursorClass}`} />

      <TopBar
        isTopBarLeftHomeBtnClick={ve.isTopBarLeftHomeBtnClick}
        veIsCodeFreeze={ve.veIsCodeFreeze}
        onTopBarLeftBtnClick={handleTopBarLeftBtnClick}
        onTopBarHomeBtnClick={handleTopBarHomeBtnClick}
        onCodeFreezeToggle={handleCodeFreezeToggle}
      />

      <BottomBar
        veSelectedBtn={ve.veSelectedBtn}
        vePicPreviewDataList={ve.vePicPreviewDataList}
        vePicUploadBtnIdx={ve.vePicUploadBtnIdx}
        selectedPenSubBarFirst={ve.selectedPenSubBarFirst}
        selectedPenSubBarSecond={ve.selectedPenSubBarSecond}
        selectedPenSubBarThird={ve.selectedPenSubBarThird}
        selectedPenSubBarFourth={ve.selectedPenSubBarFourth}
        selectedEraserSubBarFirst={ve.selectedEraserSubBarFirst}
        selectedShapeSubBarFirst={ve.selectedShapeSubBarFirst}
        onBottomBarLeftBtnClick={ve.handleBottomBarLeftBtnClick}
        onSetVeSelectedBtn={ve.setVeSelectedBtn}
        onPicUploadBtnClick={ve.handlePicUploadBtnClick}
        onSetSelectedPenSubBarFirst={ve.setSelectedPenSubBarFirst}
        onSetSelectedPenSubBarSecond={ve.setSelectedPenSubBarSecond}
        onSetSelectedPenSubBarThird={ve.setSelectedPenSubBarThird}
        onSetSelectedPenSubBarFourth={ve.setSelectedPenSubBarFourth}
        onSetSelectedEraserSubBarFirst={ve.setSelectedEraserSubBarFirst}
        onSetSelectedShapeSubBarFirst={ve.setSelectedShapeSubBarFirst}
        picUploadInputRef={ve.picUploadInputRef}
        onImageFileUpload={ve.handleImageFileUpload}
      />

      <LayerPanel
        veGridLayerControl={ve.veGridLayerControl}
        veShapeLayerControl={ve.veShapeLayerControl}
        veDesignLayerControl={ve.veDesignLayerControl}
        veCommentLayerControl={ve.veCommentLayerControl}
        onGridLayerHideClick={ve.handleGridLayerHideClick}
        onShapeLayerHideClick={ve.handleShapeLayerHideClick}
        onDesignLayerHideClick={ve.handleDesignLayerHideClick}
        onCommentLayerHideClick={ve.handleCommentLayerHideClick}
        onShapeLayerLockToggle={() => ve.setVeShapeLayerControl((c) => ({ ...c, isLock: !c.isLock }))}
        onDesignLayerLockToggle={() => ve.setVeDesignLayerControl((c) => ({ ...c, isLock: !c.isLock }))}
        onCommentLayerLockToggle={() => ve.setVeCommentLayerControl((c) => ({ ...c, isLock: !c.isLock }))}
      />

      <MiniMap
        veConfig={ve.veConfig}
        veStageState={ve.veStageState}
        previewImgRef={ve.previewImgRef}
        onZoom={ve.handleVEZoom}
        onZoomReset={ve.handleVEZoomReset}
      />

      <HistoryPanel
        className="hidden"
        historyState={ve.historyState}
        historyItemList={ve.historyItemList}
        historyListPanelRef={ve.historyListPanelRef}
        onHistoryItemClick={ve.handleHistoryItemClick}
      />

      <ShapeInPagePanel
        veShapeInPagePanelState={ve.veShapeInPagePanelState}
        veShapeInPagePanelTool={ve.veShapeInPagePanelTool}
      />
    </div>
  );
};
