import { useContext, useEffect, useMemo, useState } from 'react';
import { ConfigContext } from './ConfigProvider';
import type { UserConfig } from '../config/types';
import { Icon } from './Icon';

type CalendarEvent = {
  uid?: string;
  start: Date;
  end?: Date;
  summary?: string;
  location?: string;
};

function parseIcs(content: string): CalendarEvent[] {
  // Handle folded lines: lines that start with space are continuations
  const unfolded = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .reduce<string[]>((acc, line) => {
      if ((/^\s/.test(line)) && acc.length) {
        acc[acc.length - 1] += line.replace(/^\s/, '');
      } else {
        acc.push(line);
      }
      return acc;
    }, []);

  const events: CalendarEvent[] = [];
  let inEvent = false;
  let cur: Partial<CalendarEvent> = {};

  const parseDate = (val?: string): Date | undefined => {
    if (!val) return undefined;
    // Remove timezone or parameters before ':'
    const idx = val.indexOf(':');
    const raw = idx >= 0 ? val.slice(idx + 1) : val;
    // Date (YYYYMMDD) or DateTime (YYYYMMDDTHHMMSSZ)
    if (/^\d{8}$/.test(raw)) {
      const y = Number(raw.slice(0, 4));
      const m = Number(raw.slice(4, 6)) - 1;
      const d = Number(raw.slice(6, 8));
      return new Date(y, m, d);
    }
    // Try to parse as ISO; convert to proper format
    const dt = raw.replace(
      /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/,
      '$1-$2-$3T$4:$5:$6$7'
    );
    const date = new Date(dt);
    return isNaN(date.getTime()) ? undefined : date;
  };

  for (const line of unfolded) {
    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      cur = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (inEvent && cur.start) {
        events.push(cur as CalendarEvent);
      }
      inEvent = false;
      cur = {};
    } else if (inEvent) {
      if (line.startsWith('UID')) cur.uid = line.split(':').slice(1).join(':');
      else if (line.startsWith('DTSTART')) cur.start = parseDate(line) as Date;
      else if (line.startsWith('DTEND')) cur.end = parseDate(line);
      else if (line.startsWith('SUMMARY')) cur.summary = line.split(':').slice(1).join(':');
      else if (line.startsWith('LOCATION')) cur.location = line.split(':').slice(1).join(':');
    }
  }

  return events;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const CalendarWidget = ({ config: configProp }: { config?: UserConfig }) => {
  const ctx = useContext(ConfigContext);
  const config = configProp ?? ctx.config;
  const widgets = config.widgets || ({} as any);
  const calendarCfg = widgets.calendar || { enabled: false, icsUrl: '', source: 'ics' as const };

  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to format a date to CalDAV time-range format (UTC)
  const toCaldavTime = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${y}${m}${day}T${hh}${mm}${ss}Z`;
  };

  useEffect(() => {
    const load = async () => {
      if (!calendarCfg.enabled) return;
      setLoading(true);
      setError(null);

      try {
        if ((calendarCfg.source || 'ics') === 'ics') {
          if (!calendarCfg.icsUrl) {
            setEvents([]);
            setError('No calendar URL set');
            return;
          }
          const res = await fetch(calendarCfg.icsUrl);
          if (!res.ok) throw new Error(`Failed to fetch ICS (${res.status})`);
          const text = await res.text();
          const parsed = parseIcs(text);
          setEvents(parsed);
          return;
        }

        // CalDAV source
        const cal = (calendarCfg.caldav as any) || { url: '', username: '', password: '', useProxy: false };
        if (!cal.url || !cal.username) {
          setEvents([]);
          setError('Missing CalDAV URL or username');
          return;
        }

        // Query a wider range (current month ± 1 month) to catch recurrences
        const monthStart = startOfMonth(currentMonth);
        const prevMonthStart = startOfMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
        const nextMonthEnd = endOfMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
        const start = new Date(Date.UTC(prevMonthStart.getFullYear(), prevMonthStart.getMonth(), prevMonthStart.getDate(), 0, 0, 0));
        const end = new Date(Date.UTC(nextMonthEnd.getFullYear(), nextMonthEnd.getMonth(), nextMonthEnd.getDate(), 23, 59, 59));

        const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<c:calendar-query xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">` +
          `<d:prop><d:getetag/><c:calendar-data/></d:prop>` +
          `<c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">` +
          `<c:time-range start="${toCaldavTime(start)}" end="${toCaldavTime(end)}"/>` +
          `</c:comp-filter></c:comp-filter></c:filter>` +
          `</c:calendar-query>`;
        if (cal.useProxy) {
          const res = await fetch('/api/caldav', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'report',
              url: cal.url,
              username: cal.username,
              password: cal.password,
              start: toCaldavTime(start),
              end: toCaldavTime(end),
            }),
          });
          let data: any = null;
          try { data = await res.json(); } catch {}
          if (!res.ok) {
            const reason = data?.error || `CalDAV proxy failed (${res.status})`;
            const auth = data?.details?.wwwAuthenticate ? ` Auth: ${data.details.wwwAuthenticate}` : '';
            const hint = data?.details?.hint ? ` Hint: ${data.details.hint}` : '';
            throw new Error(`${reason}${auth}${hint}`);
          }
          if (!data) throw new Error('Empty response from CalDAV proxy');
          const icsBlocks = (data?.ics as string[] | undefined) || [];
          const allEvents = icsBlocks.flatMap((s) => parseIcs(s || '')) || [];
          setEvents(allEvents);
        } else {
          const auth = typeof btoa !== 'undefined' ? 'Basic ' + btoa(`${cal.username}:${cal.password || ''}`) : '';
          const res = await fetch(cal.url, {
            method: 'REPORT',
            headers: {
              'Content-Type': 'application/xml; charset=utf-8',
              'Depth': '1',
              ...(auth ? { 'Authorization': auth } : {}),
            },
            body,
          } as RequestInit);

          if (!res.ok) {
            throw new Error(`CalDAV query failed (${res.status})`);
          }

          const xmlText = await res.text();
          // Parse XML and extract all calendar-data blocks
          const parser = new DOMParser();
          const doc = parser.parseFromString(xmlText, 'application/xml');
          // Handle XML parser errors
          const parserErr = doc.getElementsByTagName('parsererror');
          if (parserErr && parserErr.length) {
            throw new Error('Failed to parse CalDAV response');
          }
          const icsStrings: string[] = [];
          // Try namespace-aware first
          const calDataNs = doc.getElementsByTagNameNS('urn:ietf:params:xml:ns:caldav', 'calendar-data');
          for (let i = 0; i < calDataNs.length; i++) {
            icsStrings.push(calDataNs[i].textContent || '');
          }
          if (icsStrings.length === 0) {
            // Fallback by tag name (some servers may not include prefixes as expected)
            const calData = doc.getElementsByTagName('calendar-data');
            for (let i = 0; i < calData.length; i++) {
              icsStrings.push(calData[i].textContent || '');
            }
          }
          const allEvents = icsStrings.flatMap((s) => parseIcs(s || ''));
          setEvents(allEvents);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load calendar');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [
    calendarCfg.enabled,
    calendarCfg.source,
    calendarCfg.icsUrl,
    calendarCfg.caldav?.url,
    calendarCfg.caldav?.username,
    calendarCfg.caldav?.password,
    (calendarCfg.caldav as any)?.useProxy,
    currentMonth,
  ]);

  if (!calendarCfg.enabled) return null;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const startWeekday = monthStart.getDay(); // 0=Sun
  const daysInMonth = monthEnd.getDate();

  // Build calendar cells including leading/trailing blanks to complete weeks
  const firstCellDate = new Date(monthStart);
  firstCellDate.setDate(firstCellDate.getDate() - startWeekday);

  const cells = Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(firstCellDate);
    d.setDate(firstCellDate.getDate() + i);
    return d;
  });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const start = ev.start;
      const end = ev.end || ev.start;
      // Iterate days from start to end inclusive (simple, no tz handling)
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      while (cur <= last) {
        const key = cur.toISOString().slice(0, 10);
        const list = map.get(key) || [];
        list.push(ev);
        map.set(key, list);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [events]);

  // Simple check whether any events fall within the current visible month
  const hasMonthEvents = useMemo(() => {
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();
    for (const [key, list] of eventsByDay) {
      if (!list.length) continue;
      const d = new Date(key);
      if (d.getMonth() === month && d.getFullYear() === year) return true;
    }
    return false;
  }, [eventsByDay, currentMonth]);

  const monthLabel = currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const weekdayLabels = Array.from({ length: 7 }).map((_, i) =>
    new Date(2020, 5, 7 + i).toLocaleDateString(undefined, { weekday: 'short' })
  );

  return (
    <div className="rounded-lg overflow-hidden border border-white">
      <div className="flex items-center justify-between px-3 py-2 border-b border-secondary-600 bg-secondary-700/50">
        <div className="flex items-center gap-2 text-secondary-200 text-sm">
          <Icon name="Calendar" size={16} className="text-primary-500" />
          <span className="capitalize">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 text-sm rounded bg-secondary-700 hover:bg-secondary-600"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            className="px-2 py-1 text-sm rounded bg-secondary-700 hover:bg-secondary-600"
            onClick={() => setCurrentMonth(startOfMonth(new Date()))}
          >
            Today
          </button>
          <button
            className="px-2 py-1 text-sm rounded bg-secondary-700 hover:bg-secondary-600"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      {loading && (
        <div className="p-4 text-sm text-secondary-300">Loading events…</div>
      )}
      {error && (
        <div className="p-4 text-sm text-red-400">{error}</div>
      )}
      {!loading && !error && !hasMonthEvents && (
        <div className="p-4 text-sm text-secondary-400">No events this month.</div>
      )}

      <div className="p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-px bg-secondary-700 rounded">
          {weekdayLabels.map((w) => (
            <div key={w} className="text-center text-xs sm:text-sm py-2 text-secondary-200 bg-secondary-800">
              {w}
            </div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-px bg-secondary-700 rounded">
          {cells.map((d) => {
            const inMonth = d.getMonth() === currentMonth.getMonth();
            const key = d.toISOString().slice(0, 10);
            const dayEvents = eventsByDay.get(key) || [];
            const today = isSameDay(d, new Date());
            return (
              <div key={key} className={`h-24 sm:h-28 p-1 bg-secondary-900 ${inMonth ? '' : 'opacity-40'}`}>
                <div className="flex items-center justify-between text-xs text-secondary-300">
                  <div className={`w-6 h-6 flex items-center justify-center rounded ${today ? 'bg-primary-500 text-white' : ''}`}>{d.getDate()}</div>
                </div>
                <div className="mt-1 space-y-1 overflow-hidden">
                  {dayEvents.slice(0, 2).map((ev, idx) => (
                    <div key={idx} className="truncate text-[10px] sm:text-xs px-1 py-0.5 rounded bg-primary-500/20 text-primary-300">
                      {ev.summary || 'Event'}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-[10px] sm:text-xs text-secondary-400">+{dayEvents.length - 2} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CalendarWidget;
