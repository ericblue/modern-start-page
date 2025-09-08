import React from 'react';
import { plugins } from '../plugins/registry';
import type { PluginArea } from '../plugins/types';
import type { UserConfig } from '../config/types';

export default function PluginHost({ area, config }: { area: PluginArea; config: UserConfig }) {
  const areaPlugins = plugins.filter((p) => p.area === area && p.isEnabled(config));
  if (areaPlugins.length === 0) return null;

  if (area === 'top') {
    return (
      <>
        {areaPlugins.map((p) => (
          <p.Render key={p.id} config={config} />
        ))}
      </>
    );
  }

  if (area === 'full') {
    return (
      <>
        {areaPlugins.map((p) => (
          <div key={p.id} className="mt-6 sm:mt-8 lg:mt-10 flex justify-center w-full">
            <div className="max-w-7xl w-full px-2 sm:px-4">
              <p.Render config={config} />
            </div>
          </div>
        ))}
      </>
    );
  }

  // grid area – not used yet
  return null;
}

