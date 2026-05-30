import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  DEFAULT_SCHEMATIC_ALIGNMENT_GUIDES_ENABLED,
  DEFAULT_SCHEMATIC_GRID_ENABLED,
  DEFAULT_SCHEMATIC_GRID_SIZE,
  DEFAULT_SCHEMATIC_SNAP_TO_GRID,
  SCHEMATIC_ALIGNMENT_GUIDES_ENABLED_CONFIG_KEY,
  SCHEMATIC_GRID_ENABLED_CONFIG_KEY,
  SCHEMATIC_GRID_SIZE_CONFIG_KEY,
  SCHEMATIC_SNAP_TO_GRID_CONFIG_KEY,
  parseSchematicAlignmentGuidesEnabled,
  parseSchematicGridEnabled,
  parseSchematicGridSize,
  parseSchematicSnapToGrid,
} from '../schematic/schematicSettings';

interface SchematicSettingsState {
  alignmentGuidesEnabled: boolean;
  gridEnabled: boolean;
  gridSize: number;
  snapToGrid: boolean;
}

interface SchematicSettingsContextValue extends SchematicSettingsState {
  setAlignmentGuidesEnabled: (enabled: boolean) => void;
  setGridEnabled: (enabled: boolean) => void;
  setGridSize: (gridSize: number) => void;
  setSnapToGrid: (enabled: boolean) => void;
}

type SchematicSettingDefinition<T> = {
  configKey: string;
  fallback: T;
  parseValue: (value: unknown) => T;
};

type SchematicSettingDefinitions = {
  [K in keyof SchematicSettingsState]: SchematicSettingDefinition<SchematicSettingsState[K]>;
};

const SCHEMATIC_SETTING_DEFINITIONS: SchematicSettingDefinitions = {
  alignmentGuidesEnabled: {
    configKey: SCHEMATIC_ALIGNMENT_GUIDES_ENABLED_CONFIG_KEY,
    fallback: DEFAULT_SCHEMATIC_ALIGNMENT_GUIDES_ENABLED,
    parseValue: parseSchematicAlignmentGuidesEnabled,
  },
  gridEnabled: {
    configKey: SCHEMATIC_GRID_ENABLED_CONFIG_KEY,
    fallback: DEFAULT_SCHEMATIC_GRID_ENABLED,
    parseValue: parseSchematicGridEnabled,
  },
  gridSize: {
    configKey: SCHEMATIC_GRID_SIZE_CONFIG_KEY,
    fallback: DEFAULT_SCHEMATIC_GRID_SIZE,
    parseValue: parseSchematicGridSize,
  },
  snapToGrid: {
    configKey: SCHEMATIC_SNAP_TO_GRID_CONFIG_KEY,
    fallback: DEFAULT_SCHEMATIC_SNAP_TO_GRID,
    parseValue: parseSchematicSnapToGrid,
  },
};

const SCHEMATIC_SETTING_KEYS_BY_CONFIG_KEY = new Map(
  (Object.entries(SCHEMATIC_SETTING_DEFINITIONS) as Array<[keyof SchematicSettingsState, SchematicSettingDefinition<unknown>]>)
    .map(([key, definition]) => [definition.configKey, key]),
);

const SchematicSettingsContext = createContext<SchematicSettingsContextValue | null>(null);

function readConfiguredSchematicSetting<T>(definition: SchematicSettingDefinition<T>): T {
  try {
    return definition.parseValue(window.electronAPI?.config.get(definition.configKey));
  } catch {
    return definition.fallback;
  }
}

function persistConfiguredSchematicSetting<T>(definition: SchematicSettingDefinition<T>, value: T) {
  try {
    void window.electronAPI?.config.set(definition.configKey, definition.parseValue(value));
  } catch {
    /* ignore */
  }
}

function getInitialSchematicSettingsState(): SchematicSettingsState {
  return {
    alignmentGuidesEnabled: readConfiguredSchematicSetting(SCHEMATIC_SETTING_DEFINITIONS.alignmentGuidesEnabled),
    gridEnabled: readConfiguredSchematicSetting(SCHEMATIC_SETTING_DEFINITIONS.gridEnabled),
    gridSize: readConfiguredSchematicSetting(SCHEMATIC_SETTING_DEFINITIONS.gridSize),
    snapToGrid: readConfiguredSchematicSetting(SCHEMATIC_SETTING_DEFINITIONS.snapToGrid),
  };
}

export function SchematicSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SchematicSettingsState>(getInitialSchematicSettingsState);

  const updateSetting = useCallback(function updateSetting<K extends keyof SchematicSettingsState>(
    key: K,
    value: SchematicSettingsState[K],
  ) {
    const definition = SCHEMATIC_SETTING_DEFINITIONS[key];
    const nextValue = definition.parseValue(value);

    setSettings((currentSettings) => {
      if (Object.is(currentSettings[key], nextValue)) {
        return currentSettings;
      }

      return {
        ...currentSettings,
        [key]: nextValue,
      } as SchematicSettingsState;
    });

    persistConfiguredSchematicSetting(definition, nextValue);
  }, []);

  const settingActions = useMemo(() => ({
    setAlignmentGuidesEnabled: (enabled: boolean) => updateSetting('alignmentGuidesEnabled', enabled),
    setGridEnabled: (enabled: boolean) => updateSetting('gridEnabled', enabled),
    setGridSize: (gridSize: number) => updateSetting('gridSize', gridSize),
    setSnapToGrid: (enabled: boolean) => updateSetting('snapToGrid', enabled),
  }), [updateSetting]);

  useEffect(() => {
    const dispose = window.electronAPI?.config.onDidChange?.((configKey, value) => {
      const settingKey = SCHEMATIC_SETTING_KEYS_BY_CONFIG_KEY.get(configKey);

      if (!settingKey) {
        return;
      }

      const definition = SCHEMATIC_SETTING_DEFINITIONS[settingKey];
      const nextValue = definition.parseValue(value) as SchematicSettingsState[typeof settingKey];

      setSettings((currentSettings) => {
        if (Object.is(currentSettings[settingKey], nextValue)) {
          return currentSettings;
        }

        return {
          ...currentSettings,
          [settingKey]: nextValue,
        } as SchematicSettingsState;
      });
    });

    return () => {
      dispose?.();
    };
  }, []);

  const value = useMemo<SchematicSettingsContextValue>(() => ({
    ...settings,
    ...settingActions,
  }), [settingActions, settings]);

  return (
    <SchematicSettingsContext.Provider value={value}>
      {children}
    </SchematicSettingsContext.Provider>
  );
}

export function useSchematicSettings(): SchematicSettingsContextValue {
  const ctx = useContext(SchematicSettingsContext);

  if (!ctx) {
    throw new Error('useSchematicSettings must be used within SchematicSettingsProvider');
  }

  return ctx;
}
