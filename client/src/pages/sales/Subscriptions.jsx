import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Table from '../../components/Table';
import FormModal from '../../components/FormModal';
import StatusBadge from '../../components/StatusBadge';
import { formatDate } from '../../utils/format';
import api from '../../api';

export default function Subscriptions() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [products, setProducts] = useState([]);

  const [form, setForm] = useState({
    customerId: '',
    planId: '',
    templateId: '',
    startDate: new Date().toISOString().split('T')[0],
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
      if (statusFilter) q.append('status', statusFilter);
      const res = await api.get(`/api/subscriptions?${q}`);
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
      const [custs, plns, tmpls, prods] = await Promise.all([
        api.get('/api/customers?pageSize=100'),
        api.get('/api/plans?pageSize=100'),
        api.get('/api/templates?pageSize=100'),
        api.get('/api/products?pageSize=100'),
      ]);
      setCustomers(custs.data);
      setPlans(plns.data);
      setTemplates(tmpls.data);
      setProducts(prods.data);
      if (custs.data[0]) setForm((f) => ({ ...f, customerId: custs.data[0].id }));
      if (plns.data[0]) setForm((f) => ({ ...f, planId: plns.data[0].id }));
      if (prods.data[0]) setForm((f) => ({ ...f, productId: prods.data[0].id }));
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadData();
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadMeta();
  }, []);

  function handleTemplateSelect(tmplId) {
    if (!tmplId) {
      setForm((f) => ({ ...f, templateId: '' }));
      return;
    }
    const tmpl = templates.find((t) => t.id === parseInt(tmplId, 10));
    if (tmpl) {
      setForm((f) => ({
        ...f,
        templateId: tmpl.id,
        planId: tmpl.planId,
      }));
    }
  }

  async function handleCreate() {
    setFormLoading(true);
    setFormError('');
    try {
      const payload = {
        customerId: parseInt(form.customerId, 10),
        planId: parseInt(form.planId, 10),
        startDate: form.startDate,
      };

      if (form.templateId) {
        payload.templateId = parseInt(form.templateId, 10);
      } else {
        payload.lines = [
          {
            productId: parseInt(form.productId, 10),
            qty: parseInt(form.qty, 10),
          },
        ];
      }

      await api.post('/api/subscriptions', payload);
      setModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  const columns = [
    {
      key: 'number',
      label: 'Subscription #',
      render: (row) => (
        <Link
          to={`/sales/subscriptions/${row.id}`}
          className="text-indigo-600 font-semibold hover:underline"
        >
          {row.number}
        </Link>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (row) => row.customer?.name || `Customer #${row.customerId}`,
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (row) => row.plan?.name || `Plan #${row.planId}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'startDate',
      label: 'Start Date',
      render: (row) => formatDate(row.startDate),
    },
    {
      key: 'nextInvoiceDate',
      label: 'Next Billing',
      render: (row) => row.nextInvoiceDate ? formatDate(row.nextInvoiceDate) : '—',
    },
  ];

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-sm text-gray-500">Manage recurring contracts, statuses, and billing schedules</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
        >
          + New Subscription
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['', 'DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'CLOSED'].map((st) => (
          <button
            key={st}
            onClick={() => { setStatusFilter(st); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              statusFilter === st
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {st || 'ALL'}
          </button>
        ))}
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
        title="Create Subscription"
        onSubmit={handleCreate}
        loading={formLoading}
        error={formError}
      >
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Customer</label>
          <select
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Quotation Template (Optional)</label>
          <select
            value={form.templateId}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            <option value="">-- None (Manual entry) --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Start Date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>

        {!form.templateId && (
          <div className="grid grid-cols-2 gap-3 border-t pt-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Product</label>
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
        )}
      </FormModal>
    </Layout>
  );
}
