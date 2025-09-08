import type { UserConfig, Category } from './types';
import { defaultConfig } from './defaultConfig';
import fs from 'fs/promises';
import path from 'path';

class ConfigStore {
  private config: UserConfig;
  private configPath: string;

  constructor(user?: string) {
    this.config = defaultConfig;
    const baseDir = process.env.CONFIG_PATH && process.env.CONFIG_PATH.trim().length > 0
      ? process.env.CONFIG_PATH
      : path.resolve(process.cwd(), 'data');
    this.configPath = user
      ? path.join(baseDir, `config_${user}.json`)
      : path.join(baseDir, 'config.json');
  }

  async getConfig(): Promise<UserConfig> {
    return this.config;
  }

  async saveConfig(newConfig: UserConfig): Promise<void> {
    // Normalize to avoid duplicating links inside items
    const normalized = normalizeConfig(newConfig);
    this.config = normalized;
    try {
      // Ensure the directory exists
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      // Write the config to file
      await fs.writeFile(this.configPath, JSON.stringify(normalized, null, 2));
    } catch (error) {
      console.error('Error saving config to file:', error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    try {
      // Try to read the config file
      const fileContent = await fs.readFile(this.configPath, 'utf-8');
      const loaded = JSON.parse(fileContent);
      this.config = normalizeConfig(loaded);
    } catch (error: any) {
      // If file doesn't exist, create it with default config
      if (error.code === 'ENOENT') {
        console.log('No config file found, creating with default config');
        await this.saveConfig(defaultConfig);
      } else {
        console.error('Error reading config file:', error);
        throw error;
      }
    }
  }
}

function normalizeConfig(config: UserConfig): UserConfig {
  try {
    const cfg: UserConfig = JSON.parse(JSON.stringify(config));
    cfg.contexts = (cfg.contexts || []).map((ctx) => {
      const categories: Category[] = Array.isArray((ctx as any).categories) ? (ctx as any).categories : [];
      const seenNames = new Set(categories.map((c) => c.name));
      let items = (ctx as any).items as any[] | undefined;
      if (Array.isArray(items) && items.length) {
        items = items.map((it: any) => {
          if (it && it.type === 'category') {
            if (it.category && typeof it.category === 'object') {
              const catObj = it.category as Category;
              if (catObj?.name && !seenNames.has(catObj.name)) {
                categories.push(catObj);
                seenNames.add(catObj.name);
              }
              return {
                type: 'category',
                id: it.id,
                categoryName: catObj?.name || it.categoryName || 'Unnamed',
                colSpan: it.colSpan,
              };
            }
            // Already a reference by name
            return it;
          }
          return it;
        });
      } else {
        // Auto-convert legacy categories into item references if no items defined
        const usedIds = new Set<string>();
        const makeId = (name: string, idx: number) => {
          const base = 'cat-' + (name || `category-${idx}`)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          let candidate = base || `cat-${idx}`;
          let n = 1;
          while (usedIds.has(candidate)) {
            candidate = `${base}-${n++}`;
          }
          usedIds.add(candidate);
          return candidate;
        };
        items = categories.map((c, i) => ({
          type: 'category',
          id: makeId(c.name, i),
          categoryName: c.name,
        }));
      }
      return {
        ...ctx,
        categories,
        ...(items ? { items } : {}),
      } as any;
    });
    return cfg;
  } catch {
    return config;
  }
}

export const initializeConfig = async (user?: string) => {
  const store = new ConfigStore(user);
  await store.initialize();
  return store;
}; 
