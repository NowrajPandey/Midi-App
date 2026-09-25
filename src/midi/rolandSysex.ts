/**
 * Roland XPS-30 System Exclusive builders — every byte below is taken from
 * Roland's official XPS-30 MIDI Implementation chart:
 *
 * - Model ID: 00H 00H 3AH, command DT1 = 12H (p. 12 "Data set 1 (DT1)").
 * - Device ID: the doc's worked example uses 10H and labels it "17" (values
 *   are listed one greater than the wire byte). 7FH broadcast also allowed.
 * - Address map (p. 19): Temporary Performance = 10 00 00 00;
 *   Performance Part (Part 1..16) offsets = 20 00 .. 2F 00;
 *   Performance Part parameters: +00 04 = Patch Bank Select MSB (CC# 0),
 *   +00 05 = Patch Bank Select LSB (CC# 32), +00 06 = Patch Program Number.
 *   So Part n patch assignment lives at address 10 00 (20+n-1) 04.
 * - Checksum (p. 64): sum address + data bytes, checksum = 128 - (sum mod 128),
 *   wrapped to 0..127 (doc example: 22 -> 6AH). Appended before F7.
 *
 * Writing the Part's own patch-assignment fields is the Performance-mode-safe
 * way to change tone: it bypasses the PERFORM EDIT:MIDI:BS / :PC receive
 * switches that can make ordinary CC#0/#32 + Program Change silently ignored.
 */

/** Device ID byte — matches the doc's worked example (panel shows "17"). */
export const ROLAND_DEVICE_ID = 0x10;

/** Roland DT1 checksum over address + data bytes (MIDI Implementation p. 64). */
export function rolandChecksum(bytes: number[]): number {
  const sum = bytes.reduce((a, b) => a + b, 0);
  return (128 - (sum % 128)) % 128;
}

function clamp7(v: number): number {
  return Math.max(0, Math.min(127, Math.round(v)));
}

/**
 * One DT1 message that rewrites Performance Part `part` (1-16) patch
 * assignment — Bank MSB, Bank LSB and Program — atomically in a single
 * three-byte data write (address 10 00 2x 04, data msb lsb pc).
 *
 * `program` is the MIDI wire value 0-127 (panel program − 1), matching the
 * doc: "pp = Program number: 00H - 7FH (prog.1 - prog.128)".
 */
export function buildPartPatchDt1(part: number, msb: number, lsb: number, program: number): number[] {
  const p = Math.max(1, Math.min(16, Math.round(part)));
  const address = [0x10, 0x00, 0x20 + (p - 1), 0x04];
  const data = [clamp7(msb), clamp7(lsb), clamp7(program)];
  const sum = rolandChecksum([...address, ...data]);
  return [0xf0, 0x41, ROLAND_DEVICE_ID, 0x00, 0x00, 0x3a, 0x12, ...address, ...data, sum, 0xf7];
}

/** All Notes Off (CC 123) — silences sounding notes before a tone change.
 * Deliberately NOT CC 120/121/122 (too aggressive / state-resetting). */
export function buildAllNotesOff(channel: number): number[] {
  const ch = Math.max(1, Math.min(16, channel)) - 1;
  return [0xb0 | ch, 0x7b, 0x00];
}

/** Lowercase hex line, e.g. "f0 41 10 ..." — same format the native
 * sendPatch logger produces, so the MIDI Monitor stays uniform. */
export function toHexLine(bytes: number[]): string {
  return bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join(' ');
}
