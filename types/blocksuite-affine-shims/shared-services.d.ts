import type { Signal } from '@preact/signals-core';
import type { Subscription } from 'rxjs';
import type { DocMode } from './model';
import type { ExtensionType } from './store';

export interface DocModeProvider {
  setPrimaryMode: (mode: DocMode, docId: string) => void;
  getPrimaryMode: (docId: string) => DocMode;
  togglePrimaryMode: (docId: string) => DocMode;
  onPrimaryModeChange: (handler: (mode: DocMode) => void, docId: string) => Subscription;
  setEditorMode: (mode: DocMode) => void;
  getEditorMode: () => DocMode | null;
}

export class FeatureFlagService {
  setFlag: (key: string, value: boolean) => void;
  getFlag: (key: string) => boolean;
}

export const GeneralSettingSchema: {
  parse: (value: unknown) => Record<string, unknown>;
};

export function DocModeExtension(service: DocModeProvider): ExtensionType;
export function EditorSettingExtension(service: { setting$: Signal<Record<string, unknown>> }): ExtensionType;
export function FontConfigExtension(fontConfig: unknown[]): ExtensionType;
export function ParseDocUrlExtension(service: {
  parseDocUrl: (url: string) => ({ docId: string } & Record<string, unknown>) | undefined;
}): ExtensionType;

export const ThemeExtensionIdentifier: unknown;

export const ThemeProvider: unknown;
