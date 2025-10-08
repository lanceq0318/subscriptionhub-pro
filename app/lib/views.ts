'use client';

export type View = { name: string; params: Record<string, string> };
const KEY = 'subscriptionhub:savedViews';

export function listViews(): View[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export function saveView(v: View) {
  const all = listViews().filter(x => x.name !== v.name);
  all.push(v);
  localStorage.setItem(KEY, JSON.stringify(all));
}
export function removeView(name: string) {
  const all = listViews().filter(x => x.name !== name);
  localStorage.setItem(KEY, JSON.stringify(all));
}
