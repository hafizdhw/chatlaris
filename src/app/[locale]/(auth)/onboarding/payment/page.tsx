import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { PricingCard } from '@/features/billing/PricingCard';
import { PricingFeature } from '@/features/billing/PricingFeature';
import { PricingPlanList } from '@/utils/AppConfig';
import { getI18nPath } from '@/utils/Helpers';
import { checkSubscriptionStatus } from '@/utils-ssr/checkSubscription';

import { CheckoutButton } from './CheckoutButton';
import { SubscriptionChecker } from './SubscriptionChecker';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'PricingPlan',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function PaymentPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const params = await props.params;
  const { orgId } = await auth();
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'PricingPlan',
  });

  // Redirect to organization selection if no org exists
  if (!orgId) {
    redirect(getI18nPath('/onboarding/organization-selection', params.locale));
  }

  const isPaid = await checkSubscriptionStatus(orgId);

  if (isPaid) {
    redirect(getI18nPath('/dashboard', params.locale));
  }

  return (
    <>
      {/* Client component that periodically checks subscription status */}
      <SubscriptionChecker locale={params.locale} />

      <div className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="w-full max-w-4xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold">Choose Your Plan</h1>
            <p className="mt-2 text-muted-foreground">
              Select a plan to get started.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-1 lg:grid-cols-1">
            {Object.values(PricingPlanList).map(plan => (
              <PricingCard
                key={plan.id}
                planId={plan.id}
                price={plan.price / 100} // Convert from cents
                interval={plan.interval}
                button={<CheckoutButton planId={plan.id} />}
              >
                <PricingFeature>
                  {t('feature_team_member', {
                    number: plan.features.teamMember,
                  })}
                </PricingFeature>

                <PricingFeature>
                  {t('feature_website', {
                    number: plan.features.website,
                  })}
                </PricingFeature>

                <PricingFeature>
                  {t('feature_storage', {
                    number: plan.features.storage,
                  })}
                </PricingFeature>

                <PricingFeature>
                  {t('feature_transfer', {
                    number: plan.features.transfer,
                  })}
                </PricingFeature>

                <PricingFeature>{t('feature_email_support')}</PricingFeature>
              </PricingCard>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
