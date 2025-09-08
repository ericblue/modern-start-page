import React, { useEffect, useState } from 'react';
import IframeWidget from '../../../components/Iframe';
import type { PluginManifest } from '../../types';

export const iframePlugin: PluginManifest = {
  id: 'iframe',
  name: 'Iframe',
  description: 'Embed any website via iframe.',
  area: 'full',
  size: { aspectRatio: '16:9' },
  isEnabled: (config) => Boolean(config.widgets?.iframe?.enabled),
  Render: ({ config }) => {
    if (!config.widgets?.iframe?.enabled) return null;
    return <IframeWidget />;
  },
  Settings: ({ config, onConfigChange }) => {
    const widgets = (config.widgets || {}) as any;
    const iframe = widgets.iframe || { enabled: false, url: '' };
    const [url, setUrl] = useState<string>(iframe.url || '');

    useEffect(() => {
      setUrl(iframe.url || '');
    }, [iframe.url]);
    const update = async (patch: Partial<{ enabled: boolean; url: string }>) => {
      const next = {
        ...config,
        widgets: {
          ...widgets,
          iframe: {
            ...iframe,
            ...patch,
          },
        },
      };
      await onConfigChange(next);
    };

    return (
      <div className="space-y-3 p-3 rounded-lg bg-secondary-800/50 border border-secondary-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-secondary-100">Iframe</div>
            <div className="text-xs text-secondary-400">Embed a web page via URL</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={iframe.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
            />
            <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-primary-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>

        {iframe.enabled && (
          <div className="space-y-2">
            <label className="text-xs text-secondary-300">URL</label>
            <input
              type="url"
              className="w-full px-3 py-2 bg-secondary-800 border border-secondary-700 rounded text-secondary-100 placeholder-secondary-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => update({ url })}
            />
          </div>
        )}
      </div>
    );
  },
};

export default iframePlugin;
