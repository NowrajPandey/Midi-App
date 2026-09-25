import type { Patch } from '../types';

const COLOR_VARS: Record<string, string> = {
  blue: 'var(--accent-blue)',
  green: 'var(--accent-green)',
  orange: 'var(--accent-orange)',
  purple: 'var(--accent-purple)',
  red: 'var(--accent-red)',
  teal: 'var(--accent-teal)',
  yellow: 'var(--accent-yellow)',
  gray: 'var(--accent-gray)',
};

export function Pad({
  patch,
  isActive,
  onTap,
  onLongPress,
}: {
  patch: Patch;
  isActive: boolean;
  onTap: () => void;
  onLongPress: () => void;
}) {
  let pressTimer: number | undefined;

  const startPress = () => {
    pressTimer = window.setTimeout(onLongPress, 500);
  };
  const endPress = (fireTap: boolean) => {
    if (pressTimer) window.clearTimeout(pressTimer);
    if (fireTap) onTap();
  };

  return (
    <button
      className={`pad ${isActive ? 'active' : ''}`}
      style={{ ['--pad-accent' as any]: COLOR_VARS[patch.appearance.accentColor] }}
      onPointerDown={startPress}
      onPointerUp={() => endPress(true)}
      onPointerLeave={() => endPress(false)}
    >
      {isActive && <span className="check">✓</span>}
      <span className="icon">{patch.appearance.icon}</span>
      <span className="name">{patch.name}</span>
      {patch.appearance.showSubtitle && patch.appearance.subtitle ? (
        <span className="subtitle">{patch.appearance.subtitle}</span>
      ) : null}
    </button>
  );
}
