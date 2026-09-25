import { useEffect, useState } from 'react';
import type { GridColumns, Patch } from '../types';
import { Pad } from './Pad';

function useOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  );
  useEffect(() => {
    const onResize = () => setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return orientation;
}

export function PadGrid({
  patches,
  activePatchId,
  columns,
  onTapPatch,
  onEditPatch,
  onAddPatch,
}: {
  patches: Patch[];
  activePatchId: string | null;
  columns: { portrait: GridColumns; landscape: GridColumns };
  onTapPatch: (id: string) => void;
  onEditPatch: (id: string) => void;
  onAddPatch: () => void;
}) {
  const orientation = useOrientation();
  const cols = orientation === 'portrait' ? columns.portrait : columns.landscape;

  return (
    <div className="pad-grid-scroll">
      {patches.length === 0 ? (
        <div className="empty-state">
          No patches on this page yet.
          <br />
          Tap "+ Add Patch" to create your first tone.
        </div>
      ) : null}
      <div className="pad-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {patches.map((patch) => (
          <Pad
            key={patch.id}
            patch={patch}
            isActive={patch.id === activePatchId}
            onTap={() => onTapPatch(patch.id)}
            onLongPress={() => onEditPatch(patch.id)}
          />
        ))}
        <button className="pad add-pad" onClick={onAddPatch}>
          <span className="icon">+</span>
          <span className="name">Add Patch</span>
        </button>
      </div>
    </div>
  );
}
