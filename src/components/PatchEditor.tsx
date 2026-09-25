import { useState } from 'react';
import type { PadAccentColor, Patch } from '../types';
import { midiBridge } from '../midi/MidiBridge';
import { describePatchOrigin } from '../data/xp30';

const COLORS: PadAccentColor[] = ['blue', 'green', 'orange', 'purple', 'red', 'teal', 'yellow', 'gray'];
const ICONS = ['🎹', '🎺', '🎻', '🥁', '🎸', '🎤', '🔔', '🌊', '✨', '🎛️'];

type Draft = Omit<Patch, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export function PatchEditor({
  draft,
  midiSettings,
  onCancel,
  onSave,
  onDelete,
}: {
  draft: Draft;
  midiSettings: { sendBankSelect: boolean; sendProgramChange: boolean };
  onCancel: () => void;
  onSave: (patch: Draft) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<Draft>(draft);
  const [testResult, setTestResult] = useState<string | null>(null);

  const update = (patch: Partial<Draft>) => setForm((f) => ({ ...f, ...patch }));
  const updateValues = (patch: Partial<Draft['values']>) =>
    setForm((f) => ({ ...f, values: { ...f.values, ...patch } }));
  const updateAppearance = (patch: Partial<Draft['appearance']>) =>
    setForm((f) => ({ ...f, appearance: { ...f.appearance, ...patch } }));

  const test = async () => {
    setTestResult('Sending…');
    const res = await midiBridge.sendPatch({
      channel: form.values.channel,
      bankMSB: form.values.bankMSB,
      bankLSB: form.values.bankLSB,
      program: form.values.program,
      sendBankSelect: midiSettings.sendBankSelect,
      sendProgramChange: midiSettings.sendProgramChange,
    });
    const identity = describePatchOrigin(form.origin);
    const location = `CH ${form.values.channel} · Bank ${form.values.bankMSB ?? '—'}/${form.values.bankLSB ?? '—'} · PC ${form.values.program}`;
    setTestResult(
      res.ok ? `Sent — ${identity} (${location})\n${res.raw.join('  ')}` : 'No MIDI device connected'
    );
  };

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{draft.id ? 'Edit Patch' : 'New Patch'}</h2>

        <div className="field">
          <label>Name</label>
          <input value={form.name} onChange={(e) => update({ name: e.target.value })} />
        </div>

        <div className="field-row">
          <div className="field">
            <label>MIDI Channel</label>
            <input
              type="number"
              min={1}
              max={16}
              value={form.values.channel}
              onChange={(e) => updateValues({ channel: clamp(Number(e.target.value), 1, 16) })}
            />
          </div>
          <div className="field">
            <label>Program (1–128)</label>
            <input
              type="number"
              min={1}
              max={128}
              value={form.values.program}
              onChange={(e) => updateValues({ program: clamp(Number(e.target.value), 1, 128) })}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Bank MSB (0–127, blank = skip)</label>
            <input
              type="number"
              min={0}
              max={127}
              value={form.values.bankMSB ?? ''}
              placeholder="—"
              onChange={(e) => updateValues({ bankMSB: e.target.value === '' ? null : clamp(Number(e.target.value), 0, 127) })}
            />
          </div>
          <div className="field">
            <label>Bank LSB (0–127, blank = skip)</label>
            <input
              type="number"
              min={0}
              max={127}
              value={form.values.bankLSB ?? ''}
              placeholder="—"
              onChange={(e) => updateValues({ bankLSB: e.target.value === '' ? null : clamp(Number(e.target.value), 0, 127) })}
            />
          </div>
        </div>

        <div className="field">
          <label>Icon</label>
          <div className="color-swatches">
            {ICONS.map((icon) => (
              <button
                key={icon}
                className="icon-btn"
                style={{ opacity: form.appearance.icon === icon ? 1 : 0.5 }}
                onClick={() => updateAppearance({ icon })}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Accent color</label>
          <div className="color-swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${form.appearance.accentColor === c ? 'selected' : ''}`}
                style={{ background: `var(--accent-${c})` }}
                onClick={() => updateAppearance({ accentColor: c })}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <label>Subtitle</label>
          <input
            value={form.appearance.subtitle ?? ''}
            placeholder="e.g. PR-B · 042"
            onChange={(e) => updateAppearance({ subtitle: e.target.value })}
          />
        </div>

        <button className="btn" onClick={test}>
          TEST PATCH
        </button>
        {testResult && (
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8, whiteSpace: 'pre-line' }}>
            {testResult}
          </p>
        )}

        <div className="btn-row">
          <button className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => onSave(form)}>
            Save
          </button>
        </div>
        {onDelete && (
          <div className="btn-row">
            <button className="btn danger" onClick={onDelete}>
              Delete Patch
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
