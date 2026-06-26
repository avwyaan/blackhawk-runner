import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.blackhawk.runcart',
  appName: 'RunCart',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
  },
  // Live reload against local Vite dev server.
  // Set CAP_HOT_RELOAD=1 when running `npx cap run ios` locally.
  // Leave unset for TestFlight / App Store builds.
  ...(process.env.CAP_HOT_RELOAD === '1'
    ? {
        server: {
          url: 'http://localhost:5173',
          cleartext: true,
        },
      }
    : {}),
};

export default config;
