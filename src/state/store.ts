import { createContext, useContext, useEffect, useReducer } from 'react';
import type { AppState, GridColumns, MidiSettings, Page, Patch } from '../types';

const STORAGE_KEY = 'midi-patch:v1';

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultPage(): Page {
  return { id: uid('page'), name: 'PATCHES', patchIds: [] };
}

function defaultState(): AppState {
  const page = defaultPage();
  return {
    pages: [page],
    patches: {},
    activePageId: page.id,
    activePatchId: null,
    grid: { portraitColumns: 3, landscapeColumns: 5 },
    midiSettings: { sendBankSelect: true, sendProgramChange: true, messageOrder: 'msb-lsb-pc', toneSwitchMethod: 'sysex' },
    performanceMode: false,
    selectedDeviceProfileId: 'roland-xp30',
  };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as AppState;
    // Minimal shape guard so a corrupted/old blob never crashes the app, and
    // older saved state picks up newly-added settings defaults (e.g.
    // toneSwitchMethod added with the SysEx switch engine).
    if (!parsed.pages || !parsed.patches) return defaultState();
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      midiSettings: { ...base.midiSettings, ...parsed.midiSettings },
    };
  } catch {
    return defaultState();
  }
}

export type Action =
  | { type: 'ADD_PATCH'; patch: Patch; pageId: string }
  | { type: 'UPDATE_PATCH'; patch: Patch }
  | { type: 'DELETE_PATCH'; patchId: string }
  | { type: 'REORDER_PATCHES'; pageId: string; patchIds: string[] }
  | { type: 'SET_ACTIVE_PATCH'; patchId: string | null }
  | { type: 'ADD_PAGE'; name: string }
  | { type: 'RENAME_PAGE'; pageId: string; name: string }
  | { type: 'DELETE_PAGE'; pageId: string }
  | { type: 'SET_ACTIVE_PAGE'; pageId: string }
  | { type: 'SET_GRID_COLUMNS'; orientation: 'portrait' | 'landscape'; columns: GridColumns }
  | { type: 'SET_MIDI_SETTINGS'; settings: Partial<MidiSettings> }
  | { type: 'TOGGLE_PERFORMANCE_MODE' }
  | { type: 'SET_DEVICE_PROFILE'; deviceId: string }
  | { type: 'IMPORT_STATE'; state: AppState };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_PATCH': {
      const patches = { ...state.patches, [action.patch.id]: action.patch };
      const pages = state.pages.map((p) =>
        p.id === action.pageId ? { ...p, patchIds: [...p.patchIds, action.patch.id] } : p
      );
      return { ...state, patches, pages };
    }
    case 'UPDATE_PATCH': {
      const existing = state.patches[action.patch.id];
      if (!existing) return state;
      return {
        ...state,
        patches: { ...state.patches, [action.patch.id]: { ...action.patch, updatedAt: Date.now() } },
      };
    }
    case 'DELETE_PATCH': {
      const { [action.patchId]: _removed, ...rest } = state.patches;
      const pages = state.pages.map((p) => ({ ...p, patchIds: p.patchIds.filter((id) => id !== action.patchId) }));
      const activePatchId = state.activePatchId === action.patchId ? null : state.activePatchId;
      return { ...state, patches: rest, pages, activePatchId };
    }
    case 'REORDER_PATCHES': {
      const pages = state.pages.map((p) => (p.id === action.pageId ? { ...p, patchIds: action.patchIds } : p));
      return { ...state, pages };
    }
    case 'SET_ACTIVE_PATCH':
      return { ...state, activePatchId: action.patchId };
    case 'ADD_PAGE': {
      const page: Page = { id: uid('page'), name: action.name, patchIds: [] };
      return { ...state, pages: [...state.pages, page], activePageId: page.id };
    }
    case 'RENAME_PAGE':
      return { ...state, pages: state.pages.map((p) => (p.id === action.pageId ? { ...p, name: action.name } : p)) };
    case 'DELETE_PAGE': {
      if (state.pages.length <= 1) return state; // always keep at least one page
      const pages = state.pages.filter((p) => p.id !== action.pageId);
      const activePageId = state.activePageId === action.pageId ? pages[0].id : state.activePageId;
      return { ...state, pages, activePageId };
    }
    case 'SET_ACTIVE_PAGE':
      return { ...state, activePageId: action.pageId };
    case 'SET_GRID_COLUMNS':
      return {
        ...state,
        grid:
          action.orientation === 'portrait'
            ? { ...state.grid, portraitColumns: action.columns }
            : { ...state.grid, landscapeColumns: action.columns },
      };
    case 'SET_MIDI_SETTINGS':
      return { ...state, midiSettings: { ...state.midiSettings, ...action.settings } };
    case 'TOGGLE_PERFORMANCE_MODE':
      return { ...state, performanceMode: !state.performanceMode };
    case 'SET_DEVICE_PROFILE':
      return { ...state, selectedDeviceProfileId: action.deviceId };
    case 'IMPORT_STATE':
      return action.state;
    default:
      return state;
  }
}

export const StateContext = createContext<AppState>(defaultState());
export const DispatchContext = createContext<React.Dispatch<Action>>(() => {});

export function useAppState() {
  return useContext(StateContext);
}

export function useAppDispatch() {
  return useContext(DispatchContext);
}

/** Hook that owns the reducer + persistence; used once at the app root. */
export function useRootStore() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return { state, dispatch };
}

export function newPatchTemplate(): Omit<Patch, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'New Patch',
    values: { channel: 1, bankMSB: null, bankLSB: null, program: 1 },
    appearance: { icon: '🎹', accentColor: 'blue', showSubtitle: true, subtitle: '' },
    origin: { type: 'custom' },
  };
}
