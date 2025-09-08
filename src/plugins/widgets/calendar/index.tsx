import React, { useEffect, useState } from 'react';
import CalendarWidget from '../../../components/Calendar';
import type { PluginManifest } from '../../types';

export const calendarPlugin: PluginManifest = {
  id: 'calendar',
  name: 'Calendar',
  description: 'Displays an ICS or CalDAV powered monthly calendar.',
  area: 'full',
  size: { aspectRatio: 'auto' },
  isEnabled: (config) => Boolean(config.widgets?.calendar?.enabled),
  Render: ({ config }) => {
    if (!config.widgets?.calendar?.enabled) return null;
    return <CalendarWidget config={config} />;
  },
  Settings: ({ config, onConfigChange }) => {
    const widgets = (config.widgets || {}) as any;
    const calendar = widgets.calendar || { enabled: false, icsUrl: '', source: 'ics', caldav: { url: '', username: '', password: '', useProxy: false } };

    const updateCalendar = async (patch: Partial<typeof calendar>) => {
      const next = {
        ...config,
        widgets: {
          ...widgets,
          calendar: {
            ...calendar,
            ...patch,
          },
        },
      };
      await onConfigChange(next);
    };

    const updateCalDav = async (field: 'url' | 'username' | 'password' | 'useProxy', value: string | boolean) => {
      const caldav = { ...(calendar.caldav || {}), [field]: value } as any;
      await updateCalendar({ caldav });
    };

    // Discovery & test state
    const [discovering, setDiscovering] = useState(false);
    const [discoverError, setDiscoverError] = useState<string | null>(null);
    const [discoveredCalendars, setDiscoveredCalendars] = useState<Array<{ href: string; name: string }>>([]);
    const [selectedDiscovered, setSelectedDiscovered] = useState<string>('');
    const [testing, setTesting] = useState(false);
    const [testMessage, setTestMessage] = useState<string | null>(null);

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
          const body = `<?xml version="1.0" encoding="UTF-8"?>\n`
            + `<d:propfind xmlns:d=\"DAV:\" xmlns:c=\"urn:ietf:params:xml:ns:caldav\">`
            + `<d:prop>`
            + `<d:current-user-principal/>`
            + `<c:calendar-home-set/>`
            + `<d:displayname/>`
            + `<d:resourcetype/>`
            + `</d:prop>`
            + `</d:propfind>`;
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
      await updateCalDav('url', selectedDiscovered);
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
          const body = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n`
            + `<d:propfind xmlns:d=\"DAV:\" xmlns:c=\"urn:ietf:params:xml:ns:caldav\">`
            + `<d:prop>`
            + `<d:current-user-principal/>`
            + `<c:calendar-home-set/>`
            + `</d:prop>`
            + `</d:propfind>`;
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

    // Local edit buffers to avoid focus loss on each keystroke
    const [icsUrl, setIcsUrl] = useState<string>(calendar.icsUrl || '');
    const [calUrl, setCalUrl] = useState<string>((calendar as any).caldav?.url || '');
    const [calUser, setCalUser] = useState<string>((calendar as any).caldav?.username || '');
    const [calPass, setCalPass] = useState<string>((calendar as any).caldav?.password || '');
    const [calProxy, setCalProxy] = useState<boolean>(Boolean((calendar as any).caldav?.useProxy));

    useEffect(() => setIcsUrl(calendar.icsUrl || ''), [calendar.icsUrl]);
    useEffect(() => setCalUrl((calendar as any).caldav?.url || ''), [(calendar as any).caldav?.url]);
    useEffect(() => setCalUser((calendar as any).caldav?.username || ''), [(calendar as any).caldav?.username]);
    useEffect(() => setCalPass((calendar as any).caldav?.password || ''), [(calendar as any).caldav?.password]);
    useEffect(() => setCalProxy(Boolean((calendar as any).caldav?.useProxy)), [(calendar as any).caldav?.useProxy]);

    return (
      <div className="space-y-3 p-3 rounded-lg bg-secondary-800/50 border border-secondary-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-secondary-100">Calendar</div>
            <div className="text-xs text-secondary-400">ICS or CalDAV monthly calendar</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={Boolean(calendar.enabled)}
              onChange={(e) => updateCalendar({ enabled: e.target.checked })}
            />
            <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-primary-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>

        {calendar.enabled && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-xs text-secondary-300">Source</div>
              </div>
              <select
                className="px-2 py-1 bg-secondary-900 border border-secondary-700 rounded text-secondary-100"
                value={(calendar as any).source || 'ics'}
                onChange={(e) => updateCalendar({ source: e.target.value as any })}
              >
                <option value="ics">ICS</option>
                <option value="caldav">CalDAV</option>
              </select>
            </div>

            {((calendar as any).source || 'ics') === 'ics' && (
              <div className="space-y-2">
                <label className="text-xs text-secondary-300">ICS URL</label>
                <input
                  type="url"
                  className="w-full px-3 py-2 bg-secondary-800 border border-secondary-700 rounded text-secondary-100 placeholder-secondary-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="/calendar.ics or https://example.com/feed.ics"
                  value={icsUrl}
                  onChange={(e) => setIcsUrl(e.target.value)}
                  onBlur={() => updateCalendar({ icsUrl })}
                />
              </div>
            )}

            {((calendar as any).source || 'ics') === 'caldav' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-secondary-300">CalDAV URL</label>
                  <input
                    type="url"
                    className="mt-1 w-full px-3 py-2 bg-secondary-800 border border-secondary-700 rounded text-secondary-100 placeholder-secondary-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="https://example.com/dav/calendars/user/calendar/"
                    value={calUrl}
                    onChange={(e) => setCalUrl(e.target.value)}
                    onBlur={() => updateCalDav('url', calUrl)}
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-secondary-300">
                      <input
                        type="checkbox"
                        checked={calProxy}
                        onChange={(e) => { setCalProxy(e.target.checked); updateCalDav('useProxy', e.target.checked); }}
                      />
                      Use server proxy
                    </label>
                    <button
                      type="button"
                      className="px-3 py-1 rounded bg-secondary-700 hover:bg-secondary-600 text-secondary-100 text-xs"
                      onClick={testCalDavConnection}
                      disabled={testing}
                    >
                      {testing ? 'Testing…' : 'Test connection'}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 rounded bg-secondary-700 hover:bg-secondary-600 text-secondary-100 text-xs"
                      onClick={discoverCalendars}
                      disabled={discovering}
                    >
                      {discovering ? 'Discovering…' : 'Discover calendars'}
                    </button>
                  </div>
                  {discoverError && (
                    <div className="text-xs text-red-400 mt-1">{discoverError}</div>
                  )}
                  {testMessage && !discoverError && (
                    <div className="text-xs text-secondary-300 mt-1">{testMessage}</div>
                  )}
                  {discoveredCalendars.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        className="flex-1 px-2 py-1 bg-secondary-800 border border-secondary-700 rounded text-secondary-100 text-xs"
                        value={selectedDiscovered}
                        onChange={(e) => setSelectedDiscovered(e.target.value)}
                      >
                        {discoveredCalendars.map((c) => (
                          <option key={c.href} value={c.href}>{c.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="px-3 py-1 rounded bg-primary-600 hover:bg-primary-500 text-white text-xs"
                        onClick={applyDiscovered}
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-secondary-300">Username</label>
                    <input
                      type="text"
                      className="mt-1 w-full px-3 py-2 bg-secondary-800 border border-secondary-700 rounded text-secondary-100 placeholder-secondary-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="username"
                      value={calUser}
                      onChange={(e) => setCalUser(e.target.value)}
                      onBlur={() => updateCalDav('username', calUser)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-secondary-300">Password</label>
                    <input
                      type="password"
                      className="mt-1 w-full px-3 py-2 bg-secondary-800 border border-secondary-700 rounded text-secondary-100 placeholder-secondary-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="password"
                      value={calPass}
                      onChange={(e) => setCalPass(e.target.value)}
                      onBlur={() => updateCalDav('password', calPass)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
};

export default calendarPlugin;
