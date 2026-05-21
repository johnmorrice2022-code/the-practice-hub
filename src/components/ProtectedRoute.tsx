import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

const ProtectedRoute = ({
  children,
  requireOnboarding = false,
}: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(
    null
  );
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    if (!user) {
      setCheckingProfile(false);
      return;
    }

    const checkOnboarding = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        setOnboardingComplete(false);
      } else {
        setOnboardingComplete(data.onboarding_complete ?? false);
      }
      setCheckingProfile(false);
    };

    checkOnboarding();
  }, [user]);

  if (loading || checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9f3eb]">
        <div className="w-8 h-8 border-4 border-[#E23D28] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireOnboarding && !onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
