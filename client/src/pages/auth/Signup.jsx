import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { validatePassword } from '../../utils/validators';
import { AuthShell, Field, ErrorBox, BTN_PRIMARY, INPUT } from './Login';

export default function Signup() {
  const { login }    = useAuth();
  const navigate     = useNavigate();

  const [form,    setForm]    = useState({ name: '', email: '', password: '', phone: '' });
  const [pwErrors, setPwErrors] = useState([]);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (name === 'password') setPwErrors(validatePassword(value));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validatePassword(form.password);
    if (errs.length) { setPwErrors(errs); return; }
    setError('');
    setLoading(true);
    try {
      const { api } = await import('../../api');
      await api.post('/auth/signup', form);
      // Auto-login after signup
      await login(form.email, form.password);
      navigate('/portal/subscriptions', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create your account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name">
          <input name="name" required autoFocus value={form.name} onChange={handleChange} className={INPUT} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required value={form.email} onChange={handleChange} className={INPUT} />
        </Field>
        <Field label="Phone (optional)">
          <input name="phone" value={form.phone} onChange={handleChange} className={INPUT} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" required value={form.password} onChange={handleChange} className={INPUT} />
          {/* Live password rule feedback */}
          {form.password && (
            <ul className="mt-1 space-y-0.5">
              {[
                { ok: form.password.length > 8,             label: 'Longer than 8 characters' },
                { ok: /[A-Z]/.test(form.password),          label: 'One uppercase letter' },
                { ok: /[a-z]/.test(form.password),          label: 'One lowercase letter' },
                { ok: /[^a-zA-Z0-9]/.test(form.password),  label: 'One special character' },
              ].map((rule) => (
                <li key={rule.label} className={`text-xs flex items-center gap-1 ${rule.ok ? 'text-green-600' : 'text-red-500'}`}>
                  {rule.ok ? '✓' : '✗'} {rule.label}
                </li>
              ))}
            </ul>
          )}
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <button type="submit" disabled={loading} className={BTN_PRIMARY}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        <p className="text-sm text-center text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}

