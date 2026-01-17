'use client';

import { useState } from 'react';

import { buttonVariants } from '@/components/ui/buttonVariants';
import { PricingPlanList } from '@/utils/AppConfig';

export function CheckoutButton(props: { planId: string }) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    try {
      setLoading(true);

      const plan = PricingPlanList[props.planId];
      if (!plan) {
        console.error('Plan not found:', props.planId);
        return;
      }

      // Get the appropriate price ID based on environment
      const env = process.env.NEXT_PUBLIC_BILLING_PLAN_ENV || 'dev';
      let priceId = '';

      if (env === 'prod') {
        priceId = plan.prodPriceId;
      } else if (env === 'dev') {
        priceId = plan.devPriceId;
      } else {
        priceId = plan.testPriceId;
      }

      if (!priceId) {
        console.error('Price ID not configured for this plan:', props.planId);
        return;
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: props.planId,
          priceId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCheckout}
      disabled={loading}
      className={buttonVariants({
        size: 'sm',
        className: 'mt-5 w-full',
      })}
    >
      {loading ? 'Processing...' : 'Continue to Payment'}
    </button>
  );
}
