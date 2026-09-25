import { midiBridge } from './MidiBridge';
import { buildAllNotesOff, buildPartPatchDt1, toHexLine } from './rolandSysex';
import type { MidiSettings } from '../types';

export interface ToneSwitchRequest {
  channel: number; // 1-16; also the Performance Part number (CH1 → Part 1)
  bankMSB: number | null;
  bankLSB: number | null;
  program: number; // 1-128 as stored in patches
  sendBankSelect: boolean;
  sendProgramChange: boolean;
}

export interface ToneSwitchResult {
  ok: boolean;
  raw: string[];
  method: 'sysex' | 'cc';
}

/**
 * The app's single tone-switching entry point. Two layers, exactly once per
 * tone change (no CC spam):
 *
 * Layer 1 — MIDI safety: one All Notes Off (CC 123) so no stale notes ring
 *           through the patch change. The app never holds notes itself, and
 *           CC 120 (All Sound Off) / CC 121 / CC 122 are deliberately not sent.
 *
 * Layer 2 — tone selection, per Settings:
 *   'cc' (default): classic CC#0 → CC#32 → Program Change on the patch's own
 *          channel (CH 1 → Part 1) — the reliable Performance-mode method.
 *          Bank Select MSB 85 is NEVER sent: it reloads performance banks
 *          and can slam the panel into the starred dual-tone state. Patches
 *          are still selected by their patch-bank values (87/64-75 PRST,
 *          87/0-1 USER, 121 GM …), exactly as the XPS-30 table maps them.
 *   'sysex' (experimental): one Roland DT1 that writes Performance Part n's
 *          Patch Bank MSB/LSB/Program fields directly.
 *
 * Falls back to 'cc' when the classic path is the only valid one (Bank Select
 * or Program Change toggles off, or a patch has null bank values), so those
 * settings keep their meaning.
 */
export async function applyToneSwitch(req: ToneSwitchRequest, settings: MidiSettings): Promise<ToneSwitchResult> {
  // Hard rule: never put MSB 85 on the wire (reloads Performance banks →
  // starred dual tone). Such a patch degrades to Program Change only.
  const avoidMSB85 = req.bankMSB === 85;
  const bankMSB = avoidMSB85 ? null : req.bankMSB;
  const bankLSB = avoidMSB85 ? null : req.bankLSB;
  const sendBankSelect = req.sendBankSelect && !avoidMSB85;

  const wantSysex =
    settings.toneSwitchMethod === 'sysex' &&
    sendBankSelect &&
    req.sendProgramChange &&
    bankMSB !== null &&
    bankLSB !== null;

  if (!wantSysex) {
    const res = await midiBridge.sendPatch({
      channel: req.channel,
      bankMSB,
      bankLSB,
      program: req.program,
      sendBankSelect,
      sendProgramChange: req.sendProgramChange,
    });
    return { ok: res.ok, raw: res.raw, method: 'cc' };
  }

  // Layer 1: release sounding notes, then Layer 2: the Part patch write —
  // both bytes go out in one native call, device processes them in order.
  const safety = buildAllNotesOff(req.channel);
  const dt1 = buildPartPatchDt1(req.channel, bankMSB!, bankLSB!, req.program - 1);
  const res = await midiBridge.sendRaw([...safety, ...dt1]);
  return { ok: res.ok, raw: res.ok ? [toHexLine(safety), toHexLine(dt1)] : [], method: 'sysex' };
}
