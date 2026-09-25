// ---- Core data model -------------------------------------------------

/** The raw MIDI values needed to recall one exact tone. */
export interface MidiPatchValues {
  channel: number; // 1-16 (user-facing; converted to 0-15 on the wire)
  bankMSB: number | null; // 0-127, or null to skip sending Bank Select MSB
  bankLSB: number | null; // 0-127, or null to skip sending Bank Select LSB
  program: number; // 1-128 (user-facing; converted to 0-127 on the wire)
}

export type PadAccentColor =
  | 'blue'
  | 'green'
  | 'orange'
  | 'purple'
  | 'red'
  | 'teal'
  | 'yellow'
  | 'gray';

/** Which XPS-30 list a tone comes from (matches the panel's bank field). */
export type Xps30Bank = 'prst' | 'gm' | 'user' | 'drum-prst' | 'drum-gm';

export interface PadAppearance {
  icon: string; // an emoji, kept simple + offline (no icon font dependency)
  accentColor: PadAccentColor;
  subtitle?: string; // e.g. "PR-B - 042"
  showSubtitle: boolean;
}

export interface Patch {
  id: string;
  name: string;
  values: MidiPatchValues;
  appearance: PadAppearance;
  /** Where this patch came from, purely informational / for editing UX. */
  origin:
    | { type: 'custom' }
    | { type: 'device-library'; deviceId: string; bankId: string; program: number }
    /** Picked via the XPS-30 Category + Tone Number picker, e.g. "Pf 501". */
    | { type: 'xps30-tone'; bank: Xps30Bank; code: string; number: number };
  createdAt: number;
  updatedAt: number;
}

export interface Page {
  id: string;
  name: string;
  patchIds: string[]; // ordered
}

export type GridColumns = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface GridPreferences {
  portraitColumns: GridColumns;
  landscapeColumns: GridColumns;
}

export interface MidiSettings {
  sendBankSelect: boolean;
  sendProgramChange: boolean;
  messageOrder: 'msb-lsb-pc'; // room to grow later; only one order in V1
}

export interface AppState {
  pages: Page[];
  patches: Record<string, Patch>;
  activePageId: string | null;
  activePatchId: string | null;
  grid: GridPreferences;
  midiSettings: MidiSettings;
  performanceMode: boolean;
  selectedDeviceProfileId: string; // e.g. 'roland-xp30'
}

// ---- Device profiles (built-in libraries like the XP-30) -------------

export type DeviceBankKind = 'user' | 'preset' | 'expansion';

export interface DeviceBank {
  id: string;
  name: string; // "PR-A", "USER", "XP-A", ...
  kind: DeviceBankKind; // drives "User Tone" / "Preset Tone" / "Expansion Tone" in messages
  bankMSB: number | null;
  bankLSB: number | null;
  programCount: number; // how many patches (1..programCount) live in this bank
  /**
   * When a bank's on-panel numbering does not start at 1 (XPS-30 USER patches
   * are numbered 501-756, PRST patches 0001-1472 across sub-banks), this is the
   * number the first program of the bank shows on the panel. The MIDI Program
   * Change is still `1..programCount`; display uses `programBase + program - 1`.
   * Omitted = panel numbers equal program numbers (starting at 1).
   */
  programBase?: number;
  /** Optional human-readable names for specific program numbers. */
  programNames?: Record<number, string>;
}

export interface DeviceProfile {
  id: string;
  name: string; // "Roland XP-30"
  banks: DeviceBank[];
  defaultChannel: number;
  /**
   * Set to true once the bank MSB/LSB values below have been checked
   * against the instrument's own MIDI Implementation chart. The XP-30
   * profile shipped here is built from Roland's published JV/XP-family
   * bank-select convention, not the XP-30 manual page-by-page, so treat
   * it as a strong starting point to verify on real hardware.
   */
  verified: boolean;
}

// ---- MIDI transport (bridge to native / Web MIDI) ---------------------

export interface MidiOutMessageLog {
  id: string;
  at: number;
  patchName: string;
  bankLabel: string; // e.g. "User Tone 056" or "Preset Tone · PR-B 042"
  channel: number;
  bankMSB: number | null;
  bankLSB: number | null;
  program: number;
  raw: string[]; // hex strings, for the MIDI monitor
}

export type MidiConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

export interface MidiDeviceInfo {
  id: string;
  name: string;
}
