import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

import { Env } from '@/libs/Env';
import { PricingPlanList } from '@/utils/AppConfig';

const stripe = new Stripe(Env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization required. Please create or select an organization first.' },
        { status: 400 },
      );
    }

    const { priceId, planId } = await request.json();

    if (!priceId || !planId) {
      return NextResponse.json(
        { error: 'Price ID and Plan ID are required' },
        { status: 400 },
      );
    }

    // Validate plan exists
    const plan = PricingPlanList[planId];
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 },
      );
    }

    // Get the correct price ID based on environment
    const env = Env.BILLING_PLAN_ENV;
    let selectedPriceId = '';

    if (env === 'prod') {
      selectedPriceId = plan.prodPriceId;
    } else if (env === 'dev') {
      selectedPriceId = plan.devPriceId;
    } else {
      selectedPriceId = plan.testPriceId;
    }

    // Use provided priceId if it matches, otherwise use environment-specific one
    const finalPriceId = priceId === selectedPriceId ? priceId : selectedPriceId;

    if (!finalPriceId) {
      return NextResponse.json(
        { error: 'Price ID not configured for this environment' },
        { status: 400 },
      );
    }

    const baseUrl = Env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer_email: undefined, // Will be collected in checkout
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/onboarding/payment`,
      metadata: {
        userId,
        orgId,
        planId,
      },
      subscription_data: {
        metadata: {
          orgId,
          planId,
        },
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
