import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { AuthShell, Field, ErrorBox, BTN_PRIMARY, INPUT } from './Login';

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot', { email });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset your password">
      {sent ? (
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-600">
            If <strong>{email}</strong> is registered, a reset link has been printed to the server console.
          </p>
          <Link to="/login" className="text-sm text-indigo-600 hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email">
            <input
              type="email" required autoFocus
              value={email} onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
            />
          </Field>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="submit" disabled={loading} className={BTN_PRIMARY}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          <p className="text-sm text-center text-gray-500">
            <Link to="/login" className="text-indigo-600 hover:underline">Back to sign in</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

