import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import Layout from '../../components/Layout';
import Table from '../../components/Table';
import FormModal from '../../components/FormModal';
import { formatMoney, formatDate } from '../../utils/format';

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

const PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

const EMPTY = { name: '', price: '', period: 'MONTHLY', minQty: '1', startDate: '', endDate: '', autoClose: false, closable: true, pausable: false, renewable: true };

export default function Plans() {
  const [plans,   setPlans]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/plans?page=${page}&pageSize=${PAGE_SIZE}`);
      setPlans(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setErr(''); setSaving(true);
    try {
      await api.post('/plans', form);
      setOpen(false); setForm(EMPTY); load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  function toggle(key) { setForm((f) => ({ ...f, [key]: !f[key] })); }

  const columns = [
    { key: 'name',   label: 'Name' },
    { key: 'period', label: 'Period' },
    { key: 'price',  label: 'Price', render: (r) => formatMoney(r.price) },
    { key: 'minQty', label: 'Min Qty' },
    { key: 'available', label: 'Available', render: (r) =>
      (r.startDate || r.endDate) ? `${r.startDate ? formatDate(r.startDate) : '…'} – ${r.endDate ? formatDate(r.endDate) : '…'}` : 'Always' },
    { key: 'flags',  label: 'Flags', render: (r) =>
      [r.pausable && 'Pausable', r.closable && 'Closable', r.renewable && 'Renewable', r.autoClose && 'AutoClose']
        .filter(Boolean).join(', ') || '—' },
  ];

  return (
    <Layout>
      <PageHeader title="Plans" onAdd={() => setOpen(true)} addLabel="New Plan" />
      <Table columns={columns} data={plans} total={total} page={page} pageSize={PAGE_SIZE} onPage={setPage} loading={loading} />

      <FormModal open={open} onClose={() => setOpen(false)} title="Create Plan"
        onSubmit={handleCreate} loading={saving} error={err}>
        <Field label="Name"><input className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price"><input className={INPUT} type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></Field>
          <Field label="Min Qty"><input className={INPUT} type="number" min="1" value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value })} /></Field>
        </div>
        <Field label="Period">
          <select className={INPUT} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
            {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Available from (optional)"><input className={INPUT} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="Available until (optional)"><input className={INPUT} type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[['autoClose','Auto-Close'],['closable','Closable'],['pausable','Pausable'],['renewable','Renewable']].map(([k,l]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form[k]} onChange={() => toggle(k)} className="rounded" />
              {l}
            </label>
          ))}
        </div>
      </FormModal>
    </Layout>
  );
}

function Field({ label, children }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
function PageHeader({ title, onAdd, addLabel }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-xl font-bold text-gray-800">{title}</h1>
      {onAdd && <button onClick={onAdd} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">+ {addLabel}</button>}
    </div>
  );
}

