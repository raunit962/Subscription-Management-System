import Layout from '../../components/Layout';
import { useAuth } from '../../auth/AuthContext';

export default function MySubscriptions() {
  const { user } = useAuth();

  return (
    <Layout>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-2xl mx-auto text-center mt-12">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name || 'Customer'}!</h1>
        <p className="text-gray-500 mt-2">
          You are signed in as a Portal Customer (<code className="bg-gray-100 px-2 py-0.5 rounded text-sm text-indigo-600">{user?.email}</code>).
        </p>
        <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-900 text-left">
          <p className="font-semibold mb-1">Customer Portal Access:</p>
          <p>
            Your account is authenticated and active. Self-service subscription management, payment records, and invoice downloads will be fully unlocked in Stage 3.
          </p>
        </div>
      </div>
    </Layout>
  );
}
