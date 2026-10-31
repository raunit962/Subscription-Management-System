import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { formatDate, formatMoney } from '../../utils/format';
import api from '../../api';
import { useAuth } from '../../auth/AuthContext';

export default function InvoicePrint() {
  const { id } = useParams();
  const { role } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Portal users can only read their own invoices via the scoped portal endpoint
        const path = role === 'PORTAL' ? `/portal/invoices/${id}` : `/invoices/${id}`;
        const data = await api.get(path);
        setInvoice(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, role]);

  if (loading) return <div className="p-8 text-center text-gray-500">Preparing invoice for print…</div>;
  if (!invoice) return <div className="p-8 text-center text-red-500">Invoice not found.</div>;

  const outstanding = Math.max(0, parseFloat(invoice.total || 0) - parseFloat(invoice.amountPaid || 0)).toFixed(2);

  return (
    <div className="bg-white min-h-screen p-8 max-w-4xl mx-auto text-gray-900 font-sans print:p-0">
      {/* Print Trigger Button (Hidden in print) */}
      <div className="flex justify-end gap-2 mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700"
        >
          🖨 Print / Save as PDF
        </button>
      </div>

      {/* Invoice Document Header */}
      <div className="border-b-2 border-gray-900 pb-6 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">BRIGHTLOOP</h1>
          <p className="text-sm text-gray-500 mt-1">Subscription & Recurring Billing Management</p>
          <p className="text-xs text-gray-400">support@brightloop.com</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{invoice.number}</p>
          <p className="text-xs font-semibold text-gray-500 uppercase mt-1">Status: {invoice.status}</p>
          <p className="text-sm text-gray-600 mt-1">Date: {formatDate(invoice.invoiceDate)}</p>
          <p className="text-sm text-red-600 font-semibold">Due: {formatDate(invoice.dueDate)}</p>
        </div>
      </div>

      {/* Billed To / Subscription Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">BILLED TO</h2>
          <p className="font-bold text-base text-gray-900">{invoice.customer?.name}</p>
          <p className="text-sm text-gray-600">{invoice.customer?.email}</p>
          {invoice.customer?.phone && <p className="text-sm text-gray-600">{invoice.customer.phone}</p>}
        </div>
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">SUBSCRIPTION INFO</h2>
          <p className="text-sm text-gray-900 font-semibold">Subscription: {invoice.subscription?.number}</p>
          <p className="text-sm text-gray-600">Plan: {invoice.subscription?.plan?.name}</p>
          <p className="text-sm text-gray-600">
            Period: {formatDate(invoice.periodStart)} — {formatDate(invoice.periodEnd)}
          </p>
        </div>
      </div>

      {/* Lines Table */}
      <table className="w-full text-left border-collapse mb-8 text-sm">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="py-2.5 font-bold text-gray-700">DESCRIPTION</th>
            <th className="py-2.5 text-right font-bold text-gray-700">QTY</th>
            <th className="py-2.5 text-right font-bold text-gray-700">UNIT PRICE</th>
            <th className="py-2.5 text-right font-bold text-gray-700">DISCOUNT</th>
            <th className="py-2.5 text-right font-bold text-gray-700">TAX</th>
            <th className="py-2.5 text-right font-bold text-gray-700">AMOUNT</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {(invoice.lines || []).map((l) => (
            <tr key={l.id}>
              <td className="py-3 font-medium text-gray-800">{l.description}</td>
              <td className="py-3 text-right">{l.qty}</td>
              <td className="py-3 text-right">{formatMoney(l.unitPrice)}</td>
              <td className="py-3 text-right">{parseFloat(l.discount) > 0 ? `-${formatMoney(l.discount)}` : '—'}</td>
              <td className="py-3 text-right">{formatMoney(l.tax)}</td>
              <td className="py-3 text-right font-semibold">{formatMoney(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Financials Totals */}
      <div className="flex justify-end mb-12">
        <div className="w-72 space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal:</span>
            <span>{formatMoney(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Discount Total:</span>
            <span>-{formatMoney(invoice.discountTotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Tax:</span>
            <span>+{formatMoney(invoice.taxTotal)}</span>
          </div>
          <div className="flex justify-between text-lg font-extrabold border-t-2 border-gray-900 pt-2 text-gray-900">
            <span>Total:</span>
            <span>{formatMoney(invoice.total)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-700">
            <span>Amount Paid:</span>
            <span>{formatMoney(invoice.amountPaid)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-indigo-900 border-t border-gray-300 pt-1">
            <span>Balance Due:</span>
            <span>{formatMoney(outstanding)}</span>
          </div>
        </div>
      </div>

      {/* Footer Notes */}
      <div className="border-t border-gray-200 pt-6 text-xs text-gray-500 text-center">
        <p>Thank you for your business. For any questions regarding this invoice, contact billing@brightloop.com.</p>
      </div>
    </div>
  );
}
