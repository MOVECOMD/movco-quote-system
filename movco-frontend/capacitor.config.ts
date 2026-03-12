import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uk.co.movco.app',
  appName: 'MOVCO',
  webDir: 'out',
  server: {
    url: 'https://movco-quote-system.vercel.app',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0a0f1c',
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: '#0a0f1c',
      style: 'DARK',
    },
  },
  android: {
    backgroundColor: '#0a0f1c',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    backgroundColor: '#0a0f1c',
    contentInset: 'automatic',
    scheme: 'MOVCO',
  },
};

export default config;
