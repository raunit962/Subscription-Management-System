import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import Table from '../../components/Table';
import { formatMoney, formatDate } from '../../utils/format';
import api from '../../api';

export default function MyPayments() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    api.get(`/portal/payments?page=${page}&pageSize=${pageSize}`)
      .then((res) => { setData(res.data); setTotal(res.total); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  const columns = [
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
    { key: 'invoice', label: 'Invoice', render: (r) => r.invoice?.number },
    { key: 'method', label: 'Method', render: (r) => r.method.replace('_', ' ') },
    { key: 'amount', label: 'Amount', render: (r) => formatMoney(r.amount) },
  ];

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">My payments</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table columns={columns} data={data} total={total} page={page} pageSize={pageSize}
        onPage={setPage} loading={loading} emptyText="No payments yet." />
    </Layout>
  );
}
