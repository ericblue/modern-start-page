import type { UserConfig } from '../config/types';

export type PluginArea = 'top' | 'grid' | 'full';

export interface PluginSize {
  // For grid placement; interpreted by host
  colSpan?: number; // 1..n
  rowSpan?: number; // 1..n
  // For full placement; hints only
  aspectRatio?: string; // e.g. '16:9'
}

export interface PluginManifest<TConfig = any> {
  id: string;
  name: string;
  description?: string;
  area: PluginArea;
  size?: PluginSize;
  // Return whether plugin should render for current config
  isEnabled: (config: UserConfig) => boolean;
  // Read plugin configuration from global config
  getConfig?: (config: UserConfig) => TConfig | undefined;
  // Provide default configuration for this plugin
  defaultConfig?: TConfig;
  // Optional JSON-like schema description (free-form)
  configSchema?: any;
  // React components
  Render: (props: { config: UserConfig; instanceConfig?: any }) => JSX.Element | null;
  Settings?: (props: { config: UserConfig; onConfigChange: (newConfig: UserConfig) => Promise<void> }) => JSX.Element | null;
}
