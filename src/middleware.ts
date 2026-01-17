import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { AllLocales, AppConfig } from './utils/AppConfig';
import { checkSubscriptionStatus } from './utils-ssr/checkSubscription';

const intlMiddleware = createMiddleware({
  locales: AllLocales,
  localePrefix: AppConfig.localePrefix,
  defaultLocale: AppConfig.defaultLocale,
});

// Route constants
const ROUTES = {
  ORGANIZATION_SELECTION: '/onboarding/organization-selection',
  PAYMENT: '/onboarding/payment',
  DASHBOARD: '/dashboard',
  SIGN_IN: '/sign-in',
  SIGN_UP: '/sign-up',
} as const;

// Route matchers
const isProtectedRoute = createRouteMatcher([
  `${ROUTES.DASHBOARD}(.*)`,
  '/:locale/dashboard(.*)',
  `${ROUTES.ORGANIZATION_SELECTION}(.*)`,
  `/:locale${ROUTES.ORGANIZATION_SELECTION}(.*)`,
  `${ROUTES.PAYMENT}(.*)`,
  `/:locale${ROUTES.PAYMENT}(.*)`,
  '/checkout/success(.*)',
  '/:locale/checkout/success(.*)',
  '/checkout/cancel(.*)',
  '/:locale/checkout/cancel(.*)',
]);

const isPaidRoute = createRouteMatcher([
  `${ROUTES.DASHBOARD}(.*)`,
  '/:locale/dashboard(.*)',
]);

const isOnboardingRoute = createRouteMatcher([
  `${ROUTES.ORGANIZATION_SELECTION}(.*)`,
  `/:locale${ROUTES.ORGANIZATION_SELECTION}(.*)`,
  `${ROUTES.PAYMENT}(.*)`,
  `/:locale${ROUTES.PAYMENT}(.*)`,
  '/checkout(.*)',
  '/:locale/checkout(.*)',
]);

const isApiRoute = createRouteMatcher([
  '/api(.*)',
  '/api/webhooks(.*)',
  '/:locale/api(.*)',
]);

/**
 * Extracts locale from pathname
 * @param pathname - The request pathname
 * @returns The locale string (defaults to AppConfig.defaultLocale)
 */
function extractLocale(pathname: string): string {
  const match = pathname.match(/^\/([^/]+)/);
  const potentialLocale = match?.[1];
  return potentialLocale && AllLocales.includes(potentialLocale)
    ? potentialLocale
    : AppConfig.defaultLocale;
}

/**
 * Builds a localized URL
 * @param path - The path to localize
 * @param locale - The locale
 * @param baseUrl - The base URL (must be a valid URL string)
 * @returns A new URL object
 */
function buildLocalizedUrl(path: string, locale: string, baseUrl: string | URL): URL {
  const localizedPath = locale === AppConfig.defaultLocale ? path : `/${locale}${path}`;
  return new URL(localizedPath, baseUrl);
}

/**
 * Checks if the request should be processed by Clerk middleware
 */
function shouldProcessWithClerk(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  return (
    pathname.includes(ROUTES.SIGN_IN)
    || pathname.includes(ROUTES.SIGN_UP)
    || isProtectedRoute(request)
    || isApiRoute(request)
  );
}

export default function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  // Early return for routes that don't need Clerk processing
  if (!shouldProcessWithClerk(request)) {
    return intlMiddleware(request);
  }

  return clerkMiddleware(async (auth, req) => {
    const pathname = req.nextUrl.pathname;
    const locale = extractLocale(pathname);

    // Allow access to unprotected API routes
    if (isApiRoute(req) && !isProtectedRoute(req)) {
      return NextResponse.next();
    }

    const authObj = await auth();

    // Handle unauthenticated users
    if (!authObj.userId) {
      if (isProtectedRoute(req)) {
        const signInUrl = buildLocalizedUrl(ROUTES.SIGN_IN, locale, req.url);
        return NextResponse.redirect(signInUrl);
      }
      return intlMiddleware(req);
    }

    // Handle authenticated users without organization
    if (!authObj.orgId) {
      // Allow access to onboarding routes
      if (isOnboardingRoute(req)) {
        return intlMiddleware(req);
      }
      // Redirect to organization selection for other protected routes
      if (isProtectedRoute(req)) {
        const orgSelectionUrl = buildLocalizedUrl(
          ROUTES.ORGANIZATION_SELECTION,
          locale,
          req.url,
        );
        return NextResponse.redirect(orgSelectionUrl);
      }
      return intlMiddleware(req);
    }

    // Check subscription status only for paid routes
    if (isPaidRoute(req)) {
      const isPaid = await checkSubscriptionStatus(authObj.orgId);

      // Redirect to payment if subscription is not active
      if (!isPaid && !pathname.includes(ROUTES.PAYMENT)) {
        const paymentUrl = buildLocalizedUrl(ROUTES.PAYMENT, locale, req.url);
        return NextResponse.redirect(paymentUrl);
      }
    }

    // Protect authenticated routes
    if (isProtectedRoute(req)) {
      const signInUrl = buildLocalizedUrl(ROUTES.SIGN_IN, locale, req.url);
      await auth.protect({
        // `unauthenticatedUrl` is needed to avoid error: "Unable to find `next-intl` locale because the middleware didn't run on this request"
        unauthenticatedUrl: signInUrl.toString(),
      });
    }

    return intlMiddleware(req);
  })(request, event);
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next|monitoring).*)', '/', '/(api|trpc)(.*)'], // Also exclude tunnelRoute used in Sentry from the matcher
};
