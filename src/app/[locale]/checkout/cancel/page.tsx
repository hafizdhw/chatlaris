import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { buttonVariants } from '@/components/ui/buttonVariants';

export default async function CheckoutCancelPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const params = await props.params;
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'CheckoutConfirmation',
  });

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t('title_bar')}</h1>
        <p className="mt-4 text-muted-foreground">
          {t('message_state_description')}
        </p>
        <Link
          href="/onboarding/payment"
          className={buttonVariants({
            className: 'mt-6',
          })}
        >
          Try Again
        </Link>
      </div>
    </div>
  );
}
