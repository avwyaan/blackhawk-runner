import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Home from "./pages/Home";
import CreateRun from "./pages/CreateRun";
import ActiveRunFriend from "./pages/ActiveRunFriend";
import ActiveRunRunner from "./pages/ActiveRunRunner";
import RunTracker from "./pages/RunTracker";
import { usePushNotifications } from "./hooks/usePushNotifications";
import Groups from "./pages/Groups";
import RunHistory from "./pages/RunHistory";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  usePushNotifications();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
