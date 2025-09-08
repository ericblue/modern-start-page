import { useState, useEffect } from 'react';
import { themes, type Theme } from '../data/themes';
import { Icon } from './Icon';

export default function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<Theme>(themes[0]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      const theme = themes.find(t => t.name === savedTheme);
      if (theme) {
        setCurrentTheme(theme);
        applyTheme(theme);
      }
    }
  }, []);

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    Object.entries(theme.colors.primary).forEach(([key, value]) => {
      root.style.setProperty(`--primary-${key}`, value);
    });
    Object.entries(theme.colors.secondary).forEach(([key, value]) => {
      root.style.setProperty(`--secondary-${key}`, value);
    });
    root.style.setProperty('--background', theme.colors.background);
    
    localStorage.setItem('theme', theme.name);
    setCurrentTheme(theme);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1 rounded bg-secondary-700/50 text-secondary-300 hover:bg-secondary-700 text-xs sm:text-sm"
      >
        <Icon name="Palette" size={16} className="sm:w-5 sm:h-5" />
        <span className="hidden xs:inline">{currentTheme.name}</span>
        <span className="xs:hidden">Theme</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-secondary-800 border border-secondary-700 rounded-lg p-2 w-40 sm:w-48 shadow-lg z-50">
          {themes.map((theme) => (
            <button
              key={theme.name}
              onClick={() => applyTheme(theme)}
              className={`w-full text-left px-2 sm:px-3 py-1 sm:py-2 rounded transition-colors duration-200 text-xs sm:text-sm ${
                currentTheme.name === theme.name
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'text-secondary-300 hover:bg-secondary-700'
              }`}
            >
              {theme.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 