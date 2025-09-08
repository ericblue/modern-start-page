import { useState } from 'react';
import { type UserConfig } from '../config/types';
import ThemeSwitcher from './ThemeSwitcher';
import ContextSwitcher from './ContextSwitcher';
import SettingsButton from './SettingsButton';
import { Icon } from './Icon';

interface NavigationProps {
  config: UserConfig;
  onConfigChange: (newConfig: UserConfig) => Promise<void>;
}

export default function Navigation({ config, onConfigChange }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleContextChange = async (contextId: string) => {
    const newConfig = { ...config, activeContext: contextId };
    try {
      await onConfigChange(newConfig);
    } catch (error) {
      console.error('Error updating context:', error);
    }
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden sm:flex fixed top-2 sm:top-4 right-2 sm:right-4 items-center space-x-1 sm:space-x-2 z-50">
        <ThemeSwitcher />
        <ContextSwitcher
          contexts={config.contexts}
          activeContext={config.activeContext}
          onContextChange={handleContextChange}
        />
        <button
          onClick={() => onConfigChange({ ...config, showSearchBar: !config.showSearchBar })}
          className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1 rounded bg-secondary-700/50 text-secondary-300 hover:bg-secondary-700 text-xs sm:text-sm"
        >
          <Icon name="Search" size={16} className="sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Suche</span>
        </button>
        <SettingsButton config={config} onConfigChange={onConfigChange} />
      </nav>

      {/* Mobile Hamburger Menu */}
      <nav className="sm:hidden fixed top-2 right-2 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="flex items-center justify-center w-10 h-10 rounded bg-secondary-700/50 text-secondary-300 hover:bg-secondary-700 transition-colors"
        >
          <Icon 
            name={isMobileMenuOpen ? "X" : "Menu"} 
            size={20} 
            className="w-5 h-5"
          />
        </button>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="absolute top-full right-0 mt-2 bg-secondary-800 border border-secondary-700 rounded-lg shadow-lg z-50 min-w-48">
            {/* Theme Switcher */}
            <div className="p-3 border-b border-secondary-700">
              <div className="text-xs text-secondary-400 mb-2">Design</div>
              <ThemeSwitcher />
            </div>

            {/* Context Switcher */}
            <div className="p-3 border-b border-secondary-700">
              <div className="text-xs text-secondary-400 mb-2">Kontext</div>
              <ContextSwitcher
                contexts={config.contexts}
                activeContext={config.activeContext}
                onContextChange={handleContextChange}
              />
            </div>

            {/* Search Toggle */}
            <div className="p-3 border-b border-secondary-700">
              <button
                onClick={() => {
                  onConfigChange({ ...config, showSearchBar: !config.showSearchBar });
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left px-3 py-2 rounded transition-colors duration-200 text-secondary-300 hover:bg-secondary-700"
              >
                <Icon name="Search" size={16} />
                <span>Suche umschalten</span>
              </button>
            </div>

            {/* Settings */}
            <div className="p-3">
              <div className="text-xs text-secondary-400 mb-2">Einstellungen</div>
              <SettingsButton config={config} onConfigChange={onConfigChange} />
            </div>
          </div>
        )}
      </nav>

      {/* Click outside to close mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 sm:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
} 