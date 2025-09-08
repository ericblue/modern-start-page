import type { APIRoute } from 'astro';

export const prerender = false;

const COOKIE_NAME = 'msp_auth';

export const GET: APIRoute = async ({ cookies, url, redirect }) => {
  // Clear cookie by setting maxAge to 0
  cookies.set(COOKIE_NAME, '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });

  const back = url.searchParams.get('redirectTo') || '/';
  return redirect(back);
};

