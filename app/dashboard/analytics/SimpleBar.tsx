'use client';
import React from 'react';

type Item = { label: string; value: number };

export default function SimpleBar({ data }: { data: Item[] }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <div className="w-24 text-xs text-gray-600 truncate">{d.label}</div>
          <div className="flex-1 h-3 bg-gray-100 rounded">
            <div
              className="h-3 rounded bg-gray-800"
              style={{ width: `${(d.value / max) * 100}%` }}
              title={`${d.value}`}
            />
          </div>
          <div className="w-16 text-right text-xs tabular-nums text-gray-700">
            {d.value.toFixed(2)}
          </div>
        </div>
      ))}
    </div>
  );
}
