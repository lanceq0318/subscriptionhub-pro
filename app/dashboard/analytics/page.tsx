*** Begin Patch
*** Update File: app/dashboard/analytics/page.tsx
@@
-'use client';
-import React, { useEffect, useState } from 'react';
-import StatCard from '@/app/components/StatCard';
-import SimpleBar from '@/app/components/SimpleBar';
+'use client';
+import React, { useEffect, useState } from 'react';
 
 type Summary = {
   ledger: {
     mtd: number;
     last30: number;
@@
   };
 };
 
-export default function AnalyticsPage() {
+// Inline StatCard (removes external imports)
+function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
+  return (
+    <div className="rounded-lg border p-4 bg-white shadow-sm">
+      <div className="text-sm text-gray-500">{label}</div>
+      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
+      {hint ? <div className="mt-1 text-xs text-gray-400">{hint}</div> : null}
+    </div>
+  );
+}
+
+// Inline SimpleBar (removes external imports)
+function SimpleBar({ data }: { data: { label: string; value: number }[] }) {
+  const max = Math.max(1, ...data.map(d => d.value));
+  return (
+    <div className="space-y-2">
+      {data.map((d) => (
+        <div key={d.label} className="flex items-center gap-2">
+          <div className="w-24 text-xs text-gray-600 truncate">{d.label}</div>
+          <div className="flex-1 h-3 bg-gray-100 rounded">
+            <div
+              className="h-3 rounded bg-gray-800"
+              style={{ width: `${(d.value / max) * 100}%` }}
+              title={`${d.value}`}
+            />
+          </div>
+          <div className="w-16 text-right text-xs tabular-nums text-gray-700">
+            {d.value.toFixed(2)}
+          </div>
+        </div>
+      ))}
+    </div>
+  );
+}
+
+export default function AnalyticsPage() {
   const [data, setData] = useState<Summary | null>(null);
   const [err, setErr] = useState<string | null>(null);
 
   useEffect(() => {
     (async () => {
@@
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <StatCard label="Paid MTD" value={`$${data.ledger.mtd.toFixed(2)}`} />
         <StatCard label="Paid Last 30 Days" value={`$${data.ledger.last30.toFixed(2)}`} />
         <StatCard label="Paid YTD" value={`$${data.ledger.ytd.toFixed(2)}`} />
       </div>
*** End Patch
