import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { formatMoney } from '../../utils/format';
import api from '../../api';

export default function RunBilling() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleRun() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.post('/api/billing/run', { date });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Run Recurring Billing Engine</h1>
          <p className="text-sm text-gray-500 mt-1">
            Scans all active subscriptions and generates catch-up invoices for any periods due on or before the selected date.
          </p>
        </div>

        {/* Configuration Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Target Billing Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Subscriptions with <code className="bg-gray-100 px-1 py-0.5 rounded">nextInvoiceDate ≤ target</code> will be invoiced.
              </p>
            </div>
            <button
              onClick={handleRun}
              disabled={loading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-md transition shadow disabled:opacity-50"
            >
              {loading ? 'Running Engine…' : '⚡ Execute Billing Run'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Results Card */}
        {result && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-emerald-500">✓</span> Billing Run Complete
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
                <p className="text-xs font-semibold text-emerald-800 uppercase">Invoices Generated</p>
                <p className="text-3xl font-extrabold text-emerald-900 mt-1">{result.createdCount}</p>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs font-semibold text-gray-600 uppercase">Skipped (Double-Billing Guard)</p>
                <p className="text-3xl font-extrabold text-gray-800 mt-1">{result.skippedCount}</p>
              </div>
            </div>

            {/* Generated Invoices List */}
            {result.invoices && result.invoices.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
                  Generated Invoices
                </h3>
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden text-sm">
                  {result.invoices.map((inv) => (
                    <div key={inv.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                      <div>
                        <Link
                          to={`/billing/invoices/${inv.id}`}
                          className="font-bold text-indigo-600 hover:underline"
                        >
                          {inv.number}
                        </Link>
                        <span className="text-gray-500 ml-2">Customer: {inv.customer?.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">{formatMoney(inv.total)}</span>
                        <Link
                          to={`/billing/invoices/${inv.id}`}
                          className="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 font-medium"
                        >
                          View →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
