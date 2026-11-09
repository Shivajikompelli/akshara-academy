import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.akshara.academy',
  appName: 'Akshara Academy',
  webDir: 'public',
  server: {
    url: 'https://akshara-academy-eta.vercel.app',
    cleartext: false,
  },
};

export default config;
