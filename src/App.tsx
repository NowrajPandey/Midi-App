import { useEffect, useMemo, useState } from 'react';
import type { MidiConnectionState, MidiDeviceInfo, MidiOutMessageLog, Patch } from './types';
import { deviceProfiles, describePatchOrigin } from './data/xp30';
import { DispatchContext, StateContext, useRootStore } from './state/store';
import { midiBridge, buildMonitorEntry } from './midi/MidiBridge';
import { ConnectionStatus } from './components/ConnectionStatus';
import { PageTabs } from './components/PageTabs';
import { PadGrid } from './components/PadGrid';
import { AddPatchModal } from './components/AddPatchModal';
import { PatchEditor } from './components/PatchEditor';
import { MidiMonitor } from './components/MidiMonitor';
import { SettingsPanel } from './components/SettingsPanel';

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const { state, dispatch } = useRootStore();

  const [connection, setConnection] = useState<MidiConnectionState>('disconnected');
  const [device, setDevice] = useState<MidiDeviceInfo | null>(null);
  const [monitorLog, setMonitorLog] = useState<MidiOutMessageLog[]>([]);

  const [showAddPatch, setShowAddPatch] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Patch | Omit<Patch, 'id' | 'createdAt' | 'updatedAt'> | null>(null);
  const [showMonitor, setShowMonitor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const deviceProfile = deviceProfiles[state.selectedDeviceProfileId] ?? deviceProfiles['generic'];
  const activePage = state.pages.find((p) => p.id === state.activePageId) ?? state.pages[0];
  const pagePatches = useMemo(
    () => (activePage ? activePage.patchIds.map((id) => state.patches[id]).filter(Boolean) : []),
    [activePage, state.patches]
  );

  // Sync connection status on mount + subscribe to native/web change events,
  // so a mid-session USB unplug/replug (spec §18) reflects immediately.
  useEffect(() => {
    let removeListener: (() => void) | undefined;
    (async () => {
      const status = await midiBridge.getStatus();
      setConnection(status.state);
      setDevice(status.device);
      const sub = await midiBridge.addListener(({ state: s, device: d }) => {
        setConnection(s);
        setDevice(d);
      });
      removeListener = sub.remove;
    })();
    return () => removeListener?.();
  }, []);

  const handleConnectTap = async () => {
    setConnection('connecting');
    const res = await midiBridge.requestDevice();
    if (!res.granted) setConnection('disconnected');
  };

  const sendToInstrument = async (patch: Patch) => {
    dispatch({ type: 'SET_ACTIVE_PATCH', patchId: patch.id });
    const res = await midiBridge.sendPatch({
      channel: patch.values.channel,
      bankMSB: patch.values.bankMSB,
      bankLSB: patch.values.bankLSB,
      program: patch.values.program,
      sendBankSelect: state.midiSettings.sendBankSelect,
      sendProgramChange: state.midiSettings.sendProgramChange,
    });
    if (res.ok) {
      const bankLabel = describePatchOrigin(patch.origin);
      setMonitorLog((log) =>
        [
          ...log,
          buildMonitorEntry(
            res.raw,
            patch.name,
            bankLabel,
            patch.values.channel,
            patch.values.bankMSB,
            patch.values.bankLSB,
            patch.values.program
          ),
        ].slice(-100)
      );
    }
  };

  const openEditorFor = (patchId: string) => {
    const patch = state.patches[patchId];
    if (patch) setEditingDraft(patch);
  };

  const saveDraft = (draft: Patch | Omit<Patch, 'id' | 'createdAt' | 'updatedAt'>) => {
    if ('id' in draft && draft.id) {
      dispatch({ type: 'UPDATE_PATCH', patch: draft as Patch });
    } else if (activePage) {
      const now = Date.now();
      const patch: Patch = { ...(draft as any), id: uid('patch'), createdAt: now, updatedAt: now };
      dispatch({ type: 'ADD_PATCH', patch, pageId: activePage.id });
    }
    setEditingDraft(null);
    setShowAddPatch(false);
  };

  const deleteDraft = () => {
    if (editingDraft && 'id' in editingDraft && editingDraft.id) {
      dispatch({ type: 'DELETE_PATCH', patchId: editingDraft.id });
    }
    setEditingDraft(null);
  };

  if (state.performanceMode) {
    return (
      <StateContext.Provider value={state}>
        <DispatchContext.Provider value={dispatch}>
          <div className="app-shell" onDoubleClick={() => dispatch({ type: 'TOGGLE_PERFORMANCE_MODE' })}>
            <div className="topbar">
              <ConnectionStatus state={connection} device={device} onTap={handleConnectTap} />
              <button className="icon-btn" onClick={() => dispatch({ type: 'TOGGLE_PERFORMANCE_MODE' })}>
                ✕
              </button>
            </div>
            <PadGrid
              patches={pagePatches}
              activePatchId={state.activePatchId}
              columns={{ portrait: state.grid.portraitColumns, landscape: state.grid.landscapeColumns }}
              onTapPatch={(id) => state.patches[id] && sendToInstrument(state.patches[id])}
              onEditPatch={() => {}}
              onAddPatch={() => {}}
            />
          </div>
        </DispatchContext.Provider>
      </StateContext.Provider>
    );
  }

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        <div className="app-shell">
          <div className="topbar">
            <div className="topbar-title">
              <h1>MIDI PATCH</h1>
              <span className="device-name">{deviceProfile.name}</span>
            </div>
            <div className="topbar-actions">
              <ConnectionStatus state={connection} device={device} onTap={handleConnectTap} />
              <button className="icon-btn" onClick={() => setShowMonitor(true)} title="MIDI Monitor">
                📡
              </button>
              <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings">
                ⚙️
              </button>
              <button className="icon-btn" onClick={() => dispatch({ type: 'TOGGLE_PERFORMANCE_MODE' })} title="Performance Mode">
                ▶
              </button>
            </div>
          </div>

          <PageTabs
            pages={state.pages}
            activePageId={state.activePageId}
            onSelect={(id) => dispatch({ type: 'SET_ACTIVE_PAGE', pageId: id })}
            onAddPage={() => dispatch({ type: 'ADD_PAGE', name: `PAGE ${state.pages.length + 1}` })}
          />

          <PadGrid
            patches={pagePatches}
            activePatchId={state.activePatchId}
            columns={{ portrait: state.grid.portraitColumns, landscape: state.grid.landscapeColumns }}
            onTapPatch={(id) => state.patches[id] && sendToInstrument(state.patches[id])}
            onEditPatch={openEditorFor}
            onAddPatch={() => setShowAddPatch(true)}
          />
        </div>

        {showAddPatch && (
          <AddPatchModal
            deviceProfile={deviceProfile}
            onClose={() => setShowAddPatch(false)}
            onDraftReady={(draft) => {
              setShowAddPatch(false);
              setEditingDraft(draft);
            }}
          />
        )}

        {editingDraft && (
          <PatchEditor
            draft={editingDraft as any}
            midiSettings={state.midiSettings}
            onCancel={() => setEditingDraft(null)}
            onSave={saveDraft}
            onDelete={'id' in editingDraft && editingDraft.id ? deleteDraft : undefined}
          />
        )}

        {showMonitor && <MidiMonitor log={monitorLog} onClose={() => setShowMonitor(false)} />}

        {showSettings && (
          <SettingsPanel
            midiSettings={state.midiSettings}
            grid={state.grid}
            deviceProfile={deviceProfile}
            devices={Object.values(deviceProfiles)}
            onClose={() => setShowSettings(false)}
            onMidiSettingsChange={(s) => dispatch({ type: 'SET_MIDI_SETTINGS', settings: s })}
            onGridChange={(o, c) => dispatch({ type: 'SET_GRID_COLUMNS', orientation: o, columns: c })}
            onDeviceChange={(id) => dispatch({ type: 'SET_DEVICE_PROFILE', deviceId: id })}
          />
        )}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}
