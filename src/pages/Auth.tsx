import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ShoppingBag, ArrowRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const RESEND_COOLDOWN = 60;

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  // OTP verification state
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset email sent! Check your inbox.");
      setShowForgot(false);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        if (
          error.message?.includes("not on the invite list") ||
          error.message?.includes("check_allowed_email") ||
          error.message?.includes("Database error saving new user") ||
          error.status === 500
        ) {
          toast.error("This email is not on the invite list. Please reach out to the admin for an invite.");
        } else {
          toast.error(error.message);
        }
      } else {
        setShowOtp(true);
        setResendTimer(RESEND_COOLDOWN);
        toast.success("A verification code has been sent to your email!");
      }
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "signup",
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account verified successfully!");
    }
    setLoading(false);
  };

  const handleResendOtp = useCallback(async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("A new verification code has been sent!");
      setResendTimer(RESEND_COOLDOWN);
    }
    setLoading(false);
  }, [resendTimer, email]);

  if (showOtp) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold font-display tracking-tight">Verify Email</h1>
            <p className="text-muted-foreground">
              Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-display">Verification Code</CardTitle>
              <CardDescription>Check your inbox (and spam folder)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                onClick={handleVerifyOtp}
                className="w-full h-12 text-base font-semibold"
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying..." : "Verify & Create Account"}
                {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
              </Button>

              <div className="text-center">
                <button
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0 || loading}
                  className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend code"}
                </button>
              </div>

              <button
                onClick={() => { setShowOtp(false); setOtp(""); }}
                className="w-full text-center text-sm text-muted-foreground hover:underline"
              >
                ← Back to sign up
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight">RunCart</h1>
          <p className="text-muted-foreground">Group orders, simplified.</p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-display">
              {isLogin ? "Welcome back" : "Create account"}
            </CardTitle>
            <CardDescription>
              {isLogin ? "Sign in to your account" : "Join your friends on RunCart"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    required={!isLogin}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
                {loading ? "..." : isLogin ? "Sign In" : "Create Account"}
                {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary font-medium hover:underline"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
