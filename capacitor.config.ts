import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nowraj.midipatch',
  appName: 'MIDI Patch',
  webDir: 'dist',
  android: {
    // USB devices only appear after the user grants permission via
    // the system dialog our native plugin triggers — nothing special
    // needed here, but keep webContentsDebuggingEnabled while developing.
    webContentsDebuggingEnabled: true,
  },
};

export default config;
