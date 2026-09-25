import type { Page } from '../types';

export function PageTabs({
  pages,
  activePageId,
  onSelect,
  onAddPage,
}: {
  pages: Page[];
  activePageId: string | null;
  onSelect: (id: string) => void;
  onAddPage: () => void;
}) {
  return (
    <div className="page-tabs">
      {pages.map((p) => (
        <button
          key={p.id}
          className={`page-tab ${p.id === activePageId ? 'active' : ''}`}
          onClick={() => onSelect(p.id)}
        >
          {p.name}
        </button>
      ))}
      <button className="page-tab" onClick={onAddPage}>
        + Page
      </button>
    </div>
  );
}
