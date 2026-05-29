import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore
import Stripe from 'npm:stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PRICE_TO_TIER: Record<string, string> = {
  'price_1TY61I64C8nH7JLRp76K4fDu': 'platform',
  'price_1TY65l64C8nH7JLRWFVtLed9': 'platform_maths',
  'price_1TY68a64C8nH7JLRvGrJ5YKA': 'platform_physics',
  'price_1TY6AQ64C8nH7JLRspCVhegw': 'platform_both',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    return new Response('Missing environment variables', { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (err) {
    console.error('Signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.error('Processing event:', event.type);

  try {
    // ── checkout.session.completed ─────────────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode !== 'subscription' || !session.subscription || !session.customer) {
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // Identify user — client_reference_id first, then email fallback
      let userId: string | null = session.client_reference_id ?? null;
      if (!userId) {
        const email = (session.customer_details as any)?.email ?? null;
        if (email) {
          const { data: { users } } = await supabase.auth.admin.listUsers();
          userId = users.find((u: any) => u.email === email)?.id ?? null;
        }
      }

      if (!userId) {
        console.error('Cannot identify user');
        return new Response('Cannot identify user', { status: 400 });
      }

      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      // Retrieve full subscription so we get the correct price/tier/period
      // (customer.subscription.created fires before this event, so we can't rely on that handler)
      const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = stripeSub.items.data[0]?.price?.id ?? '';
      const tier = PRICE_TO_TIER[priceId] ?? 'platform';
      const periodEnd = stripeSub.current_period_end
        ? new Date(stripeSub.current_period_end * 1000).toISOString()
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      // Check if row already exists for this user
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('subscriptions')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            tier,
            status: 'active',
            current_period_end: periodEnd,
          })
          .eq('user_id', userId);
        if (error) throw new Error(`Update failed: ${JSON.stringify(error)}`);
      } else {
        const { error } = await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            tier,
            status: 'active',
            current_period_end: periodEnd,
          });
        if (error) throw new Error(`Insert failed: ${JSON.stringify(error)}`);
      }

      console.error('Subscription written for user:', userId, 'tier:', tier);
    }

    // ── customer.subscription.created / updated ────────────────────────────────
    // Updates tier/status from the full subscription object — no API call needed.
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price?.id ?? '';
      const tier = PRICE_TO_TIER[priceId] ?? 'platform';
      const status = sub.status === 'active' ? 'active'
        : sub.status === 'past_due' ? 'past_due'
        : 'cancelled';
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from('subscriptions')
        .update({ stripe_price_id: priceId, tier, status, current_period_end: periodEnd })
        .eq('stripe_subscription_id', sub.id);

      if (error) console.error('Tier update failed:', JSON.stringify(error));
    }

    // ── customer.subscription.deleted ─────────────────────────────────────────
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('stripe_subscription_id', sub.id);
      if (error) console.error('Cancel failed:', JSON.stringify(error));
    }
  } catch (err) {
    console.error('Handler error:', err.message);
    return new Response(`Handler error: ${err.message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});
