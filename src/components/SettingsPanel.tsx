import type { DeviceProfile, GridPreferences, MidiSettings } from '../types';
import { GridSizeControl } from './GridSizeControl';

export function SettingsPanel({
  midiSettings,
  grid,
  deviceProfile,
  devices,
  onClose,
  onMidiSettingsChange,
  onGridChange,
  onDeviceChange,
}: {
  midiSettings: MidiSettings;
  grid: GridPreferences;
  deviceProfile: DeviceProfile;
  devices: DeviceProfile[];
  onClose: () => void;
  onMidiSettingsChange: (s: Partial<MidiSettings>) => void;
  onGridChange: (o: 'portrait' | 'landscape', c: GridPreferences['portraitColumns']) => void;
  onDeviceChange: (id: string) => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <div className="field">
          <label>Device</label>
          <select value={deviceProfile.id} onChange={(e) => onDeviceChange(e.target.value)}>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {!d.verified ? ' (bank values unverified)' : ''}
              </option>
            ))}
          </select>
        </div>

        <GridSizeControl label="Portrait columns" value={grid.portraitColumns} onChange={(c) => onGridChange('portrait', c)} />
        <GridSizeControl label="Landscape columns" value={grid.landscapeColumns} onChange={(c) => onGridChange('landscape', c)} />

        <div className="settings-row">
          <span>Send Bank Select</span>
          <button
            className={`switch ${midiSettings.sendBankSelect ? 'on' : ''}`}
            onClick={() => onMidiSettingsChange({ sendBankSelect: !midiSettings.sendBankSelect })}
          >
            <span className="knob" />
          </button>
        </div>
        <div className="settings-row">
          <span>Send Program Change</span>
          <button
            className={`switch ${midiSettings.sendProgramChange ? 'on' : ''}`}
            onClick={() => onMidiSettingsChange({ sendProgramChange: !midiSettings.sendProgramChange })}
          >
            <span className="knob" />
          </button>
        </div>
        <div className="settings-row">
          <span>SysEx tone switch (experimental)</span>
          <button
            className={`switch ${midiSettings.toneSwitchMethod === 'sysex' ? 'on' : ''}`}
            onClick={() =>
              onMidiSettingsChange({
                toneSwitchMethod: midiSettings.toneSwitchMethod === 'sysex' ? 'cc' : 'sysex',
                toneSwitchPicked: true,
              })
            }
          >
            <span className="knob" />
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>
          OFF (recommended): classic CC#0 → CC#32 → Program Change on the patch's channel —
          MSB 87 + LSB 64–75 (PRST) / 0–1 (USER) / 121 (GM), never performance-bank MSB 85,
          so no starred dual tone. ON: experimental Roland SysEx write straight to
          Performance Part n's patch assignment (device ID 17).
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>
          Message order is fixed in V1: Bank MSB → Bank LSB → Program Change.
        </p>

        <div className="btn-row">
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
        <p className="app-credit">MIDI Patch — made by Nowraj Pandey</p>
      </div>
    </div>
  );
}
