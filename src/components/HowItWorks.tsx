import { motion } from "framer-motion";
import { BookOpen, Brain, TrendingUp } from "lucide-react";

const steps = [
  {
    icon: BookOpen,
    title: "Pick your topic",
    description: "Choose your subject, exam board and the exact subtopic you want to practise. Foundation or Higher, we match you precisely.",
  },
  {
    icon: Brain,
    title: "Start a Jam Session",
    description: "Work through exam-style questions one at a time. Show your working, submit your answer, and get instant JAM Feedback before moving on.",
  },
  {
    icon: TrendingUp,
    title: "Track Your Journey",
    description: "See exactly where you're strong and where to focus next. Our adaptive system guides you towards the topics that will make the biggest difference.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-28">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold">
            How it <span className="text-accent-amber">works</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Three simple steps to better exam preparation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="bg-card rounded-xl p-8 card-shadow border border-border"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <step.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-3">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
