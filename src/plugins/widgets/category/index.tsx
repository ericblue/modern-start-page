import React from 'react';
import type { PluginManifest } from '../../types';
import type { Category } from '../../../config/types';

// Category plugin renders a links category passed via instanceConfig.category
export const categoryPlugin: PluginManifest<{ category: Category }> = {
  id: 'category',
  name: 'Category',
  description: 'Displays a list of links as a category tile.',
  area: 'grid',
  isEnabled: () => true,
  Render: ({ instanceConfig }) => {
    const cat = (instanceConfig?.category as Category) || { name: '', displayMode: 'icon', links: [] };
    return (
      <div className="bg-secondary-200/90 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold text-secondary-200 mb-4 sm:mb-6">{cat.name}</h2>
        <div className="space-y-1 sm:space-y-2">
          {cat.links.map((link) => (
            <a
              key={link.name}
              href={link.url.startsWith('http') ? link.url : `http://${link.url}`}
              className="flex items-center space-x-2 p-2 sm:p-3 text-secondary-300 hover:text-primary-400 transition-colors duration-200 group rounded-md hover:bg-secondary-700/20"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="text-sm sm:text-base truncate">{link.name}</span>
            </a>
          ))}
        </div>
      </div>
    );
  },
};

export default categoryPlugin;

