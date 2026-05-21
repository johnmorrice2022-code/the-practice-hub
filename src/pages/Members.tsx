import { useAuth } from '@/contexts/AuthContext';

const Members = () => {
  const { isSubscribed, subscriptionLoading } = useAuth();

  return (
    <div style={{ padding: 40 }}>
      <h1>Members Debug</h1>
      <p>subscriptionLoading: {String(subscriptionLoading)}</p>
      <p>isSubscribed: {String(isSubscribed)}</p>
    </div>
  );
};

export default Members;
