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

const organizationSelectionUrl = '/onboarding/organization-selection';
const paymentUrl = '/onboarding/payment';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/:locale/dashboard(.*)',
  `${organizationSelectionUrl}(.*)`,
  `/:locale${organizationSelectionUrl}(.*)`,
  `${paymentUrl}(.*)`,
  `/:locale${paymentUrl}(.*)`,
  '/checkout/success(.*)',
  '/:locale/checkout/success(.*)',
  '/checkout/cancel(.*)',
  '/:locale/checkout/cancel(.*)',
]);

const isPaidRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/:locale/dashboard(.*)',
]);

const isApiRoute = createRouteMatcher([
  '/api(.*)',
  '/api/webhooks(.*)',
  '/:locale/api(.*)',
]);

export default function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  if (
    request.nextUrl.pathname.includes('/sign-in')
    || request.nextUrl.pathname.includes('/sign-up')
    || isProtectedRoute(request)
    || isApiRoute(request)
  ) {
    return clerkMiddleware(async (auth, req) => {
      // Allow access to API routes
      if (isApiRoute(req) && !isProtectedRoute(req)) {
        return NextResponse.next();
      }

      const authObj = await auth();

      // Get subscription status using utility function
      const isPaid = await checkSubscriptionStatus(authObj.orgId);

      // If user is authenticated but has no org, redirect to organization-selection
      // (except if they're already on onboarding/checkout pages)
      if (
        authObj.userId
        && !authObj.orgId && isProtectedRoute(req)
      ) {
        const locale = req.nextUrl.pathname.match(/(\/.*)\/dashboard/)?.at(1) ?? '';
        const orgSelectionUrl = new URL(
          `${locale}${organizationSelectionUrl}`,
          req.url,
        );

        if (!req.nextUrl.pathname.includes(organizationSelectionUrl)) {
          return NextResponse.redirect(orgSelectionUrl);
        }
      }

      if (!!authObj.orgId && isProtectedRoute(req) && isPaidRoute(req) && !isPaid) {
        const locale = req.nextUrl.pathname.match(/(\/.*)\/dashboard/)?.at(1) ?? '';
        const paymentUrlObj = new URL(`${locale}${paymentUrl}`, req.url);
        if (!req.nextUrl.pathname.includes(paymentUrl)) {
          return NextResponse.redirect(paymentUrlObj);
        }
      }

      if (isProtectedRoute(req) && !!authObj.orgId) {
        const locale
          = req.nextUrl.pathname.match(/(\/.*)\/dashboard/)?.at(1) ?? '';

        const signInUrl = new URL(`${locale}/sign-in`, req.url);

        await auth.protect({
          // `unauthenticatedUrl` is needed to avoid error: "Unable to find `next-intl` locale because the middleware didn't run on this request"
          unauthenticatedUrl: signInUrl.toString(),
        });
      }

      return intlMiddleware(req);
    })(request, event);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next|monitoring).*)', '/', '/(api|trpc)(.*)'], // Also exclude tunnelRoute used in Sentry from the matcher
};
