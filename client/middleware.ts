import createMiddleware from 'next-intl/middleware';
import { withAuth } from 'next-auth/middleware';
import { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['ko', 'en'],
  defaultLocale: 'ko',
});

const authMiddleware = withAuth(
  // @ts-ignore
  function onSuccess(req) {
    return intlMiddleware(req);
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
);

export default function middleware(req: NextRequest) {
  const publicPathnameRegex = RegExp(
    `^(/(${['ko', 'en'].join('|')}))?(/($|login|register))`,
    'i'
  );
  const isPublicPage = publicPathnameRegex.test(req.nextUrl.pathname);

  if (isPublicPage) {
    return intlMiddleware(req);
  } else {
    // @ts-ignore
    return authMiddleware(req);
  }
}

export const config = {
  // Match all pathnames except for
  // - /api (API routes)
  // - /_next (Next.js internals)
  // - /static (static files)
  // - /favicon.ico, /sitemap.xml, /robots.txt (metadata files)
  matcher: ['/((?!api|_next|static|favicon.ico|sitemap.xml|robots.txt).*)'],
};
