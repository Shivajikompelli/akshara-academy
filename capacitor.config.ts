import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.akshara.academy',
  appName: 'Akshara Academy',
  webDir: 'public',
  server: {
    url: 'http://192.168.0.5:3000',
    cleartext: true,
  },
};

export default config;
