import { OrganizationList } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getI18nPath } from '@/utils/Helpers';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'Dashboard',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function OrganizationSelectionPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const params = await props.params;
  const { orgId } = await auth();

  if (orgId) {
    return redirect(getI18nPath('/dashboard', params.locale));
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <OrganizationList
        afterSelectOrganizationUrl={getI18nPath('/onboarding/payment', params.locale)}
        afterCreateOrganizationUrl={getI18nPath('/onboarding/payment', params.locale)}
        hidePersonal
        skipInvitationScreen
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
