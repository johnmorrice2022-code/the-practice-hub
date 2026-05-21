import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
cat >
  (~/Desktop/eht - practice - hub - main / src / contexts / AuthContext.tsx) <<
    'EOF';
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
  refreshSubscription: () => Promise<void>;
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
  refreshSubscription: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [questionsUsed, setQuestionsUsed] = useState(0);

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

  const fetchSubscriptionData = async (userId: string) => {
    setSubscriptionLoading(true);
    try {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('tier, status, stripe_price_id, current_period_end')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
      setSubscription(subData ?? null);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('questions_used')
        .eq('id', userId)
        .single();
      setQuestionsUsed(profileData?.questions_used ?? 0);
    } catch {
      setSubscription(null);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchSubscriptionData(session.user.id);
    } else {
      setSubscription(null);
      setSubscriptionLoading(false);
      setQuestionsUsed(0);
    }
  }, [session]);

  const refreshSubscription = async () => {
    if (session?.user) {
      await fetchSubscriptionData(session.user.id);
    }
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
        refreshSubscription,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
EOF;
