import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const reasons = [
  "Built by a qualified Physics teacher — not a tech company guessing at education",
  "Questions match real GCSE exam board style, mark schemes and grade boundaries",
  "AI marking that awards method marks, just like a real examiner",
  "Warm, encouraging feedback that never uses the word 'wrong'",
  "Fully adaptive — the platform learns where you need help most",
  "Works for AQA, Edexcel and OCR across Foundation and Higher tiers",
];

export function WhyHubJam() {
  return (
    <section className="py-20 md:py-28 bg-raised">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold">
            Why <span className="text-accent-amber">The Hub Jam</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            This is not another generic quiz app. Every detail is designed for GCSE success.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {reasons.map((reason, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="flex items-start gap-3 bg-card rounded-lg p-5 border border-border"
            >
              <CheckCircle2 className="w-5 h-5 text-success mt-0.5 shrink-0" />
              <p className="text-sm leading-relaxed">{reason}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
