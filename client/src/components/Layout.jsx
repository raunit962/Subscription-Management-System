import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const ADMIN_NAV = [
  { to: '/admin/users',         label: 'Users' },
  { to: '/admin/customers',     label: 'Customers' },
  { to: '/admin/products',      label: 'Products' },
  { to: '/admin/plans',         label: 'Plans' },
  { to: '/admin/taxes',         label: 'Taxes' },
  // /admin/payment-terms — CUT from UI (seed data is enough; Stage 2 may add if needed)
  // Stage 2/3 will append items below this comment
  { to: '/sales/subscriptions', label: 'Subscriptions' },
  { to: '/sales/templates',     label: 'Templates' },
  { to: '/sales/discounts',     label: 'Discounts' },
  { to: '/billing/invoices',    label: 'Invoices' },
  { to: '/billing/run',         label: 'Run Billing' },
];

const INTERNAL_NAV = [
  { to: '/admin/customers',     label: 'Customers' },
  { to: '/admin/products',      label: 'Products' },
  { to: '/admin/plans',         label: 'Plans' },
  // Stage 2/3 will append items below this comment
  { to: '/sales/subscriptions', label: 'Subscriptions' },
  { to: '/sales/templates',     label: 'Templates' },
  { to: '/billing/invoices',    label: 'Invoices' },
  { to: '/billing/run',         label: 'Run Billing' },
];

const PORTAL_NAV = [
  // Stage 3 will append portal items
];

function navItems(role) {
  if (role === 'ADMIN')    return ADMIN_NAV;
  if (role === 'INTERNAL') return INTERNAL_NAV;
  return PORTAL_NAV;
}

export default function Layout({ children }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-200">
          <span className="text-lg font-bold text-indigo-600">Brightloop</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems(role).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-200 px-4 py-3">
          <p className="text-xs font-medium text-gray-900 truncate">{user?.name}</p>
          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          <span className="inline-block mt-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
            {role}
          </span>
          <button
            onClick={handleLogout}
            className="mt-2 w-full text-left text-xs text-red-500 hover:text-red-700"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
