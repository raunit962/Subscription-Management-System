import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import Layout from '../../components/Layout';
import Table from '../../components/Table';
import FormModal from '../../components/FormModal';

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';
const EMPTY = { name: '', percent: '' };

export default function Taxes() {
  const [taxes,   setTaxes]   = useState([]);
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
      const res = await api.get(`/taxes?page=${page}&pageSize=${PAGE_SIZE}`);
      setTaxes(res.data);
      setTotal(res.total);
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setErr(''); setSaving(true);
    try {
      await api.post('/taxes', form);
      setOpen(false); setForm(EMPTY); load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const columns = [
    { key: 'name',      label: 'Name' },
    { key: 'percent',   label: 'Rate', render: (r) => `${r.percent}%` },
    { key: 'createdAt', label: 'Created', render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Taxes</h1>
        <button onClick={() => setOpen(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
          + New Tax
        </button>
      </div>
      <Table columns={columns} data={taxes} total={total} page={page} pageSize={PAGE_SIZE} onPage={setPage} loading={loading} />

      <FormModal open={open} onClose={() => setOpen(false)} title="Create Tax"
        onSubmit={handleCreate} loading={saving} error={err}>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Rate (%)</label>
          <input className={INPUT} type="number" step="0.01" min="0" max="100" value={form.percent}
            onChange={(e) => setForm({ ...form, percent: e.target.value })} required /></div>
      </FormModal>
    </Layout>
  );
}

