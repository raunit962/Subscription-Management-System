import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Table from '../../components/Table';
import FormModal from '../../components/FormModal';
import { formatMoney, formatDate } from '../../utils/format';
import api from '../../api';

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400';
const METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card',          label: 'Card' },
];
const methodLabel = (m) => METHODS.find((x) => x.value === m)?.label || m;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Payments section for the invoice detail page: payment history + "Record payment"
 * (only shown while the invoice is CONFIRMED — the server enforces the same rule).
 */
export function PaymentsPanel({ invoice, onPaid }) {
  const outstanding = (parseFloat(invoice.total) - parseFloat(invoice.amountPaid)).toFixed(2);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: outstanding, method: 'cash', date: today(), note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function openModal() {
    setForm({ amount: outstanding, method: 'cash', date: today(), note: '' });
    setError('');
    setOpen(true);
  }

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await api.post('/payments', { invoiceId: invoice.id, ...form });
      setOpen(false);
      onPaid?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const payments = invoice.payments || [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
      <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
        <span className="font-semibold text-sm text-gray-800">Payments</span>
        {invoice.status === 'CONFIRMED' && (
          <button
            onClick={openModal}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium"
          >
            Record payment
          </button>
        )}
      </div>
      {payments.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-400">No payments recorded.</p>
      ) : (
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">{formatDate(p.date)}</td>
                <td className="px-4 py-3">{methodLabel(p.method)}</td>
                <td className="px-4 py-3 text-gray-500">{p.note || '—'}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={`Record payment · ${invoice.number}`}
        onSubmit={submit}
        loading={saving}
        error={error}
        submitLabel="Record payment"
      >
        <p className="text-sm text-gray-500">Outstanding: <b>{formatMoney(outstanding)}</b></p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <input className={INPUT} type="number" step="0.01" min="0.01" max={outstanding} required
            value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
          <select className={INPUT} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input className={INPUT} type="date" required
            value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
          <input className={INPUT} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
      </FormModal>
    </div>
  );
}

/** All payments, newest first. */
export default function Payments() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    api.get(`/payments?page=${page}&pageSize=${pageSize}`)
      .then((res) => { setData(res.data); setTotal(res.total); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  const columns = [
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
    {
      key: 'invoice', label: 'Invoice',
      render: (r) => (
        <Link to={`/billing/invoices/${r.invoiceId}`} className="text-indigo-600 font-semibold hover:underline">
          {r.invoice?.number}
        </Link>
      ),
    },
    { key: 'customer', label: 'Customer', render: (r) => r.invoice?.customer?.name || '—' },
    { key: 'method', label: 'Method', render: (r) => methodLabel(r.method) },
    { key: 'note', label: 'Note' },
    { key: 'amount', label: 'Amount', render: (r) => formatMoney(r.amount) },
  ];

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Payments</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table columns={columns} data={data} total={total} page={page} pageSize={pageSize}
        onPage={setPage} loading={loading} emptyText="No payments yet." />
    </Layout>
  );
}
