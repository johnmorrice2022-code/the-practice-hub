import { motion } from "framer-motion";

export function FounderSection() {
  return (
    <section id="about" className="py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="bg-card rounded-xl p-10 md:p-14 card-shadow border border-border text-center"
        >
          <div className="w-20 h-20 rounded-full bg-secondary mx-auto mb-6 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary">HJ</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Built by a <span className="text-accent-amber">teacher</span>, for students
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            The Hub Jam was created by a qualified Physics teacher who saw first-hand how students struggled to find high-quality, exam-focused practice. Every question, every piece of feedback and every design choice reflects years of classroom experience — not guesswork.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
