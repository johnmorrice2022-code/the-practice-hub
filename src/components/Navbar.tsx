import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";

const navLinks = [
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
  { label: "About", href: "/#about" },
];

const appLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Practice", href: "/practice" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isLanding = location.pathname === "/";
  const isLoggedIn = !!user;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const links = isLoggedIn && !isLanding ? appLinks : isLanding ? navLinks : [];

  return (
    <nav className="sticky top-0 z-50 bg-navbar border-b border-navbar/10">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to={isLoggedIn ? "/dashboard" : "/"} className="flex items-center gap-2">
          <img src={logo} alt="The Hub Jam" className="h-[4rem] w-auto text-lg" />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) =>
            isLanding ? (
              <a
                key={link.href}
                href={link.href}
                className="text-navbar-foreground/70 hover:text-navbar-foreground text-sm font-medium transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                to={link.href}
                className={`text-sm font-medium transition-colors ${
                  location.pathname === link.href
                    ? "text-navbar-foreground"
                    : "text-navbar-foreground/70 hover:text-navbar-foreground"
                }`}
              >
                {link.label}
              </Link>
            )
          )}

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-navbar-foreground/80 hover:text-navbar-foreground hover:bg-navbar-foreground/10"
              >
                <LogOut size={16} className="mr-1.5" />
                Sign out
              </Button>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-navbar-foreground/80 hover:text-navbar-foreground hover:bg-navbar-foreground/10">
                    Log in
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button variant="navbar" size="default">
                    Get started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-navbar-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-navbar border-t border-navbar-foreground/10 px-6 py-4 space-y-3 animate-fade-in">
          {links.map((link) =>
            isLanding ? (
              <a
                key={link.href}
                href={link.href}
                className="block text-navbar-foreground/70 hover:text-navbar-foreground text-sm font-medium py-2"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                to={link.href}
                className={`block text-sm font-medium py-2 ${
                  location.pathname === link.href
                    ? "text-navbar-foreground"
                    : "text-navbar-foreground/70 hover:text-navbar-foreground"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            )
          )}
          <div className="flex flex-col gap-2 pt-2">
            {isLoggedIn ? (
              <Button
                variant="ghost"
                onClick={() => { handleSignOut(); setMobileOpen(false); }}
                className="w-full text-navbar-foreground/80 hover:text-navbar-foreground hover:bg-navbar-foreground/10"
              >
                <LogOut size={16} className="mr-1.5" />
                Sign out
              </Button>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full text-navbar-foreground/80 hover:text-navbar-foreground hover:bg-navbar-foreground/10">
                    Log in
                  </Button>
                </Link>
                <Link to="/signup" onClick={() => setMobileOpen(false)}>
                  <Button variant="navbar" className="w-full">
                    Get started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
