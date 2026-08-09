// All amounts in cents to avoid floating-point rounding issues.
export interface OrderForSettleUp {
  orderId: string;
  userId: string;
  itemCount: number;
  subtotalCents: number; // sum of price_cents * quantity, treating unpriced items as 0
}

export interface RunCosts {
  lumpSumTotalCents: number | null;
  taxCents: number;
  tipCents: number;
  deliveryFeeCents: number;
}

export interface SettleUpEntry {
  orderId: string;
  userId: string;
  owedCents: number;
}

// Lump sum mode: the total already includes tax/tip/fees, and there's no
// per-item pricing to be proportional to, so it's split by each order's
// share of the total item count. Itemized mode: each order pays its own
// subtotal plus its proportional share of tax+tip+delivery, weighted by
// subtotal (confirmed with the user) — the runner's own order (if any)
// counts toward the base but is filtered out of "who owes the runner" at
// the display layer, since they don't owe themselves.
export function computeSettleUp(orders: OrderForSettleUp[], costs: RunCosts): SettleUpEntry[] {
  if (costs.lumpSumTotalCents !== null) {
    const totalItems = orders.reduce((sum, o) => sum + o.itemCount, 0);
    if (totalItems === 0) {
      return orders.map((o) => ({ orderId: o.orderId, userId: o.userId, owedCents: 0 }));
    }
    return orders.map((o) => ({
      orderId: o.orderId,
      userId: o.userId,
      owedCents: Math.round((o.itemCount / totalItems) * costs.lumpSumTotalCents!),
    }));
  }

  const feesCents = costs.taxCents + costs.tipCents + costs.deliveryFeeCents;
  const totalSubtotal = orders.reduce((sum, o) => sum + o.subtotalCents, 0);
  if (totalSubtotal === 0) {
    return orders.map((o) => ({ orderId: o.orderId, userId: o.userId, owedCents: 0 }));
  }
  return orders.map((o) => ({
    orderId: o.orderId,
    userId: o.userId,
    owedCents: o.subtotalCents + Math.round((o.subtotalCents / totalSubtotal) * feesCents),
  }));
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
