import { formatMoney } from '../utils/format';

/**
 * Editable product lines for subscriptions and quotation templates (Stage 3).
 *
 * Props:
 *   lines     — [{ productId, attributeValueId, qty, taxId }]
 *   onChange  — (lines) => void
 *   products  — products from GET /api/products (with attributeValues)
 *   taxes     — taxes from GET /api/taxes
 *   minQty?   — plan minimum quantity, shown as a hint and used as the input min
 *
 * Prices are shown for reference only; the server computes every amount.
 */
const CELL = 'px-2 py-1.5 border border-gray-300 rounded-md text-sm w-full';

export function emptyLine(products = [], taxes = []) {
  return { productId: products[0]?.id ?? '', attributeValueId: '', qty: '1', taxId: taxes[0]?.id ?? '' };
}

/** Lines as the API expects them (ids as numbers, blanks dropped). */
export function toApiLines(lines) {
  return lines.map((l) => ({
    productId: parseInt(l.productId, 10),
    qty: parseInt(l.qty, 10),
    ...(l.attributeValueId ? { attributeValueId: parseInt(l.attributeValueId, 10) } : {}),
    ...(l.taxId ? { taxId: parseInt(l.taxId, 10) } : {}),
  }));
}

export default function LineItemsEditor({ lines, onChange, products, taxes, minQty = 1 }) {
  const update = (i, patch) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const remove = (i) => onChange(lines.filter((_, j) => j !== i));
  const add = () => onChange([...lines, emptyLine(products, taxes)]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-gray-700 uppercase">Lines</label>
        <span className="text-xs text-gray-400">Min qty per line: {minQty}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 text-left">
            <th className="font-medium pb-1">Product</th>
            <th className="font-medium pb-1">Variant</th>
            <th className="font-medium pb-1 w-20">Qty</th>
            <th className="font-medium pb-1">Tax</th>
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const product = products.find((p) => p.id === parseInt(line.productId, 10));
            const variants = product?.attributeValues || [];
            return (
              <tr key={i} className="align-top">
                <td className="pr-2 pb-2">
                  <select className={CELL} value={line.productId}
                    onChange={(e) => update(i, { productId: e.target.value, attributeValueId: '' })}>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {formatMoney(p.salesPrice)}</option>
                    ))}
                  </select>
                </td>
                <td className="pr-2 pb-2">
                  <select className={CELL} value={line.attributeValueId} disabled={!variants.length}
                    onChange={(e) => update(i, { attributeValueId: e.target.value })}>
                    <option value="">{variants.length ? 'No variant' : '—'}</option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.attribute}: {v.value} (+{formatMoney(v.extraPrice)})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="pr-2 pb-2">
                  <input className={CELL} type="number" min={minQty} required value={line.qty}
                    onChange={(e) => update(i, { qty: e.target.value })} />
                </td>
                <td className="pr-2 pb-2">
                  <select className={CELL} value={line.taxId} onChange={(e) => update(i, { taxId: e.target.value })}>
                    <option value="">No tax</option>
                    {taxes.map((t) => <option key={t.id} value={t.id}>{t.name} ({parseFloat(t.percent)}%)</option>)}
                  </select>
                </td>
                <td className="pb-2">
                  {lines.length > 1 && (
                    <button type="button" onClick={() => remove(i)}
                      className="px-1.5 py-1 text-gray-400 hover:text-red-600" aria-label="Remove line">×</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" onClick={add} className="text-sm text-indigo-600 hover:underline">+ Add line</button>
    </div>
  );
}
