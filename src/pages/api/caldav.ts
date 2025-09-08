import type { APIRoute } from 'astro';

export const prerender = false;

async function doFetch(url: string, options: RequestInit) {
  // Node 18+ has global fetch; Astro server runtime supports fetch
  return await fetch(url, options);
}

function basicAuth(username: string, password: string) {
  const token = Buffer.from(`${username}:${password || ''}`).toString('base64');
  return `Basic ${token}`;
}

// Very lightweight XML helpers (avoid DOMParser on server)
function extractAll(text: string, tagLocal: string, nsHint?: string): string[] {
  const tag = tagLocal.split(':').pop();
  const re = new RegExp(`<[^>]*${tag}[^>]*>([\s\S]*?)<\\/[^>]*${tag}[^>]*>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const action = body?.action as 'report' | 'discover';
    const url = String(body?.url || '');
    const username = String(body?.username || '');
    const password = String(body?.password || '');
    const debug = !!body?.debug || process.env.CALDAV_DEBUG === '1';

    if (!url || !username) {
      return new Response(JSON.stringify({ error: 'Missing url or username' }), { status: 400 });
    }

    const headers: Record<string, string> = {};
    const authHeaderPresent = Boolean(username);
    if (authHeaderPresent) headers['Authorization'] = basicAuth(username, password);

    if (action === 'report') {
      const start = String(body?.start || '');
      const end = String(body?.end || '');
      const reportXml = `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">
  <d:prop><d:getetag/><c:calendar-data/></d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${start}" end="${end}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

      const reqInit: RequestInit = {
        method: 'REPORT',
        headers: {
          ...headers,
          'Content-Type': 'application/xml; charset=utf-8',
          'Depth': '1',
        },
        body: reportXml,
      };
      if (debug) {
        console.log('[CalDAV Proxy][REPORT] url=', url, 'headers(without auth)=', { ...reqInit.headers, Authorization: undefined });
      }
      const res = await doFetch(url, reqInit);
      const www = res.headers.get('www-authenticate') || '';
      const text = await res.text();
      if (!res.ok) {
        const details: any = { status: res.status, wwwAuthenticate: www, bodySnippet: text.slice(0, 300), authHeaderPresent, usernameHint: username ? `${username}` : '' };
        if (res.status === 403) {
          details.hint = 'REPORT must target a specific calendar collection (e.g., …/caldav/calendars/<user>/<calendar>/). Use discovery or set the collection URL.';
        }
        if (debug) console.warn('[CalDAV Proxy][REPORT] status=', res.status, 'authHeaderPresent=', authHeaderPresent, 'www-authenticate=', www, 'bodySnippet=', text.slice(0, 300));
        return new Response(JSON.stringify({ error: `REPORT failed ${res.status}`, details }), { status: 502, headers: { 'Content-Type': 'application/json' } });
      }
      const xml = text;
      // Extract all <calendar-data> blocks
      let calDataBlocks = extractAll(xml, 'calendar-data');
      // Fallback: some servers support ?export on a collection; try if no data
      if (!calDataBlocks.length) {
        const exportUrl = url.includes('?') ? url : `${url}${url.endsWith('/') ? '' : '/'}?export`;
        try {
          const expRes = await doFetch(exportUrl, { method: 'GET', headers: { ...headers } });
          const expText = await expRes.text();
          if (expRes.ok && /BEGIN:VCALENDAR/i.test(expText)) {
            calDataBlocks = [expText];
            if (debug) console.log('[CalDAV Proxy][EXPORT] Used export fallback at', exportUrl);
          } else if (debug) {
            console.warn('[CalDAV Proxy][EXPORT] Fallback failed status=', expRes.status);
          }
        } catch (e) {
          if (debug) console.warn('[CalDAV Proxy][EXPORT] Fallback error', (e as any)?.message);
        }
      }
      return new Response(JSON.stringify({ ics: calDataBlocks }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'discover') {
      // Try to find calendar-home-set and then list child calendars
      const propfindXml = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:current-user-principal/>
    <c:calendar-home-set/>
    <d:displayname/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`;

      const init0: RequestInit = {
        method: 'PROPFIND',
        headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8', 'Depth': '0' },
        body: propfindXml,
      };
      if (debug) console.log('[CalDAV Proxy][PROPFIND 0] url=', url, 'headers(without auth)=', { ...init0.headers, Authorization: undefined });
      const res0 = await doFetch(url, init0);
      const www0 = res0.headers.get('www-authenticate') || '';
      const xml0 = await res0.text();
      if (!res0.ok) return new Response(JSON.stringify({ error: `PROPFIND 0 failed ${res0.status}`, details: { status: res0.status, wwwAuthenticate: www0, bodySnippet: xml0.slice(0, 300), authHeaderPresent, usernameHint: username ? `${username}` : '' } }), { status: 502, headers: { 'Content-Type': 'application/json' } });

      const hrefsHome = extractAll(xml0, 'calendar-home-set');
      let homeHref = '';
      if (hrefsHome.length) {
        const inner = hrefsHome[0];
        const hrefCandidate = extractAll(inner, 'href')[0] || '';
        homeHref = hrefCandidate;
      }

      let homeUrl = homeHref ? new URL(homeHref, url).toString() : url;

      if (!homeHref) {
        // Try via current-user-principal
        const principals = extractAll(xml0, 'current-user-principal');
        const ph = principals.length ? extractAll(principals[0], 'href')[0] : '';
        if (ph) {
          const pUrl = new URL(ph, url).toString();
          const resP = await doFetch(pUrl, {
            method: 'PROPFIND',
            headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8', 'Depth': '0' },
            body: propfindXml,
          });
          if (resP.ok) {
            const xmlP = await resP.text();
            const homes = extractAll(xmlP, 'calendar-home-set');
            const hhref = homes.length ? extractAll(homes[0], 'href')[0] : '';
            if (hhref) homeUrl = new URL(hhref, pUrl).toString();
          }
        }
      }

      const init1: RequestInit = {
        method: 'PROPFIND',
        headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8', 'Depth': '1' },
        body: propfindXml,
      };
      if (debug) console.log('[CalDAV Proxy][PROPFIND 1] url=', homeUrl, 'headers(without auth)=', { ...init1.headers, Authorization: undefined });
      const res1 = await doFetch(homeUrl, init1);
      const www1 = res1.headers.get('www-authenticate') || '';
      const xml1 = await res1.text();
      if (!res1.ok) return new Response(JSON.stringify({ error: `PROPFIND 1 failed ${res1.status}`, details: { status: res1.status, wwwAuthenticate: www1, bodySnippet: xml1.slice(0, 300), authHeaderPresent, usernameHint: username ? `${username}` : '' } }), { status: 502, headers: { 'Content-Type': 'application/json' } });

      const responses = extractAll(xml1, 'response');
      let items: Array<{ href: string; name: string }> = [];
      for (const resp of responses) {
        const href = extractAll(resp, 'href')[0] || '';
        const resType = extractAll(resp, 'resourcetype')[0] || '';
        // Heuristics: calendar element OR supported-calendar-component-set OR calendar-description
        const propBlob = extractAll(resp, 'prop')[0] || resp;
        const looksCal = /<[^>]*calendar[^>]*\/>/i.test(resType) || /<[^>]*calendar[^>]*>/.test(resType)
          || /supported-calendar-component-set/i.test(propBlob)
          || /calendar-description/i.test(propBlob);
        if (!href || !isCal) continue;
        const name = extractAll(resp, 'displayname')[0] || href;
        const absHref = new URL(href, homeUrl).toString();
        items.push({ href: absHref, name });
      }

      // Synology/SabreDAV fallback: try /caldav/calendars/<username>/
      let guessedHome = '';
      if (items.length === 0 && username && /\/caldav\/?/i.test(url)) {
        const guessHome = new URL(`calendars/${encodeURIComponent(username)}/`, url).toString();
        guessedHome = guessHome;
        if (debug) console.log('[CalDAV Proxy][PROPFIND 1][fallback] url=', guessHome);
        const resF = await doFetch(guessHome, {
          method: 'PROPFIND',
          headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8', 'Depth': '1' },
          body: propfindXml,
        });
        const xmlF = await resF.text();
        if (resF.ok) {
          const responsesF = extractAll(xmlF, 'response');
          for (const resp of responsesF) {
            const href = extractAll(resp, 'href')[0] || '';
            const resType = extractAll(resp, 'resourcetype')[0] || '';
            const propBlob = extractAll(resp, 'prop')[0] || resp;
            const isCal = /<[^>]*calendar[^>]*\/>/i.test(resType) || /<[^>]*calendar[^>]*>/.test(resType)
              || /supported-calendar-component-set/i.test(propBlob)
              || /calendar-description/i.test(propBlob);
            if (!href || !isCal) continue;
            const name = extractAll(resp, 'displayname')[0] || href;
            const absHref = new URL(href, guessHome).toString();
            items.push({ href: absHref, name });
          }
        }
      }

      return new Response(JSON.stringify({ calendars: items, guessHome: guessedHome || homeUrl }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unexpected error' }), { status: 500 });
  }
};
