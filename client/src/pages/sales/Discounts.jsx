import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import Table from '../../components/Table';
import FormModal from '../../components/FormModal';
import { formatMoney, formatDate } from '../../utils/format';
import { useAuth } from '../../auth/AuthContext';
import api from '../../api';

export default function Discounts() {
  const { role } = useAuth();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [products, setProducts] = useState([]);

  const [form, setForm] = useState({
    name: '',
    type: 'PERCENT',
    value: '',
    scope: 'SUBSCRIPTION',
    productId: '',
    minQty: '',
    minPurchase: '',
    usageLimit: '',
    startDate: '',
    endDate: '',
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const pageSize = 10;

  async function loadData() {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page, pageSize, search });
      const res = await api.get(`/api/discounts?${q}`);
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
      const prodsRes = await api.get('/api/products?pageSize=100');
      setProducts(prodsRes.data);
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
      const payload = {
        name: form.name,
        type: form.type,
        value: parseFloat(form.value),
        scope: form.scope,
      };

      if (form.scope === 'PRODUCT') {
        payload.productId = parseInt(form.productId, 10);
      }
      if (form.minQty) payload.minQty = parseInt(form.minQty, 10);
      if (form.minPurchase) payload.minPurchase = parseFloat(form.minPurchase);
      if (form.usageLimit) payload.usageLimit = parseInt(form.usageLimit, 10);
      if (form.startDate) payload.startDate = form.startDate;
      if (form.endDate) payload.endDate = form.endDate;

      await api.post('/api/discounts', payload);
      setModalOpen(false);
      setForm({
        name: '',
        type: 'PERCENT',
        value: '',
        scope: 'SUBSCRIPTION',
        productId: products[0]?.id || '',
        minQty: '',
        minPurchase: '',
        usageLimit: '',
        startDate: '',
        endDate: '',
      });
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  const columns = [
    { key: 'name', label: 'Discount Name' },
    {
      key: 'value',
      label: 'Value',
      render: (row) =>
        row.type === 'PERCENT' ? `${row.value}%` : formatMoney(row.value),
    },
    {
      key: 'scope',
      label: 'Scope',
      render: (row) => (
        <span className="capitalize">
          {row.scope.toLowerCase()} {row.product ? `(${row.product.name})` : ''}
        </span>
      ),
    },
    {
      key: 'usage',
      label: 'Usage / Limit',
      render: (row) =>
        `${row.usageCount} / ${row.usageLimit !== null && row.usageLimit !== undefined ? row.usageLimit : '∞'}`,
    },
    {
      key: 'dates',
      label: 'Validity Window',
      render: (row) => {
        if (!row.startDate && !row.endDate) return 'Always active';
        return `${row.startDate ? formatDate(row.startDate) : 'Now'} → ${row.endDate ? formatDate(row.endDate) : 'Indefinite'}`;
      },
    },
  ];

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Promotions & Discounts</h1>
          <p className="text-sm text-gray-500">Tiered percentage & fixed value pricing rules with usage limits</p>
        </div>
        {role === 'ADMIN' && (
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
          >
            + New Discount
          </button>
        )}
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
        title="Create Promotional Discount"
        onSubmit={handleCreate}
        loading={formLoading}
        error={formError}
      >
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Discount Name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Summer Promo 10%"
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="PERCENT">Percentage (%)</option>
              <option value="FIXED">Fixed Amount ($)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Value</label>
            <input
              type="number"
              step="0.01"
              required
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder={form.type === 'PERCENT' ? '10' : '50.00'}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Scope</label>
            <select
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="SUBSCRIPTION">Whole Subscription</option>
              <option value="PRODUCT">Specific Product Line</option>
            </select>
          </div>
          {form.scope === 'PRODUCT' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Target Product</label>
              <select
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Min Qty</label>
            <input
              type="number"
              min="1"
              value={form.minQty}
              onChange={(e) => setForm({ ...form, minQty: e.target.value })}
              placeholder="e.g. 5"
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Min Purchase ($)</label>
            <input
              type="number"
              step="0.01"
              value={form.minPurchase}
              onChange={(e) => setForm({ ...form, minPurchase: e.target.value })}
              placeholder="e.g. 500"
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Usage Limit</label>
            <input
              type="number"
              min="1"
              value={form.usageLimit}
              onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
              placeholder="e.g. 100"
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Start Date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">End Date</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>
      </FormModal>
    </Layout>
  );
}
