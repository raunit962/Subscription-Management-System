import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Table from '../../components/Table';
import StatusBadge from '../../components/StatusBadge';
import { formatMoney, formatDate, formatDueRelative } from '../../utils/format';
import api from '../../api';

export default function MyInvoices() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    api.get(`/portal/invoices?page=${page}&pageSize=${pageSize}`)
      .then((res) => { setData(res.data); setTotal(res.total); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  const columns = [
    { key: 'number', label: 'Invoice #', render: (r) => <span className="font-semibold">{r.number}</span> },
    { key: 'subscription', label: 'Subscription', render: (r) => r.subscription?.number },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'invoiceDate', label: 'Date', render: (r) => formatDate(r.invoiceDate) },
    {
      key: 'dueDate', label: 'Due',
      render: (r) => r.status === 'CONFIRMED' ? formatDueRelative(r.dueDate) : formatDate(r.dueDate),
    },
    { key: 'total', label: 'Total', render: (r) => formatMoney(r.total) },
    { key: 'outstanding', label: 'Balance', render: (r) => formatMoney(r.outstanding) },
    {
      key: 'print', label: '',
      render: (r) => (
        <Link to={`/billing/invoices/${r.id}/print`} target="_blank" className="text-indigo-600 hover:underline">
          View / print
        </Link>
      ),
    },
  ];

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">My invoices</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table columns={columns} data={data} total={total} page={page} pageSize={pageSize}
        onPage={setPage} loading={loading} emptyText="No invoices yet." />
    </Layout>
  );
}
