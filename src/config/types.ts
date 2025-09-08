export interface Link {
  name: string;
  url: string;
  icon: string;
}

export interface Category {
  name: string;
  displayMode: 'icon' | 'list';
  links: Link[];
}

export interface Context {
  id: string;
  name: string;
  categories: Category[];
  // Optional new unified layout items; if present, takes precedence over categories during rendering
  items?: Array<
    | {
        type: 'category';
        id: string;
        // Reference by name to avoid duplicating links in config
        categoryName: string;
        colSpan?: number;
      }
    | {
        type: 'plugin';
        id: string; // instance id
        pluginId: string; // matches PluginManifest.id
        pluginConfig?: any; // instance-level config override
        colSpan?: number;
      }
  >;
}

export interface WidgetSettings {
  weather: {
    enabled: boolean;
    useCelsius: boolean;
  };
  clock: {
    enabled: boolean;
    showSeconds: boolean;
  };
  iframe: {
    enabled: boolean;
    url: string;
  };
  calendar: {
    enabled: boolean;
    icsUrl: string;
    source?: 'ics' | 'caldav';
    caldav?: {
      url: string;
      username: string;
      password: string;
      useProxy?: boolean;
    };
  };
}

export interface UserConfig {
  contexts: Context[];
  activeContext: string;
  theme: string;
  gridColumns: number;
  displayMode: 'icon' | 'list';
  showCategoryBorders: boolean;
  showSearchBar: boolean;
  widgets: WidgetSettings;
  // Optional plugin-specific configurations keyed by plugin id
  plugins?: Record<string, any> & {
    search?: { enabled: boolean; engine?: string };
  };
  user: string;
}

declare global {
  interface Window {
    mspConfig: UserConfig;
    onConfigChange: (newConfig: UserConfig) => Promise<void>;
  }
}

export interface ConfigStore {
  getConfig(): Promise<UserConfig>;
  saveConfig(config: UserConfig): Promise<void>;
  initialize(): Promise<void>;
} 
