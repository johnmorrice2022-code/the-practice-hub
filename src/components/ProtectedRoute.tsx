import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({
  children,
  requireOnboarding = true,
  requireAdmin = false,
}: ProtectedRouteProps) => {
  const { user, loading, onboardingComplete, onboardingLoading, isAdmin } = useAuth();

  if (loading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9f3eb]">
        <div className="w-8 h-8 border-4 border-[#E23D28] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // On the onboarding route: if already complete, send to dashboard
  if (!requireOnboarding && onboardingComplete) {
    return <Navigate to="/dashboard" replace />;
  }

  // On protected routes: if onboarding not done, send to onboarding
  if (requireOnboarding && !onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
