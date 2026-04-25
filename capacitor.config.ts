import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a5459423d6b84dc783b2314f0431e6fd',
  appName: 'RunCart',
  webDir: 'dist',
  // Hot-reload from the Lovable sandbox during development only.
  // Set CAP_HOT_RELOAD=1 when running `npx cap run` locally.
  // For TestFlight / App Store builds, leave it unset so the app loads
  // the bundled `dist/` and works fully offline-capable.
  ...(process.env.CAP_HOT_RELOAD === '1'
    ? {
        server: {
          url: 'https://a5459423-d6b8-4dc7-83b2-314f0431e6fd.lovableproject.com?forceHideBadge=true',
          cleartext: true,
        },
      }
    : {}),
};

export default config;
