import createMiddleware from 'next-intl/middleware';
import { withAuth } from 'next-auth/middleware';
import { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['ko', 'en'],
  defaultLocale: 'ko',
});

const authMiddleware = withAuth(
  function onSuccess(req: NextRequest) {
    return intlMiddleware(req);
  },
  {
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  },
);

export default function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Explicit private paths that require authorization (with optional locale prefixes)
  const privatePathnameRegex = RegExp(
    `^(/(${['ko', 'en'].join('|')}))?/(dashboard|projects|settings)`,
    'i',
  );
  const isPrivatePage = privatePathnameRegex.test(pathname);

  if (isPrivatePage) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (authMiddleware as any)(req);
  } else {
    return intlMiddleware(req);
  }
}

export const config = {
  // Match all pathnames except for
  // - /api (API routes)
  // - /_next (Next.js internals)
  // - /static (static files)
  // - /favicon.ico, /sitemap.xml, /robots.txt, /manifest.json, /manifest.webmanifest (metadata files)
  matcher: [
    '/((?!api|_next|static|images|manifest.json|manifest.webmanifest|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
