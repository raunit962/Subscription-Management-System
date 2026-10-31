/**
 * Dashboard stat tile.
 *
 * Props:
 *   label  — string
 *   value  — string | number (already formatted)
 *   sub?   — small secondary line
 *   tone?  — 'default' | 'warn' | 'danger' | 'good'
 */
const TONES = {
  default: 'text-gray-900',
  good:    'text-emerald-700',
  warn:    'text-amber-600',
  danger:  'text-red-600',
};

export default function KpiCard({ label, value, sub, tone = 'default' }) {
  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${TONES[tone] || TONES.default}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
