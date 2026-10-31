import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import Layout from '../../components/Layout';
import Table from '../../components/Table';
import FormModal from '../../components/FormModal';

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';
const EMPTY = { name: '', dueDays: '' };

export default function PaymentTerms() {
  const [terms,   setTerms]   = useState([]);
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
      const res = await api.get(`/payment-terms?page=${page}&pageSize=${PAGE_SIZE}`);
      setTerms(res.data);
      setTotal(res.total);
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setErr(''); setSaving(true);
    try {
      await api.post('/payment-terms', form);
      setOpen(false); setForm(EMPTY); load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const columns = [
    { key: 'name',    label: 'Name' },
    { key: 'dueDays', label: 'Due Days' },
    { key: 'createdAt', label: 'Created', render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Payment Terms</h1>
        <button onClick={() => setOpen(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
          + New Term
        </button>
      </div>
      <Table columns={columns} data={terms} total={total} page={page} pageSize={PAGE_SIZE} onPage={setPage} loading={loading} />

      <FormModal open={open} onClose={() => setOpen(false)} title="Create Payment Term"
        onSubmit={handleCreate} loading={saving} error={err}>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Due Days</label>
          <input className={INPUT} type="number" min="0" value={form.dueDays}
            onChange={(e) => setForm({ ...form, dueDays: e.target.value })} required /></div>
      </FormModal>
    </Layout>
  );
}

