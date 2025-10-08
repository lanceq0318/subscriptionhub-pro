'use client';
import React, { useEffect, useState } from 'react';

type Summary = {
  ledger: {
    mtd: number;
    last30: number;
    ytd: number;
    trend6m: { month: string; total: number }[];
    byCategoryYtd: { category: string; total: number }[];
  };
  fleet: {
    overdueCount: number;
    activeCount: number;
    mrrRunRate: number;
  };
};

// Inline StatCard
function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-4 bg-white shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-gray-400">{hint}</div> : null}
    </div>
  );
}

// Inline SimpleBar
function SimpleBar({ data }: { data: { label: string; value: number }[] }) {
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

export default function AnalyticsPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/analytics/summary', { cache: 'no-store' });
      if (!res.ok) { setErr('Failed to load analytics'); return; }
      setData(await res.json());
    })();
  }, []);

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!data) return <div className="p-6 text-gray-500">Loading…</div>;

  const trend = data.ledger.trend6m.map(t => ({ label: t.month.slice(5), value: t.total }));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Paid MTD" value={`$${data.ledger.mtd.toFixed(2)}`} />
        <StatCard label="Paid Last 30 Days" value={`$${data.ledger.last30.toFixed(2)}`} />
        <StatCard label="Paid YTD" value={`$${data.ledger.ytd.toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-lg border p-4 bg-white">
          <div className="text-sm text-gray-500 mb-3">Ledger Trend (last 6 months)</div>
          <SimpleBar data={trend} />
        </div>
        <div className="rounded-lg border p-4 bg-white">
          <div className="text-sm text-gray-500 mb-3">Spend by Category (YTD)</div>
          <SimpleBar data={data.ledger.byCategoryYtd.map(c => ({ label: c.category, value: c.total }))} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Active Subscriptions" value={`${data.fleet.activeCount}`} />
        <StatCard label="Overdue (by Next Billing)" value={`${data.fleet.overdueCount}`} />
        <StatCard label="MRR Run Rate (from list price)" value={`$${data.fleet.mrrRunRate.toFixed(2)}`} hint="Run rate from subscription cadence" />
      </div>
    </div>
  );
}
