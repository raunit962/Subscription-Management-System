/**
 * Format a decimal string as currency.
 * formatMoney('1760.00') → '$1,760.00'
 */
export function formatMoney(value, currency = 'USD') {
  const num = parseFloat(value ?? 0);
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format an ISO date string to a readable date.
 * formatDate('2024-03-15T00:00:00Z') → 'Mar 15, 2024'
 */
export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  }).format(new Date(value));
}

/**
 * Format a date+time.
 */
export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year:   'numeric',
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/**
 * Return 'X days overdue' or 'Due in X days'.
 */
export function formatDueRelative(dueDateStr) {
  if (!dueDateStr) return '—';
  const diff = Math.floor((new Date(dueDateStr) - Date.now()) / 86_400_000);
  if (diff < 0)  return `${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''} overdue`;
  if (diff === 0) return 'Due today';
  return `Due in ${diff} day${diff !== 1 ? 's' : ''}`;
}

