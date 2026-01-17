'use client';
import * as React from 'react';

// If using TypeScript, add the following snippet to your file as well.
declare global {
  // eslint-disable-next-line ts/no-namespace
  namespace JSX {
    // eslint-disable-next-line ts/consistent-type-definitions
    interface IntrinsicElements {
      'stripe-pricing-table': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

function PricingPage() {
  // Paste the stripe-pricing-table snippet in your React component
  return (
    <stripe-pricing-table
      pricing-table-id={process.env.STRIPE_PRICING_TABLE_ID}
      publishable-key={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
    >
    </stripe-pricing-table>
  );
}

export default PricingPage;
