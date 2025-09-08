import type { PluginManifest } from './types';
import { calendarPlugin } from './widgets/calendar';
import { iframePlugin } from './widgets/iframe';
import { searchPlugin } from './widgets/search';
import { categoryPlugin } from './widgets/category';

export const plugins: PluginManifest[] = [
  searchPlugin,
  categoryPlugin,
  calendarPlugin,
  iframePlugin,
];

export type { PluginManifest } from './types';
