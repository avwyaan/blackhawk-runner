import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Registers the device for APNs push notifications, persists the token in
 * `device_tokens`, and deep-links to the tracker when a notification is tapped.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    if (!Capacitor.isNativePlatform()) return;

    let mounted = true;

    const register = async () => {
      const perm = await PushNotifications.checkPermissions();
      let status = perm.receive;
      if (status === "prompt" || status === "prompt-with-rationale") {
        const req = await PushNotifications.requestPermissions();
        status = req.receive;
      }
      if (status !== "granted") return;
      await PushNotifications.register();
    };

    const onRegistration = PushNotifications.addListener("registration", async (token) => {
      if (!mounted) return;
      try {
        await supabase
          .from("device_tokens")
          .upsert(
            { user_id: user.id, token: token.value, platform: Capacitor.getPlatform() },
            { onConflict: "user_id,token" }
          );
      } catch (e) {
        console.error("Failed to persist device token:", e);
      }
    });

    const onError = PushNotifications.addListener("registrationError", (err) => {
      console.error("Push registration error:", err);
    });

    const onTap = PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const runId = action.notification.data?.run_id;
      if (runId) navigate(`/run/${runId}/tracker`);
    });

    register();

    return () => {
      mounted = false;
      onRegistration.then((h) => h.remove());
      onError.then((h) => h.remove());
      onTap.then((h) => h.remove());
    };
  }, [user, navigate]);
}
