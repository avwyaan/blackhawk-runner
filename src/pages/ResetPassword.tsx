import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Listen for the recovery event Supabase fires after parsing the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || (event === "INITIAL_SESSION" && session)) {
        setIsValidSession(true);
        setChecking(false);
      }
    });

    // Manually parse hash in case the event already fired before mount
    const hash = window.location.hash;
    if (hash.includes("access_token") && hash.includes("type=recovery")) {
      const params = new URLSearchParams(hash.substring(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
          if (!error) setIsValidSession(true);
          setChecking(false);
        });
      } else {
        setChecking(false);
      }
    } else {
      // Fallback: check existing session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setIsValidSession(true);
        setChecking(false);
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully!");
      await supabase.auth.signOut();
      navigate("/auth");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight">Reset Password</h1>
          <p className="text-muted-foreground">Choose a new password for your account</p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-display">New Password</CardTitle>
            <CardDescription>
              {isValidSession
                ? "Enter your new password below"
                : "Waiting for recovery link to be verified..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  disabled={!isValidSession}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  disabled={!isValidSession}
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold"
                disabled={loading || !isValidSession}
              >
                {loading ? "Updating..." : "Update Password"}
                {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
              </Button>
            </form>

            <button
              onClick={() => navigate("/auth")}
              className="w-full text-center text-sm text-muted-foreground hover:underline mt-4"
            >
              ← Back to sign in
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
