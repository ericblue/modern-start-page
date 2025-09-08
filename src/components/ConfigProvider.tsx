import { useState, useEffect, createContext, useContext } from 'react';
import type { UserConfig } from '../config/types';
import Navigation from './Navigation';
import Search from './Search';
import ContextManager from './ContextManager';
import DateGreeting from './DateGreeting';
import SystemStatus from './SystemStatus';
import { Weather } from './Weather';
import { Clock } from './Clock';
import PluginHost from './PluginHost';

interface ConfigProviderProps {
  initialConfig: UserConfig;
  user?: string;
}

export const ConfigContext = createContext<{
  config: UserConfig;
  user: string;
  onConfigChange: (newConfig: UserConfig) => Promise<void>;
}>({
  config: {} as UserConfig,
  user: "" as string,
  onConfigChange: async () => {},
});

export default function ConfigProvider({ initialConfig, user = '' }: ConfigProviderProps) {
  const [config, setConfig] = useState<UserConfig>(initialConfig);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle search bar with Ctrl/Cmd + Shift + S
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleConfigChange({ ...config, showSearchBar: !config.showSearchBar });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config]);

  const handleConfigChange = async (newConfig: UserConfig) => {
    console.log('ConfigProvider: Starting config change with:', newConfig);
    newConfig.user = user;
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        throw new Error('Failed to save config');
      }

      console.log('ConfigProvider: Config saved successfully');
      setConfig(newConfig);
      window.mspConfig = newConfig;
      window.dispatchEvent(new CustomEvent('msp-config-change', { detail: newConfig }));
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration. Please try again.');
    }
  };

  return (
    <ConfigContext.Provider value={{ config, user, onConfigChange: handleConfigChange }}>
      <Navigation config={config} onConfigChange={handleConfigChange} />
      <div className="mt-4 sm:mt-6 lg:mt-8">
        <DateGreeting />
        <div className="mt-2 sm:mt-4">
          <SystemStatus />
        </div>
      </div>
      {/* Top-area plugins (e.g., Search) */}
      <div className="mt-4 sm:mt-6 lg:mt-8">
        <PluginHost area="top" config={config} />
      </div>
      <div className="mt-4 sm:mt-6 lg:mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {config.widgets?.weather?.enabled && (
            <div>
              <Weather />
            </div>
          )}
          {config.widgets?.clock?.enabled && (
            <div>
              <Clock />
            </div>
          )}
        </div>
      </div>
      <div className="mt-8 sm:mt-10 lg:mt-12">
        <ContextManager initialConfig={config} />
      </div>
      {/* Full-width plugins are now rendered via Context items in the grid */}
    </ConfigContext.Provider>
  );
} 
