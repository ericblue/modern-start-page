import Search from '../../../components/Search';
import type { PluginManifest } from '../../types';
import type { UserConfig } from '../../../config/types';

type SearchConfig = {
  enabled: boolean;
  engine?: string;
};

function getSearchConfig(config: UserConfig): SearchConfig {
  const pluginCfg = (config.plugins?.search as any) as SearchConfig | undefined;
  return {
    enabled: pluginCfg?.enabled ?? Boolean(config.showSearchBar),
    engine: pluginCfg?.engine,
  };
}

export const searchPlugin: PluginManifest<SearchConfig> = {
  id: 'search',
  name: 'Search Bar',
  description: 'Global search bar with switchable engines.',
  area: 'top',
  size: {},
  isEnabled: (config) => getSearchConfig(config).enabled,
  getConfig: getSearchConfig,
  defaultConfig: { enabled: true, engine: 'google' },
  configSchema: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
      engine: { type: 'string', enum: ['google', 'duckduckgo', 'bing', 'youtube', 'github'], default: 'google' },
    },
  },
  Render: ({ config }) => {
    if (!getSearchConfig(config).enabled) return null;
    return <Search />;
  },
  Settings: ({ config, onConfigChange }) => {
    const pluginCfg = getSearchConfig(config);
    const update = async (patch: Partial<SearchConfig>) => {
      const next = {
        ...config,
        showSearchBar: patch.enabled !== undefined ? patch.enabled : config.showSearchBar,
        plugins: {
          ...(config.plugins || {}),
          search: {
            enabled: patch.enabled ?? pluginCfg.enabled,
            engine: patch.engine ?? pluginCfg.engine ?? 'google',
          },
        },
      } as UserConfig;
      await onConfigChange(next);
    };

    return (
      <div className="space-y-3 p-3 rounded-lg bg-secondary-800/50 border border-secondary-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-secondary-100">Search Bar</div>
            <div className="text-xs text-secondary-400">Toggle visibility and default engine</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={pluginCfg.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
            />
            <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-primary-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-secondary-300">Default engine</div>
          <select
            className="bg-secondary-900 text-secondary-100 text-xs rounded px-2 py-1 border border-secondary-700"
            value={pluginCfg.engine || 'google'}
            onChange={(e) => update({ engine: e.target.value })}
          >
            <option value="google">Google</option>
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="bing">Bing</option>
            <option value="youtube">YouTube</option>
            <option value="github">GitHub</option>
          </select>
        </div>
      </div>
    );
  },
};

export default searchPlugin;
