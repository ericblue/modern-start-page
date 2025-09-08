import type { APIRoute } from 'astro';

export const prerender = false;

const COOKIE_NAME = 'msp_auth';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Read password from env or fallback. This is a simple gate, not hardened security.
const PASSWORD = process.env.LOGIN_PASSWORD || 'changeme';

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  try {
    // Support both form submissions and JSON payloads
    let password = '';
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { password?: string; redirectTo?: string };
      password = body.password || '';
    } else {
      const form = await request.formData();
      password = String(form.get('password') || '');
    }

    if (password !== PASSWORD) {
      // On failure, redirect back with error flag if form submitted, else return JSON
      if (!contentType.includes('application/json')) {
        const back = url.searchParams.get('redirectTo') || '/';
        return redirect(`${back}?login=failed`);
      }
      return new Response(JSON.stringify({ success: false, error: 'Invalid password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Set long-lived, httpOnly cookie
    cookies.set(COOKIE_NAME, '1', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: ONE_YEAR_SECONDS,
      secure: process.env.NODE_ENV === 'production',
    });

    // Redirect for forms, JSON response for XHR
    if (!contentType.includes('application/json')) {
      const back = url.searchParams.get('redirectTo') || '/';
      return redirect(back);
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Unexpected error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

