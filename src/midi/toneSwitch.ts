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
 *   'sysex' (default): one Roland DT1 that writes Performance Part n's
 *          Patch Bank MSB/LSB/Program fields directly. Works in Performance
 *          mode even when PERFORM EDIT:MIDI:BS / :PC receive is OFF, and it
 *          leaves every other Part parameter (level, pan, offsets, sends)
 *          untouched — only the patch assignment changes.
 *   'cc':   classic CC#0 → CC#32 → Program Change burst (native path).
 *
 * Falls back to 'cc' when the classic path is the only valid one (Bank Select
 * or Program Change toggles off, or a patch has null bank values), so those
 * settings keep their meaning.
 */
export async function applyToneSwitch(req: ToneSwitchRequest, settings: MidiSettings): Promise<ToneSwitchResult> {
  const wantSysex =
    settings.toneSwitchMethod !== 'cc' &&
    req.sendBankSelect &&
    req.sendProgramChange &&
    req.bankMSB !== null &&
    req.bankLSB !== null;

  if (!wantSysex) {
    const res = await midiBridge.sendPatch({
      channel: req.channel,
      bankMSB: req.bankMSB,
      bankLSB: req.bankLSB,
      program: req.program,
      sendBankSelect: req.sendBankSelect,
      sendProgramChange: req.sendProgramChange,
    });
    return { ok: res.ok, raw: res.raw, method: 'cc' };
  }

  // Layer 1: release sounding notes, then Layer 2: the Part patch write —
  // both bytes go out in one native call, device processes them in order.
  const safety = buildAllNotesOff(req.channel);
  const dt1 = buildPartPatchDt1(req.channel, req.bankMSB!, req.bankLSB!, req.program - 1);
  const res = await midiBridge.sendRaw([...safety, ...dt1]);
  return { ok: res.ok, raw: res.ok ? [toHexLine(safety), toHexLine(dt1)] : [], method: 'sysex' };
}
