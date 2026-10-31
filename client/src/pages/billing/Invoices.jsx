import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Table from '../../components/Table';
import StatusBadge from '../../components/StatusBadge';
import { formatMoney, formatDate } from '../../utils/format';
import api from '../../api';

export default function Invoices() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const pageSize = 10;

  async function loadData() {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page, pageSize, search });
      if (statusFilter) q.append('status', statusFilter);
      const res = await api.get(`/api/invoices?${q}`);
      setData(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [page, search, statusFilter]);

  const columns = [
    {
      key: 'number',
      label: 'Invoice #',
      render: (row) => (
        <Link
          to={`/billing/invoices/${row.id}`}
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
      key: 'subscription',
      label: 'Subscription',
      render: (row) =>
        row.subscription ? (
          <Link
            to={`/sales/subscriptions/${row.subscriptionId}`}
            className="text-gray-600 hover:text-indigo-600 underline"
          >
            {row.subscription.number}
          </Link>
        ) : (
          `Sub #${row.subscriptionId}`
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'invoiceDate',
      label: 'Invoice Date',
      render: (row) => formatDate(row.invoiceDate),
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (row) => formatDate(row.dueDate),
    },
    {
      key: 'total',
      label: 'Total',
      render: (row) => <span className="font-semibold">{formatMoney(row.total)}</span>,
    },
    {
      key: 'amountPaid',
      label: 'Paid',
      render: (row) => formatMoney(row.amountPaid),
    },
  ];

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500">Track billed periods, payment status, and customer accounts</p>
        </div>
        <Link
          to="/billing/run"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
        >
          ⚙ Run Billing Engine
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['', 'DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED'].map((st) => (
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
    </Layout>
  );
}
