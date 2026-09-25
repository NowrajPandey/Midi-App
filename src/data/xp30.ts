import type { DeviceBank, DeviceProfile } from '../types';

/**
 * Roland XP-30 device profile.
 *
 * IMPORTANT — verify before relying on this live:
 * Roland's JV/XP-family romplers (JV-90, JV-1010, XP-60/80/30, etc.) share
 * one bank-select convention, confirmed independently by Roland's own
 * support notes for the XP-30:
 *
 *   Controller 0  (Bank Select MSB) picks the *group*:
 *     80 = User / internal RAM patches
 *     81 = factory Preset patches (PR-A..PR-E)
 *     84 = Expansion Board patches (XP-A..XP-E)
 *   Controller 32 (Bank Select LSB) picks the *sub-bank letter* inside
 *     that group (0 = A, 1 = B, 2 = C, 3 = D, 4 = E), each holding up
 *     to 64 patches.
 *
 * Sources: Roland/Sweetwater support note for the XP-30 ("Controller 32
 * selects the bank. Controller 0 selects standard [81] or expansion [84]
 * boards"), and the published JV-90 MIDI implementation table which uses
 * the same 81/LSB-per-letter layout. The exact program-count-per-bank and
 * whether USER has one 64-patch bank or more can differ slightly by model
 * — open the "MIDI Implementation" chapter of the actual XP-30 manual and
 * adjust `programCount` / bank list below if your unit disagrees. Until
 * you've checked that, `verified` stays false and the app will show a
 * small "unverified" hint next to the device name.
 */
export const rolandXP30: DeviceProfile = {
  id: 'roland-xp30',
  name: 'Roland XP-30',
  defaultChannel: 1,
  verified: false,
  banks: [
    { id: 'user', name: 'USER', kind: 'user', bankMSB: 80, bankLSB: 0, programCount: 64 },
    { id: 'pr-a', name: 'PR-A', kind: 'preset', bankMSB: 81, bankLSB: 0, programCount: 64 },
    { id: 'pr-b', name: 'PR-B', kind: 'preset', bankMSB: 81, bankLSB: 1, programCount: 64 },
    { id: 'pr-c', name: 'PR-C', kind: 'preset', bankMSB: 81, bankLSB: 2, programCount: 64 },
    { id: 'pr-d', name: 'PR-D', kind: 'preset', bankMSB: 81, bankLSB: 3, programCount: 64 },
    { id: 'pr-e', name: 'PR-E', kind: 'preset', bankMSB: 81, bankLSB: 4, programCount: 64 },
    { id: 'xp-a', name: 'XP-A', kind: 'expansion', bankMSB: 84, bankLSB: 0, programCount: 64 },
    { id: 'xp-b', name: 'XP-B', kind: 'expansion', bankMSB: 84, bankLSB: 1, programCount: 64 },
    { id: 'xp-c', name: 'XP-C', kind: 'expansion', bankMSB: 84, bankLSB: 2, programCount: 64 },
    { id: 'xp-d', name: 'XP-D', kind: 'expansion', bankMSB: 84, bankLSB: 3, programCount: 64 },
    { id: 'xp-e', name: 'XP-E', kind: 'expansion', bankMSB: 84, bankLSB: 4, programCount: 64 },
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
 * the XP-30's own panel numbers its patches. */
export function formatProgramNumber(program: number, digits = 3): string {
  return String(program).padStart(digits, '0');
}

/** Builds the single unambiguous "what tone is this exactly" string used
 * in Test Patch results and the MIDI Monitor. Two differently-sourced
 * patches that end up with the same display name will still show a
 * different bankLabel here, because it's built from the original bank +
 * program, not from the (editable) patch name. */
export function describePatchOrigin(
  origin: { type: 'custom' } | { type: 'device-library'; deviceId: string; bankId: string; program: number }
): string {
  if (origin.type === 'device-library') {
    const device = deviceProfiles[origin.deviceId];
    const bank = device?.banks.find((b) => b.id === origin.bankId);
    if (bank) {
      return `${bankKindLabel(bank.kind)} · ${bank.name} ${formatProgramNumber(origin.program)}`;
    }
  }
  return 'Custom Patch';
}
