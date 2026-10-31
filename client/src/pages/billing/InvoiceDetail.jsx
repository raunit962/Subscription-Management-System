import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatMoney } from '../../utils/format';
import api from '../../api';

export default function InvoiceDetail() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function loadInvoice() {
    setLoading(true);
    try {
      const data = await api.get(`/api/invoices/${id}`);
      setInvoice(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoice();
  }, [id]);

  async function handleConfirm() {
    setActionLoading(true);
    setError('');
    setActionMsg('');
    try {
      await api.post(`/api/invoices/${id}/confirm`);
      setActionMsg('Invoice confirmed successfully.');
      await loadInvoice();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm('Are you sure you want to cancel this invoice? The billed period will be freed for re-billing.')) {
      return;
    }
    setActionLoading(true);
    setError('');
    setActionMsg('');
    try {
      await api.post(`/api/invoices/${id}/cancel`);
      setActionMsg('Invoice cancelled. Billed period freed.');
      await loadInvoice();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSend() {
    setActionLoading(true);
    setError('');
    setActionMsg('');
    try {
      const res = await api.post(`/api/invoices/${id}/send`);
      setActionMsg(res.message || 'Invoice sent to customer email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="py-12 text-center text-gray-500">Loading invoice details…</div>
      </Layout>
    );
  }

  if (!invoice) {
    return (
      <Layout>
        <div className="py-12 text-center text-red-500">{error || 'Invoice not found.'}</div>
      </Layout>
    );
  }

  const outstanding = Math.max(0, parseFloat(invoice.total || 0) - parseFloat(invoice.amountPaid || 0)).toFixed(2);

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{invoice.number}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Customer: <span className="font-medium text-gray-800">{invoice.customer?.name}</span> ({invoice.customer?.email})
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {invoice.status === 'DRAFT' && (
            <>
              <button
                onClick={handleConfirm}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition disabled:opacity-50"
              >
                Confirm Invoice
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-sm font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          )}

          {invoice.status === 'CONFIRMED' && (
            <>
              <button
                onClick={handleSend}
                disabled={actionLoading}
                className="px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-sm font-medium transition disabled:opacity-50"
              >
                ✉ Send to Customer
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-sm font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          )}

          <Link
            to={`/billing/invoices/${id}/print`}
            target="_blank"
            className="px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md text-sm font-medium transition"
          >
            🖨 Print View
          </Link>
        </div>
      </div>

      {actionMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-md text-sm">
          {actionMsg}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Meta Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Subscription</p>
          <p className="text-base font-bold text-gray-900 mt-1">
            <Link to={`/sales/subscriptions/${invoice.subscriptionId}`} className="text-indigo-600 hover:underline">
              {invoice.subscription?.number || `#${invoice.subscriptionId}`}
            </Link>
          </p>
          <p className="text-xs text-gray-500">{invoice.subscription?.plan?.name}</p>
        </div>

        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Billing Period</p>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {formatDate(invoice.periodStart)} → {formatDate(invoice.periodEnd)}
          </p>
        </div>

        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Invoice Date</p>
          <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(invoice.invoiceDate)}</p>
          <p className="text-xs text-gray-500">Due: {formatDate(invoice.dueDate)}</p>
        </div>

        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Outstanding Balance</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{formatMoney(outstanding)}</p>
          <p className="text-xs text-gray-500">Paid: {formatMoney(invoice.amountPaid)}</p>
        </div>
      </div>

      {/* Lines Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
        <div className="px-5 py-3 border-b border-gray-200 font-semibold text-sm text-gray-800">
          Invoice Breakdown
        </div>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Discount</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Tax</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(invoice.lines || []).map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{l.description}</td>
                <td className="px-4 py-3 text-right">{l.qty}</td>
                <td className="px-4 py-3 text-right">{formatMoney(l.unitPrice)}</td>
                <td className="px-4 py-3 text-right text-orange-600">
                  {parseFloat(l.discount) > 0 ? `-${formatMoney(l.discount)}` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{formatMoney(l.tax)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatMoney(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Box */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span>{formatMoney(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-orange-600 font-medium">
              <span>Total Discounts:</span>
              <span>-{formatMoney(invoice.discountTotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Taxes:</span>
              <span>+{formatMoney(invoice.taxTotal)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 border-t pt-2">
              <span>Invoice Total:</span>
              <span>{formatMoney(invoice.total)}</span>
            </div>
            <div className="flex justify-between text-sm text-emerald-700 font-medium">
              <span>Amount Paid:</span>
              <span>{formatMoney(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-indigo-700 border-t pt-1">
              <span>Balance Due:</span>
              <span>{formatMoney(outstanding)}</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
