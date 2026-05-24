import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface Subscription {
  tier: 'platform' | 'platform_maths' | 'platform_physics' | 'platform_both';
  status: 'active' | 'cancelled' | 'past_due';
  stripe_price_id: string;
  current_period_end: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  subscription: Subscription | null;
  subscriptionLoading: boolean;
  isSubscribed: boolean;
  hasMathsStreams: boolean;
  hasPhysicsStreams: boolean;
  questionsUsed: number;
  onboardingComplete: boolean;
  onboardingLoading: boolean;
  refreshSubscription: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  subscription: null,
  subscriptionLoading: true,
  isSubscribed: false,
  hasMathsStreams: false,
  hasPhysicsStreams: false,
  questionsUsed: 0,
  onboardingComplete: false,
  onboardingLoading: true,
  refreshSubscription: async () => {},
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [questionsUsed, setQuestionsUsed] = useState(0);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    return () => authSub.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string, initialLoad = false) => {
    setSubscriptionLoading(true);
    if (initialLoad) setOnboardingLoading(true);
    try {
      const [subResult, profileResult] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('tier, status, stripe_price_id, current_period_end')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('questions_used, questions_used_date, onboarding_complete')
          .eq('id', userId)
          .maybeSingle(),
      ]);

      setSubscription(subResult.data ?? null);

      const today = new Date().toISOString().split('T')[0];
      const usedDate = profileResult.data?.questions_used_date ?? null;
      const questionsUsedToday =
        usedDate === today ? (profileResult.data?.questions_used ?? 0) : 0;
      setQuestionsUsed(questionsUsedToday);
      setOnboardingComplete(profileResult.data?.onboarding_complete ?? false);
    } catch {
      setSubscription(null);
      setOnboardingComplete(false);
    } finally {
      setSubscriptionLoading(false);
      if (initialLoad) setOnboardingLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchUserData(session.user.id, true);
    } else if (!loading) {
      setSubscription(null);
      setSubscriptionLoading(false);
      setQuestionsUsed(0);
      setOnboardingComplete(false);
      setOnboardingLoading(false);
    }
  }, [session, loading]);

  const refreshSubscription = async () => {
    if (session?.user) await fetchUserData(session.user.id);
  };

  const refreshProfile = async () => {
    if (session?.user) await fetchUserData(session.user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isSubscribed = subscription?.status === 'active';
  const hasMathsStreams =
    isSubscribed &&
    (subscription?.tier === 'platform_maths' ||
      subscription?.tier === 'platform_both');
  const hasPhysicsStreams =
    isSubscribed &&
    (subscription?.tier === 'platform_physics' ||
      subscription?.tier === 'platform_both');

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        subscription,
        subscriptionLoading,
        isSubscribed,
        hasMathsStreams,
        hasPhysicsStreams,
        questionsUsed,
        onboardingComplete,
        onboardingLoading,
        refreshSubscription,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
