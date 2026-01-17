'use client';

import { useOrganization } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { getI18nPath } from '@/utils/Helpers';

type SubscriptionCheckerProps = {
  locale: string;
  checkInterval?: number; // in milliseconds, default 3000 (3 seconds)
  maxChecks?: number; // maximum number of checks, default 20 (1 minute total)
};

type SubscriptionMetadata = {
  subscriptionActive?: boolean;
  subscriptionStatus?: string;
};

/**
 * Client component that periodically checks if the user has an active subscription
 * using Clerk's organization metadata. Redirects to dashboard when subscription becomes active.
 */
export function SubscriptionChecker(props: SubscriptionCheckerProps) {
  const { locale, checkInterval = 3000, maxChecks = 20 } = props;
  const { organization, isLoaded } = useOrganization();
  const router = useRouter();
  const checkCountRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // Don't start checking until organization data is loaded
    if (!isLoaded) {
      return;
    }

    const checkSubscription = () => {
      // Prevent multiple redirects
      if (hasRedirectedRef.current) {
        return;
      }

      const metadata = organization?.publicMetadata as SubscriptionMetadata | undefined;
      const isPaid = metadata?.subscriptionActive === true;

      if (isPaid) {
        // Subscription is active, redirect to dashboard
        hasRedirectedRef.current = true;
        const dashboardPath = getI18nPath('/dashboard', locale);
        router.push(dashboardPath);
        return;
      }

      checkCountRef.current += 1;

      // Stop checking after max attempts
      if (checkCountRef.current >= maxChecks) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    // Start checking immediately, then at intervals
    checkSubscription();
    intervalRef.current = setInterval(checkSubscription, checkInterval);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [organization, isLoaded, locale, checkInterval, maxChecks, router]);

  // This component doesn't render anything
  return null;
}
