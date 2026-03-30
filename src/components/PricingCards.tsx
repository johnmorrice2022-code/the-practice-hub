import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "£0",
    period: "forever",
    description: "Get started with the basics",
    features: [
      "10 questions per day",
      "GCSE Maths only",
      "AQA exam board",
      "Basic progress tracking",
    ],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Student",
    price: "£9",
    period: "per month",
    description: "Everything you need to succeed",
    features: [
      "Unlimited questions",
      "Maths and Physics",
      "All exam boards",
      "Full JAM Feedback",
      "Timed practice mode",
      "Complete progress tracking",
    ],
    cta: "Get started",
    featured: true,
  },
  {
    name: "School",
    price: "Custom",
    period: "per school",
    description: "For departments and whole schools",
    features: [
      "Managed student accounts",
      "Parent dashboard access",
      "Department analytics",
      "Custom billing",
      "Priority support",
    ],
    cta: "Contact us",
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
                  ? "bg-card border-primary ring-2 ring-primary/20"
                  : "bg-card border-border"
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
                <span className="text-sm text-muted-foreground ml-1">/{plan.period}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/signup">
                <Button
                  variant={plan.featured ? "hero" : "outline"}
                  className="w-full"
                >
                  {plan.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
