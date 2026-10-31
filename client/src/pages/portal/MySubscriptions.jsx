import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import Table from '../../components/Table';
import StatusBadge from '../../components/StatusBadge';
import { formatDate } from '../../utils/format';
import api from '../../api';

export default function MySubscriptions() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    api.get(`/portal/subscriptions?page=${page}&pageSize=${pageSize}`)
      .then((res) => { setData(res.data); setTotal(res.total); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  const columns = [
    { key: 'number', label: 'Subscription #', render: (r) => <span className="font-semibold">{r.number}</span> },
    { key: 'plan', label: 'Plan', render: (r) => r.plan?.name },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'startDate', label: 'Start', render: (r) => formatDate(r.startDate) },
    { key: 'nextInvoiceDate', label: 'Next invoice', render: (r) => formatDate(r.nextInvoiceDate) },
    { key: 'expiryDate', label: 'Expires', render: (r) => formatDate(r.expiryDate) },
  ];

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">My subscriptions</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table columns={columns} data={data} total={total} page={page} pageSize={pageSize}
        onPage={setPage} loading={loading} emptyText="You have no subscriptions yet." />
    </Layout>
  );
}
