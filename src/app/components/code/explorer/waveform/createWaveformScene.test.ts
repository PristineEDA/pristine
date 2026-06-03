import { describe, expect, it, vi } from 'vitest';
import { Container, Text, Texture } from 'pixi.js';

import { clipWaveformLineToBounds, createWaveformScene, getWaveformBusHexagonBevel, updateWaveformSceneCursor, updateWaveformScenePan, updateWaveformSceneSelection, updateWaveformSceneVerticalScroll, updateWaveformSceneViewport, waveformHighImpedanceStripeSpacing, waveformLayerNames, waveformUnknownStripeSpacing, type WaveformSignalTextureCacheEntry } from './createWaveformScene';
import { fitWaveformViewport, getWaveformCanvasHeightForData, getWaveformDigitalPulseFillCount, getWaveformDisplayRows, getWaveformShapeCounts, getWaveformSignalLaneY } from './waveformLayout';
import { mockWaveformData } from './waveformMockData';
import type { WaveformDataSet } from './waveformTypes';

describe('createWaveformScene', () => {
  it('builds explicit render layers and reports X/Z state coverage', () => {
    const scene = createWaveformScene({
      cursorTime: mockWaveformData.cursorTime,
      data: mockWaveformData,
      height: 320,
      selectedSignalId: 'u_top_module1-counting',
      viewport: fitWaveformViewport(mockWaveformData),
      width: 900,
    });

    expect(Object.keys(scene.layers)).toEqual(waveformLayerNames);
    expect(scene.world.children).toHaveLength(waveformLayerNames.length);
    expect(scene.rowCount).toBe(getWaveformDisplayRows(mockWaveformData).length);
    expect(scene.layers.content.children.length).toBeGreaterThan(0);
    expect(scene.layers.content.children.length).toBeLessThan(mockWaveformData.signals.length);
    expect(scene.layers.status.children.length).toBeGreaterThan(0);
    expect(scene.layers.status.children.some((child) => child instanceof Container && child.label === 'waveform-header-overlay')).toBe(true);
    expect(scene.layers.operation.children.length).toBeGreaterThan(0);
    expect(scene.firstSignalLaneY).toBe(getWaveformSignalLaneY(mockWaveformData, 'tb_top_module1-clk'));
    expect(scene.selectedSignalLaneY).toBe(getWaveformSignalLaneY(mockWaveformData, 'u_top_module1-counting'));
    expect(scene.shapeCounts).toEqual(getWaveformShapeCounts(mockWaveformData, fitWaveformViewport(mockWaveformData)));
    expect(scene.shapeCounts.busHexagonCount).toBeGreaterThan(0);
    expect(scene.shapeCounts.xStateBlockCount).toBeGreaterThan(0);
    expect(scene.shapeCounts.zStateBlockCount).toBeGreaterThan(0);
    expect(scene.digitalPulseFillCount).toBe(getWaveformDigitalPulseFillCount(mockWaveformData, fitWaveformViewport(mockWaveformData)));
    expect(scene.digitalPulseFillCount).toBeGreaterThan(0);
    expect(scene.stateCounts.xStateCount).toBeGreaterThan(0);
    expect(scene.stateCounts.zStateCount).toBeGreaterThan(0);
    expect(scene.renderStats.visibleRowCount).toBeGreaterThan(0);
    expect(scene.renderStats.culledRowCount).toBeGreaterThan(0);
    expect(scene.renderStats.renderedSignalCount).toBeGreaterThan(0);
    expect(scene.renderStats.renderedSignalCount).toBeLessThan(mockWaveformData.signals.length);
    expect(scene.renderStats.renderedSegmentCount).toBeGreaterThan(0);
    expect(scene.renderStats.drawnHorizontalSegmentCount).toBeGreaterThan(0);
    expect(scene.renderStats.collapsedSegmentCount).toBe(scene.renderStats.skippedHorizontalSegmentCount);
    expect(scene.renderStats.busFullHexagonCount).toBeGreaterThan(0);

    scene.world.destroy({ children: true });
  });

  it('records cache misses and hits for cacheable signal textures outside dense mode', () => {
    const cache = new Map<string, WaveformSignalTextureCacheEntry>();
    const signalTextureCache = {
      get: (key: string) => cache.get(key),
      set: (key: string, entry: WaveformSignalTextureCacheEntry) => cache.set(key, entry),
    };
    const textureRenderer = {
      generateTexture: () => Texture.EMPTY,
    };
    const baseOptions = {
      cursorTime: mockWaveformData.cursorTime,
      data: mockWaveformData,
      height: 420,
      selectedSignalId: null,
      signalTextureCache,
      textureRenderer,
      viewport: { startTime: 0, endTime: 80 },
      width: 900,
    };

    const firstScene = createWaveformScene(baseOptions);
    firstScene.world.destroy({ children: true });
    const secondScene = createWaveformScene(baseOptions);

    expect(firstScene.renderStats.cacheableSignalCount).toBeGreaterThan(0);
    expect(firstScene.renderStats.cacheMissCount).toBeGreaterThan(0);
    expect(firstScene.renderStats.cachedSignalCount).toBeGreaterThan(0);
    expect(secondScene.renderStats.cacheHitCount).toBeGreaterThan(0);

    secondScene.world.destroy({ children: true });
  });

  it('generates cache textures at the renderer resolution for crisp cached rows', () => {
    const cache = new Map<string, WaveformSignalTextureCacheEntry>();
    const signalTextureCache = {
      get: (key: string) => cache.get(key),
      set: (key: string, entry: WaveformSignalTextureCacheEntry) => cache.set(key, entry),
    };
    const generateTexture = vi.fn(() => Texture.EMPTY);
    const scene = createWaveformScene({
      cursorTime: mockWaveformData.cursorTime,
      data: mockWaveformData,
      height: 420,
      renderResolution: 2,
      selectedSignalId: null,
      signalTextureCache,
      textureRenderer: { generateTexture },
      viewport: { startTime: 0, endTime: 80 },
      width: 900,
    });

    expect(generateTexture).toHaveBeenCalledWith(expect.objectContaining({
      antialias: false,
      resolution: 2,
    }));

    scene.world.destroy({ children: true });
  });

  it('skips invisible digital segments while preserving visible special-state labels', () => {
    const viewport = fitWaveformViewport(mockWaveformData);
    const scene = createWaveformScene({
      cursorTime: mockWaveformData.cursorTime,
      data: mockWaveformData,
      height: getWaveformCanvasHeightForData(mockWaveformData),
      selectedSignalId: null,
      viewport,
      width: 360,
    });
    const stateLabels = collectText(scene.layers.content).filter((text) => text === 'x' || text === 'z');
    const shapeCounts = getWaveformShapeCounts(mockWaveformData, viewport);

    expect(scene.renderStats.skippedHorizontalSegmentCount).toBeGreaterThan(0);
    expect(scene.renderStats.collapsedSegmentCount).toBeGreaterThan(0);
    expect(scene.renderStats.suppressedLabelCount).toBeGreaterThan(0);
    expect(stateLabels.length).toBeLessThan(shapeCounts.xStateBlockCount + shapeCounts.zStateBlockCount);

    scene.world.destroy({ children: true });
  });

  it('reports full, fold-only, and vertical fallback bus drawing shapes', () => {
    const data: WaveformDataSet = {
      id: 'bus-shapes',
      title: 'bus-shapes',
      timescaleUnit: 'ns',
      duration: 1000,
      cursorTime: 0,
      groups: [{ id: 'g0', label: 'g0' }],
      signals: [
        {
          id: 'bus',
          groupId: 'g0',
          name: 'bus',
          path: 'g0.bus',
          kind: 'bus',
          color: '#8fd694',
          width: 8,
          transitions: [
            { time: 0, value: '0' },
            { time: 100, value: '1' },
            { time: 110, value: '2' },
            { time: 110.1, value: '3' },
            { time: 120, value: '4' },
            { time: 1000, value: '5' },
          ],
        },
      ],
    };
    const scene = createWaveformScene({
      cursorTime: 0,
      data,
      height: 120,
      renderResolution: 1,
      selectedSignalId: null,
      viewport: { startTime: 0, endTime: 1000 },
      width: 360,
    });

    expect(scene.renderStats.busFullHexagonCount).toBeGreaterThan(0);
    expect(scene.renderStats.busFoldOnlyCount).toBeGreaterThan(0);
    expect(scene.renderStats.busVerticalFallbackCount).toBeGreaterThan(0);
    expect(scene.renderStats.skippedHorizontalSegmentCount).toBe(scene.renderStats.busFoldOnlyCount + scene.renderStats.busVerticalFallbackCount);

    scene.world.destroy({ children: true });
  });

  it('draws a single X or Z text label per special-state block', () => {
    const viewport = fitWaveformViewport(mockWaveformData);
    const scene = createWaveformScene({
      cursorTime: mockWaveformData.cursorTime,
      data: mockWaveformData,
      height: getWaveformCanvasHeightForData(mockWaveformData),
      selectedSignalId: null,
      viewport,
      width: 900,
    });
    const stateLabels = collectText(scene.layers.content).filter((text) => text === 'x' || text === 'z');
    const xLabels = stateLabels.filter((text) => text === 'x');
    const zLabels = stateLabels.filter((text) => text === 'z');
    const shapeCounts = getWaveformShapeCounts(mockWaveformData, viewport);

    expect(xLabels.length).toBeGreaterThan(0);
    expect(zLabels.length).toBeGreaterThan(0);
    expect(xLabels.length).toBeLessThanOrEqual(shapeCounts.xStateBlockCount);
    expect(zLabels.length).toBeLessThanOrEqual(shapeCounts.zStateBlockCount);
    expect(stateLabels.every((text) => text.length === 1)).toBe(true);

    scene.world.destroy({ children: true });
  });

  it('keeps bus hexagon bevel consistent across normal-width bus segments', () => {
    expect(getWaveformBusHexagonBevel(32, 20)).toBe(getWaveformBusHexagonBevel(160, 20));
    expect(getWaveformBusHexagonBevel(160, 20)).toBe(getWaveformBusHexagonBevel(400, 20));
    expect(getWaveformBusHexagonBevel(5, 20)).toBeLessThan(getWaveformBusHexagonBevel(32, 20));
  });

  it('uses denser chevrons for Z hatches while preserving the X hatch spacing', () => {
    expect(waveformUnknownStripeSpacing).toBe(8);
    expect(waveformHighImpedanceStripeSpacing).toBe(6);
    expect(waveformHighImpedanceStripeSpacing).toBeLessThan(waveformUnknownStripeSpacing);
  });

  it('clips Z chevron strokes to the state rectangle without changing their slope', () => {
    const clipped = clipWaveformLineToBounds(10, 2, 17, 10, { bottom: 18, left: 1, right: 12, top: 2 });

    expect(clipped).not.toBeNull();
    expect(clipped?.x1).toBe(10);
    expect(clipped?.y1).toBe(2);
    expect(clipped?.x2).toBe(12);
    expect(clipped?.y2).toBeCloseTo(4.2857, 4);
  });

  it('updates cursor, selection, vertical scroll, and viewport in place without replacing the world', () => {
    const scene = createWaveformScene({
      cursorTime: mockWaveformData.cursorTime,
      data: mockWaveformData,
      height: 320,
      selectedSignalId: 'u_top_module1-counting',
      viewport: fitWaveformViewport(mockWaveformData),
      width: 900,
    });
    const originalWorld = scene.world;
    const originalBackgroundLayer = scene.layers.background;
    const initialVisibleRowCount = scene.renderStats.visibleRowCount;
    const initialContentChildren = [...scene.nodes.contentRows.children];
    const nextViewport = { startTime: 40, endTime: 140 };

    expect(scene.renderStats.rowAttachCount).toBeGreaterThan(0);

    updateWaveformSceneCursor(scene, 128);
    updateWaveformSceneSelection(scene, 'dense-signal-40');
    updateWaveformSceneVerticalScroll(scene, 330);
    const scrolledContentChildren = [...scene.nodes.contentRows.children];
    const verticalScrollRowStats = {
      rowAttachCount: scene.renderStats.rowAttachCount,
      rowReuseCount: scene.renderStats.rowReuseCount,
      rowRecycleCount: scene.renderStats.rowRecycleCount,
    };
    updateWaveformSceneViewport(scene, nextViewport);
    const viewportContentChildren = [...scene.nodes.contentRows.children];

    expect(scene.world).toBe(originalWorld);
    expect(scene.layers.background).toBe(originalBackgroundLayer);
    expect(scene.state.cursorTime).toBe(128);
    expect(scene.state.viewport).toEqual(nextViewport);
    expect(scene.selectedSignalLaneY).toBe(getWaveformSignalLaneY(mockWaveformData, 'dense-signal-40'));
    expect(scene.shapeCounts).toEqual(getWaveformShapeCounts(mockWaveformData, nextViewport));
    expect(scene.digitalPulseFillCount).toBe(getWaveformDigitalPulseFillCount(mockWaveformData, nextViewport));
    expect(scene.renderStats.visibleRowCount).not.toBe(initialVisibleRowCount);
    expect(verticalScrollRowStats.rowAttachCount).toBeGreaterThan(0);
    expect(verticalScrollRowStats.rowReuseCount).toBeGreaterThan(0);
    expect(verticalScrollRowStats.rowRecycleCount).toBeGreaterThan(0);
    expect(scene.renderStats.rowAttachCount).toBe(0);
    expect(scene.renderStats.rowReuseCount).toBeGreaterThan(0);
    expect(scene.renderStats.rowRecycleCount).toBe(0);
    expect(scrolledContentChildren.some((child) => initialContentChildren.includes(child))).toBe(true);
    expect(viewportContentChildren[0]).toBe(scrolledContentChildren[0]);
    expect(scene.nodes.statusCursor.children.length).toBeGreaterThan(0);
    expect(scene.nodes.operationCursor.children.length).toBeGreaterThan(0);
    expect(scene.nodes.statusHeader.children.length).toBeGreaterThan(0);
    expect(scene.nodes.backgroundLanes.children.length).toBeGreaterThan(0);
    expect(scene.nodes.contentRows.children.length).toBeGreaterThan(0);

    scene.world.destroy({ children: true });
  });

  it('reuses unchanged row content across viewport updates when a row signature stays stable', () => {
    const data: WaveformDataSet = {
      id: 'row-signature-data',
      title: 'row-signature',
      timescaleUnit: 'ns',
      duration: 200,
      cursorTime: 40,
      groups: [
        {
          id: 'g0',
          label: 'g0',
        },
      ],
      signals: [
        {
          id: 'static-low',
          groupId: 'g0',
          name: 'static_low',
          path: 'g0.static_low',
          kind: 'logic',
          color: '#38d8ff',
          transitions: [
            { time: 0, value: '0' },
          ],
        },
        {
          id: 'toggle',
          groupId: 'g0',
          name: 'toggle',
          path: 'g0.toggle',
          kind: 'logic',
          color: '#ff6b8a',
          transitions: [
            { time: 0, value: '0' },
            { time: 40, value: '1' },
            { time: 60, value: '0' },
            { time: 140, value: '1' },
          ],
        },
      ],
    };
    const scene = createWaveformScene({
      cursorTime: data.cursorTime,
      data,
      height: getWaveformCanvasHeightForData(data),
      selectedSignalId: null,
      viewport: { startTime: 60, endTime: 160 },
      width: 900,
    });
    const staticRowNode = scene.rowRegistry.activeRows.get('signal:static-low');
    const toggledRowNode = scene.rowRegistry.activeRows.get('signal:toggle');
    const staticContentBefore = staticRowNode?.contentContainer.children[0] ?? null;
    const toggledContentBefore = toggledRowNode?.contentContainer.children[0] ?? null;

    expect(staticContentBefore).not.toBeNull();
    expect(toggledContentBefore).not.toBeNull();

    updateWaveformSceneViewport(scene, { startTime: 80, endTime: 180 });

    const staticContentAfter = scene.rowRegistry.activeRows.get('signal:static-low')?.contentContainer.children[0] ?? null;
    const toggledContentAfter = scene.rowRegistry.activeRows.get('signal:toggle')?.contentContainer.children[0] ?? null;

    expect(staticContentAfter).toBe(staticContentBefore);
    expect(toggledContentAfter).not.toBe(toggledContentBefore);
    expect(scene.renderStats.rowContentSkipCount).toBe(1);
    expect(scene.renderStats.rowContentRedrawCount).toBe(1);

    scene.world.destroy({ children: true });
  });

  it('uses the horizontal buffer for same-span pan without redrawing row content', () => {
    const scene = createWaveformScene({
      cursorTime: mockWaveformData.cursorTime,
      data: mockWaveformData,
      height: 320,
      selectedSignalId: null,
      viewport: { startTime: 20, endTime: 120 },
      width: 900,
    });
    const originalContentChildren = [...scene.nodes.contentRows.children];
    const originalContentX = scene.nodes.contentRows.x;
    const nextViewport = { startTime: 30, endTime: 130 };

    expect(updateWaveformScenePan(scene, nextViewport)).toBe(true);

    expect(scene.state.viewport).toEqual(nextViewport);
    expect(scene.nodes.contentRows.children).toEqual(originalContentChildren);
    expect(scene.nodes.contentRows.x).not.toBe(originalContentX);
    expect(scene.nodes.backgroundGrid.x).toBe(scene.nodes.contentRows.x);
    expect(scene.nodes.statusHeader.x).toBe(scene.nodes.contentRows.x);
    expect(scene.renderStats.panBufferHitCount).toBe(1);
    expect(scene.renderStats.panBufferMissCount).toBe(0);
    expect(scene.renderStats.panPixelShiftCount).toBeGreaterThan(0);
    expect(scene.renderStats.rowContentRedrawCount).toBe(0);
    expect(scene.renderStats.rowContentSkipCount).toBeGreaterThan(0);

    scene.world.destroy({ children: true });
  });
});

function collectText(container: Container): string[] {
  const texts: string[] = [];

  for (const child of container.children) {
    if (child instanceof Text) {
      texts.push(String(child.text));
    }

    if (child instanceof Container) {
      texts.push(...collectText(child));
    }
  }

  return texts;
}
