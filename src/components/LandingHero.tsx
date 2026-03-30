import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight">
            GCSE Maths and Physics,{" "}
            <span className="text-accent-amber">practised properly</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Adaptive exam-style questions, intelligent marking and clear feedback — built by a qualified Physics teacher who understands what students actually need.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button variant="hero" size="xl">
                Start practising free
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="outline" size="lg">
                See how it works
              </Button>
            </a>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            No card required · 10 free questions every day
          </p>
        </motion.div>
      </div>
    </section>
  );
}
