import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Index from './pages/Index';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Practice from './pages/Practice';
import Journey from './pages/Journey';
import History from './pages/History';
import ParentDashboard from './pages/ParentDashboard';
import Hub from './pages/Hub';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import AuthCallback from './pages/AuthCallback';
import AdminDiagrams from './pages/admin/AdminDiagrams';
import AdminProbabilityQuestions from './pages/admin/AdminProbabilityQuestions';
import AdminHub from './pages/admin/AdminHub';
import AdminReviewQueue from './pages/admin/AdminReviewQueue';
import Members from './pages/Members';
import AdminMembers from './pages/admin/AdminMembers';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
import ResetPassword from './pages/ResetPassword';
import JamSessions from './pages/JamSessions';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/jam-sessions" element={<JamSessions />} />

            {/* Onboarding — auth required, no onboarding check */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute requireOnboarding={false}>
                  <OnboardingFlow />
                </ProtectedRoute>
              }
            />

            {/* Protected routes — auth + onboarding required */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requireOnboarding={true}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/practice"
              element={
                <ProtectedRoute requireOnboarding={true}>
                  <Practice />
                </ProtectedRoute>
              }
            />
            <Route
              path="/journey"
              element={
                <ProtectedRoute requireOnboarding={true}>
                  <Journey />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute requireOnboarding={true}>
                  <History />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parent"
              element={
                <ProtectedRoute requireOnboarding={true}>
                  <ParentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hub"
              element={
                <ProtectedRoute requireOnboarding={true}>
                  <Hub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute requireOnboarding={true}>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/members"
              element={
                <ProtectedRoute requireOnboarding={true}>
                  <Members />
                </ProtectedRoute>
              }
            />

            {/* Admin routes — no onboarding check */}
            <Route path="/admin" element={<AdminHub />} />
            <Route path="/admin/diagrams" element={<AdminDiagrams />} />
            <Route
              path="/admin/probability-questions"
              element={<AdminProbabilityQuestions />}
            />
            <Route path="/admin/review-queue" element={<AdminReviewQueue />} />
            <Route path="/admin/members" element={<AdminMembers />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
