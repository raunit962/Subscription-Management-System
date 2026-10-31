import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../../api';
import { validatePassword } from '../../utils/validators';
import { AuthShell, Field, ErrorBox, BTN_PRIMARY, INPUT } from './Login';

export default function ResetPassword() {
  const [params]              = useSearchParams();
  const token                 = params.get('token') || '';
  const navigate              = useNavigate();

  const [password,  setPassword]  = useState('');
  const [pwErrors,  setPwErrors]  = useState([]);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);

  function handleChange(e) {
    setPassword(e.target.value);
    setPwErrors(validatePassword(e.target.value));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validatePassword(password);
    if (errs.length) { setPwErrors(errs); return; }
    if (!token) { setError('Missing reset token. Check your reset link.'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Set a new password">
      {done ? (
        <p className="text-sm text-center text-green-600">
          Password reset! Redirecting to sign in…
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="New password">
            <input
              type="password" required autoFocus
              value={password} onChange={handleChange}
              className={INPUT}
            />
            {password && (
              <ul className="mt-1 space-y-0.5">
                {[
                  { ok: password.length > 8,             label: 'Longer than 8 characters' },
                  { ok: /[A-Z]/.test(password),          label: 'One uppercase letter' },
                  { ok: /[a-z]/.test(password),          label: 'One lowercase letter' },
                  { ok: /[^a-zA-Z0-9]/.test(password),  label: 'One special character' },
                ].map((r) => (
                  <li key={r.label} className={`text-xs flex items-center gap-1 ${r.ok ? 'text-green-600' : 'text-red-500'}`}>
                    {r.ok ? '✓' : '✗'} {r.label}
                  </li>
                ))}
              </ul>
            )}
          </Field>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="submit" disabled={loading} className={BTN_PRIMARY}>
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
          <p className="text-sm text-center text-gray-500">
            <Link to="/login" className="text-indigo-600 hover:underline">Back to sign in</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

