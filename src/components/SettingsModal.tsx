import { useState, useRef, useEffect } from 'react';
import type { UserConfig, Context, Category, WidgetSettings } from '../config/types';
import { themes, type Theme } from '../data/themes';
import ContextEditModal from './ContextEditModal';
import BookmarkEditModal from './BookmarkEditModal';
import ThemeSelector from './ThemeSelector';
import GridLayoutSelector from './GridLayoutSelector';
import ConfirmDialog from './ConfirmDialog';
import Toast from './Toast';
import { Icon } from './Icon';
import { plugins } from '../plugins/registry';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Declare the window.onConfigChange type
declare global {
  interface Window {
    onConfigChange: (newConfig: UserConfig) => Promise<void>;
  }
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: UserConfig;
  onConfigChange: (newConfig: UserConfig) => Promise<void>;
}

type Tab = 'contexts' | 'layout' | 'category' | 'appearance' | 'plugins' | 'backup' | 'widgets' | 'about';

// Add this new component for sortable items
function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center justify-between p-3 bg-secondary-700/50 rounded-lg">
        <div className="flex items-center space-x-2">
          <div 
            className="cursor-grab active:cursor-grabbing flex-shrink-0"
            {...attributes}
            {...listeners}
          >
            <Icon name="GripVertical" size={16} className="text-secondary-400" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function SettingsModal({ isOpen, onClose, config, onConfigChange }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('contexts');
  const [editingContext, setEditingContext] = useState<Context | null>(null);
  const [editingBookmark, setEditingBookmark] = useState<Category | null>(null);
  const [selectedContextId, setSelectedContextId] = useState(config.activeContext);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isWarning: boolean;
    action: 'delete' | 'import' | null;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    isWarning: false,
    action: null,
    onConfirm: () => {},
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleLogout = () => {
    const redirectTo = window.location.pathname + window.location.search;
    window.location.href = `/api/logout?redirectTo=${encodeURIComponent(redirectTo)}`;
  };

  const handleConfigUpdate = async (newConfig: UserConfig) => {
    console.log('SettingsModal: Starting config update with:', newConfig);
    try {
      await onConfigChange(newConfig);
      console.log('SettingsModal: Config update successful');
      setToast({ message: 'Configuration updated successfully', type: 'success' });
    } catch (error) {
      console.error('Error updating config:', error);
      setToast({ message: 'Failed to update configuration', type: 'error' });
    }
  };

  const handleContextSave = async (context: Context) => {
    console.log('SettingsModal: Starting context save with:', context);
    const newConfig = { ...config };
    const index = newConfig.contexts.findIndex(c => c.id === context.id);
    if (index >= 0) {
      newConfig.contexts[index] = context;
    } else {
      newConfig.contexts.push(context);
    }
    try {
      await handleConfigUpdate(newConfig);
      setToast({ message: 'Context saved successfully', type: 'success' });
    } catch (error) {
      console.error('Error saving context:', error);
      setToast({ message: 'Failed to save context', type: 'error' });
    }
    setEditingContext(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = config.contexts.findIndex(context => context.id === active.id);
      const newIndex = config.contexts.findIndex(context => context.id === over.id);
      
      const newContexts = arrayMove(config.contexts, oldIndex, newIndex);
      const newConfig = { ...config, contexts: newContexts };
      handleConfigUpdate(newConfig);
    }
  };

  const handleContextEdit = (context: Context) => {
    console.log('Editing context:', context);
    setEditingContext(context);
  };

  const handleContextDelete = async (contextId: string) => {
    console.log('Deleting context:', contextId);
    const contextToDelete = config.contexts.find(c => c.id === contextId);
    if (!contextToDelete) return;

    // Prevent deletion if it's the last context
    if (config.contexts.length <= 1) {
      setConfirmDialog({ 
        isOpen: true, 
        title: "Cannot Delete Context",
        message: "You must have at least one context. Please create a new context before deleting this one.",
        isWarning: true,
        action: null,
        onConfirm: () => {},
      });
      return;
    }

    // Show confirmation dialog for deletion
    setConfirmDialog({ 
      isOpen: true, 
      title: "Delete Context",
      message: `Are you sure you want to delete the context "${contextToDelete.name}"? This action cannot be undone.`,
      isWarning: false,
      action: 'delete',
      onConfirm: async () => {
        const newConfig = {
          ...config,
          contexts: config.contexts.filter(c => c.id !== contextId)
        };
        
        if (newConfig.activeContext === contextId) {
          newConfig.activeContext = newConfig.contexts[0]?.id || '';
        }

        try {
          await onConfigChange(newConfig);
          setToast({ message: 'Context deleted successfully', type: 'success' });
        } catch (error) {
          console.error('Error deleting context:', error);
          setToast({ message: 'Failed to delete context', type: 'error' });
        }

        setConfirmDialog({
          isOpen: false,
          title: '',
          message: '',
          isWarning: false,
          action: null,
          onConfirm: () => {},
        });
      }
    });
  };

  const handleBookmarkSave = async (category: Category, contextId: string) => {
    console.log('SettingsModal: Starting bookmark save with:', { category, contextId });
    const newConfig = { ...config };
    const contextIndex = newConfig.contexts.findIndex(c => c.id === selectedContextId);
    
    if (contextIndex >= 0) {
      const context = newConfig.contexts[contextIndex];
      
      // If we're editing an existing category, find it by its original name
      const originalCategory = editingBookmark?.name ? 
        context.categories.find(c => c.name === editingBookmark.name) : null;
      
      if (originalCategory) {
        // Update existing category
        const categoryIndex = context.categories.findIndex(c => c.name === originalCategory.name);
        if (categoryIndex >= 0) {
          context.categories[categoryIndex] = category;
        }
      } else {
        // Add new category
        context.categories.push(category);
      }
      
      // Update the context in the config
      newConfig.contexts[contextIndex] = context;
      
      try {
        // Use server-side discovery when proxy is enabled
        {
          const cal0 = (calendar as any).caldav || { url: '', username: '', password: '', useProxy: false };
          if (cal0.useProxy) {
            const baseUrl0: string = cal0.url || '';
            if (!baseUrl0) {
              setDiscoverError('Enter a CalDAV base URL first');
              return;
            }
            const res0 = await fetch('/api/caldav', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'discover', url: baseUrl0, username: cal0.username, password: cal0.password }),
            });
            if (!res0.ok) throw new Error(`Discovery failed (${res0.status})`);
            const data0 = await res0.json();
            const items0 = (data0?.calendars as Array<{ href: string; name: string }>) || [];
            if (items0.length === 0) setDiscoverError('No calendar collections found');
            setDiscoveredCalendars(items0);
            if (items0.length) setSelectedDiscovered(items0[0].href);
            return;
          }
        }
        console.log('SettingsModal: Attempting to save config:', newConfig);
        await handleConfigUpdate(newConfig);
        setToast({ message: 'Bookmark updated successfully', type: 'success' });
      } catch (error) {
        console.error('Error updating bookmark:', error);
        setToast({ message: 'Failed to update bookmark', type: 'error' });
      }
    } else {
      console.error('Context not found for ID:', selectedContextId);
      setToast({ message: 'Context not found', type: 'error' });
    }
    
    setEditingBookmark(null);
  };

  const handleExportConfig = () => {
    const configString = JSON.stringify(config, null, 2);
    const blob = new Blob([configString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'msp-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    setConfirmDialog({ 
      isOpen: true, 
      title: "Import Configuration",
      message: "Importing a new configuration will override your current settings. Are you sure you want to continue?",
      isWarning: false,
      action: 'import',
      onConfirm: () => {
        fileInputRef.current?.click();
        setConfirmDialog({
          isOpen: false,
          title: '',
          message: '',
          isWarning: false,
          action: null,
          onConfirm: () => {},
        });
      }
    });
  };

  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedConfig = JSON.parse(e.target?.result as string);
        // Basic validation of the imported config
        if (
          importedConfig &&
          Array.isArray(importedConfig.contexts) &&
          typeof importedConfig.activeContext === 'string'
        ) {
          handleConfigUpdate(importedConfig);
          setToast({ message: 'Configuration imported successfully', type: 'success' });
        } else {
          setToast({ message: 'Invalid configuration file format', type: 'error' });
        }
      } catch (error) {
        setToast({ message: 'Error reading configuration file', type: 'error' });
      }
    };
    reader.readAsText(file);
    // Reset the file input
    event.target.value = '';
  };

  const handleThemeChange = (theme: Theme) => {
    // Apply theme colors to CSS variables
    const root = document.documentElement;
    Object.entries(theme.colors.primary).forEach(([key, value]) => {
      root.style.setProperty(`--primary-${key}`, value);
    });
    Object.entries(theme.colors.secondary).forEach(([key, value]) => {
      root.style.setProperty(`--secondary-${key}`, value);
    });
    root.style.setProperty('--background', theme.colors.background);
    
    // Update config
    handleConfigUpdate({ ...config, theme: theme.name });
  };

  const currentTheme = themes.find(t => t.name === config.theme) || themes[0];

  const handleDisplayModeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newConfig = {
      ...config,
      displayMode: e.target.value as 'icon' | 'list'
    };
    await handleConfigUpdate(newConfig);
  };

  const handleSearchBarToggle = async (enabled: boolean) => {
    console.log('Search bar toggle:', enabled);
    console.log('Current config:', config);
    const newConfig = {
      ...config,
      showSearchBar: enabled
    };
    console.log('New config:', newConfig);
    try {
      await handleConfigUpdate(newConfig);
      console.log('Search bar toggle successful');
    } catch (error) {
      console.error('Error toggling search bar:', error);
    }
  };

  const AppearanceSettings = () => {
    const currentTheme = themes.find(t => t.name === config.theme) || themes[0];

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-secondary-200">Theme</h3>
          <ThemeSelector
            currentTheme={currentTheme}
            onThemeChange={handleThemeChange}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-secondary-200">Grid Layout</h3>
          <GridLayoutSelector
            currentColumns={config.gridColumns}
            onColumnsChange={(columns) => handleConfigUpdate({ ...config, gridColumns: columns })}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-secondary-200">Category Borders</h3>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.showCategoryBorders}
                onChange={(e) => handleConfigUpdate({ ...config, showCategoryBorders: e.target.checked })}
                className="form-checkbox h-5 w-5 text-primary-500 rounded border-secondary-600 focus:ring-primary-500"
              />
              <span className="text-secondary-300">Show category borders</span>
            </label>
          </div>
        </div>
      </div>
    );
  };

  const CategorySettings = () => {
    const [ctxId, setCtxId] = useState<string>(selectedContextId);
    const ctx = config.contexts.find((c) => c.id === ctxId) || config.contexts[0];

    const [catName, setCatName] = useState<string>(ctx?.categories?.[0]?.name || '');
    useEffect(() => {
      setSelectedContextId(ctxId);
      if (!ctx.categories?.find((c) => c.name === catName)) {
        setCatName(ctx.categories?.[0]?.name || '');
      }
    }, [ctxId, ctx.categories]);

    const category = (ctx.categories || []).find((c) => c.name === catName);

    const [linksLocal, setLinksLocal] = useState(category?.links || []);
    useEffect(() => { setLinksLocal(category?.links || []); }, [category?.name]);

    const updateContext = async (nextCtx: Context) => {
      const next = {
        ...config,
        contexts: config.contexts.map((c) => (c.id === nextCtx.id ? nextCtx : c)),
      };
      await handleConfigUpdate(next);
    };

    const addCategory = () => setEditingBookmark({ name: '', displayMode: 'icon', links: [] });
    const editCategory = () => category && setEditingBookmark(category);

    const removeCategory = async () => {
      if (!category) return;
      const newCtx = { ...ctx, categories: (ctx.categories || []).filter((c) => c.name !== category.name) };
      await updateContext(newCtx);
      setCatName(newCtx.categories?.[0]?.name || '');
    };

    const moveLink = async (from: number, to: number) => {
      if (!category) return;
      const newLinks = arrayMove(category.links, from, to);
      const newCtx = {
        ...ctx,
        categories: (ctx.categories || []).map((c) => (c.name === category.name ? { ...c, links: newLinks } : c)),
      };
      await updateContext(newCtx);
    };

    const persistLinks = async (newLinks: typeof linksLocal) => {
      if (!category) return;
      const newCtx = { ...ctx, categories: (ctx.categories || []).map((c) => (c.name === category.name ? { ...c, links: newLinks } : c)) };
      await updateContext(newCtx);
    };

    const addLink = async () => {
      const next = [...linksLocal, { name: 'New Link', url: 'https://', icon: 'Link' }];
      setLinksLocal(next);
      await persistLinks(next);
    };

    const removeLink = async (index: number) => {
      const next = linksLocal.filter((_, i) => i !== index);
      setLinksLocal(next);
      await persistLinks(next);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <select
            value={ctxId}
            onChange={(e) => setCtxId(e.target.value)}
            className="px-3 py-1 rounded bg-secondary-800 border border-secondary-700 text-secondary-200"
          >
            {config.contexts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            className="px-3 py-1 rounded bg-secondary-800 border border-secondary-700 text-secondary-200"
          >
            {(ctx.categories || []).map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
          <button onClick={addCategory} className="px-3 py-1 rounded bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 flex items-center gap-1 text-sm">
            <Icon name="Plus" size={16} /> Add
          </button>
          <button onClick={editCategory} disabled={!category} className="px-3 py-1 rounded bg-secondary-700 hover:bg-secondary-600 text-secondary-100 text-sm disabled:opacity-50">Edit</button>
          <button onClick={removeCategory} disabled={!category} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-sm disabled:opacity-50">Delete</button>
        </div>

        {category ? (
          <div className="space-y-3">
            <div className="text-sm text-secondary-300">Links in “{category.name}”</div>
            <div className="space-y-2">
              {linksLocal.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-secondary-800/50 border border-secondary-700 p-2 rounded">
                  <input
                    className="flex-1 px-2 py-1 bg-secondary-900 border border-secondary-700 rounded text-secondary-100 text-sm"
                    value={link.name}
                    onChange={(e) => setLinksLocal((prev) => prev.map((l, i) => (i === idx ? { ...l, name: e.target.value } : l)))}
                    onBlur={() => persistLinks(linksLocal)}
                  />
                  <input
                    className="flex-[2] px-2 py-1 bg-secondary-900 border border-secondary-700 rounded text-secondary-100 text-sm"
                    value={link.url}
                    onChange={(e) => setLinksLocal((prev) => prev.map((l, i) => (i === idx ? { ...l, url: e.target.value } : l)))}
                    onBlur={() => persistLinks(linksLocal)}
                  />
                  <input
                    className="w-40 px-2 py-1 bg-secondary-900 border border-secondary-700 rounded text-secondary-100 text-sm"
                    value={link.icon}
                    onChange={(e) => setLinksLocal((prev) => prev.map((l, i) => (i === idx ? { ...l, icon: e.target.value } : l)))}
                    onBlur={() => persistLinks(linksLocal)}
                  />
                  <div className="flex items-center gap-1">
                    <button className="px-2 py-1 rounded bg-secondary-700 hover:bg-secondary-600 text-secondary-100 text-xs" onClick={() => idx > 0 && moveLink(idx, idx - 1)}>↑</button>
                    <button className="px-2 py-1 rounded bg-secondary-700 hover:bg-secondary-600 text-secondary-100 text-xs" onClick={() => idx < linksLocal.length - 1 && moveLink(idx, idx + 1)}>↓</button>
                    <button className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs" onClick={() => removeLink(idx)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addLink} className="px-3 py-1 rounded bg-secondary-700 hover:bg-secondary-600 text-secondary-100 text-sm">+ Add Link</button>
          </div>
        ) : (
          <div className="text-sm text-secondary-400">No category selected.</div>
        )}
      </div>
    );
  };

  const handleBookmarkEdit = (category: Category) => {
    console.log('Editing bookmark:', category);
    setEditingBookmark(category);
  };

  const handleBookmarkDelete = (context: Context, categoryName: string) => {
    console.log('Deleting bookmark:', categoryName);
    const categoryToDelete = context.categories.find(c => c.name === categoryName);
    if (!categoryToDelete) return;

    setConfirmDialog({ 
      isOpen: true, 
      title: "Delete Bookmark",
      message: `Are you sure you want to delete the bookmark category "${categoryName}"? This action cannot be undone.`,
      isWarning: false,
      action: 'delete',
      onConfirm: async () => {
        const newContext = {
          ...context,
          categories: context.categories.filter(
            cat => cat.name !== categoryName
          )
        };
        const newConfig = {
          ...config,
          contexts: config.contexts.map(c => 
            c.id === context.id ? newContext : c
          )
        };

        try {
          await onConfigChange(newConfig);
          setToast({ message: 'Bookmark deleted successfully', type: 'success' });
        } catch (error) {
          console.error('Error deleting bookmark:', error);
          setToast({ message: 'Failed to delete bookmark', type: 'error' });
        }

        setConfirmDialog({
          isOpen: false,
          title: '',
          message: '',
          isWarning: false,
          action: null,
          onConfirm: () => {},
        });
      }
    });
  };

  const handleBookmarkDragEnd = (event: DragEndEvent, contextId: string) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const context = config.contexts.find(c => c.id === contextId);
      if (!context) return;

      const oldIndex = context.categories.findIndex(category => category.name === active.id);
      const newIndex = context.categories.findIndex(category => category.name === over.id);
      
      const newCategories = arrayMove(context.categories, oldIndex, newIndex);
      const newContext = { ...context, categories: newCategories };
      const newConfig = {
        ...config,
        contexts: config.contexts.map(c => 
          c.id === contextId ? newContext : c
        )
      };
      handleConfigUpdate(newConfig);
    }
  };

  const handleWidgetToggle = async (widget: keyof WidgetSettings, enabled: boolean) => {
    // Ensure widgets property exists
    const widgets = config.widgets || {
      weather: {
        enabled: false,
        useCelsius: false
      },
      clock: {
        enabled: false,
        showSeconds: false
      },
      iframe: {
        enabled: false,
        url: ''
      },
      calendar: {
        enabled: false,
        icsUrl: '',
        source: 'ics',
        caldav: { url: '', username: '', password: '' },
      }
    } as WidgetSettings;

    const newConfig = {
      ...config,
      widgets: {
        ...widgets,
        [widget]: {
          ...widgets[widget],
          enabled
        }
      }
    };

    try {
      await handleConfigUpdate(newConfig);
    } catch (error) {
      console.error('Error toggling widget:', error);
      setToast({ message: 'Failed to toggle widget', type: 'error' });
    }
  };

  const handleTemperatureUnitToggle = async (useCelsius: boolean) => {
    // Ensure widgets property exists
    const widgets = config.widgets || {
      weather: {
        enabled: false,
        useCelsius: false
      },
      clock: {
        enabled: false,
        showSeconds: false
      },
      iframe: {
        enabled: false,
        url: ''
      },
      calendar: {
        enabled: false,
        icsUrl: '',
        source: 'ics',
        caldav: { url: '', username: '', password: '' },
      }
    } as WidgetSettings;

    const newConfig = {
      ...config,
      widgets: {
        ...widgets,
        weather: {
          ...widgets.weather,
          useCelsius
        },
        clock: {
          ...widgets.clock,
          useCelsius
        }
      }
    };

    try {
      await handleConfigUpdate(newConfig);
    } catch (error) {
      console.error('Error toggling temperature unit:', error);
      setToast({ message: 'Failed to toggle temperature unit', type: 'error' });
    }
  };

  const handleClockSecondsToggle = async (showSeconds: boolean) => {
    // Ensure widgets property exists
    const widgets = config.widgets || {
      weather: {
        enabled: false,
        useCelsius: false
      },
      clock: {
        enabled: false,
        showSeconds: false
      },
      iframe: {
        enabled: false,
        url: ''
      },
      calendar: {
        enabled: false,
        icsUrl: '',
        source: 'ics',
        caldav: { url: '', username: '', password: '' },
      }
    } as WidgetSettings;

    const newConfig = {
      ...config,
      widgets: {
        ...widgets,
        clock: {
          ...widgets.clock,
          showSeconds
        }
      }
    };

    try {
      await handleConfigUpdate(newConfig);
    } catch (error) {
      console.error('Error toggling clock seconds:', error);
      setToast({ message: 'Failed to toggle clock seconds', type: 'error' });
    }
  };

  const handleIframeUrlChange = async (url: string) => {
    const widgets = config.widgets || {
      weather: { enabled: false, useCelsius: false },
      clock: { enabled: false, showSeconds: false },
      iframe: { enabled: false, url: '' },
      calendar: { enabled: false, icsUrl: '', source: 'ics', caldav: { url: '', username: '', password: '' } },
    } as WidgetSettings;

    const newConfig = {
      ...config,
      widgets: {
        ...widgets,
        iframe: {
          ...widgets.iframe,
          url
        }
      }
    };

    try {
      await handleConfigUpdate(newConfig);
    } catch (error) {
      console.error('Error updating iframe URL:', error);
      setToast({ message: 'Failed to update iframe URL', type: 'error' });
    }
  };

  const handleCalendarSourceChange = async (source: 'ics' | 'caldav') => {
    const widgets = (config.widgets || {
      weather: { enabled: false, useCelsius: false },
      clock: { enabled: false, showSeconds: false },
      iframe: { enabled: false, url: '' },
      calendar: { enabled: false, icsUrl: '', source: 'ics', caldav: { url: '', username: '', password: '' } },
    }) as WidgetSettings;

    const newConfig = {
      ...config,
      widgets: {
        ...widgets,
        calendar: {
          enabled: widgets.calendar?.enabled ?? false,
          icsUrl: widgets.calendar?.icsUrl || '',
          source,
          caldav: widgets.calendar?.caldav || { url: '', username: '', password: '' },
        },
      },
    };

    try {
      await handleConfigUpdate(newConfig);
    } catch (error) {
      console.error('Error updating calendar source:', error);
      setToast({ message: 'Failed to update calendar source', type: 'error' });
    }
  };

  const handleCalDavChange = async (field: 'url' | 'username' | 'password' | 'useProxy', value: string | boolean) => {
    const widgets = (config.widgets || {
      weather: { enabled: false, useCelsius: false },
      clock: { enabled: false, showSeconds: false },
      iframe: { enabled: false, url: '' },
      calendar: { enabled: false, icsUrl: '', source: 'ics', caldav: { url: '', username: '', password: '' } },
    }) as WidgetSettings;

    const currentCal = widgets.calendar?.caldav || { url: '', username: '', password: '', useProxy: false };
    const newConfig = {
      ...config,
      widgets: {
        ...widgets,
        calendar: {
          enabled: widgets.calendar?.enabled ?? false,
          icsUrl: widgets.calendar?.icsUrl || '',
          source: (widgets.calendar as any)?.source || 'ics',
          caldav: { ...currentCal, [field]: value as any },
        },
      },
    };

    try {
      await handleConfigUpdate(newConfig);
    } catch (error) {
      console.error('Error updating CalDAV settings:', error);
      setToast({ message: 'Failed to update CalDAV settings', type: 'error' });
    }
  };

  const handleCalendarUrlChange = async (icsUrl: string) => {
    const widgets = config.widgets || {
      weather: { enabled: false, useCelsius: false },
      clock: { enabled: false, showSeconds: false },
      iframe: { enabled: false, url: '' },
      calendar: { enabled: false, icsUrl: '', source: 'ics', caldav: { url: '', username: '', password: '' } },
    } as WidgetSettings;

    const newConfig = {
      ...config,
      widgets: {
        ...widgets,
        calendar: {
          ...widgets.calendar,
          icsUrl,
        },
      },
    };

    try {
      await handleConfigUpdate(newConfig);
    } catch (error) {
      console.error('Error updating calendar URL:', error);
      setToast({ message: 'Failed to update calendar URL', type: 'error' });
    }
  };

  const WidgetsSettings = () => {
    const [calendarUrlInput, setCalendarUrlInput] = useState('');
    const [discovering, setDiscovering] = useState(false);
    const [discoverError, setDiscoverError] = useState<string | null>(null);
    const [discoveredCalendars, setDiscoveredCalendars] = useState<Array<{ href: string; name: string }>>([]);
    const [selectedDiscovered, setSelectedDiscovered] = useState<string>('');
    const [testing, setTesting] = useState(false);
    const [testMessage, setTestMessage] = useState<string | null>(null);
    // Ensure widgets property exists with all widget settings
    const widgets = config.widgets || {
      weather: {
        enabled: false,
        useCelsius: false
      },
      clock: {
        enabled: false,
        showSeconds: false
      },
      iframe: {
        enabled: false,
        url: ''
      },
      calendar: {
        enabled: false,
        icsUrl: '',
        source: 'ics',
        caldav: { url: '', username: '', password: '' },
      }
    } as WidgetSettings;

    const iframe = widgets.iframe || {
      enabled: false,
      url: ''
    };

    const calendar = widgets.calendar || {
      enabled: false,
      icsUrl: '',
      source: 'ics' as const,
      caldav: { url: '', username: '', password: '' },
    };

    useEffect(() => {
      setCalendarUrlInput(calendar.icsUrl || '');
    }, [calendar.icsUrl]);

    const discoverCalendars = async () => {
      setDiscovering(true);
      setDiscoverError(null);
      setDiscoveredCalendars([]);
      setSelectedDiscovered('');
      try {
        const cal = (calendar as any).caldav || { url: '', username: '', password: '' };
        const baseUrl: string = cal.url || '';
        if (!baseUrl) {
          setDiscoverError('Enter a CalDAV base URL first');
          return;
        }
        const auth = typeof btoa !== 'undefined' && cal.username
          ? 'Basic ' + btoa(`${cal.username}:${cal.password || ''}`)
          : '';

        const propfind = async (url: string, depth: '0' | '1') => {
          const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<d:propfind xmlns:d=\"DAV:\" xmlns:c=\"urn:ietf:params:xml:ns:caldav\">` +
            `<d:prop>` +
            `<d:current-user-principal/>` +
            `<c:calendar-home-set/>` +
            `<d:displayname/>` +
            `<d:resourcetype/>` +
            `</d:prop>` +
            `</d:propfind>`;
          const res = await fetch(url, {
            method: 'PROPFIND',
            headers: {
              'Content-Type': 'application/xml; charset=utf-8',
              'Depth': depth,
              ...(auth ? { 'Authorization': auth } : {}),
            },
            body,
          } as RequestInit);
          if (!res.ok) throw new Error(`PROPFIND ${depth} failed (${res.status})`);
          const text = await res.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'application/xml');
          const parserErr = doc.getElementsByTagName('parsererror');
          if (parserErr && parserErr.length) throw new Error('Failed to parse PROPFIND response');
          return doc;
        };

        const getHref = (parent: Element | Document, local: string, ns?: string) => {
          const els = ns
            ? (parent as Document).getElementsByTagNameNS(ns, local)
            : (parent as Document).getElementsByTagName(local);
          if (els && els.length) {
            const hrefs = (els[0] as Element).getElementsByTagNameNS('DAV:', 'href');
            if (hrefs && hrefs.length) return hrefs[0].textContent || '';
          }
          return '';
        };

        // Step 1: Try to get calendar-home-set directly on given URL
        const doc0 = await propfind(baseUrl, '0');
        let home = getHref(doc0, 'calendar-home-set', 'urn:ietf:params:xml:ns:caldav');
        if (!home) {
          // Try via current-user-principal
          const principalHref = getHref(doc0, 'current-user-principal', 'DAV:')
            || getHref(doc0, 'current-user-principal');
          if (!principalHref) {
            home = baseUrl;
          } else {
            const principalUrl = new URL(principalHref, baseUrl).toString();
            const docP = await propfind(principalUrl, '0');
            home = getHref(docP, 'calendar-home-set', 'urn:ietf:params:xml:ns:caldav');
            if (!home) home = principalUrl;
          }
        }

        const homeUrl = new URL(home, baseUrl).toString();

        // Step 2: Depth:1 list calendars in home
        const doc1 = await propfind(homeUrl, '1');
        const responses = doc1.getElementsByTagNameNS('DAV:', 'response');
        const items: Array<{ href: string; name: string }> = [];
        for (let i = 0; i < responses.length; i++) {
          const resp = responses[i];
          const hrefEl = resp.getElementsByTagNameNS('DAV:', 'href')[0];
          if (!hrefEl) continue;
          const href = new URL(hrefEl.textContent || '', homeUrl).toString();
          const displaynameEl = resp.getElementsByTagNameNS('DAV:', 'displayname')[0];
          const displayname = displaynameEl?.textContent || href;
          // Check resourcetype contains caldav:calendar
          let isCalendar = false;
          const resType = resp.getElementsByTagNameNS('DAV:', 'resourcetype')[0];
          if (resType) {
            const calEls = resType.getElementsByTagNameNS('urn:ietf:params:xml:ns:caldav', 'calendar');
            if (calEls && calEls.length) isCalendar = true;
          }
          if (isCalendar) items.push({ href, name: displayname });
        }

        if (items.length === 0) {
          setDiscoverError('No calendar collections found');
        }
        setDiscoveredCalendars(items);
        if (items.length) setSelectedDiscovered(items[0].href);
      } catch (e: any) {
        setDiscoverError(e?.message || 'Discovery failed');
      } finally {
        setDiscovering(false);
      }
    };

    const applyDiscovered = async () => {
      if (!selectedDiscovered) return;
      await handleCalDavChange('url', selectedDiscovered);
    };

    const testCalDavConnection = async () => {
      setTesting(true);
      setTestMessage(null);
      try {
        const cal = (calendar as any).caldav || { url: '', username: '', password: '', useProxy: false };
        const baseUrl: string = cal.url || '';
        if (!baseUrl) {
          setTestMessage('Please enter a CalDAV URL first');
          return;
        }
        if (cal.useProxy) {
          const res = await fetch('/api/caldav', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'discover', url: baseUrl, username: cal.username, password: cal.password }),
          });
          let data: any = null;
          try { data = await res.json(); } catch {}
          if (!res.ok) {
            const err = data?.error || `Failed (${res.status})`;
            const auth = data?.details?.wwwAuthenticate ? ` Auth: ${data.details.wwwAuthenticate}` : '';
            const hint = data?.details?.hint ? ` Hint: ${data.details.hint}` : '';
            setTestMessage(`Connection failed: ${err}${auth}${hint}`);
            return;
          }
          const count = Array.isArray(data?.calendars) ? data.calendars.length : 0;
          const guess = data?.guessHome ? ` Base: ${data.guessHome}` : '';
          setTestMessage(`Connection successful. Found ${count} calendar(s).${guess}`);
        } else {
          // Direct browser PROPFIND Depth:0
          const auth = typeof btoa !== 'undefined' && (calendar as any).caldav?.username
            ? 'Basic ' + btoa(`${(calendar as any).caldav?.username}:${(calendar as any).caldav?.password || ''}`)
            : '';
          const body = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n` +
            `<d:propfind xmlns:d=\"DAV:\" xmlns:c=\"urn:ietf:params:xml:ns:caldav\">` +
            `<d:prop>` +
            `<d:current-user-principal/>` +
            `<c:calendar-home-set/>` +
            `</d:prop>` +
            `</d:propfind>`;
          const res = await fetch(baseUrl, {
            method: 'PROPFIND',
            headers: {
              'Content-Type': 'application/xml; charset=utf-8',
              'Depth': '0',
              ...(auth ? { 'Authorization': auth } : {}),
            },
            body,
          } as RequestInit);
          if (!res.ok) {
            const www = res.headers.get('www-authenticate') || '';
            setTestMessage(`Connection failed: ${res.status}. Auth: ${www}`);
            return;
          }
          setTestMessage('Connection successful.');
        }
      } catch (e: any) {
        setTestMessage(e?.message || 'Test failed');
      } finally {
        setTesting(false);
      }
    };

    // Ensure both weather and clock properties exist
    const weather = widgets.weather || {
      enabled: true,
      useCelsius: false
    };

    const clock = widgets.clock || {
      enabled: true,
      showSeconds: true
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">Weather Widget</h3>
              <div className="group relative">
                <Icon name="Info" size={16} className="text-secondary-400 cursor-help" />
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-2 bg-secondary-800 text-sm text-secondary-100 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[2000]">
                  To use the weather widget, you need to:
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Get an API key from <a href="https://openweathermap.org/api" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300">OpenWeatherMap</a></li>
                    <li>Set the <code className="bg-secondary-700 px-1 rounded">PUBLIC_OPENWEATHER_API_KEY</code> environment variable</li>
                  </ol>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-400">Display current weather information</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={weather.enabled}
              onChange={(e) => handleWidgetToggle('weather', e.target.checked)}
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
          </label>
        </div>

        {weather.enabled && (
          <div className="pl-4 border-l-2 border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Temperature Unit</h4>
                <p className="text-xs text-gray-400">Choose between Celsius and Fahrenheit</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={weather.useCelsius}
                  onChange={(e) => handleTemperatureUnitToggle(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                <span className="ml-2 text-sm text-gray-400">
                  {weather.useCelsius ? 'Celsius' : 'Fahrenheit'}
                </span>
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Clock Widget</h3>
            <p className="text-sm text-gray-400">Display current time</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={clock.enabled}
              onChange={(e) => handleWidgetToggle('clock', e.target.checked)}
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
          </label>
        </div>

        {clock.enabled && (
          <div className="pl-4 border-l-2 border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Show Seconds</h4>
                <p className="text-xs text-gray-400">Display seconds in the clock</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={clock.showSeconds}
                  onChange={(e) => handleClockSecondsToggle(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
          </div>
        )}

        <div className="p-3 rounded-lg bg-secondary-800/40 border border-secondary-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Calendar settings moved</h3>
              <p className="text-xs text-secondary-400">Manage Calendar in the Plugins tab.</p>
            </div>
            <button
              type="button"
              className="px-3 py-1 rounded bg-primary-600 hover:bg-primary-500 text-white text-sm"
              onClick={() => setActiveTab('plugins')}
            >
              Open Plugins
            </button>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-secondary-800/40 border border-secondary-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Iframe settings moved</h3>
              <p className="text-xs text-secondary-400">Manage Iframe in the Plugins tab.</p>
            </div>
            <button
              type="button"
              className="px-3 py-1 rounded bg-primary-600 hover:bg-primary-500 text-white text-sm"
              onClick={() => setActiveTab('plugins')}
            >
              Open Plugins
            </button>
          </div>
        </div>
      </div>
    );
  };

  const AboutSettings = () => {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-secondary-200">About Modern Start Page</h3>
          <p className="text-secondary-300">
            A modern, customizable start page for your browser and new tab page.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-secondary-200">Links</h3>
          <div className="space-y-2">
            <a
              href="https://github.com/ericblue/modern-start-page"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-primary-400 hover:text-primary-300"
            >
              <Icon name="Github" size={16} />
              <span>GitHub Repository</span>
            </a>
            <a
              href="https://about.ericblue.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-primary-400 hover:text-primary-300"
            >
              <Icon name="User" size={16} />
              <span>Author Website</span>
            </a>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-secondary-200">License</h3>
          <p className="text-secondary-300">
            This project is licensed under the MIT License.
          </p>
        </div>
      </div>
    );
  };

  const LayoutSettings = () => {
    const [selectedId, setSelectedId] = useState<string>(selectedContextId);

    const ctx = config.contexts.find((c) => c.id === selectedId) || config.contexts[0];
    const items = (ctx as any)?.items as any[] | undefined;
    const gridColumns = Math.max(1, Number(config.gridColumns || 3));
    const [activeId, setActiveId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
    // Keep outer selectedContextId in sync for category edit handlers
    useEffect(() => { setSelectedContextId(selectedId); }, [selectedId]);

    const setContextItems = async (newItems: any[]) => {
      const nextContexts = config.contexts.map((c) => (c.id === ctx.id ? { ...c, items: newItems } : c));
      await handleConfigUpdate({ ...config, contexts: nextContexts });
    };

    const genId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const initFromCategories = async () => {
      const newItems = (ctx.categories || []).map((cat, idx) => ({
        type: 'category',
        id: genId(`cat${idx}`),
        categoryName: cat.name,
      }));
      await setContextItems(newItems);
    };

    const handleItemDragEnd = async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const current = ((config.contexts.find((c) => c.id === ctx.id) as any)?.items || []) as any[];
      const oldIndex = current.findIndex((i) => i.id === active.id);
      const newIndex = current.findIndex((i) => i.id === over.id);
      const newItems = arrayMove(current, oldIndex, newIndex);
      await setContextItems(newItems);
    };

    const removeItem = async (id: string) => {
      const current = (items || []) as any[];
      const newItems = current.filter((i) => i.id !== id);
      await setContextItems(newItems);
    };

    const updateItem = async (id: string, patch: any) => {
      const current = (items || []) as any[];
      const newItems = current.map((i) => (i.id === id ? { ...i, ...patch } : i));
      await setContextItems(newItems);
    };

    const addPluginItem = async (pluginId: string) => {
      const current = (items || []) as any[];
      const newItem = { type: 'plugin', id: genId(pluginId), pluginId } as any;
      await setContextItems([...current, newItem]);
    };

    const addCategoryItem = async (categoryName: string) => {
      const cat = (ctx.categories || []).find((c) => c.name === categoryName);
      if (!cat) return;
      const current = (items || []) as any[];
      const newItem = { type: 'category', id: genId('cat'), categoryName: cat.name } as any;
      await setContextItems([...current, newItem]);
    };

    const availablePlugins = [
      { id: 'calendar', label: 'Calendar' },
      { id: 'iframe', label: 'Iframe' },
    ];

    const [selectedCategoryToAdd, setSelectedCategoryToAdd] = useState<string>('');

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Context Layout</h3>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="px-3 py-1 rounded bg-secondary-800 border border-secondary-700 text-secondary-200"
            >
              {config.contexts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="text-xs text-secondary-400">Drag using the grip icon</div>
        </div>

        {!items || items.length === 0 ? (
          <div className="p-3 rounded-lg bg-secondary-800/40 border border-secondary-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">No layout items</div>
                <div className="text-xs text-secondary-400">Initialize from existing categories or add plugins below.</div>
              </div>
              <button
                onClick={initFromCategories}
                className="px-3 py-1 rounded bg-primary-600 hover:bg-primary-500 text-white text-sm"
              >
                Use Categories
              </button>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setActiveId(String(e.active.id))}
            onDragOver={(e) => setOverId(e.over ? String(e.over.id) : null)}
            onDragEnd={(e) => { setActiveId(null); setOverId(null); handleItemDragEnd(e); }}
          >
            <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
              <div
                className="grid items-stretch gap-3 border border-secondary-700/40 border-dashed rounded-lg p-3 bg-secondary-900/40"
                style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
              >
                {items.map((it) => {
                  const plug = it.type === 'plugin' ? plugins.find((p) => p.id === it.pluginId) : null;
                  const isFull = plug?.area === 'full';
                  const name = it.type === 'category' ? (it.category?.name || it.categoryName || 'Category') : `Plugin: ${it.pluginId}`;
                  const span = isFull ? gridColumns : Math.max(1, Math.min(Number(it.colSpan || 1), gridColumns));
                  return (
                    <div
                      key={it.id}
                      style={{ gridColumn: isFull ? '1 / -1' : (`span ${span} / span ${span}` as any) }}
                      className={`h-full ${overId === it.id ? 'ring-1 ring-primary-500/50 bg-secondary-800/20' : ''}`}
                    >
                      <SortableItem id={it.id}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-secondary-200 text-sm flex-1 min-w-0">
                            <span className="font-medium truncate block">{name}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {isFull ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary-800 text-secondary-300 border border-secondary-700">Full</span>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-secondary-300">
                              <select
                                aria-label="Column span"
                                className="px-1 py-0.5 bg-secondary-800 border border-secondary-700 rounded text-secondary-100 w-14"
                                value={span}
                                onChange={(e) => updateItem(it.id, { colSpan: Math.max(1, Math.min(Number(e.target.value), gridColumns)) })}
                              >
                                {Array.from({ length: gridColumns }).map((_, idx) => (
                                  <option key={idx + 1} value={idx + 1}>{idx + 1}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <button
                            onClick={() => removeItem(it.id)}
                            className="p-1 rounded hover:bg-secondary-600"
                            title="Remove"
                          >
                            <Icon name="Trash2" size={16} />
                          </button>
                        </div>
                        {/* No preview; clean dashed borders keep grid visible */}
                      </SortableItem>
                    </div>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="p-3 rounded-lg bg-secondary-800/40 border border-secondary-700 space-y-3">
          <div className="text-sm font-medium">Add item</div>
          <div className="flex flex-wrap gap-2">
            {availablePlugins.map((p) => (
              <button
                key={p.id}
                onClick={() => addPluginItem(p.id)}
                className="px-3 py-1 rounded bg-secondary-700 hover:bg-secondary-600 text-secondary-100 text-sm"
              >
                + {p.label}
              </button>
            ))}
          </div>
          {ctx.categories && ctx.categories.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                className="px-2 py-1 rounded bg-secondary-800 border border-secondary-700 text-secondary-200 text-sm"
                value={selectedCategoryToAdd}
                onChange={(e) => setSelectedCategoryToAdd(e.target.value)}
              >
                <option value="">Select category…</option>
                {ctx.categories.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={() => selectedCategoryToAdd && addCategoryItem(selectedCategoryToAdd)}
                className="px-3 py-1 rounded bg-secondary-700 hover:bg-secondary-600 text-secondary-100 text-sm"
              >
                + Add Category Tile
              </button>
            </div>
          )}
        </div>

        {/* Category editing moved to Category tab */}
      </div>
    );
  };

  return (
    <>
      <div className={`fixed inset-0 bg-black/50 flex items-start justify-center pt-10 z-[1000] ${isOpen ? '' : 'hidden'}`}>
        <div className="bg-secondary-900 rounded-lg p-6 w-full max-w-4xl mt-10">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-secondary-700">
            <h2 className="text-xl font-semibold text-secondary-200">Settings</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded border border-secondary-700 text-secondary-200 hover:bg-secondary-800 hover:border-secondary-600 text-sm"
                title="Logout"
              >
                Logout
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-secondary-700 transition-colors"
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 mb-6">
            <button
              onClick={() => setActiveTab('contexts')}
              className={`flex items-center space-x-2 px-4 py-2 rounded ${
                activeTab === 'contexts' ? 'bg-primary-500/20 text-primary-400' : 'text-secondary-300 hover:bg-secondary-800'
              }`}
            >
              <Icon name="Grid" size={16} />
              <span>Contexts</span>
            </button>
            {/* Bookmarks tab removed; managed under Layout */}
            <button
              onClick={() => setActiveTab('layout')}
              className={`flex items-center space-x-2 px-4 py-2 rounded ${
                activeTab === 'layout' ? 'bg-primary-500/20 text-primary-400' : 'text-secondary-300 hover:bg-secondary-800'
              }`}
            >
              <Icon name="LayoutGrid" size={16} />
              <span>Layout</span>
            </button>
            <button
              onClick={() => setActiveTab('category')}
              className={`flex items-center space-x-2 px-4 py-2 rounded ${
                activeTab === 'category' ? 'bg-primary-500/20 text-primary-400' : 'text-secondary-300 hover:bg-secondary-800'
              }`}
            >
              <Icon name="Folder" size={16} />
              <span>Category</span>
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`flex items-center space-x-2 px-4 py-2 rounded ${
                activeTab === 'appearance' ? 'bg-primary-500/20 text-primary-400' : 'text-secondary-300 hover:bg-secondary-800'
              }`}
            >
              <Icon name="Palette" size={16} />
              <span>Appearance</span>
            </button>
            <button
              onClick={() => setActiveTab('plugins')}
              className={`flex items-center space-x-2 px-4 py-2 rounded ${
                activeTab === 'plugins' ? 'bg-primary-500/20 text-primary-400' : 'text-secondary-300 hover:bg-secondary-800'
              }`}
            >
              <Icon name="Puzzle" size={16} />
              <span>Plugins</span>
            </button>
            <button
              onClick={() => setActiveTab('widgets')}
              className={`flex items-center space-x-2 px-4 py-2 rounded ${
                activeTab === 'widgets' ? 'bg-primary-500/20 text-primary-400' : 'text-secondary-300 hover:bg-secondary-800'
              }`}
            >
              <Icon name="Grid" size={16} />
              <span>Widgets</span>
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`flex items-center space-x-2 px-4 py-2 rounded ${
                activeTab === 'backup' ? 'bg-primary-500/20 text-primary-400' : 'text-secondary-300 hover:bg-secondary-800'
              }`}
            >
              <Icon name="Database" size={16} />
              <span>Backup</span>
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`flex items-center space-x-2 px-4 py-2 rounded ${
                activeTab === 'about' ? 'bg-primary-500/20 text-primary-400' : 'text-secondary-300 hover:bg-secondary-800'
              }`}
            >
              <Icon name="Info" size={16} />
              <span>About</span>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 h-[70vh] overflow-y-auto">
            {activeTab === 'contexts' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Contexts</h3>
                  <button
                    onClick={() => setEditingContext({ id: '', name: '', categories: [] })}
                    className="flex items-center space-x-1 px-3 py-1 rounded bg-primary-500/20 text-primary-400 hover:bg-primary-500/30"
                  >
                    <Icon name="Plus" size={16} />
                    <span>Add Context</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {config.contexts.map(context => (
                    <div key={context.id} className="flex items-center justify-between p-2 rounded bg-secondary-800">
                      <div className="flex items-center space-x-2">
                        <Icon name="Grid" size={16} className="text-secondary-400" />
                        <span>{context.name}</span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleContextEdit(context)}
                          className="p-1 rounded hover:bg-secondary-700"
                        >
                          <Icon name="Pencil" size={16} />
                        </button>
                        <button
                          onClick={() => handleContextDelete(context.id)}
                          className="p-1 rounded hover:bg-secondary-700"
                        >
                          <Icon name="Trash2" size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bookmarks tab removed; category management is in Layout tab */}

            {activeTab === 'layout' && (
              <LayoutSettings />
            )}

            {activeTab === 'category' && (
              <CategorySettings />
            )}

            {activeTab === 'appearance' && (
              <AppearanceSettings />
            )}

            {activeTab === 'plugins' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Plugins</h3>
                <p className="text-sm text-secondary-400">Manage pluggable widgets, including Search, Calendar, and Iframe.</p>
                <div className="space-y-3">
                  {plugins.map((p) => (
                    <div key={p.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-secondary-100">{p.name}</div>
                          {p.description && (
                            <div className="text-xs text-secondary-400">{p.description}</div>
                          )}
                        </div>
                        <div className="text-xs text-secondary-500">Area: {p.area}</div>
                      </div>
                      {p.Settings ? (
                        <p.Settings config={config} onConfigChange={onConfigChange} />
                      ) : (
                        <div className="text-xs text-secondary-500 italic">Settings managed in Widgets tab.</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'widgets' && (
              <WidgetsSettings />
            )}

            {activeTab === 'about' && (
              <AboutSettings />
            )}

            {activeTab === 'backup' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Backup & Restore</h3>
                <div className="space-y-4">
                  <button
                    onClick={handleExportConfig}
                    className="flex items-center space-x-2 px-4 py-2 rounded bg-primary-500/20 text-primary-400 hover:bg-primary-500/30"
                  >
                    <Icon name="Download" size={16} />
                    <span>Export Configuration</span>
                  </button>
                  <button
                    onClick={handleImportClick}
                    className="flex items-center space-x-2 px-4 py-2 rounded bg-primary-500/20 text-primary-400 hover:bg-primary-500/30"
                  >
                    <Icon name="Upload" size={16} />
                    <span>Import Configuration</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportConfig}
                    accept=".json"
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Context Edit Modal */}
      {editingContext && (
        <ContextEditModal
          context={editingContext}
          onSave={handleContextSave}
          onCancel={() => setEditingContext(null)}
          className="z-[2000]"
        />
      )}

      {/* Bookmark Edit Modal */}
      {editingBookmark && (
        <BookmarkEditModal
          category={editingBookmark}
          contextId={selectedContextId}
          onSave={handleBookmarkSave}
          onCancel={() => setEditingBookmark(null)}
          className="z-[2000]"
        />
      )}

      {/* Confirm Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[3000]">
          <div className="bg-secondary-900 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-secondary-200 mb-4">
              {confirmDialog.title}
            </h3>
            <p className="text-secondary-300 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmDialog({
                  isOpen: false,
                  title: '',
                  message: '',
                  isWarning: false,
                  action: null,
                  onConfirm: () => {},
                })}
                className="px-4 py-2 rounded bg-secondary-700 text-secondary-100 hover:bg-secondary-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 rounded ${
                  confirmDialog.isWarning 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-primary-500 hover:bg-primary-600'
                } text-white`}
              >
                {confirmDialog.action === 'delete' ? 'Delete' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
