import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.akshara.academy',
  appName: 'Akshara Academy',
  webDir: 'public',
  server: {
    url: 'https://akshara-academy-eta.vercel.app',
    cleartext: false,
    allowNavigation: [
      'akshara-academy-eta.vercel.app',
      '*.supabase.co',
      '*.vercel.app',
    ],
  },
};

export default config;
