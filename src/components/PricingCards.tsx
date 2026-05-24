import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';

const freePlan = {
  name: 'Free',
  price: '£0',
  period: 'forever',
  description: 'Try the platform at your own pace — no credit card needed',
  features: [
    '10 practice questions per day',
    'GCSE Maths and Physics',
    'Pearson Edexcel and AQA',
    'Access to Free Lesson Monday's',
    'Intelligent marking and feedback',
    '2 JAM Help exchanges per question',
    'Progress tracking',
  ],
  cta: 'Start free',
  href: '/signup',
  external: false,
  featured: false,
};

const paidPlans = [
  {
    name: 'The Practice Hub',
    price: '£10.99',
    period: 'per month',
    description: 'Unlimited practice with full AI support',
    features: [
      'Unlimited practice questions',
      'GCSE Maths and Physics',
      'Pearson Edexcel and AQA',
      'Intelligent marking and feedback',
      '5 JAM Help exchanges per question',
      'Full progress tracking',
    ],
    cta: 'Get started',
    href: 'https://buy.stripe.com/test_7sY9AM1Ua34U89q0DMf7i04',
    external: true,
    featured: false,
  },
  {
    name: 'Practice Hub + Maths Livestreams',
    price: '£18.99',
    period: 'per month',
    description: 'Unlimited practice plus weekly live Maths teaching.',
    features: [
      'Everything in The Practice Hub',
      'Weekly members-only Maths livestreams',
      'Foundation and Higher covered',
      'Members-only recordings',
    ],
    cta: 'Get started',
    href: 'https://buy.stripe.com/test_eVq6oA42i20Q75meuCf7i05',
    external: true,
    featured: false,
  },
  {
    name: 'Practice Hub + Physics Livestreams',
    price: '£18.99',
    period: 'per month',
    description: 'Unlimited practice plus weekly live Physics teaching.',
    features: [
      'Everything in The Practice Hub',
      'Weekly members-only Physics livestreams',
      'Foundation and Higher covered',
      'Members-only recordings',
    ],
    cta: 'Get started',
    href: 'https://buy.stripe.com/test_eVq5kw7eu5d2blCgCKf7i06',
    external: true,
    featured: false,
  },
  {
    name: 'Practice Hub + Maths & Physics Livestreams',
    price: '£24.99',
    period: 'per month',
    description:
      'The complete package — unlimited practice and live teaching, for both subjects',
    features: [
      'Everything in The Practice Hub',
      'Weekly Maths and Physics livestreams',
      'Foundation and Higher covered',
      'Members-only recordings',
    ],
    cta: 'Get started',
    href: 'https://buy.stripe.com/test_28E9AMdCSaxm75mfyGf7i07',
    external: true,
    featured: true,
  },
];

function PlanCard({ plan, index }: { plan: typeof freePlan; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className={`rounded-xl p-8 border card-shadow flex flex-col ${
        plan.featured
          ? 'bg-card border-primary ring-2 ring-primary/20'
          : 'bg-card border-border'
      }`}
    >
      {plan.featured && (
        <span className="inline-block text-xs font-semibold text-primary mb-3 bg-primary/10 px-3 py-1 rounded-full self-start">
          Most popular
        </span>
      )}
      <h3 className="text-xl font-bold">{plan.name}</h3>
      <div className="mt-3 mb-1">
        <span className="text-3xl font-bold">{plan.price}</span>
        <span className="text-sm text-muted-foreground ml-1">
          /{plan.period}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>
      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {plan.external ? (
        <a
          href={plan.href}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full block"
        >
          <Button
            variant={plan.featured ? 'hero' : 'outline'}
            className="w-full"
          >
            {plan.cta}
          </Button>
        </a>
      ) : (
        <Link to={plan.href}>
          <Button
            variant={plan.featured ? 'hero' : 'outline'}
            className="w-full"
          >
            {plan.cta}
          </Button>
        </Link>
      )}
    </motion.div>
  );
}

export function PricingCards() {
  return (
    <section id="pricing" className="py-20 md:py-28">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold">
            Simple, fair <span className="text-accent-amber">pricing</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Start free. Upgrade when you are ready.
          </p>
        </div>

        {/* Free tier — full width */}
        <div className="mb-8">
          <PlanCard plan={freePlan} index={0} />
        </div>

        {/* Paid tiers — 2 column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {paidPlans.map((plan, i) => (
            <PlanCard key={plan.name} plan={plan} index={i + 1} />
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          All plans include a free tier to try before you commit. No credit card
          required to start.
        </p>
      </div>
    </section>
  );
}
