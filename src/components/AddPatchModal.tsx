import { useState } from 'react';
import type { DeviceBank, DeviceProfile, Patch } from '../types';
import { newPatchTemplate } from '../state/store';

type Step = 'choose' | 'bank' | 'program';

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

  const startCustom = () => onDraftReady(newPatchTemplate());

  const startLibrary = () => {
    if (deviceProfile.banks.length === 0) {
      // No library configured for this device — fall straight to custom.
      startCustom();
      return;
    }
    setStep('bank');
  };

  const pickBank = (b: DeviceBank) => {
    setBank(b);
    setStep('program');
  };

  const pickProgram = (program: number) => {
    if (!bank) return;
    const draft = newPatchTemplate();
    onDraftReady({
      ...draft,
      name: `${bank.name} ${program}`,
      values: {
        channel: deviceProfile.defaultChannel,
        bankMSB: bank.bankMSB,
        bankLSB: bank.bankLSB,
        program,
      },
      appearance: { ...draft.appearance, subtitle: `${bank.name} · ${program}` },
      origin: { type: 'device-library', deviceId: deviceProfile.id, bankId: bank.id, program },
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
              <button onClick={startCustom}>
                Custom MIDI Patch
                <span className="desc">Enter channel, bank and program manually</span>
              </button>
            </div>
            <div className="btn-row">
              <button className="btn ghost" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'bank' && (
          <>
            <h2>{deviceProfile.name} — Choose a bank</h2>
            <div className="choice-list">
              {deviceProfile.banks.map((b) => (
                <button key={b.id} onClick={() => pickBank(b)}>
                  {b.name}
                  <span className="desc">
                    MSB {b.bankMSB ?? '—'} · LSB {b.bankLSB ?? '—'} · {b.programCount} patches
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

function ProgramPicker({
  bank,
  onPick,
  onBack,
}: {
  bank: DeviceBank;
  onPick: (program: number) => void;
  onBack: () => void;
}) {
  const [value, setValue] = useState('1');
  const n = Math.max(1, Math.min(bank.programCount, Number(value) || 1));

  return (
    <>
      <h2>{bank.name} — Patch number</h2>
      <div className="field">
        <label>Program (1–{bank.programCount})</label>
        <input
          type="number"
          min={1}
          max={bank.programCount}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
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
