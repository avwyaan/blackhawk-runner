import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, LogOut, Moon, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";

const Profile = () => {
  const { user, signOut } = useAuth();
  const { isAdmin, viewMode, setViewMode } = useUserRole();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setDisplayName(data.display_name);
      });
  }, [user]);

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      await signOut();
      navigate("/auth");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  };

  const updateProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() })
      .eq("user_id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Profile updated!");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-bold text-lg">Profile</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Your Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <Button onClick={updateProfile} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Admin Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <Label className="cursor-pointer">Admin Mode</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {viewMode === "admin"
                        ? "Group creation, invites, and oversight tools are visible"
                        : "Browsing like a regular member"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={viewMode === "admin"}
                  onCheckedChange={(checked) => setViewMode(checked ? "admin" : "user")}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className="w-4 h-4 text-muted-foreground" />
                <Label className="cursor-pointer">Dark Mode</Label>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
            </div>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          className="w-full text-destructive"
          onClick={async () => { await signOut(); navigate("/auth"); }}
        >
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="w-full text-destructive/70 hover:text-destructive">
              <Trash2 className="w-4 h-4 mr-2" /> Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes your profile, all orders, and group memberships. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={deleteAccount}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Yes, delete my account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default Profile;
