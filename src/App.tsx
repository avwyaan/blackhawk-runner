import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import Auth from "./pages/Auth";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { useScreenTracking } from "./hooks/useScreenTracking";
import { setAnalyticsUser } from "./lib/analytics";

// Auth stays eager — it is the first screen for a signed-out user, and the app
// is signed out on a cold start more often than not. Everything else is split
// out so the initial chunk carries only what the login screen needs.
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Home = lazy(() => import("./pages/Home"));
const CreateRun = lazy(() => import("./pages/CreateRun"));
const ActiveRunFriend = lazy(() => import("./pages/ActiveRunFriend"));
const ActiveRunRunner = lazy(() => import("./pages/ActiveRunRunner"));
const RunTracker = lazy(() => import("./pages/RunTracker"));
const Groups = lazy(() => import("./pages/Groups"));
const RunHistory = lazy(() => import("./pages/RunHistory"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A paused/unreachable backend should be retried, not surfaced instantly
      // as a hard failure — but not so long that the UI feels hung.
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 30_000,
      // Capacitor apps are resumed far more often than reloaded; refetching on
      // focus is how a backgrounded app gets fresh data.
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-screen text-muted-foreground">
    Loading...
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  // Mounted once inside Router + AuthProvider so push listeners aren't re-registered on navigation.
  usePushNotifications();
  useScreenTracking();

  const { user } = useAuth();
  useEffect(() => {
    setAnalyticsUser(user?.id ?? null);
  }, [user]);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/create-run" element={<ProtectedRoute><CreateRun /></ProtectedRoute>} />
        <Route path="/run/:runId" element={<ProtectedRoute><ActiveRunFriend /></ProtectedRoute>} />
        <Route path="/run/:runId/runner" element={<ProtectedRoute><ActiveRunRunner /></ProtectedRoute>} />
        <Route path="/run/:runId/tracker" element={<ProtectedRoute><RunTracker /></ProtectedRoute>} />
        <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><RunHistory /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
