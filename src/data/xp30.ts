import type { DeviceBank, DeviceProfile, Patch, Xps30Bank } from '../types';
import { XPS30_TONES } from './xps30-tones';
import type { Xps30Tone } from './xps30-tones';

/**
 * Roland XPS-30 device profile (the user's actual instrument — note: XPS-30,
 * not the older XP-30).
 *
 * Bank Select values are from Roland's official XPS-30 MIDI Implementation
 * chart (XPS-30_MIDI_Imple_eng02_W.pdf), so `verified` is now true:
 *
 *   MSB 87 / LSB 64-75 → Preset Patch 0001-1472 (PC 1-128 per sub-bank)
 *   MSB 87 / LSB 0     → User Patch 0501-0628
 *   MSB 87 / LSB 1     → User Patch 0629-0756
 *   MSB 121 / LSB 0-9  → GM Patch (LSB picks the variation)
 *   MSB 86 / LSB 64    → Preset Drum Kit 0001-0035
 *   MSB 120 / LSB 0    → GM Drum Kit
 *
 * The tone table in `xps30-tones.ts` is generated from the official XPS-30
 * Parameter Guide patch list, so every "Category + Number" the panel shows
 * (e.g. `Pf 501`) resolves to the exact MSB/LSB/Program that recalls it.
 */
const prstBanks: DeviceBank[] = Array.from({ length: 12 }, (_, i) => ({
  id: `prst-${i + 1}`,
  name: 'PRST',
  kind: 'preset',
  bankMSB: 87,
  bankLSB: 64 + i,
  programCount: i === 11 ? 64 : 128, // 0001-1472: last sub-bank holds 64
  programBase: 1 + i * 128,
}));

export const rolandXP30: DeviceProfile = {
  // id kept as 'roland-xp30' so already-saved app state keeps working.
  id: 'roland-xp30',
  name: 'Roland XPS-30',
  defaultChannel: 1,
  verified: true,
  banks: [
    ...prstBanks,
    { id: 'user-1', name: 'USER', kind: 'user', bankMSB: 87, bankLSB: 0, programCount: 128, programBase: 501 },
    { id: 'user-2', name: 'USER', kind: 'user', bankMSB: 87, bankLSB: 1, programCount: 128, programBase: 629 },
  ],
};

/** A "no fixed device" profile for pure custom-MIDI use with any synth. */
export const genericProfile: DeviceProfile = {
  id: 'generic',
  name: 'Generic MIDI device',
  defaultChannel: 1,
  verified: true,
  banks: [],
};

export const deviceProfiles: Record<string, DeviceProfile> = {
  [rolandXP30.id]: rolandXP30,
  [genericProfile.id]: genericProfile,
};

/** Turns a bank's kind into the exact word used in every message, so two
 * patches that share a display name (e.g. both renamed "Piano") never get
 * confused about whether they're a factory Preset, a User tone, or an
 * Expansion board tone — this label always goes in front of the number. */
export function bankKindLabel(kind: DeviceBank['kind']): string {
  switch (kind) {
    case 'user':
      return 'User Tone';
    case 'preset':
      return 'Preset Tone';
    case 'expansion':
      return 'Expansion Tone';
    default:
      return 'Tone';
  }
}

/** Pads a program number to a fixed width, e.g. 56 -> "056", matching how
 * the XPS-30's own panel numbers its patches. */
export function formatProgramNumber(program: number, digits = 3): string {
  return String(program).padStart(digits, '0');
}

// ---- XPS-30 tone picker ------------------------------------------------

const BANK_LABELS: Record<Xps30Bank, string> = {
  prst: 'PRST',
  gm: 'GM',
  user: 'USER',
  'drum-prst': 'PRST DRUM',
  'drum-gm': 'GM DRUM',
};

/** Short bank word as the XPS-30 shows it ("PRST", "USER", ...). */
export function xps30BankLabel(bank: Xps30Bank): string {
  return BANK_LABELS[bank];
}

const CODE_LABELS: Record<string, string> = {
  Pf: 'Piano / E.Piano',
  Ky: 'Organ / Keyboard',
  Gt: 'Guitar / Bass',
  St: 'Strings',
  Oc: 'Orchestra',
  Br: 'Brass / Woodwinds',
  Vo: 'Choir / Voice',
  Sy: 'Synth',
  Pd: 'Pad',
  Wr: 'World / FX',
  Sp: 'Phrase (Sample)',
  Dr: 'Drum Kit',
};

export function xps30CodeLabel(code: string): string {
  return CODE_LABELS[code] ?? 'Tone';
}

/** All category codes present in the patch list, in panel (list) order. */
export function xps30Codes(): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const t of XPS30_TONES) {
    if (!seen.has(t.c)) {
      seen.add(t.c);
      codes.push(t.c);
    }
  }
  return codes;
}

const byKey = new Map<string, Xps30Tone>();
const userByNo = new Map<number, Xps30Tone>();
const prstByNo = new Map<number, Xps30Tone>();
for (const t of XPS30_TONES) {
  if (t.b === 'user') userByNo.set(t.no, t);
  if (t.b === 'prst') prstByNo.set(t.no, t);
  const key = `${t.c}:${t.n}`;
  if (!byKey.has(key)) byKey.set(key, t); // file order = PRST first, so PRST wins ties over GM
}

/**
 * Turns what the XPS-30 screen shows — a category code plus a tone number,
 * e.g. `Pf 501` — into the exact Bank Select + Program Change that recalls
 * that one tone, no matter which bank it lives in.
 *
 * Resolution order:
 *  1. Exact "code + number" match in the official patch list
 *     (PRST 0001-1472 category numbers, GM, and USER 501-756 designations).
 *  2. Numbers 501-756 without an exact match → USER bank by formula
 *     (501-628 = MSB 87/LSB 0, 629-756 = MSB 87/LSB 1), because the panel
 *     only numbers USER tones in that range.
 *  3. Anything else ≤ 1472 → the PRST tone with that global panel number.
 *
 * Returns null when the number can't be resolved.
 */
export function resolveXps30Tone(code: string, number: number): Xps30Tone | null {
  const n = Math.floor(number);
  if (!Number.isFinite(n) || n < 1 || !code) return null;

  const exact = byKey.get(`${code}:${n}`);
  if (exact) return exact;

  if (n >= 501 && n <= 756) {
    const known = userByNo.get(n);
    if (known) return known;
    return {
      b: 'user',
      c: code,
      n,
      name: '',
      m: 87,
      l: n <= 628 ? 0 : 1,
      p: n <= 628 ? n - 500 : n - 628,
      no: n,
    };
  }

  if (n <= 1472) {
    const row = prstByNo.get(n);
    if (row) return row;
  }

  return null;
}

/** Builds the single unambiguous "what tone is this exactly" string used
 * in Test Patch results and the MIDI Monitor. Two differently-sourced
 * patches that end up with the same display name will still show a
 * different bankLabel here, because it's built from the original bank +
 * program, not from the (editable) patch name. */
export function describePatchOrigin(origin: Patch['origin']): string {
  if (origin.type === 'device-library') {
    const device = deviceProfiles[origin.deviceId];
    const bank = device?.banks.find((b) => b.id === origin.bankId);
    if (bank) {
      return `${bankKindLabel(bank.kind)} · ${bank.name} ${formatProgramNumber(origin.program)}`;
    }
  }
  if (origin.type === 'xps30-tone') {
    return `XPS-30 ${BANK_LABELS[origin.bank]} · ${origin.code} ${formatProgramNumber(origin.number)}`;
  }
  return 'Custom Patch';
}
