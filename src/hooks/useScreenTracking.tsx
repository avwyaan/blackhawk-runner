import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent } from "@/lib/analytics";

// Mounted once at the app root so every route change logs a screen_view,
// giving future analysis a basic funnel/bounce view for free.
export function useScreenTracking() {
  const location = useLocation();

  useEffect(() => {
    trackEvent("screen_view", { screen: location.pathname });
  }, [location.pathname]);
}
