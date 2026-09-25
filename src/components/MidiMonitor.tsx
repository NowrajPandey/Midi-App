import type { MidiOutMessageLog } from '../types';

export function MidiMonitor({ log, onClose }: { log: MidiOutMessageLog[]; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>MIDI Monitor</h2>
        {log.length === 0 && <p style={{ color: 'var(--text-dim)' }}>Nothing sent yet.</p>}
        <div className="monitor-log">
          {log
            .slice()
            .reverse()
            .map((entry) => (
              <div className="monitor-entry" key={entry.id}>
                <div style={{ fontWeight: 700 }}>
                  {entry.patchName} — {entry.bankLabel}
                </div>
                <div>
                  CH {entry.channel} · Bank {entry.bankMSB ?? '—'}/{entry.bankLSB ?? '—'} · PC {entry.program}
                </div>
                <div>{entry.raw.join('  ')}</div>
                <div className="ok">✓ Sent — {new Date(entry.at).toLocaleTimeString()}</div>
              </div>
            ))}
        </div>
        <div className="btn-row">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
