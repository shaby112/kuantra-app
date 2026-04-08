import type { LayoutItem, WidgetConfig } from "@/types/dashboard";

export const GRID_COLUMNS = 12;
export const DEFAULT_MIN_W = 1;
export const DEFAULT_MIN_H = 1;

function rectsCollide(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function sanitizeItem(item: LayoutItem): LayoutItem {
  const minW = Math.max(DEFAULT_MIN_W, item.minW ?? DEFAULT_MIN_W);
  const minH = Math.max(DEFAULT_MIN_H, item.minH ?? DEFAULT_MIN_H);

  const w = Math.max(minW, Math.min(GRID_COLUMNS, Math.floor(item.w || minW)));
  const h = Math.max(minH, Math.floor(item.h || minH));
  const xRaw = Math.max(0, Math.floor(item.x || 0));
  const y = Math.max(0, Math.floor(item.y || 0));
  const x = Math.min(xRaw, GRID_COLUMNS - w);

  return {
    ...item,
    x,
    y,
    w,
    h,
    minW,
    minH,
  };
}

export function normalizeGridLayout(layout: LayoutItem[]): LayoutItem[] {
  if (!Array.isArray(layout)) return [];
  const sorted = [...layout]
    .map(sanitizeItem)
    .sort((a, b) => (a.y - b.y) || (a.x - b.x) || a.i.localeCompare(b.i));

  const placed: LayoutItem[] = [];

  for (const candidate of sorted) {
    const current = { ...candidate };

    while (true) {
      const collision = placed.find((p) => rectsCollide(current, p));
      if (!collision) break;
      current.y = collision.y + collision.h;
    }

    placed.push(current);
  }

  const byId = new Map(placed.map((item) => [item.i, item]));
  return layout.map((original) => byId.get(original.i) ?? sanitizeItem(original));
}

export function normalizeLayoutForWidgets(
  widgets: WidgetConfig[],
  layout: LayoutItem[],
): LayoutItem[] {
  const safeLayout = Array.isArray(layout) ? layout : [];
  const safeWidgets = Array.isArray(widgets) ? widgets : [];
  const byId = new Map(safeLayout.map((l) => [l.i, l]));
  const merged: LayoutItem[] = [];

  let nextY = 0;
  for (const widget of safeWidgets) {
    const existing = byId.get(widget.id);
    if (existing) {
      merged.push(existing);
      nextY = Math.max(nextY, existing.y + existing.h);
      continue;
    }

    merged.push({
      i: widget.id,
      x: 0,
      y: nextY,
      w: 6,
      h: 4,
      minW: 2,
      minH: 2,
    });
    nextY += 4;
  }

  return normalizeGridLayout(merged);
}
