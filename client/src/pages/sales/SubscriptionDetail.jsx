import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatMoney } from '../../utils/format';
import api from '../../api';

export default function SubscriptionDetail() {
  const { id } = useParams();
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function loadSub() {
    setLoading(true);
    try {
      const data = await api.get(`/api/subscriptions/${id}`);
      setSub(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSub();
  }, [id]);

  async function handleTransition(toStatus) {
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/subscriptions/${id}/transition`, { to: toStatus });
      await loadSub();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRenew() {
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/subscriptions/${id}/renew`);
      await loadSub();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="py-12 text-center text-gray-500">Loading subscription details…</div>
      </Layout>
    );
  }

  if (!sub) {
    return (
      <Layout>
        <div className="py-12 text-center text-red-500">{error || 'Subscription not found.'}</div>
      </Layout>
    );
  }

  const plan = sub.plan;

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{sub.number}</h1>
            <StatusBadge status={sub.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Customer: <span className="font-medium text-gray-800">{sub.customer?.name}</span> ({sub.customer?.email})
          </p>
        </div>

        {/* Action buttons based on status & plan */}
        <div className="flex items-center gap-2">
          {sub.status === 'DRAFT' && (
            <button
              onClick={() => handleTransition('QUOTATION')}
              disabled={actionLoading}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md text-sm font-medium transition disabled:opacity-50"
            >
              Send Quote →
            </button>
          )}

          {sub.status === 'QUOTATION' && (
            <button
              onClick={() => handleTransition('CONFIRMED')}
              disabled={actionLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition disabled:opacity-50"
            >
              Confirm Order →
            </button>
          )}

          {sub.status === 'CONFIRMED' && (
            <button
              onClick={() => handleTransition('ACTIVE')}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition disabled:opacity-50"
            >
              Activate Subscription ✓
            </button>
          )}

          {sub.status === 'ACTIVE' && (
            <>
              {plan?.pausable && (
                <button
                  onClick={() => handleTransition('PAUSED')}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-md text-sm font-medium transition disabled:opacity-50"
                >
                  Pause
                </button>
              )}
              {plan?.closable && (
                <button
                  onClick={() => handleTransition('CLOSED')}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-md text-sm font-medium transition disabled:opacity-50"
                >
                  Close Early
                </button>
              )}
              {plan?.renewable && (
                <button
                  onClick={handleRenew}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-sm font-medium transition disabled:opacity-50"
                >
                  Renew (+1 Period)
                </button>
              )}
            </>
          )}

          {sub.status === 'PAUSED' && (
            <>
              <button
                onClick={() => handleTransition('ACTIVE')}
                disabled={actionLoading}
                className="px-3 py-2 bg-green-600 text-white hover:bg-green-700 rounded-md text-sm font-medium transition disabled:opacity-50"
              >
                Resume
              </button>
              <button
                onClick={() => handleTransition('CLOSED')}
                disabled={actionLoading}
                className="px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-md text-sm font-medium transition disabled:opacity-50"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Plan</p>
          <p className="text-base font-bold text-gray-900 mt-1">{plan?.name}</p>
          <p className="text-xs text-gray-500">{plan?.period} · Min Qty: {plan?.minQty}</p>
        </div>

        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Billing Timeline</p>
          <p className="text-sm text-gray-900 mt-1">Start: {formatDate(sub.startDate)}</p>
          <p className="text-sm text-gray-900">
            Next Invoice: {sub.nextInvoiceDate ? formatDate(sub.nextInvoiceDate) : 'None scheduled'}
          </p>
        </div>

        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Payment Terms</p>
          <p className="text-base font-bold text-gray-900 mt-1">
            {sub.paymentTerm ? sub.paymentTerm.name : 'Net 15 (Standard)'}
          </p>
        </div>
      </div>

      {/* Lines Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
        <div className="px-5 py-3 border-b border-gray-200 font-semibold text-sm text-gray-800">
          Subscription Line Items
        </div>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Variant</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(sub.lines || []).map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{line.product?.name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {line.attributeValue ? `${line.attributeValue.attribute}: ${line.attributeValue.value}` : 'Standard'}
                </td>
                <td className="px-4 py-3 text-right">{line.qty}</td>
                <td className="px-4 py-3 text-right">{formatMoney(line.unitPrice)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatMoney(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Generated Invoices */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-200 font-semibold text-sm text-gray-800 flex justify-between items-center">
          <span>Invoices for this Subscription</span>
          <span className="text-xs text-gray-500 font-normal">{sub.invoices?.length || 0} invoice(s)</span>
        </div>
        {!sub.invoices || sub.invoices.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No invoices generated yet.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Invoice Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sub.invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/billing/invoices/${inv.id}`} className="text-indigo-600 font-semibold hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(inv.invoiceDate)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatMoney(inv.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
