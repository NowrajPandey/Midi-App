import { useState } from 'react';
import type { DeviceBank, DeviceProfile, Patch } from '../types';
import { newPatchTemplate } from '../state/store';
import {
  bankKindLabel,
  formatProgramNumber,
  resolveXps30Tone,
  xps30BankLabel,
  xps30CodeLabel,
  xps30Codes,
} from '../data/xp30';
import type { Xps30Tone } from '../data/xps30-tones';

type Step = 'choose' | 'bank' | 'program' | 'tone';

export function AddPatchModal({
  deviceProfile,
  onClose,
  onDraftReady,
}: {
  deviceProfile: DeviceProfile;
  onClose: () => void;
  onDraftReady: (draft: Omit<Patch, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [step, setStep] = useState<Step>('choose');
  const [bank, setBank] = useState<DeviceBank | null>(null);
  const hasTonePicker = deviceProfile.id === 'roland-xp30';

  const startCustom = () => onDraftReady(newPatchTemplate());

  const startLibrary = () => {
    if (deviceProfile.banks.length === 0) {
      // No library configured for this device — fall straight to custom.
      startCustom();
      return;
    }
    setStep('bank');
  };

  const startTonePicker = () => {
    if (!hasTonePicker) {
      startCustom();
      return;
    }
    setStep('tone');
  };

  const pickBank = (b: DeviceBank) => {
    setBank(b);
    setStep('program');
  };

  const pickProgram = (panelNumber: number) => {
    if (!bank) return;
    // The panel shows a global number (PRST 0001-1472, USER 501-756); the
    // MIDI Program Change is 1..128 inside the selected sub-bank.
    const program = panelNumber - (bank.programBase ?? 1) + 1;
    const draft = newPatchTemplate();
    const padded = formatProgramNumber(panelNumber);
    onDraftReady({
      ...draft,
      name: `${bank.name} ${padded}`,
      values: {
        channel: deviceProfile.defaultChannel,
        bankMSB: bank.bankMSB,
        bankLSB: bank.bankLSB,
        program,
      },
      appearance: {
        ...draft.appearance,
        subtitle: `${bankKindLabel(bank.kind)} · ${bank.name} ${padded}`,
      },
      origin: { type: 'device-library', deviceId: deviceProfile.id, bankId: bank.id, program: panelNumber },
    });
  };

  const pickTone = (tone: Xps30Tone) => {
    const draft = newPatchTemplate();
    onDraftReady({
      ...draft,
      name: `${tone.c} ${tone.n}`,
      values: {
        channel: deviceProfile.defaultChannel,
        bankMSB: tone.m,
        bankLSB: tone.l,
        program: tone.p,
      },
      appearance: {
        ...draft.appearance,
        subtitle: `${xps30BankLabel(tone.b)}${tone.name ? ` · ${tone.name}` : ''}`,
      },
      origin: { type: 'xps30-tone', bank: tone.b, code: tone.c, number: tone.n },
    });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {step === 'choose' && (
          <>
            <h2>Add Patch</h2>
            <div className="choice-list">
              <button onClick={startLibrary}>
                {deviceProfile.name} Library
                <span className="desc">Browse built-in banks and patches</span>
              </button>
              <button onClick={startTonePicker}>
                {hasTonePicker ? 'Custom Tone — Category + Number' : 'Custom MIDI Patch'}
                <span className="desc">
                  {hasTonePicker
                    ? 'Pick exactly what the panel shows, e.g. Pf 501'
                    : 'Enter channel, bank and program manually'}
                </span>
              </button>
            </div>
            <div className="btn-row">
              <button className="btn ghost" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'tone' && (
          <TonePicker
            defaultChannel={deviceProfile.defaultChannel}
            onPick={pickTone}
            onBack={() => setStep('choose')}
            onManual={startCustom}
          />
        )}

        {step === 'bank' && (
          <>
            <h2>{deviceProfile.name} — Choose a bank</h2>
            <div className="choice-list">
              {deviceProfile.banks.map((b) => (
                <button key={b.id} onClick={() => pickBank(b)}>
                  {b.name} — {bankKindLabel(b.kind)}
                  <span className="desc">
                    Tones {(b.programBase ?? 1)}–{(b.programBase ?? 1) + b.programCount - 1} · MSB{' '}
                    {b.bankMSB ?? '—'} · LSB {b.bankLSB ?? '—'}
                  </span>
                </button>
              ))}
            </div>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => setStep('choose')}>
                Back
              </button>
            </div>
          </>
        )}

        {step === 'program' && bank && (
          <ProgramPicker bank={bank} onPick={pickProgram} onBack={() => setStep('bank')} />
        )}
      </div>
    </div>
  );
}

/**
 * The main custom-tone flow: enter the category code and tone number exactly
 * as the XPS-30 panel displays them ("Pf 501") and resolve them to the exact
 * Bank Select + Program Change before anything is saved.
 */
function TonePicker({
  defaultChannel,
  onPick,
  onBack,
  onManual,
}: {
  defaultChannel: number;
  onPick: (tone: Xps30Tone) => void;
  onBack: () => void;
  onManual: () => void;
}) {
  const codes = xps30Codes();
  const [code, setCode] = useState(codes[0] ?? 'Pf');
  const [numStr, setNumStr] = useState('');
  const n = Number(numStr);
  const tone = numStr.trim() !== '' && Number.isFinite(n) ? resolveXps30Tone(code, n) : null;
  const attempted = numStr.trim() !== '';

  return (
    <>
      <h2>Custom Tone — Category + Number</h2>
      <div className="field-row">
        <div className="field">
          <label>Category</label>
          <select value={code} onChange={(e) => setCode(e.target.value)}>
            {codes.map((c) => (
              <option key={c} value={c}>
                {c} — {xps30CodeLabel(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Tone number</label>
          <input
            type="number"
            min={1}
            max={1472}
            value={numStr}
            placeholder="e.g. 501"
            onChange={(e) => setNumStr(e.target.value)}
          />
        </div>
      </div>

      {tone ? (
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: -6, marginBottom: 14 }}>
          Resolves to <strong>{tone.c} {tone.n}</strong> — {xps30BankLabel(tone.b)}
          {tone.name ? ` · ${tone.name}` : ''} · MSB {tone.m} · LSB {tone.l} · PC {tone.p} · CH {defaultChannel}
        </p>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: -6, marginBottom: 14 }}>
          {attempted
            ? 'No tone matches that category + number. Check the value, or enter the bank data manually.'
            : 'Type the number exactly as the XPS-30 screen shows it.'}
        </p>
      )}

      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: -6, marginBottom: 14 }}>
        <strong>501–756</strong> are USER tones (so <strong>Pf 501</strong> recalls USER 501 wherever
        it is saved). Smaller numbers match PRST/GM tones, e.g. <strong>Ky 046</strong>.
      </p>

      <div className="btn-row">
        <button className="btn ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn primary" disabled={!tone} onClick={() => tone && onPick(tone)}>
          Use this tone
        </button>
      </div>
      <div className="btn-row">
        <button className="btn ghost" onClick={onManual}>
          Enter MSB / LSB / Program manually
        </button>
      </div>
    </>
  );
}

function ProgramPicker({
  bank,
  onPick,
  onBack,
}: {
  bank: DeviceBank;
  onPick: (panelNumber: number) => void;
  onBack: () => void;
}) {
  const base = bank.programBase ?? 1;
  const end = base + bank.programCount - 1;
  const [value, setValue] = useState(String(base));
  const n = clamp(Number(value) || base, base, end);

  return (
    <>
      <h2>
        {bank.name} — {bankKindLabel(bank.kind)}
      </h2>
      <div className="field">
        <label>Exact tone number ({base}–{end})</label>
        <input
          type="number"
          min={base}
          max={end}
          value={value}
          placeholder={`e.g. ${base}`}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: -6, marginBottom: 14 }}>
        This will be saved as <strong>{bankKindLabel(bank.kind)} · {bank.name} {formatProgramNumber(n)}</strong> —
        that exact wording is what you'll see in Test Patch and the MIDI Monitor, so it never gets
        confused with a different bank's tone.
      </p>
      <div className="btn-row">
        <button className="btn ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn primary" onClick={() => onPick(n)}>
          Continue
        </button>
      </div>
    </>
  );
}

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
