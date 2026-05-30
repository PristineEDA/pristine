import rawMockWaveformData from './waveformMockData.json';

import { parseWaveformDataJson } from './waveformDataLoader';
import type { WaveformDataSet } from './waveformTypes';

export const mockWaveformData: WaveformDataSet = parseWaveformDataJson(rawMockWaveformData);
