import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import KpiCard from '../../components/KpiCard';
import StatusBadge from '../../components/StatusBadge';
import { formatMoney } from '../../utils/format';
import api from '../../api';

const INPUT = 'px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400';
const INVOICE_STATUSES = ['DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED'];

function SummaryTable({ title, headers, rows }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-5 py-3 border-b border-gray-200 font-semibold text-sm text-gray-800">{title}</div>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((h, i) => (
              <th key={h} className={`px-4 py-2.5 text-xs font-medium text-gray-500 uppercase ${i ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-4 py-6 text-center text-gray-400">No data for these filters.</td></tr>
          ) : rows.map((cells, r) => (
            <tr key={r}>
              {cells.map((c, i) => (
                <td key={i} className={`px-4 py-3 ${i ? 'text-right tabular-nums' : ''}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const [filters, setFilters] = useState({ from: '', to: '', planId: '', status: '' });
  const [plans, setPlans] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/plans?pageSize=100').then((res) => setPlans(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    setLoading(true);
    setError('');
    api.get(`/reports/dashboard?${q}`)
      .then(setKpis)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });

  return (
    <Layout>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Finance dashboard</h1>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-500">From<br /><input type="date" className={INPUT} value={filters.from} onChange={set('from')} /></label>
          <label className="text-xs text-gray-500">To<br /><input type="date" className={INPUT} value={filters.to} onChange={set('to')} /></label>
          <label className="text-xs text-gray-500">Plan<br />
            <select className={INPUT} value={filters.planId} onChange={set('planId')}>
              <option value="">All plans</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-500">Invoice status<br />
            <select className={INPUT} value={filters.status} onChange={set('status')}>
              <option value="">All</option>
              {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <button
            onClick={() => setFilters({ from: '', to: '', planId: '', status: '' })}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {loading && !kpis && <p className="text-gray-500">Loading…</p>}

      {kpis && (
        <div className={loading ? 'opacity-60' : ''}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <KpiCard label="Active subscriptions" value={kpis.activeSubscriptions} />
            <KpiCard label="MRR" value={formatMoney(kpis.mrr)} sub="Active lines, monthly equivalent" />
            <KpiCard label="Revenue collected" value={formatMoney(kpis.revenueCollected)} sub="Payments in date range" tone="good" />
            <KpiCard label="Outstanding" value={formatMoney(kpis.outstanding.amount)} sub={`${kpis.outstanding.count} confirmed invoices`} tone="warn" />
            <KpiCard
              label="Overdue"
              value={formatMoney(kpis.overdue.amount)}
              sub={<Link to="/finance/overdue" className="hover:underline">{kpis.overdue.count} invoices past due →</Link>}
              tone={kpis.overdue.count ? 'danger' : 'default'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <SummaryTable
                title="Invoices by status (invoice date in range)"
                headers={['Status', 'Count', 'Total', 'Paid', 'Outstanding']}
                rows={kpis.invoicesByStatus.map((r) => [
                  <StatusBadge status={r.status} />, r.count,
                  formatMoney(r.total), formatMoney(r.paid), formatMoney(r.outstanding),
                ])}
              />
            </div>
            <SummaryTable
              title="Subscriptions by status"
              headers={['Status', 'Count']}
              rows={kpis.subscriptionsByStatus.map((r) => [<StatusBadge status={r.status} />, r.count])}
            />
          </div>
        </div>
      )}
    </Layout>
  );
}
