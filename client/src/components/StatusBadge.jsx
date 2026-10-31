const STATUS_STYLES = {
  // Subscription statuses
  DRAFT:     'bg-gray-100 text-gray-600',
  QUOTATION: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  ACTIVE:    'bg-green-100 text-green-700',
  PAUSED:    'bg-orange-100 text-orange-700',
  CLOSED:    'bg-red-100 text-red-700',
  // Invoice statuses
  PAID:      'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-600',
  // Roles
  ADMIN:     'bg-purple-100 text-purple-700',
  INTERNAL:  'bg-blue-100 text-blue-700',
  PORTAL:    'bg-gray-100 text-gray-600',
};

/**
 * A coloured pill badge for statuses and roles.
 */
export default function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

