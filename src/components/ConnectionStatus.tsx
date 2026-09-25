import type { MidiConnectionState, MidiDeviceInfo } from '../types';

const LABELS: Record<MidiConnectionState, string> = {
  connected: 'MIDI Connected',
  disconnected: 'MIDI Disconnected',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
};

export function ConnectionStatus({
  state,
  device,
  onTap,
}: {
  state: MidiConnectionState;
  device: MidiDeviceInfo | null;
  onTap: () => void;
}) {
  return (
    <button className="status-pill" onClick={onTap}>
      <span className={`status-dot ${state}`} />
      {state === 'connected' && device ? device.name : LABELS[state]}
    </button>
  );
}
