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
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const pageSize = 20;

  function load() {
    setLoading(true);
    api.get(`/portal/subscriptions?page=${page}&pageSize=${pageSize}`)
      .then((res) => { setData(res.data); setTotal(res.total); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page]);

  async function act(sub, path, body, done) {
    if (body?.to === 'CLOSED' && !window.confirm(`Close ${sub.number}? This can't be undone.`)) return;
    setBusyId(sub.id);
    setError('');
    setMessage('');
    try {
      await api.post(`/portal/subscriptions/${sub.id}/${path}`, body);
      setMessage(`${sub.number} ${done}.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  // Only offer what the plan allows; the server enforces the same rules
  function actions(r) {
    const btn = 'px-2 py-1 rounded text-xs font-medium disabled:opacity-50';
    const busy = busyId === r.id;
    const items = [];
    if (r.status === 'ACTIVE' && r.plan?.pausable) {
      items.push(<button key="p" disabled={busy} className={`${btn} bg-orange-100 text-orange-700`} onClick={() => act(r, 'transition', { to: 'PAUSED' }, 'paused')}>Pause</button>);
    }
    if (r.status === 'PAUSED' && r.plan?.pausable) {
      items.push(<button key="r" disabled={busy} className={`${btn} bg-green-100 text-green-700`} onClick={() => act(r, 'transition', { to: 'ACTIVE' }, 'resumed')}>Resume</button>);
    }
    if (['ACTIVE', 'PAUSED'].includes(r.status) && r.plan?.renewable && r.expiryDate) {
      items.push(<button key="n" disabled={busy} className={`${btn} bg-indigo-50 text-indigo-700`} onClick={() => act(r, 'renew', {}, 'renewed for one more period')}>Renew</button>);
    }
    if ((r.status === 'PAUSED') || (r.status === 'ACTIVE' && r.plan?.closable)) {
      items.push(<button key="c" disabled={busy} className={`${btn} bg-red-50 text-red-700`} onClick={() => act(r, 'transition', { to: 'CLOSED' }, 'closed')}>Close</button>);
    }
    return items.length ? <div className="flex gap-1.5">{items}</div> : '—';
  }

  const columns = [
    { key: 'number', label: 'Subscription #', render: (r) => <span className="font-semibold">{r.number}</span> },
    { key: 'plan', label: 'Plan', render: (r) => r.plan?.name },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'startDate', label: 'Start', render: (r) => formatDate(r.startDate) },
    { key: 'nextInvoiceDate', label: 'Next invoice', render: (r) => formatDate(r.nextInvoiceDate) },
    { key: 'expiryDate', label: 'Expires', render: (r) => formatDate(r.expiryDate) },
    { key: 'actions', label: 'Manage', render: actions },
  ];

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">My subscriptions</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-3 text-sm text-green-700">{message}</p>}
      <Table columns={columns} data={data} total={total} page={page} pageSize={pageSize}
        onPage={setPage} loading={loading} emptyText="You have no subscriptions yet." />
    </Layout>
  );
}
