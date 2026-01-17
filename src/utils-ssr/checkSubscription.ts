import { clerkClient } from '@clerk/nextjs/server';

type SubscriptionMetadata = {
  subscriptionActive?: boolean;
  subscriptionStatus?: string;
};

/**
 * Checks if a user's organization has an active subscription.
 * Uses Clerk API to fetch organization metadata.
 * Optimized for Edge runtime compatibility.
 *
 * @param orgId - The organization ID
 * @returns Promise<boolean> - true if subscription is active
 */
export async function checkSubscriptionStatus(
  orgId: string | null | undefined,
): Promise<boolean> {
  if (!orgId) {
    return false;
  }

  try {
    const org = await (await clerkClient()).organizations.getOrganization({
      organizationId: orgId,
    });
    const metadata = org?.publicMetadata as SubscriptionMetadata | undefined;
    return metadata?.subscriptionActive === true;
  } catch (error) {
    // If API call fails, log error and return false (conservative approach)
    console.error('Failed to fetch organization subscription status:', error);
    return false;
  }
}
