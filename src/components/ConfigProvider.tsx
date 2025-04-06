import { useState, useEffect, createContext, useContext } from 'react';
import type { UserConfig } from '../config/types';
import Navigation from './Navigation';
import Search from './Search';
import ContextManager from './ContextManager';
import DateGreeting from './DateGreeting';
import SystemStatus from './SystemStatus';
import { Weather } from './Weather';
import { Clock } from './Clock';

interface ConfigProviderProps {
  initialConfig: UserConfig;
}

export const ConfigContext = createContext<{
  config: UserConfig;
  onConfigChange: (newConfig: UserConfig) => Promise<void>;
}>({
  config: {} as UserConfig,
  onConfigChange: async () => {},
});

export default function ConfigProvider({ initialConfig }: ConfigProviderProps) {
  const [config, setConfig] = useState<UserConfig>(initialConfig);

  const handleConfigChange = async (newConfig: UserConfig) => {
    console.log('ConfigProvider: Starting config change with:', newConfig);
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
    <ConfigContext.Provider value={{ config, onConfigChange: handleConfigChange }}>
      <Navigation config={config} onConfigChange={handleConfigChange} />
      <div className="mt-8">
        <DateGreeting />
        <div className="mt-4">
          <SystemStatus />
        </div>
      </div>
      <div className="mt-8">
        <Search />
      </div>
      <div className="mt-8">
        <div className="grid grid-cols-3 gap-4">
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
          <div>
            {/* Placeholder for future widget */}
          </div>
        </div>
      </div>
      <div className="mt-12">
        <ContextManager initialConfig={config} />
      </div>
    </ConfigContext.Provider>
  );
} 