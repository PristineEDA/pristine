export type ElectronGpuFeatureStatus = Record<string, string>;

export interface ElectronGpuInfo {
  auxAttributes?: Record<string, unknown>;
  gpuDevice?: Array<Record<string, unknown>>;
  machineModelName?: string;
  machineModelVersion?: string;
}

export interface ElectronGpuDiagnostics {
  hardwareAccelerationEnabled: boolean;
  featureStatus: ElectronGpuFeatureStatus;
  info: ElectronGpuInfo | null;
  infoError: string | null;
}

export interface RendererGpuSupportDiagnostics {
  webgpu: boolean;
  webgl2: boolean;
  webgl: boolean;
}