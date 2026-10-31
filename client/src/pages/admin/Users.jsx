import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import Layout from '../../components/Layout';
import Table from '../../components/Table';
import FormModal from '../../components/FormModal';
import StatusBadge from '../../components/StatusBadge';

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

export default function Users() {
  const [users,   setUsers]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [form,    setForm]    = useState({ name: '', email: '', password: '', role: 'INTERNAL' });
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/users?page=${page}&pageSize=${PAGE_SIZE}`);
      setUsers(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setErr('');
    setSaving(true);
    try {
      await api.post('/users', form);
      setOpen(false);
      setForm({ name: '', email: '', password: '', role: 'INTERNAL' });
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: 'name',      label: 'Name' },
    { key: 'email',     label: 'Email' },
    { key: 'role',      label: 'Role', render: (r) => <StatusBadge status={r.role} /> },
    { key: 'createdAt', label: 'Created', render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <Layout>
      <PageHeader title="Users" onAdd={() => setOpen(true)} addLabel="New Staff" />
      <Table
        columns={columns} data={users} total={total}
        page={page} pageSize={PAGE_SIZE} onPage={setPage} loading={loading}
      />

      <FormModal open={open} onClose={() => setOpen(false)} title="Create Staff User"
        onSubmit={handleCreate} loading={saving} error={err}>
        <Field label="Full name">
          <input className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Email">
          <input className={INPUT} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label="Password">
          <input className={INPUT} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </Field>
        <Field label="Role">
          <select className={INPUT} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="INTERNAL">Internal</option>
            <option value="ADMIN">Admin</option>
          </select>
        </Field>
      </FormModal>
    </Layout>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function PageHeader({ title, onAdd, addLabel }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-xl font-bold text-gray-800">{title}</h1>
      {onAdd && (
        <button onClick={onAdd} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
          + {addLabel}
        </button>
      )}
    </div>
  );
}

