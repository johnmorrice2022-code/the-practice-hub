import { motion } from "framer-motion";

const testimonials = [
  {
    quote: "The feedback actually tells me where I went astray in my working. No other app does that.",
    name: "Sophie",
    role: "Year 11 Student",
  },
  {
    quote: "I can see exactly which topics my daughter needs to focus on. It gives me real peace of mind.",
    name: "Mark",
    role: "Parent",
  },
  {
    quote: "Finally, practice questions that look and feel like the real exam. My students love it.",
    name: "Mrs Patel",
    role: "Head of Science",
  },
];

export function Testimonials() {
  return (
    <section className="py-20 md:py-28 bg-raised">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold">
            What people are <span className="text-accent-amber">saying</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className="bg-card rounded-xl p-8 border border-border card-shadow"
            >
              <p className="text-sm leading-relaxed italic text-foreground/80 mb-6">
                "{t.quote}"
              </p>
              <div>
                <p className="font-semibold text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
