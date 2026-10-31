import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

// Where to send a user after login: back to the page they were sent away from,
// but only if their role can open it (customers: /portal, staff: everything else).
// Admin-only pages still go through ProtectedRoute for INTERNAL users.
function landingPath(user, from) {
  const home = user.role === 'PORTAL' ? '/portal/subscriptions' : '/sales/subscriptions';
  if (!from || from === '/' || from === '/login') return home;
  const isPortalPage = from.startsWith('/portal');
  const isSharedPage = /^\/billing\/invoices\/\d+\/print$/.test(from);
  if (isSharedPage) return from;
  if (user.role === 'PORTAL') return isPortalPage ? from : home;
  return isPortalPage ? home : from;
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(landingPath(user, from), { replace: true });
    }
  }, [user, navigate, from]);

  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedUser = await login(email, password);
      navigate(landingPath(loggedUser, from), { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Sign in to Brightloop">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
            placeholder="you@company.com"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
            placeholder="••••••••"
          />
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <button type="submit" disabled={loading} className={BTN_PRIMARY}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-sm text-center text-gray-500 pt-1">
          <Link to="/forgot-password" className="text-indigo-600 hover:underline">
            Forgot password?
          </Link>
          {' · '}
          <Link to="/signup" className="text-indigo-600 hover:underline">
            Create account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function AuthShell({ title, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-100 p-8">
        <div className="mb-6 text-center">
          <span className="text-2xl font-black text-indigo-600 tracking-tight">Brightloop</span>
          <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-widest font-semibold">Subscription Billing</p>
          <h2 className="text-lg font-semibold text-gray-800 mt-4">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

export const INPUT =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';
export const BTN_PRIMARY =
  'w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm';
export function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
export function ErrorBox({ children }) {
  return (
    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
      {children}
    </p>
  );
}
