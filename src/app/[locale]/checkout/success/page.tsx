import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { buttonVariants } from '@/components/ui/buttonVariants';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'CheckoutConfirmation',
  });

  return {
    title: t('title_bar'),
    description: t('message_state_description'),
  };
}

export default async function CheckoutSuccessPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'CheckoutConfirmation',
  });

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t('message_state_title')}</h1>
        <p className="mt-4 text-muted-foreground">
          {t('message_state_description')}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your subscription is being set up. You will be redirected to your dashboard shortly.
        </p>
        {searchParams.session_id && (
          <p className="mt-2 text-xs text-muted-foreground">
            Session ID:
            {' '}
            {searchParams.session_id}
          </p>
        )}
        <Link
          href="/dashboard"
          className={buttonVariants({
            className: 'mt-6',
          })}
        >
          {t('message_state_button')}
        </Link>
      </div>
    </div>
  );
}
