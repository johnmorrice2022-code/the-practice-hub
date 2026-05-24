import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '£0',
    period: 'forever',
    description: 'Try the platform at your own pace',
    features: [
      '10 practice questions per day',
      'GCSE Maths and Physics',
      'Pearson Edexcel and AQA',
      'AI marking and feedback',
      '2 JAM Help exchanges per question',
      'Progress tracking',
    ],
    cta: 'Start free',
    href: '/signup',
    featured: false,
  },
  {
    name: 'The Practice Hub',
    price: '£10.99',
    period: 'per month',
    description: 'Unlimited practice with full AI support',
    features: [
      'Unlimited practice questions',
      'GCSE Maths and Physics',
      'Pearson Edexcel and AQA',
      'AI marking and feedback',
      '5 JAM Help exchanges per question',
      'Full progress tracking',
    ],
    cta: 'Get started',
    href: 'https://buy.stripe.com/test_7sY9AM1Ua34U89q0DMf7i04',
    featured: true,
  },
  {
    name: 'Practice Hub + Livestreams',
    price: 'From £18.99',
    period: 'per month',
    description: 'Everything in The Practice Hub, plus weekly live teaching',
    features: [
      'Everything in The Practice Hub',
      'Weekly Maths livestreams (£18.99/mo)',
      'Weekly Physics livestreams (£18.99/mo)',
      'Maths and Physics livestreams (£24.99/mo)',
      'Foundation and Higher covered',
      'Members-only recordings',
    ],
    cta: 'See options',
    href: '/signup',
    featured: false,
  },
];

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className={`rounded-xl p-8 border card-shadow ${
                plan.featured
                  ? 'bg-card border-primary ring-2 ring-primary/20'
                  : 'bg-card border-border'
              }`}
            >
              {plan.featured && (
                <span className="inline-block text-xs font-semibold text-primary mb-3 bg-primary/10 px-3 py-1 rounded-full">
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
              <p className="text-sm text-muted-foreground mb-6">
                {plan.description}
              </p>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {plan.href.startsWith('http') ? (
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
