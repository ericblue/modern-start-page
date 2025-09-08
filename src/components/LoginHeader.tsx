import React from 'react';
import { ConfigContext } from './ConfigProvider';
import DateGreeting from './DateGreeting';
import SystemStatus from './SystemStatus';
import Search from './Search';
import type { UserConfig } from '../config/types';

// Minimal config to power the Search component on the login page
const minimalConfig: UserConfig = {
  contexts: [],
  activeContext: '',
  theme: 'light',
  gridColumns: 3,
  displayMode: 'list',
  showCategoryBorders: false,
  showSearchBar: true,
  user: '',
  widgets: {
    weather: { enabled: false, useCelsius: false },
    clock: { enabled: false, showSeconds: false },
    iframe: { enabled: false, url: '' },
    calendar: { enabled: false, icsUrl: '' },
  },
};

export default function LoginHeader() {
  const onConfigChange = async (_newConfig: UserConfig) => {
    // No-op on login screen
  };

  return (
    <ConfigContext.Provider value={{ config: minimalConfig, user: '', onConfigChange }}>
      <div className="mt-4 sm:mt-6 lg:mt-8">
        <DateGreeting />
        <div className="mt-2 sm:mt-4">
          <SystemStatus />
        </div>
      </div>
      <div className="mt-4 sm:mt-6 lg:mt-8">
        <Search />
      </div>
    </ConfigContext.Provider>
  );
}

