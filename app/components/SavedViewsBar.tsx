'use client';
import React, { useEffect, useState } from 'react';
import { listViews, saveView, removeView, View } from '@/app/lib/views';

export default function SavedViewsBar({
  currentParams, onApply
}: {
  currentParams: Record<string, string>;
  onApply: (params: Record<string,string>) => void;
}) {
  const [views, setViews] = useState<View[]>([]);
  const [name, setName] = useState('');

  useEffect(() => { setViews(listViews()); }, []);

  function add() {
    if (!name.trim()) return;
    saveView({ name: name.trim(), params: currentParams });
    setViews(listViews());
    setName('');
  }
  function apply(v: View) { onApply(v.params); }
  function del(n: string) { removeView(n); setViews(listViews()); }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {views.map(v => (
        <div key={v.name} className="flex items-center gap-1 border rounded px-2 py-1 bg-white">
          <button className="text-sm" onClick={() => apply(v)}>{v.name}</button>
          <button className="text-gray-400 hover:text-red-600" onClick={() => del(v.name)}>×</button>
        </div>
      ))}
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Save current view as…"
        className="border rounded px-2 py-1 text-sm"
      />
      <button onClick={add} className="px-3 py-1 text-sm rounded bg-gray-900 text-white">Save View</button>
    </div>
  );
}
