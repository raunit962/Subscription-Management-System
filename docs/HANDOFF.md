# Handoff Notes

## Stage 1 — Foundation (Person A)

---

### Built

#### Server — routes live at `/api/*`

| Route file | Endpoints |
|---|---|
| `auth.routes.js` | `POST /signup`, `POST /login`, `GET /me`, `POST /forgot`, `POST /reset` |
| `users.routes.js` | `POST /users` (ADMIN), `GET /users` (ADMIN), `GET /users/:id` (ADMIN) |
| `customers.routes.js` | `POST /customers`, `GET /customers`, `GET /customers/:id` (ADMIN/INTERNAL) |
| `products.routes.js` | `GET/POST /products`, `GET/PUT /products/:id`, `POST/PUT/DELETE /products/:id/attributes` |
| `plans.routes.js` | `GET/POST /plans`, `GET/PUT /plans/:id` |
| `taxes.routes.js` | `GET/POST /taxes`, `GET/PUT/DELETE /taxes/:id` |
| `paymentTerms.routes.js` | `GET/POST /payment-terms`, `GET/PUT/DELETE /payment-terms/:id` |

#### Server — lib

| File | Exports |
|---|---|
| `lib/auth.js` | `validatePassword`, `hashPassword`, `comparePassword`, `signToken`, `verifyToken`, `requireAuth`, `requireRole`, `generateResetToken` |
| `lib/money.js` | `add`, `sub`, `mul`, `pct`, `round2`, `gt`, `gte`, `lt`, `lte`, `eq` (all use decimal.js) |
| `lib/errors.js` | `HttpError`, `errorHandler` middleware |
| `lib/pagination.js` | `parsePagination`, `paginatedResponse` |
| `lib/prisma.js` | singleton `PrismaClient` |

#### Prisma

- Full schema with all 14 models + enums (Role, Period, SubscriptionStatus, InvoiceStatus, DiscountType, DiscountScope)
- All §3 indexes + `@@unique([subscriptionId, billedPeriod])` on Invoice
- Migration: `init`
- Seed: admin@brightloop.com / Admin@123!, staff@brightloop.com / Staff@123!, alice@example.com / Portal@123!, bob@example.com / Portal@123!, 3 products (CRM with Odoo+560/Generic+0, Cloud Hosting, Support Plan), 3 plans, 2 taxes, 2 payment terms

#### Client

| Path | What it is |
|---|---|
| `src/api.js` | Fetch wrapper with Bearer token, JSON parse, throws with server error message |
| `src/auth/AuthContext.jsx` | `useAuth()` → `{ user, role, token, login, logout }` |
| `src/auth/ProtectedRoute.jsx` | Role-based guard, redirects to `/login` or `/unauthorized` |
| `src/components/Layout.jsx` | Role-aware sidebar; append nav items for S2/S3 |
| `src/components/Table.jsx` | Server-paginated table with optional search |
| `src/components/FormModal.jsx` | Reusable create/edit modal |
| `src/components/StatusBadge.jsx` | Colour pills — covers all S1–S3 statuses |
| `src/utils/validators.js` | `validatePassword(pw)` → string[] errors (mirrors server regex) |
| `src/utils/format.js` | `formatMoney`, `formatDate`, `formatDateTime`, `formatDueRelative` |
| `src/pages/auth/` | Login, Signup (live pw rule errors), ForgotPassword, ResetPassword |
| `src/pages/admin/` | Users, Customers, Products (+ variant modal), Plans, Taxes |

---

### Contracts Stage 2 must use (do not rename)

#### Auth middleware
```js
const { requireAuth, requireRole } = require('../lib/auth');
// Usage: router.post('/', requireAuth, requireRole('ADMIN'), handler)
```

#### Money helpers (`lib/money.js`)
```js
const { add, sub, mul, pct, round2 } = require('../lib/money');
// All return decimal strings rounded to 2dp — never use + / * on raw prices
```

#### Pagination
```js
const { parsePagination, paginatedResponse } = require('../lib/pagination');
// parsePagination(req.query) → { page, pageSize, skip }
// paginatedResponse(data, total, page, pageSize) → { data, total, page, pageSize }
```

#### Error
```js
const { HttpError } = require('../lib/errors');
throw new HttpError(409, 'Conflict message');
```

#### Prisma
```js
const prisma = require('../lib/prisma'); // singleton — never new PrismaClient()
```

#### app.js — append only
```js
// Append require() lines after: // Stage 2 will append its require() lines below this comment
// Append app.use() lines after: // Stage 2/3 will append their app.use() lines below this comment
```

#### App.jsx — append only
```jsx
// Append import lines after: // S2/S3 imports will be appended below this comment
// Append <Route> elements after: // S2/S3 routes will be appended below this comment
```

#### Layout.jsx — append only
```js
// Append to ADMIN_NAV / INTERNAL_NAV arrays after their respective comments
```

---

### Cut Items (dropped at T-20 min)

| Item | Reason | Notes for Stage 2/3 |
|---|---|---|
| **Edit/delete UI on all admin pages** | Time. | APIs (`PUT /products/:id`, `DELETE /taxes/:id`, etc.) are fully implemented server-side — wire UI if time allows in S2/S3. |
| **PaymentTerms page** (`/admin/payment-terms`) | Time. | Seed has Net 15 + Net 30. API at `/api/payment-terms` is live. File `PaymentTerms.jsx` exists but is unrouted. |
| **Product detail page** | Time. | `GET /api/products/:id` returns full data with variants. |
| **Customer detail / edit** | Time. | `GET /api/customers/:id` returns customer + last 5 subscriptions. |

---

### Test Results

All Stage 1 test-gate checks are in:
- `tests/auth.test.js` — password rules (4 rejections + 1 accept), duplicate email case-insensitive 409, reset token works once then 400
- `tests/roles.test.js` — INTERNAL → 403 on staff create, PORTAL → 403 on products POST, unauthed → 401
- `tests/products.test.js` — Odoo variant price = 1760.00, Generic = 1200.00, duplicate attribute 409, prices as decimal strings

> Run: `npm test` from repo root (uses `DATABASE_URL_TEST`)

---

### Known Issues / Gotchas

- Node.js must be v20+. Install with `winget install OpenJS.NodeJS.LTS` if missing.
- Docker must be running before `npm run setup` (Postgres 16 on port 5432).
- `setup-and-commit.bat` in the repo root handles full setup + git init + all commits.
- `billedPeriod` on Invoice is nullable — Postgres NULLs don't conflict, so cancelling an invoice sets it to `null` and frees the period for re-billing. **Do not add a non-null default.**
