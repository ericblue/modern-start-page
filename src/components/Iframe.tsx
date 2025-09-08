import { useContext, useMemo } from 'react';
import { ConfigContext } from './ConfigProvider';
import { Icon } from './Icon';

export const IframeWidget = () => {
  const { config } = useContext(ConfigContext);

  const widgets = config.widgets || {
    iframe: { enabled: false, url: '' },
  } as any;

  const iframeCfg = widgets.iframe || { enabled: false, url: '' };

  if (!iframeCfg.enabled) return null;

  const url = iframeCfg.url?.trim() || '';

  const isValid = useMemo(() => {
    try {
      if (!url) return false;
      const u = new URL(url);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }, [url]);

  if (!isValid) {
    return (
      <div className="p-3 sm:p-4 bg-secondary-700/50 rounded-lg">
        <div className="flex items-start gap-3">
          <Icon name="AlertTriangle" size={18} className="text-yellow-400 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-secondary-100">Iframe URL missing or invalid</div>
            <div className="text-xs text-secondary-300">Set a valid URL in Settings → Widgets → Iframe.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border border-secondary-200">
      <div className="aspect-video bg-secondary-800">
        <iframe
          src={url}
          title="Embedded content"
          className="w-full h-full"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default IframeWidget;
