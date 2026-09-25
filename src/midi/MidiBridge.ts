import { registerPlugin, Capacitor } from '@capacitor/core';
import type { MidiConnectionState, MidiDeviceInfo, MidiOutMessageLog } from '../types';

/**
 * Shape of the native Android plugin (implemented in Kotlin — see
 * /android-native-plugin/MidiPlugin.kt). Capacitor marshals these calls
 * over the JS<->native bridge; on Android this talks to android.media.midi.
 */
export interface MidiPatchNativePlugin {
  /** Ask the OS for USB MIDI devices + trigger the permission dialog. */
  requestDevice(): Promise<{ granted: boolean }>;
  /** Current connection snapshot, so the UI can sync on resume. */
  getStatus(): Promise<{ state: MidiConnectionState; device: MidiDeviceInfo | null }>;
  /** Send one three-message "patch select" burst (Bank MSB/LSB + PC). */
  sendPatch(options: {
    channel: number; // 1-16
    bankMSB: number | null; // 0-127 or null to skip
    bankLSB: number | null; // 0-127 or null to skip
    program: number; // 1-128
    sendBankSelect: boolean;
    sendProgramChange: boolean;
  }): Promise<{ ok: boolean; raw: string[] }>;
  addListener(
    eventName: 'connectionChange',
    listenerFunc: (data: { state: MidiConnectionState; device: MidiDeviceInfo | null }) => void
  ): Promise<{ remove: () => void }>;
}

const NativeMidiPatch = registerPlugin<MidiPatchNativePlugin>('MidiPatch');

// ---- Web MIDI fallback (desktop browser dev only; Android WebView has no
// Web MIDI, so this path never runs on-device — it just lets you build and
// sanity-check the UI/patch logic with `npm run dev` before touching a
// phone) ---------------------------------------------------------------

class WebMidiFallback {
  // Typed as `any` on purpose: the Web MIDI API types aren't in lib.dom
  // by default and this whole class only ever runs in a desktop dev
  // browser, never on-device (see isNative routing below).
  private output: any | null = null;
  private listeners: Array<(s: MidiConnectionState, d: MidiDeviceInfo | null) => void> = [];

  async requestDevice() {
    if (!('requestMIDIAccess' in navigator)) return { granted: false };
    const access = await (navigator as any).requestMIDIAccess({ sysex: false });
    const first = Array.from(access.outputs.values())[0] as any | undefined;
    if (first) {
      this.output = first;
      this.emit('connected', { id: first.id, name: first.name ?? 'MIDI Output' });
      return { granted: true };
    }
    this.emit('disconnected', null);
    return { granted: false };
  }

  async getStatus() {
    return {
      state: (this.output ? 'connected' : 'disconnected') as MidiConnectionState,
      device: this.output ? { id: this.output.id, name: this.output.name ?? 'MIDI Output' } : null,
    };
  }

  async sendPatch(options: Parameters<MidiPatchNativePlugin['sendPatch']>[0]) {
    const raw: string[] = [];
    if (!this.output) return { ok: false, raw };
    const ch = Math.max(0, Math.min(15, options.channel - 1));
    const send = (bytes: number[]) => {
      this.output!.send(bytes);
      raw.push(bytes.map((b) => b.toString(16).padStart(2, '0')).join(' '));
    };
    if (options.sendBankSelect) {
      if (options.bankMSB !== null) send([0xb0 | ch, 0x00, options.bankMSB]);
      if (options.bankLSB !== null) send([0xb0 | ch, 0x20, options.bankLSB]);
    }
    if (options.sendProgramChange) {
      send([0xc0 | ch, Math.max(0, Math.min(127, options.program - 1))]);
    }
    return { ok: true, raw };
  }

  addListener(_e: 'connectionChange', fn: (d: any) => void) {
    const wrapped = (s: MidiConnectionState, d: MidiDeviceInfo | null) => fn({ state: s, device: d });
    this.listeners.push(wrapped);
    return Promise.resolve({ remove: () => (this.listeners = this.listeners.filter((l) => l !== wrapped)) });
  }

  private emit(state: MidiConnectionState, device: MidiDeviceInfo | null) {
    this.listeners.forEach((l) => l(state, device));
  }
}

const isNative = Capacitor.isNativePlatform();
const webFallback = new WebMidiFallback();

/** Public API the React app uses — routes to native on-device, Web MIDI in dev. */
export const midiBridge = {
  isNative,
  requestDevice: () => (isNative ? NativeMidiPatch.requestDevice() : webFallback.requestDevice()),
  getStatus: () => (isNative ? NativeMidiPatch.getStatus() : webFallback.getStatus()),
  sendPatch: (options: Parameters<MidiPatchNativePlugin['sendPatch']>[0]) =>
    isNative ? NativeMidiPatch.sendPatch(options) : webFallback.sendPatch(options),
  addListener: (fn: (data: { state: MidiConnectionState; device: MidiDeviceInfo | null }) => void) =>
    isNative
      ? NativeMidiPatch.addListener('connectionChange', fn)
      : webFallback.addListener('connectionChange', fn),
};

export function buildMonitorEntry(
  raw: string[],
  patchName: string,
  bankLabel: string,
  channel: number,
  bankMSB: number | null,
  bankLSB: number | null,
  program: number
): MidiOutMessageLog {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    patchName,
    bankLabel,
    channel,
    bankMSB,
    bankLSB,
    program,
    raw,
  };
}
