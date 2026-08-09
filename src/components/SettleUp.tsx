import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Wallet } from "lucide-react";
import { toast } from "sonner";
import { computeSettleUp, formatCents, type OrderForSettleUp, type RunCosts } from "@/lib/settleUp";

interface SettleUpProps {
  runId: string;
  runnerId: string;
}

interface EntryDisplay {
  orderId: string;
  userId: string;
  displayName: string;
  owedCents: number;
  paidAt: string | null;
}

const SettleUp = ({ runId, runnerId }: SettleUpProps) => {
  const { user } = useAuth();
  const isRunner = user?.id === runnerId;
  const [costsFinalized, setCostsFinalized] = useState(false);
  const [entries, setEntries] = useState<EntryDisplay[]>([]);
  const [runnerPaymentInfo, setRunnerPaymentInfo] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const { data: run } = await supabase
      .from("runs")
      .select("lump_sum_total_cents, tax_cents, tip_cents, delivery_fee_cents, costs_finalized_at")
      .eq("id", runId)
      .single();
    if (!run || !run.costs_finalized_at) {
      setCostsFinalized(false);
      return;
    }
    setCostsFinalized(true);

    const { data: orders } = await supabase
      .from("orders")
      .select("id, user_id, paid_at")
      .eq("run_id", runId);
    if (!orders || orders.length === 0) {
      setEntries([]);
      return;
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, quantity, price_cents")
      .in(
        "order_id",
        orders.map((o) => o.id)
      );

    const forSettleUp: OrderForSettleUp[] = orders.map((o) => {
      const orderItems = (items || []).filter((i) => i.order_id === o.id);
      return {
        orderId: o.id,
        userId: o.user_id,
        itemCount: orderItems.reduce((sum, i) => sum + i.quantity, 0),
        subtotalCents: orderItems.reduce((sum, i) => sum + (i.price_cents ?? 0) * i.quantity, 0),
      };
    });

    const costs: RunCosts = {
      lumpSumTotalCents: run.lump_sum_total_cents,
      taxCents: run.tax_cents,
      tipCents: run.tip_cents,
      deliveryFeeCents: run.delivery_fee_cents,
    };

    const computed = computeSettleUp(forSettleUp, costs).filter((e) => e.userId !== runnerId);
    const userIds = computed.map((e) => e.userId);
    const [{ data: profiles }, { data: runnerProfile }] = await Promise.all([
      userIds.length > 0
        ? supabase.from("profiles").select("user_id, display_name").in("user_id", userIds)
        : Promise.resolve({ data: [] as { user_id: string; display_name: string }[] }),
      supabase.from("profiles").select("payment_info").eq("user_id", runnerId).maybeSingle(),
    ]);
    const nameMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.display_name]));
    const paidMap = Object.fromEntries(orders.map((o) => [o.id, o.paid_at]));
    setRunnerPaymentInfo(runnerProfile?.payment_info ?? null);

    setEntries(
      computed
        .filter((e) => e.owedCents > 0)
        .map((e) => ({
          orderId: e.orderId,
          userId: e.userId,
          displayName: nameMap[e.userId] || "Someone",
          owedCents: e.owedCents,
          paidAt: paidMap[e.orderId] ?? null,
        }))
    );
  }, [runId, runnerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const markPaid = async (orderId: string, paid: boolean) => {
    const { error } = await supabase
      .from("orders")
      .update({ paid_at: paid ? new Date().toISOString() : null })
      .eq("id", orderId);
    if (error) toast.error(error.message);
    fetchData();
  };

  if (!costsFinalized) {
    return <p className="text-xs text-muted-foreground px-1">Costs haven't been entered for this run yet.</p>;
  }

  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground px-1">Nothing owed on this run.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settle Up</p>
      {runnerPaymentInfo && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" /> Pay via: {runnerPaymentInfo}
        </p>
      )}
      {entries.map((e) => {
        const isMine = e.userId === user?.id;
        const canToggle = isRunner || isMine;
        return (
          <Card key={e.orderId}>
            <CardContent className="py-2.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {isRunner ? e.displayName : "You"} {e.paidAt ? "paid" : "owes"} {formatCents(e.owedCents)}
                </p>
              </div>
              {canToggle && (
                <Button
                  variant={e.paidAt ? "outline" : "default"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => markPaid(e.orderId, !e.paidAt)}
                >
                  {e.paidAt ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1" /> Paid
                    </>
                  ) : (
                    "Mark paid"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default SettleUp;
