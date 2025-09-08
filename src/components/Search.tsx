import { useEffect, useState, useContext } from 'react';
import { ConfigContext } from './ConfigProvider';
import { Icon } from './Icon';

const searchEngines = {
  google: 'https://google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  bing: 'https://www.bing.com/search?q=',
  youtube: 'https://www.youtube.com/results?search_query=',
  github: 'https://github.com/search?q=',
};

type SearchEngine = keyof typeof searchEngines;

export default function Search() {
  const { config, onConfigChange } = useContext(ConfigContext);
  const [query, setQuery] = useState('');
  const [engine, setEngine] = useState<SearchEngine>('google');
  const [showTooltip, setShowTooltip] = useState(false);
  const [showEngineDropdown, setShowEngineDropdown] = useState(false);

  // Resolve plugin-based configuration with fallback to legacy
  const pluginCfg = (config.plugins?.search as any) || {};
  const enabled = typeof pluginCfg.enabled === 'boolean' ? pluginCfg.enabled : Boolean(config.showSearchBar);

  // Initialize engine from config.plugins.search if present
  useEffect(() => {
    const cfgEngine = (config.plugins?.search as any)?.engine as SearchEngine | undefined;
    if (cfgEngine && cfgEngine in searchEngines) {
      setEngine(cfgEngine);
    }
  }, [config.plugins?.search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const searchUrl = searchEngines[engine] + encodeURIComponent(query);
      window.open(searchUrl, '_blank');
    }
  };

  const handleClear = () => {
    setQuery('');
  };

  const handleEngineSelect = async (selectedEngine: SearchEngine) => {
    setEngine(selectedEngine);
    setShowEngineDropdown(false);
    // persist to plugin config
    try {
      const next = {
        ...config,
        plugins: {
          ...(config.plugins || {}),
          search: {
            enabled,
            engine: selectedEngine,
          },
        },
      };
      await onConfigChange(next);
    } catch (e) {
      // ignore persist errors in UI
    }
  };

  if (!enabled) return null;

  return (
    <div className="relative z-10 search-container">
      <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
        <div className="relative">
          <input
            type="text" autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Wonach suchst du?"
            className="w-full px-3 sm:px-4 py-2 sm:py-3 pl-10 sm:pl-12 pr-16 sm:pr-20 bg-secondary-800/50 rounded-lg border border-secondary-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 outline-none text-black placeholder-secondary-400 placeholder-italic text-sm sm:text-base"
          />
          <div 
            className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-secondary-400 cursor-help"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <Icon name="Search" size={16} className="sm:w-5 sm:h-5" />
            {showTooltip && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 sm:px-3 py-1 sm:py-2 bg-secondary-800 text-secondary-200 text-xs sm:text-sm rounded-lg shadow-lg whitespace-nowrap z-50">
                <span className="text-primary-400">⌘</span> + <span className="text-primary-400">⇧</span> + <span className="text-primary-400">S</span> zum Umschalten
              </div>
            )}
          </div>
        </div>
        
        {/* Clear button and search engine dropdown */}
        <div className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="text-secondary-400 hover:text-secondary-200 transition-colors text-sm sm:text-base p-1"
            >
              ✕
            </button>
          )}
          
          {/* Search engine dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEngineDropdown(!showEngineDropdown)}
              className="flex items-center space-x-1 px-2 py-1 rounded text-xs sm:text-sm text-secondary-300 hover:text-primary-400 hover:bg-secondary-700/50 transition-colors"
            >
              <span className="capitalize">{engine}</span>
              <Icon name="ChevronDown" size={12} className="sm:w-3 sm:h-3" />
            </button>
            
            {showEngineDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-secondary-800 border border-secondary-700 rounded-lg shadow-lg z-50 min-w-32">
                {Object.keys(searchEngines).map((eng) => (
                  <button
                    key={eng}
                    type="button"
                    onClick={() => handleEngineSelect(eng as SearchEngine)}
                    className={`w-full text-left px-3 py-2 text-xs sm:text-sm rounded transition-colors duration-200 ${
                      engine === eng
                        ? 'bg-primary-500/20 text-primary-400'
                        : 'text-secondary-300 hover:bg-secondary-700'
                    }`}
                  >
                    <span className="capitalize">{eng}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </form>
      
      {/* Click outside to close dropdown */}
      {showEngineDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowEngineDropdown(false)}
        />
      )}
    </div>
  );
} 
