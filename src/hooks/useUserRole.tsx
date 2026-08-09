import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ViewMode = "user" | "admin";

const VIEW_MODE_KEY = "runcart:viewMode";

export function useUserRole() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewModeRaw, setViewModeRaw] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || "user"
  );

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const setViewMode = (mode: ViewMode) => {
    localStorage.setItem(VIEW_MODE_KEY, mode);
    setViewModeRaw(mode);
  };

  // Non-admins are always in user mode, regardless of what's in storage.
  const viewMode: ViewMode = isAdmin ? viewModeRaw : "user";

  return { isAdmin, viewMode, setViewMode };
}
