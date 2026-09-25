import type { DeviceProfile } from '../types';

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
    { id: 'user', name: 'USER', bankMSB: 80, bankLSB: 0, programCount: 64 },
    { id: 'pr-a', name: 'PR-A', bankMSB: 81, bankLSB: 0, programCount: 64 },
    { id: 'pr-b', name: 'PR-B', bankMSB: 81, bankLSB: 1, programCount: 64 },
    { id: 'pr-c', name: 'PR-C', bankMSB: 81, bankLSB: 2, programCount: 64 },
    { id: 'pr-d', name: 'PR-D', bankMSB: 81, bankLSB: 3, programCount: 64 },
    { id: 'pr-e', name: 'PR-E', bankMSB: 81, bankLSB: 4, programCount: 64 },
    { id: 'xp-a', name: 'XP-A', bankMSB: 84, bankLSB: 0, programCount: 64 },
    { id: 'xp-b', name: 'XP-B', bankMSB: 84, bankLSB: 1, programCount: 64 },
    { id: 'xp-c', name: 'XP-C', bankMSB: 84, bankLSB: 2, programCount: 64 },
    { id: 'xp-d', name: 'XP-D', bankMSB: 84, bankLSB: 3, programCount: 64 },
    { id: 'xp-e', name: 'XP-E', bankMSB: 84, bankLSB: 4, programCount: 64 },
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
