import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

// On native iOS, store the Supabase session in Preferences (NSUserDefaults with
// Data Protection) rather than unencrypted localStorage.
export const supabaseStorage = Capacitor.isNativePlatform()
  ? {
      getItem: (key: string) =>
        Preferences.get({ key }).then((r) => r.value),
      setItem: (key: string, value: string) =>
        Preferences.set({ key, value }),
      removeItem: (key: string) =>
        Preferences.remove({ key }),
    }
  : localStorage;
