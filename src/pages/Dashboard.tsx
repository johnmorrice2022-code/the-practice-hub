import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Link, Navigate } from "react-router-dom";
import { BookOpen, Zap, Trophy } from "lucide-react";

const Dashboard = () => {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        {/* Greeting */}
        <div>
          <h1 className="text-3xl font-bold">
            Hey {firstName} <span className="text-accent-amber">👋</span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            Ready to practise? Jump into a Jam Session.
          </p>
        </div>

        {/* Primary CTA */}
        <Link to="/practice">
          <div className="bg-card rounded-xl p-8 card-shadow border border-border hover:border-primary/30 transition-colors cursor-pointer group">
            <div className="flex items-start gap-5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <h2 className="text-lg font-bold group-hover:text-primary transition-colors">
                  Start a Jam Session
                </h2>
                <p className="text-sm text-muted-foreground">
                  Pick your subject, topic, and tier — then answer exam-style questions at your level.
                </p>
              </div>
              <Button variant="default" size="sm" className="shrink-0 mt-1">
                Let's go
              </Button>
            </div>
          </div>
        </Link>

        {/* Quick stats placeholder row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl p-6 card-shadow border border-border space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BookOpen size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">Sessions this week</span>
            </div>
            <p className="text-2xl font-bold">0</p>
          </div>
          <div className="bg-card rounded-xl p-6 card-shadow border border-border space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Trophy size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">Weekly goal</span>
            </div>
            <p className="text-2xl font-bold">
              0 <span className="text-sm font-normal text-muted-foreground">/ 5</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
