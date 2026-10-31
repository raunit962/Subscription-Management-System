import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import Table from '../../components/Table';
import FormModal from '../../components/FormModal';
import api from '../../api';

export default function Templates() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);

  const [form, setForm] = useState({
    name: '',
    planId: '',
    validityDays: '30',
    productId: '',
    qty: '1',
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const pageSize = 10;

  async function loadData() {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page, pageSize, search });
      const res = await api.get(`/api/templates?${q}`);
      setData(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMeta() {
    try {
      const [plansRes, prodsRes] = await Promise.all([
        api.get('/api/plans?pageSize=100'),
        api.get('/api/products?pageSize=100'),
      ]);
      setPlans(plansRes.data);
      setProducts(prodsRes.data);
      if (plansRes.data[0]) setForm((f) => ({ ...f, planId: plansRes.data[0].id }));
      if (prodsRes.data[0]) setForm((f) => ({ ...f, productId: prodsRes.data[0].id }));
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadData();
  }, [page, search]);

  useEffect(() => {
    loadMeta();
  }, []);

  async function handleCreate() {
    setFormLoading(true);
    setFormError('');
    try {
      await api.post('/api/templates', {
        name: form.name,
        planId: parseInt(form.planId, 10),
        validityDays: parseInt(form.validityDays, 10),
        lines: [
          {
            productId: parseInt(form.productId, 10),
            qty: parseInt(form.qty, 10),
          },
        ],
      });
      setModalOpen(false);
      setForm({ name: '', planId: plans[0]?.id || '', validityDays: '30', productId: products[0]?.id || '', qty: '1' });
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  const columns = [
    { key: 'name', label: 'Template Name' },
    {
      key: 'plan',
      label: 'Recurring Plan',
      render: (row) => row.plan?.name || `Plan #${row.planId}`,
    },
    {
      key: 'validityDays',
      label: 'Validity',
      render: (row) => `${row.validityDays} days`,
    },
    {
      key: 'lines',
      label: 'Pre-filled Lines',
      render: (row) => Array.isArray(row.lines) ? `${row.lines.length} item(s)` : '0',
    },
  ];

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quotation Templates</h1>
          <p className="text-sm text-gray-500">Reusable sales packages with pre-configured products and plans</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
        >
          + New Template
        </button>
      </div>

      <Table
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        onPage={setPage}
        onSearch={setSearch}
        loading={loading}
      />

      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Quotation Template"
        onSubmit={handleCreate}
        loading={formLoading}
        error={formError}
      >
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Template Name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Standard CRM Starter"
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Plan</label>
          <select
            value={form.planId}
            onChange={(e) => setForm({ ...form, planId: e.target.value })}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.period})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Quote Validity (Days)</label>
          <input
            type="number"
            min="1"
            value={form.validityDays}
            onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Product</label>
            <select
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              {products.map((pr) => (
                <option key={pr.id} value={pr.id}>{pr.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>
      </FormModal>
    </Layout>
  );
}
