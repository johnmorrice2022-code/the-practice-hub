import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-navbar text-navbar-foreground">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <span className="text-xl font-bold">
              The Hub <span className="text-navbar-accent">Jam</span>
            </span>
            <p className="mt-3 text-sm text-navbar-foreground/60 leading-relaxed">
              Adaptive GCSE Maths and Physics practice, built by a qualified teacher.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-navbar-foreground/80">Platform</h4>
            <div className="space-y-2.5">
              <Link to="/#how-it-works" className="block text-sm text-navbar-foreground/50 hover:text-navbar-foreground/80 transition-colors">How It Works</Link>
              <Link to="/#pricing" className="block text-sm text-navbar-foreground/50 hover:text-navbar-foreground/80 transition-colors">Pricing</Link>
              <Link to="/signup" className="block text-sm text-navbar-foreground/50 hover:text-navbar-foreground/80 transition-colors">Get Started</Link>
            </div>
          </div>

          {/* Subjects */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-navbar-foreground/80">Subjects</h4>
            <div className="space-y-2.5">
              <span className="block text-sm text-navbar-foreground/50">GCSE Maths</span>
              <span className="block text-sm text-navbar-foreground/50">GCSE Physics</span>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-navbar-foreground/80">Legal</h4>
            <div className="space-y-2.5">
              <span className="block text-sm text-navbar-foreground/50">Privacy Policy</span>
              <span className="block text-sm text-navbar-foreground/50">Terms of Service</span>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-navbar-foreground/10 text-center">
          <p className="text-sm text-navbar-foreground/40">
            © {new Date().getFullYear()} The Hub Jam. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
