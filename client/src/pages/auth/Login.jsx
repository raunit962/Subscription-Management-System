import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

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
      if (user.role === 'PORTAL') {
        navigate('/portal/subscriptions', { replace: true });
      } else {
        const dest = from !== '/' && from !== '/login' ? from : '/sales/subscriptions';
        navigate(dest, { replace: true });
      }
    }
  }, [user, navigate, from]);

  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedUser = await login(email, password);
      if (loggedUser.role === 'PORTAL') {
        navigate('/portal/subscriptions', { replace: true });
      } else {
        const dest = from !== '/' && from !== '/login' ? from : '/sales/subscriptions';
        navigate(dest, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  function handleQuickLogin(demoEmail, demoPassword) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
    setLoading(true);
    login(demoEmail, demoPassword)
      .then((loggedUser) => {
        if (loggedUser.role === 'PORTAL') {
          navigate('/portal/subscriptions', { replace: true });
        } else {
          const dest = from !== '/' && from !== '/login' ? from : '/sales/subscriptions';
          navigate(dest, { replace: true });
        }
      })
      .catch((err) => {
        setError(err.message || 'Login failed. Please check credentials or start database server.');
      })
      .finally(() => {
        setLoading(false);
      });
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
            placeholder="admin@brightloop.com"
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

        {/* Quick Demo Logins for Hackathon Evaluators */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center mb-2">
            ⚡ Quick Demo Logins
          </p>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@brightloop.com', 'Admin@123!')}
              className="py-1.5 px-2 bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium rounded text-center transition"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('staff@brightloop.com', 'Staff@123!')}
              className="py-1.5 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium rounded text-center transition"
            >
              Staff
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('alice@example.com', 'Portal@123!')}
              className="py-1.5 px-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium rounded text-center transition"
            >
              Customer
            </button>
          </div>
        </div>

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
