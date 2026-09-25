import type { GridColumns } from '../types';

const OPTIONS: GridColumns[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];

export function GridSizeControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: GridColumns;
  onChange: (v: GridColumns) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="grid-columns-picker">
        {OPTIONS.map((n) => (
          <button key={n} className={value === n ? 'active' : ''} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
