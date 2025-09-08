import { useState, useMemo, useEffect, memo } from 'react';
import type { Context, UserConfig, Link } from '../config/types';
import { plugins } from '../plugins/registry';
import { Icon } from './Icon';

interface ContextManagerProps {
  initialConfig: UserConfig;
}

const LinkCard = memo(({ link }: { link: Link }) => {
  return (
    <a
      href={link.url.startsWith('http') ? link.url : `http://${link.url}`}
      className="flex items-center space-x-2 p-2 sm:p-3 text-secondary-300 hover:text-primary-400 transition-colors duration-200 group rounded-md hover:bg-secondary-700/20 min-w-0"
      target="_blank"
      rel="noopener noreferrer"
    >
      <Icon name={link.icon} size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
      <span className="text-sm sm:text-base truncate break-words max-w-full">
        {link.name}
      </span>
    </a>
  );
});

const CategorySection = memo(({ category, showBorders }: { category: any, showBorders: boolean }) => {
  return (
    <div className={`h-full bg-secondary-200/90 rounded-lg p-4 sm:p-6 ${showBorders ? 'border border-secondary-200' : ''} flex flex-col overflow-hidden`}>
      <h2 className="text-lg sm:text-xl font-semibold text-secondary-200 mb-4 sm:mb-6 break-words">
        {category.name}
      </h2>
      <div className="space-y-1 sm:space-y-2">
        {category.links.map((link: Link) => (
          <LinkCard key={link.name} link={link} />
        ))}
      </div>
    </div>
  );
});

export default function ContextManager({ initialConfig }: ContextManagerProps) {
  const [config, setConfig] = useState<UserConfig>(initialConfig);
  const [activeContext, setActiveContext] = useState(initialConfig.activeContext);
  
  useEffect(() => {
    const handleConfigChange = (event: CustomEvent<UserConfig>) => {
      setConfig(event.detail);
      setActiveContext(event.detail.activeContext);
    };

    window.addEventListener('msp-config-change', handleConfigChange as EventListener);
    return () => {
      window.removeEventListener('msp-config-change', handleConfigChange as EventListener);
    };
  }, []);

  const currentContext = useMemo(() =>
    config.contexts.find(c => c.id === activeContext) || config.contexts[0],
    [config.contexts, activeContext]
  );

  if (!currentContext?.categories) {
    console.warn('No categories found in current context');
    return null;
  }

  // Respect configured grid columns
  const gridColumns = Math.max(1, Number(config.gridColumns || 3));

  // If new items array exists, render a unified grid of items (categories + plugin instances)
  if (Array.isArray((currentContext as any).items) && (currentContext as any).items.length) {
    const items = (currentContext as any).items as Array<any>;
    return (
      <div className="flex justify-center w-full">
        <div
          className="grid items-stretch gap-4 sm:gap-6 max-w-7xl w-full px-2 sm:px-4"
          style={{
            gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
            display: 'grid',
          }}
        >
          {items.map((item) => {
            if (item.type === 'category' && item.category) {
              const style: React.CSSProperties = {};
              if (item.colSpan && item.colSpan > 1) {
                const span = Math.min(item.colSpan, gridColumns);
                style.gridColumn = `span ${span} / span ${span}` as any;
              }
              return (
                <div key={item.id} style={style} className="h-full">
                  <CategorySection
                    category={item.category}
                    showBorders={config.showCategoryBorders}
                  />
                </div>
              );
            }
            if (item.type === 'category' && (item as any).categoryName) {
              const cat = (currentContext.categories || []).find((c: any) => c.name === (item as any).categoryName);
              if (!cat) return null;
              const style: React.CSSProperties = {};
              if ((item as any).colSpan && (item as any).colSpan > 1) {
                const span = Math.min((item as any).colSpan, gridColumns);
                style.gridColumn = `span ${span} / span ${span}` as any;
              }
              return (
                <div key={item.id} style={style} className="h-full">
                  <CategorySection category={cat} showBorders={config.showCategoryBorders} />
                </div>
              );
            }
            if (item.type === 'plugin' && item.pluginId) {
              const p = plugins.find((x) => x.id === item.pluginId);
              if (!p) return null;
              // Only render if plugin is globally enabled or has its own isEnabled true
              if (!p.isEnabled(config)) return null;
              const style: React.CSSProperties = {};
              if (p.area === 'full') {
                style.gridColumn = '1 / -1';
              } else if (item.colSpan && item.colSpan > 1) {
                const span = Math.min(item.colSpan, gridColumns);
                style.gridColumn = `span ${span} / span ${span}` as any;
              }
              return (
                <div key={item.id} className="min-w-0 h-full" style={style}>
                  <p.Render config={config} instanceConfig={item.pluginConfig} />
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  // Fallback to legacy categories rendering
  return (
    <div className="flex justify-center w-full">
      <div
        className="grid items-stretch gap-4 sm:gap-6 category-grid max-w-7xl w-full px-2 sm:px-4"
        style={{
          gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
          display: 'grid',
        }}
      >
        {currentContext.categories.map((category) => (
          <div key={category.name} className="h-full">
            <CategorySection
              category={category}
              showBorders={config.showCategoryBorders}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
