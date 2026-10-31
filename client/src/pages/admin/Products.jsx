import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import Layout from '../../components/Layout';
import Table from '../../components/Table';
import FormModal from '../../components/FormModal';
import { formatMoney } from '../../utils/format';

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(false);

  // Create product modal
  const [open,    setOpen]    = useState(false);
  const [form,    setForm]    = useState({ name: '', type: 'service', salesPrice: '', costPrice: '', notes: '' });
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  // Variants modal
  const [varOpen,  setVarOpen]  = useState(false);
  const [selProd,  setSelProd]  = useState(null);
  const [varForm,  setVarForm]  = useState({ attribute: 'Brand', value: '', extraPrice: '0' });
  const [varSave,  setVarSave]  = useState(false);
  const [varErr,   setVarErr]   = useState('');

  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs  = `?page=${page}&pageSize=${PAGE_SIZE}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      const res = await api.get(`/products${qs}`);
      setProducts(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(term) {
    setSearch(term);
    setPage(1);
  }

  async function handleCreate() {
    setErr('');
    setSaving(true);
    try {
      await api.post('/products', form);
      setOpen(false);
      setForm({ name: '', type: 'service', salesPrice: '', costPrice: '', notes: '' });
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddVariant() {
    setVarErr('');
    setVarSave(true);
    try {
      await api.post(`/products/${selProd.id}/attributes`, varForm);
      setVarOpen(false);
      setVarForm({ attribute: 'Brand', value: '', extraPrice: '0' });
      load();
    } catch (e) {
      setVarErr(e.message);
    } finally {
      setVarSave(false);
    }
  }

  const columns = [
    { key: 'name',       label: 'Name' },
    { key: 'type',       label: 'Type' },
    { key: 'salesPrice', label: 'Sales Price', render: (r) => formatMoney(r.salesPrice) },
    { key: 'variants',   label: 'Variants',    render: (r) => r.attributeValues?.length ?? 0 },
    {
      key: 'actions', label: '',
      render: (r) => (
        <button
          onClick={() => { setSelProd(r); setVarOpen(true); }}
          className="text-xs text-indigo-600 hover:underline"
        >
          + Variant
        </button>
      ),
    },
  ];

  return (
    <Layout>
      <PageHeader title="Products" onAdd={() => setOpen(true)} addLabel="New Product" />
      <Table
        columns={columns} data={products} total={total}
        page={page} pageSize={PAGE_SIZE} onPage={setPage}
        onSearch={handleSearch} loading={loading}
      />

      {/* Create product modal */}
      <FormModal open={open} onClose={() => setOpen(false)} title="Create Product"
        onSubmit={handleCreate} loading={saving} error={err}>
        <Field label="Name">
          <input className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Type">
          <select className={INPUT} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="service">Service</option>
            <option value="product">Physical Product</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sales Price">
            <input className={INPUT} type="number" step="0.01" min="0" value={form.salesPrice}
              onChange={(e) => setForm({ ...form, salesPrice: e.target.value })} required />
          </Field>
          <Field label="Cost Price">
            <input className={INPUT} type="number" step="0.01" min="0" value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={INPUT} rows={2} value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </FormModal>

      {/* Add variant modal */}
      <FormModal open={varOpen} onClose={() => setVarOpen(false)}
        title={`Add Variant — ${selProd?.name ?? ''}`}
        onSubmit={handleAddVariant} loading={varSave} error={varErr} submitLabel="Add Variant">
        <p className="text-xs text-gray-500">
          Variant price = {formatMoney(selProd?.salesPrice)} (base) + extra price
        </p>
        <Field label="Attribute (e.g. Brand)">
          <input className={INPUT} value={varForm.attribute}
            onChange={(e) => setVarForm({ ...varForm, attribute: e.target.value })} required />
        </Field>
        <Field label="Value (e.g. Odoo)">
          <input className={INPUT} value={varForm.value}
            onChange={(e) => setVarForm({ ...varForm, value: e.target.value })} required />
        </Field>
        <Field label="Extra Price">
          <input className={INPUT} type="number" step="0.01" min="0" value={varForm.extraPrice}
            onChange={(e) => setVarForm({ ...varForm, extraPrice: e.target.value })} required />
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
      {onAdd && <button onClick={onAdd} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">+ {addLabel}</button>}
    </div>
  );
}

