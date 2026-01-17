import { clerkClient } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { organizationSchema } from '@/models/Schema';
import { SUBSCRIPTION_STATUS } from '@/types/Subscription';

const stripe = new Stripe(Env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature' },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      Env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string,
          );

          // Get orgId from session metadata (organization already exists)
          const orgId = session.metadata?.orgId;
          if (!orgId) {
            console.error('No orgId in session metadata');
            break;
          }

          // Check if organization exists in database, if not create it
          const existingOrg = await db.query.organizationSchema.findFirst({
            where: eq(organizationSchema.id, orgId),
          });

          if (!existingOrg) {
            // Sync organization to database (org exists in Clerk but not in DB)
            await db.insert(organizationSchema).values({
              id: orgId,
              stripeCustomerId: subscription.customer as string,
              stripeSubscriptionId: subscription.id,
              stripeSubscriptionPriceId: subscription.items.data[0]?.price.id || null,
              stripeSubscriptionStatus: subscription.status,
              stripeSubscriptionCurrentPeriodEnd: (subscription as any).current_period_end ?? null,
            });
          } else {
            // Update existing organization with subscription
            await db.update(organizationSchema)
              .set({
                stripeCustomerId: subscription.customer as string,
                stripeSubscriptionId: subscription.id,
                stripeSubscriptionPriceId: subscription.items.data[0]?.price.id || null,
                stripeSubscriptionStatus: subscription.status,
                stripeSubscriptionCurrentPeriodEnd: (subscription as any).current_period_end ?? null,
              })
              .where(eq(organizationSchema.id, orgId));
          }

          // Sync subscription status to Clerk organization metadata
          const organizations = (await clerkClient()).organizations;
          const isActive = subscription.status === SUBSCRIPTION_STATUS.ACTIVE;
          await organizations.updateOrganizationMetadata(orgId, {
            publicMetadata: {
              subscriptionStatus: subscription.status,
              subscriptionActive: isActive,
            },
          });
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find organization by customer ID
        const org = await db.query.organizationSchema.findFirst({
          where: eq(organizationSchema.stripeCustomerId, customerId),
        });

        if (!org) {
          console.error('Organization not found for customer:', customerId);
          break;
        }

        await db.update(organizationSchema)
          .set({
            stripeSubscriptionStatus: subscription.status,
            stripeSubscriptionCurrentPeriodEnd: (subscription as any).current_period_end ?? null,
            ...(event.type === 'customer.subscription.deleted' && {
              stripeSubscriptionId: null,
              stripeSubscriptionPriceId: null,
            }),
          })
          .where(eq(organizationSchema.id, org.id));

        // Sync subscription status to Clerk organization metadata
        const organizations = (await clerkClient()).organizations;
        const isActive = subscription.status === SUBSCRIPTION_STATUS.ACTIVE;
        await organizations.updateOrganizationMetadata(org.id, {
          publicMetadata: {
            subscriptionStatus: subscription.status,
            subscriptionActive: isActive,
          },
        });
        break;
      }

      default:
        // eslint-disable-next-line no-console
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 },
    );
  }
}
