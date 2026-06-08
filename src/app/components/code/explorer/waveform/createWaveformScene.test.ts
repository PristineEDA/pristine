import { describe, expect, it } from 'vitest';
import { BitmapText, Container, Text } from 'pixi.js';

import { clipWaveformLineToBounds, createWaveformScene, getWaveformBusHexagonBevel, getWaveformBusLabelBounds, getWaveformBusSpecialStateHexDigitWidth, getWaveformDigitalSegmentStrokeWidth, getWaveformDigitalSpecialStateBounds, getWaveformFittedBusLabelText, updateWaveformSceneCursor, updateWaveformScenePan, updateWaveformSceneSelection, updateWaveformSceneVerticalScroll, updateWaveformSceneViewport, waveformHighImpedanceStripeSpacing, waveformLayerNames, waveformUnknownStripeSpacing } from './createWaveformScene';
import { fitWaveformViewport, getInitialWaveformViewport, getWaveformCanvasHeightForData, getWaveformDigitalPulseFillCount, getWaveformDisplayRows, getWaveformRulerScrollIndicatorMetrics, getWaveformShapeCounts, getWaveformSignalLaneY, timeToX, waveformHeaderHeight } from './waveformLayout';
import { createWaveformBinaryFrameFromDataset, parseWaveformBinaryFrame, WaveformBinaryValueKind, waveformBinaryFrameVersionV2, type WaveformBinaryFrameSegmentInput } from './waveformBinaryFrame';
import { createWaveformFixtureFrame, waveformFixtureData, waveformTransitionFixtureData as mockWaveformData } from './waveformTestFixtures';
import type { WaveformDataSet, WaveformViewport } from './waveformTypes';

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
    expect(scene.layers.status.children.some((child) => child instanceof Container && child.label === 'waveform-header-background')).toBe(true);
    expect(scene.layers.status.children.some((child) => child instanceof Container && child.label === 'waveform-header-overlay')).toBe(true);
    expect(scene.layers.status.children.some((child) => child instanceof Container && child.label === 'waveform-ruler-scroll-indicator')).toBe(true);
    expect(scene.layers.status.children.indexOf(scene.nodes.statusHeaderBackground)).toBeLessThan(scene.layers.status.children.indexOf(scene.nodes.statusRulerIndicator));
    expect(scene.layers.status.children.indexOf(scene.nodes.statusRulerIndicator)).toBeLessThan(scene.layers.status.children.indexOf(scene.nodes.statusHeader));
    expect(scene.nodes.statusHeaderBackground.children.length).toBe(1);
    expect(scene.nodes.statusRulerIndicator.children.length).toBe(1);
    expect(getWaveformRulerScrollIndicatorMetrics(scene.state.viewport, scene.state.data.duration, scene.state.width).cornerRadius).toBe(3);
    expect(getWaveformRulerScrollIndicatorMetrics(scene.state.viewport, scene.state.data.duration, scene.state.width).height).toBe(22);
    expect(waveformHeaderHeight).toBe(22);
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
    expect(scene.renderStats.renderedSignalCount).toBe(0);
    expect(scene.renderStats.renderedSegmentCount).toBe(0);
    expect(scene.renderStats.drawnHorizontalSegmentCount).toBe(0);
    expect(scene.renderStats.collapsedSegmentCount).toBe(scene.renderStats.skippedHorizontalSegmentCount);
    expect(scene.renderStats.busFullHexagonCount).toBe(0);

    scene.world.destroy({ children: true });
  });

  it('does not render legacy signal content before a binary frame is available', () => {
    const scene = createWaveformScene({
      cursorTime: mockWaveformData.cursorTime,
      data: mockWaveformData,
      height: 420,
      selectedSignalId: null,
      viewport: { startTime: 0, endTime: 80 },
      width: 900,
    });

    expect(scene.renderStats.renderedSignalCount).toBe(0);
    expect(scene.renderStats.renderedSegmentCount).toBe(0);
    expect(scene.nodes.contentBatch.visible).toBe(false);
    expect(scene.nodes.contentRows.visible).toBe(true);

    scene.world.destroy({ children: true });
  });

  it('skips invisible digital segments while preserving visible special-state labels', () => {
    const data: WaveformDataSet = {
      id: 'digital-zero-width-fixture',
      title: 'digital-zero-width-fixture',
      timescaleUnit: 'ns',
      duration: 1000,
      cursorTime: 0,
      groups: [{ id: 'g0', label: 'g0' }],
      signals: [
        {
          id: 'logic',
          groupId: 'g0',
          name: 'logic',
          path: 'g0.logic',
          kind: 'logic',
          color: '#38d8ff',
          transitions: [
            { time: 0, value: 'x' },
            { time: 100, value: 'z' },
            { time: 200, value: '0' },
            { time: 200.1, value: '1' },
            { time: 200.2, value: '0' },
            { time: 200.3, value: '1' },
            { time: 300, value: 'x' },
            { time: 340, value: '0' },
          ],
        },
      ],
    };
    const viewport = { startTime: 0, endTime: data.duration };
    const frame = createBinaryFrameFromTransitions(data, viewport, 100);
    const scene = createWaveformScene({
      cursorTime: data.cursorTime,
      data,
      frame,
      height: getWaveformCanvasHeightForData(data),
      selectedSignalId: null,
      viewport,
      width: 100,
    });
    const stateLabels = collectText(scene.layers.content).filter((text) => text === 'x' || text === 'z');
    const shapeCounts = getWaveformShapeCounts(data, viewport);

    expect(scene.renderStats.skippedHorizontalSegmentCount).toBeGreaterThan(0);
    expect(scene.renderStats.collapsedSegmentCount).toBeGreaterThan(0);
    expect(scene.renderStats.suppressedLabelCount).toBeGreaterThan(0);
    expect(stateLabels.length).toBeLessThan(shapeCounts.xStateBlockCount + shapeCounts.zStateBlockCount);

    scene.world.destroy({ children: true });
  });

  it('renders viewport-ready binary waveform frames from typed arrays', () => {
    const viewport = getInitialWaveformViewport(waveformFixtureData);
    const frame = parseWaveformBinaryFrame(createWaveformFixtureFrame(viewport, 900));
    const scene = createWaveformScene({
      cursorTime: waveformFixtureData.cursorTime,
      data: waveformFixtureData,
      frame,
      height: 320,
      selectedSignalId: 'u_top_module1-counting',
      viewport,
      width: 900,
    });

    expect(frame.signalTable.buffer).toBe(frame.x0.buffer);
    expect(frame.segmentCount).toBeGreaterThan(0);
    expect(scene.renderStats.renderedSegmentCount).toBeGreaterThan(0);
    expect(scene.renderStats.drawnHorizontalSegmentCount).toBeGreaterThan(0);
    expect(scene.renderStats.busSpecialStateHexagonCount).toBeGreaterThan(0);
    expect(scene.renderStats.busSpecialStateLabelCount).toBeGreaterThan(0);
    expect(scene.renderStats.gpuBufferUpdateCount).toBeGreaterThan(0);
    expect(scene.renderStats.gpuLayerCount).toBeGreaterThan(0);
    expect(scene.renderStats.gpuDrawLayerCount).toBeLessThanOrEqual(8);
    expect(scene.renderStats.gpuLayerCount).toBeLessThanOrEqual(8);
    expect(scene.renderStats.gpuVertexCount).toBeGreaterThan(0);
    expect(scene.renderStats.meshVertexCount).toBe(scene.renderStats.gpuVertexCount);
    expect(scene.nodes.contentRows.visible).toBe(false);
    expect(scene.nodes.contentBatch.visible).toBe(true);
    expect(scene.state.frame).toBe(frame);
    expect(scene.state.viewport).toEqual({ startTime: 0, endTime: waveformFixtureData.duration });
    expect(scene.state.horizontalBuffer.viewport.startTime).toBe(0);

    const headerLabels = collectText(scene.nodes.statusHeader);
    expect(headerLabels).toContain(`0${waveformFixtureData.timescaleUnit}`);
    expect(headerLabels.some((label) => label.startsWith('-'))).toBe(false);

    expect(updateWaveformScenePan(scene, { startTime: waveformFixtureData.duration + 50, endTime: waveformFixtureData.duration + 150 })).toBe(false);
    expect(scene.renderStats.panBufferMissCount).toBe(1);
    expect(scene.nodes.contentRows.x).toBe(0);
    expect(scene.nodes.statusHeader.x).toBe(0);

    scene.world.destroy({ children: true });
  });

  it('pans inside a prepared binary frame without rewriting GPU buffers', () => {
    const preparedViewport = { startTime: 0, endTime: 200 };
    const viewport = { startTime: 40, endTime: 140 };
    const frame = parseWaveformBinaryFrame(createWaveformFixtureFrame(preparedViewport, 900));
    const scene = createWaveformScene({
      cursorTime: waveformFixtureData.cursorTime,
      data: waveformFixtureData,
      frame,
      height: 320,
      selectedSignalId: null,
      viewport,
      width: 900,
    });
    const initialGpuUpdateCount = scene.renderStats.gpuBufferUpdateCount;
    const initialGpuVertexCount = scene.renderStats.gpuVertexCount;
    const firstSignalNode = scene.rowRegistry.activeRows.get('signal:u_top_module1-clk');
    const firstMeshContainer = firstSignalNode?.contentContainer.children[0] ?? null;

    expect(initialGpuUpdateCount).toBeGreaterThan(0);
    expect(initialGpuVertexCount).toBeGreaterThan(0);
    expect(scene.renderStats.gpuDrawLayerCount).toBeLessThanOrEqual(8);

    expect(updateWaveformScenePan(scene, { startTime: 50, endTime: 150 })).toBe(true);

    const nextSignalNode = scene.rowRegistry.activeRows.get('signal:u_top_module1-clk');
    const nextMeshContainer = nextSignalNode?.contentContainer.children[0] ?? null;

    expect(nextMeshContainer).toBe(firstMeshContainer);
    expect(scene.renderStats.panBufferHitCount).toBe(1);
    expect(scene.renderStats.panBufferMissCount).toBe(0);
    expect(scene.renderStats.gpuBufferUpdateCount).toBe(0);
    expect(scene.renderStats.gpuDrawLayerCount).toBeLessThanOrEqual(8);
    expect(scene.renderStats.gpuVertexCount).toBeGreaterThan(0);
    expect(scene.renderStats.meshVertexCount).toBe(scene.renderStats.gpuVertexCount);

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
      frame: createBinaryFrameFromTransitions(data, { startTime: 0, endTime: 1000 }, 360),
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

  it('keeps single-bit X/Z text labels as single characters', () => {
    const data: WaveformDataSet = {
      id: 'single-bit-special-state-fixture',
      title: 'single-bit-special-state-fixture',
      timescaleUnit: 'ns',
      duration: 120,
      cursorTime: 0,
      groups: [{ id: 'g0', label: 'g0' }],
      signals: [
        {
          id: 'logic',
          groupId: 'g0',
          name: 'logic',
          path: 'g0.logic',
          kind: 'logic',
          color: '#38d8ff',
          transitions: [
            { time: 0, value: 'x' },
            { time: 40, value: 'z' },
            { time: 80, value: '0' },
            { time: 120, value: '1' },
          ],
        },
      ],
    };
    const viewport = { startTime: 0, endTime: data.duration };
    const scene = createWaveformScene({
      cursorTime: data.cursorTime,
      data,
      frame: createBinaryFrameFromTransitions(data, viewport, 900),
      height: getWaveformCanvasHeightForData(data),
      selectedSignalId: null,
      viewport,
      width: 900,
    });
    const stateLabels = collectText(scene.layers.content).filter((text) => text === 'x' || text === 'z');
    const xLabels = stateLabels.filter((text) => text === 'x');
    const zLabels = stateLabels.filter((text) => text === 'z');
    const shapeCounts = getWaveformShapeCounts(data, viewport);

    expect(xLabels.length).toBeGreaterThan(0);
    expect(zLabels.length).toBeGreaterThan(0);
    expect(xLabels.length).toBeLessThanOrEqual(shapeCounts.xStateBlockCount);
    expect(zLabels.length).toBeLessThanOrEqual(shapeCounts.zStateBlockCount);
    expect(stateLabels.every((text) => text.length === 1)).toBe(true);

    scene.world.destroy({ children: true });
  });

  it('draws multi-bit X/Z labels aligned to hexadecimal digit width', () => {
    const cases = [
      { expectedX: 'x', expectedZ: 'z', signalWidth: 4 },
      { expectedX: 'xx', expectedZ: 'zz', signalWidth: 8 },
      { expectedX: 'xxxx', expectedZ: 'zzzz', signalWidth: 16 },
    ];

    for (const { expectedX, expectedZ, signalWidth } of cases) {
      const data = createBusSpecialStateDataSet(signalWidth);
      const viewport = { startTime: 0, endTime: 120 };
      const scene = createWaveformScene({
        cursorTime: 0,
        data,
        frame: createBinaryFrameFromTransitions(data, viewport, 900),
        height: 120,
        selectedSignalId: null,
        viewport,
        width: 900,
      });
      const labels = collectText(scene.layers.content);

      expect(labels).toContain(expectedX);
      expect(labels).toContain(expectedZ);
      expect(scene.renderStats.busSpecialStateHexagonCount).toBeGreaterThanOrEqual(2);
      expect(scene.renderStats.busSpecialStateLabelCount).toBeGreaterThanOrEqual(2);
      expect(scene.renderStats.busSpecialStateWidthAlignedLabelCount).toBeGreaterThanOrEqual(2);
      expect(scene.renderStats.busFullHexagonCount).toBeGreaterThanOrEqual(scene.renderStats.busSpecialStateHexagonCount);

      scene.world.destroy({ children: true });
    }
  });

  it('truncates bus value and X/Z labels with trailing dots when hexagons shrink', () => {
    const data = createBusSpecialStateDataSet(8, 6);
    const viewport = { startTime: 0, endTime: 520 };
    const scene = createWaveformScene({
      cursorTime: 0,
      data,
      frame: createBinaryFrameFromTransitions(data, viewport, 220),
      height: 120,
      selectedSignalId: null,
      viewport,
      width: 220,
    });
    const labels = collectText(scene.layers.content);

    expect(labels.some((label) => label.includes('.'))).toBe(true);
    expect(scene.renderStats.busTruncatedLabelCount).toBeGreaterThan(0);
    expect(scene.renderStats.busLabelDotReplacementCount).toBeGreaterThan(0);
    expect(scene.renderStats.busSpecialStateLabelCount).toBeGreaterThan(0);

    scene.world.destroy({ children: true });
  });

  it('computes bus X/Z label width from hexadecimal digits', () => {
    expect(getWaveformBusSpecialStateHexDigitWidth(undefined)).toBe(1);
    expect(getWaveformBusSpecialStateHexDigitWidth(1)).toBe(1);
    expect(getWaveformBusSpecialStateHexDigitWidth(4)).toBe(1);
    expect(getWaveformBusSpecialStateHexDigitWidth(5)).toBe(2);
    expect(getWaveformBusSpecialStateHexDigitWidth(8)).toBe(2);
    expect(getWaveformBusSpecialStateHexDigitWidth(16)).toBe(4);
  });

  it('aligns bus labels to the full hexagon top horizontal segment', () => {
    const bounds = getWaveformBusLabelBounds(10, 160, 20);
    const bevel = getWaveformBusHexagonBevel(160, 20);

    expect(bounds.left).toBe(10 + bevel);
    expect(bounds.right).toBe(10 + 160 - bevel);
    expect(bounds.width).toBe(160 - bevel * 2);
  });

  it('fits bus labels by greedily replacing trailing characters with dots', () => {
    const fullText = getWaveformFittedBusLabelText('abcd', 24, 10);
    const oneReplacement = getWaveformFittedBusLabelText('abcd', 23, 10);
    const twoReplacements = getWaveformFittedBusLabelText('abcd', 20, 10);
    const tooNarrow = getWaveformFittedBusLabelText('abcd', 2, 10);

    expect(fullText).toEqual({
      fits: true,
      replacementCount: 0,
      text: 'abcd',
      truncated: false,
    });
    expect(oneReplacement).toEqual({
      fits: true,
      replacementCount: 1,
      text: 'abc.',
      truncated: true,
    });
    expect(twoReplacements).toEqual({
      fits: true,
      replacementCount: 2,
      text: 'ab..',
      truncated: true,
    });
    expect(tooNarrow.fits).toBe(false);
    expect(tooNarrow.text).toBe('');
  });

  it('uses the normal digital segment stroke width for single-bit X/Z blocks', () => {
    expect(getWaveformDigitalSegmentStrokeWidth('clock')).toBe(1.7);
    expect(getWaveformDigitalSegmentStrokeWidth('logic')).toBe(2);
  });

  it('aligns single-bit X/Z block bounds to normal digital high and low levels', () => {
    expect(getWaveformDigitalSpecialStateBounds(0)).toEqual({
      height: 16,
      y: 7,
    });
    expect(getWaveformDigitalSpecialStateBounds(42)).toEqual({
      height: 16,
      y: 49,
    });
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

  it('draws cursor marker at the true time position and hides it outside the viewport', () => {
    const viewport = { startTime: 40, endTime: 140 };
    const scene = createWaveformScene({
      cursorTime: 84,
      data: mockWaveformData,
      height: 320,
      selectedSignalId: null,
      viewport,
      width: 900,
    });
    const expectedX = Math.round(timeToX(84, viewport, 900)) + 0.5;

    expect(scene.nodes.statusCursor.children).toHaveLength(1);
    expect(scene.nodes.operationCursor.children).toHaveLength(2);
    expect(scene.nodes.statusCursor.children[0]?.label).toBe(`waveform-cursor-line-x-${expectedX.toFixed(2)}`);
    expect(scene.nodes.operationCursor.children.some((child) => child.label === 'waveform-cursor-badge')).toBe(true);

    updateWaveformSceneCursor(scene, 20);

    expect(scene.nodes.statusCursor.children).toHaveLength(0);
    expect(scene.nodes.operationCursor.children).toHaveLength(0);

    updateWaveformSceneCursor(scene, 128);
    const nextExpectedX = Math.round(timeToX(128, viewport, 900)) + 0.5;

    expect(scene.nodes.statusCursor.children).toHaveLength(1);
    expect(scene.nodes.operationCursor.children).toHaveLength(2);
    expect(scene.nodes.statusCursor.children[0]?.label).toBe(`waveform-cursor-line-x-${nextExpectedX.toFixed(2)}`);

    scene.world.destroy({ children: true });
  });

  it('keeps row containers stable across viewport updates before a binary frame arrives', () => {
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
    expect(staticRowNode?.contentMetrics.renderedSegmentCount ?? -1).toBe(0);
    expect(toggledRowNode?.contentMetrics.renderedSegmentCount ?? -1).toBe(0);

    updateWaveformSceneViewport(scene, { startTime: 80, endTime: 180 });

    const staticRowAfter = scene.rowRegistry.activeRows.get('signal:static-low');
    const toggledRowAfter = scene.rowRegistry.activeRows.get('signal:toggle');

    expect(staticRowAfter).toBe(staticRowNode);
    expect(toggledRowAfter).toBe(toggledRowNode);
    expect(staticRowAfter?.contentMetrics.renderedSegmentCount ?? -1).toBe(0);
    expect(toggledRowAfter?.contentMetrics.renderedSegmentCount ?? -1).toBe(0);
    expect(scene.renderStats.renderedSignalCount).toBe(0);
    expect(scene.renderStats.renderedSegmentCount).toBe(0);

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
    const originalRulerIndicatorChildren = [...scene.nodes.statusRulerIndicator.children];
    const nextViewport = { startTime: 30, endTime: 130 };

    expect(updateWaveformScenePan(scene, nextViewport)).toBe(true);

    const nextRulerIndicatorMetrics = getWaveformRulerScrollIndicatorMetrics(nextViewport, mockWaveformData.duration, 900);

    expect(scene.state.viewport).toEqual(nextViewport);
    expect(scene.nodes.contentRows.children).toEqual(originalContentChildren);
    expect(scene.nodes.contentRows.x).not.toBe(originalContentX);
    expect(scene.nodes.backgroundGrid.x).toBe(scene.nodes.contentRows.x);
    expect(scene.nodes.statusHeader.x).toBe(scene.nodes.contentRows.x);
    expect(scene.nodes.statusHeaderBackground.x).toBe(0);
    expect(scene.nodes.statusRulerIndicator.x).toBe(0);
    expect(scene.nodes.statusRulerIndicator.children).not.toEqual(originalRulerIndicatorChildren);
    expect(nextRulerIndicatorMetrics.left).toBeGreaterThan(0);
    expect(scene.renderStats.panBufferHitCount).toBe(1);
    expect(scene.renderStats.panBufferMissCount).toBe(0);
    expect(scene.renderStats.panPixelShiftCount).toBeGreaterThan(0);
    expect(scene.renderStats.gpuBufferUpdateCount).toBe(0);

    scene.world.destroy({ children: true });
  });
});

function createBusSpecialStateDataSet(width: number, segmentCount = 3): WaveformDataSet {
  const values = ['x', 'z', '0', '1'];
  const duration = segmentCount * 40;
  const transitions = Array.from({ length: segmentCount + 1 }, (_, index) => ({
    time: index * 40,
    value: values[index % values.length] ?? '0',
  }));

  return {
    id: 'bus-special-state-width-fixture',
    title: 'bus-special-state-width-fixture',
    timescaleUnit: 'ns',
    duration,
    cursorTime: 0,
    groups: [{ id: 'g0', label: 'g0' }],
    signals: [
      {
        id: 'bus-special',
        groupId: 'g0',
        name: 'bus_special',
        path: 'g0.bus_special',
        kind: 'bus',
        color: '#8fd694',
        width,
        transitions,
      },
    ],
  };
}

function createBinaryFrameFromTransitions(data: WaveformDataSet, viewport: WaveformViewport, width: number) {
  const rows = getWaveformDisplayRows(data).filter((row) => row.kind === 'signal');
  const segments: WaveformBinaryFrameSegmentInput[] = [];

  for (const row of rows) {
    const signal = row.signal;
    const transitions = signal.transitions ?? [];
    if (transitions.length === 0) {
      continue;
    }

    for (let index = 0; index < transitions.length; index += 1) {
      const transition = transitions[index];
      const nextTransition = transitions[index + 1];
      if (!transition) {
        continue;
      }

      const time0 = Math.max(transition.time, viewport.startTime);
      const time1 = Math.min(nextTransition?.time ?? data.duration, viewport.endTime);
      if (time1 <= time0) {
        continue;
      }

      const value = String(transition.value);
      segments.push({
        label: signal.kind === 'bus' && value !== 'x' && value !== 'z' ? value : null,
        laneY: row.y,
        signalIndex: row.signalIndex,
        time0,
        time1,
        valueKind: getBinaryValueKind(signal.kind, value),
        x0: timeToX(time0, viewport, width),
        x1: timeToX(time1, viewport, width),
      });
    }
  }

  return parseWaveformBinaryFrame(createWaveformBinaryFrameFromDataset(data, segments, {
    preparedRange: viewport,
    signalIndices: rows.map((row) => row.signalIndex),
    version: waveformBinaryFrameVersionV2,
    viewportRange: viewport,
  }));
}

function getBinaryValueKind(kind: WaveformDataSet['signals'][number]['kind'], value: string) {
  if (value === 'x') {
    return WaveformBinaryValueKind.Unknown;
  }

  if (value === 'z') {
    return WaveformBinaryValueKind.HighImpedance;
  }

  if (kind === 'bus') {
    return WaveformBinaryValueKind.Bus;
  }

  return value === '1' ? WaveformBinaryValueKind.High : WaveformBinaryValueKind.Low;
}

function collectText(container: Container): string[] {
  const texts: string[] = [];

  for (const child of container.children) {
    if (child instanceof Text || child instanceof BitmapText) {
      texts.push(String(child.text));
    }

    if (child instanceof Container) {
      texts.push(...collectText(child));
    }
  }

  return texts;
}
