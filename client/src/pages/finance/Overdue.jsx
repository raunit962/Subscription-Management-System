import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Table from '../../components/Table';
import { formatMoney, formatDate } from '../../utils/format';
import api from '../../api';

/** Confirmed invoices with a balance whose due date is before today. */
export default function Overdue() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    api.get(`/reports/overdue?page=${page}&pageSize=${pageSize}`)
      .then((res) => { setData(res.data); setTotal(res.total); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  const columns = [
    {
      key: 'number', label: 'Invoice #',
      render: (r) => (
        <Link to={`/billing/invoices/${r.id}`} className="text-indigo-600 font-semibold hover:underline">{r.number}</Link>
      ),
    },
    { key: 'customer', label: 'Customer', render: (r) => r.customer?.name },
    { key: 'dueDate', label: 'Due', render: (r) => formatDate(r.dueDate) },
    {
      key: 'daysOverdue', label: 'Days overdue',
      render: (r) => <span className="font-semibold text-red-600">{r.daysOverdue}</span>,
    },
    { key: 'total', label: 'Total', render: (r) => formatMoney(r.total) },
    { key: 'outstanding', label: 'Outstanding', render: (r) => <b>{formatMoney(r.outstanding)}</b> },
  ];

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Overdue invoices</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table columns={columns} data={data} total={total} page={page} pageSize={pageSize}
        onPage={setPage} loading={loading} emptyText="Nothing overdue." />
    </Layout>
  );
}
