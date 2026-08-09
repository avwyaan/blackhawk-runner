import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, CheckCheck, PackageCheck, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import CountdownTimer from "@/components/CountdownTimer";
import { LiveActivity, type ShoppingItem as LAItem } from "@/plugins/LiveActivity";
import { trackEvent } from "@/lib/analytics";
import { formatCents } from "@/lib/settleUp";

interface OrderItemWithUser {
  id: string;
  item_name: string;
  quantity: number;
  comment: string | null;
  is_picked_up: boolean;
  price_cents: number | null;
  order_id: string;
  user_id: string;
  display_name: string;
  is_order_complete: boolean;
}

interface OrderMeta {
  id: string;
  user_id: string;
  is_complete: boolean;
  dropped_off_at: string | null;
}

interface Run {
  id: string;
  store_names: string;
  status: string;
  closes_at: string;
  runner_id: string;
  group_id: string;
  note: string | null;
}

const isNative = Capacitor.isNativePlatform();

function buildLAItems(items: OrderItemWithUser[]): LAItem[] {
  return items.map((item) => ({
    id: item.id,
    name: item.item_name,
    quantity: item.quantity > 1 ? `×${item.quantity}` : undefined,
    person: item.display_name,
    initial: (item.display_name || "?")[0].toUpperCase(),
  }));
}

const ActiveRunRunner = () => {
  const { runId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [items, setItems] = useState<OrderItemWithUser[]>([]);
  const [orders, setOrders] = useState<OrderMeta[]>([]);
  const [liveActivitiesEnabled, setLiveActivitiesEnabled] = useState(true);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [useLumpSum, setUseLumpSum] = useState(false);
  const [lumpSumInput, setLumpSumInput] = useState("");
  const [taxInput, setTaxInput] = useState("");
  const [tipInput, setTipInput] = useState("");
  const [feeInput, setFeeInput] = useState("");
  const [finishing, setFinishing] = useState(false);
  const activityStarted = useRef(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notification_preferences")
      .select("notify_live_activities")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setLiveActivitiesEnabled(data?.notify_live_activities ?? true));
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!runId) return;

    const { data: runData } = await supabase.from("runs").select("*").eq("id", runId).single();
    setRun(runData);

    const { data: orders } = await supabase
      .from("orders")
      .select("id, user_id, is_complete, dropped_off_at")
      .eq("run_id", runId);

    setOrders(orders || []);

    if (!orders || orders.length === 0) { setItems([]); return; }

    const userIds = orders.map((o) => o.user_id);
    const [{ data: profiles }, { data: allItems }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
      supabase.from("order_items").select("*").in("order_id", orders.map((o) => o.id)),
    ]);

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.display_name]));
    const orderMap = Object.fromEntries(orders.map((o) => [o.id, o]));

    setItems(
      (allItems || []).map((item) => ({
        ...item,
        user_id: orderMap[item.order_id]?.user_id || "",
        display_name: profileMap[orderMap[item.order_id]?.user_id || ""] || "Unknown",
        is_order_complete: orderMap[item.order_id]?.is_complete || false,
      }))
    );
  }, [runId]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`runner-${runId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "runs", filter: `id=eq.${runId}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData, runId]);

  // Sync Live Activity when items change during active shopping
  useEffect(() => {
    if (!isNative || !activityStarted.current || !run) return;
    if (run.status !== "shopping") return;

    const checkedIds = items.filter((i) => i.is_picked_up).map((i) => i.id);
    LiveActivity.update({ items: buildLAItems(items), checkedIds }).catch(() => {});
  }, [items, run]);

  const toggleItemPickup = async (itemId: string, currentValue: boolean) => {
    await supabase.from("order_items").update({ is_picked_up: !currentValue }).eq("id", itemId);
    fetchData();
  };

  const updateItemPrice = async (itemId: string, dollarsValue: string) => {
    const trimmed = dollarsValue.trim();
    let cents: number | null = null;
    if (trimmed !== "") {
      const parsed = Math.round(parseFloat(trimmed) * 100);
      if (Number.isNaN(parsed) || parsed < 0) return;
      cents = parsed;
    }
    await supabase.from("order_items").update({ price_cents: cents }).eq("id", itemId);
    fetchData();
  };

  const markPersonComplete = async (orderId: string) => {
    await Promise.all([
      supabase.from("orders").update({ is_complete: true }).eq("id", orderId),
      supabase.from("order_items").update({ is_picked_up: true }).eq("order_id", orderId),
    ]);
    fetchData();
    toast.success("Marked as complete!");
  };

  const startShopping = async () => {
    await supabase.from("runs").update({ status: "shopping" }).eq("id", runId);

    if (isNative && run && liveActivitiesEnabled) {
      const laItems = buildLAItems(items);
      const checkedIds = items.filter((i) => i.is_picked_up).map((i) => i.id);
      try {
        await LiveActivity.start({
          runId: run.id,
          storeNames: run.store_names,
          items: laItems,
          checkedIds,
        });
        activityStarted.current = true;
      } catch {
        // Live Activity failed silently (iOS <16.2 or disabled) — shopping continues normally
      }
    }

    trackEvent("run_locked", { groupId: run?.group_id });
    fetchData();
    toast.success("Shopping locked in — list is on your lock screen!");
  };

  const endLiveActivityIfNeeded = async () => {
    if (!isNative || !activityStarted.current) return;
    const laItems = buildLAItems(items);
    const checkedIds = items.filter((i) => i.is_picked_up).map((i) => i.id);
    try {
      await LiveActivity.end({ items: laItems, checkedIds });
      activityStarted.current = false;
    } catch {
      // ignore
    }
  };

  // Delivery is tracked per recipient — a runner drops off at different houses
  // at different times. The run itself flips to "dropped_off" automatically
  // (via a DB trigger) once every order has one.
  const markPersonDroppedOff = async (orderId: string) => {
    await supabase.from("orders").update({ dropped_off_at: new Date().toISOString() }).eq("id", orderId);
    fetchData();
    toast.success("Marked as dropped off!");
  };

  // Bulk drop-off — for a group hand-off in one spot, or to wrap up a run with
  // no orders at all.
  const finishRun = async () => {
    const now = new Date().toISOString();
    const pending = orders.filter((o) => !o.dropped_off_at);
    if (pending.length > 0) {
      await supabase.from("orders").update({ dropped_off_at: now }).in(
        "id",
        pending.map((o) => o.id)
      );
    }
    if (orders.length === 0) {
      await supabase.from("runs").update({ status: "dropped_off" }).eq("id", runId);
    }
    await endLiveActivityIfNeeded();
    trackEvent("run_finished", { groupId: run?.group_id });
    fetchData();
    toast.success("Run complete — everything's dropped off!");
  };

  const toCents = (v: string) => Math.round(parseFloat(v || "0") * 100);

  const confirmFinish = async () => {
    setFinishing(true);
    const updates = useLumpSum
      ? { lump_sum_total_cents: toCents(lumpSumInput), tax_cents: 0, tip_cents: 0, delivery_fee_cents: 0 }
      : {
          lump_sum_total_cents: null,
          tax_cents: toCents(taxInput),
          tip_cents: toCents(tipInput),
          delivery_fee_cents: toCents(feeInput),
        };
    await supabase
      .from("runs")
      .update({ ...updates, costs_finalized_at: new Date().toISOString() })
      .eq("id", runId);
    setShowFinishDialog(false);
    setFinishing(false);
    await finishRun();
  };

  const itemizedSubtotalCents = items.reduce((sum, i) => sum + (i.price_cents ?? 0) * i.quantity, 0);

  const cancelRun = async () => {
    if (!window.confirm("Cancel this run? Everyone in the group will be notified.")) return;
    await supabase.from("runs").update({ status: "cancelled" }).eq("id", runId);
    await endLiveActivityIfNeeded();
    trackEvent("run_cancelled", { groupId: run?.group_id });
    fetchData();
    toast.success("Run cancelled");
  };

  if (!run) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;

  const byPerson = items.reduce<Record<string, OrderItemWithUser[]>>((acc, item) => {
    const key = `${item.order_id}__${item.display_name}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const totalItems = items.length;
  const pickedItems = items.filter((i) => i.is_picked_up).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-base">{run.store_names}</h1>
              <p className="text-xs text-muted-foreground">{pickedItems}/{totalItems} items picked</p>
            </div>
          </div>
          <CountdownTimer closesAt={run.closes_at} />
        </div>
      </header>

      {/* Progress bar */}
      <div className="max-w-lg mx-auto px-4 pt-3">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: totalItems > 0 ? `${(pickedItems / totalItems) * 100}%` : "0%" }}
          />
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {items.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-display font-semibold">No orders yet</p>
            <p className="text-sm">Waiting for friends to add items...</p>
          </div>
        )}

        {Object.entries(byPerson).map(([key, personItems]) => {
          const [orderId, displayName] = key.split("__");
          const allPicked = personItems.every((i) => i.is_picked_up);
          const order = orders.find((o) => o.id === orderId);
          const droppedOff = !!order?.dropped_off_at;

          return (
            <Card key={key} className={droppedOff ? "opacity-40" : allPicked ? "opacity-50" : ""}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-display font-semibold text-sm">{displayName}</p>
                  <div className="flex items-center gap-1">
                    {!allPicked && (
                      <Button variant="ghost" size="sm" onClick={() => markPersonComplete(orderId)} className="text-xs h-7">
                        <CheckCheck className="w-3.5 h-3.5 mr-1" /> All done
                      </Button>
                    )}
                    {run.status === "shopping" && !droppedOff && (
                      <Button variant="ghost" size="sm" onClick={() => markPersonDroppedOff(orderId)} className="text-xs h-7">
                        <PackageCheck className="w-3.5 h-3.5 mr-1" /> Dropped off
                      </Button>
                    )}
                    {droppedOff && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <PackageCheck className="w-3.5 h-3.5" /> Delivered
                      </span>
                    )}
                  </div>
                </div>
                {personItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 py-1">
                    <Checkbox
                      checked={item.is_picked_up}
                      onCheckedChange={() => toggleItemPickup(item.id, item.is_picked_up)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.is_picked_up ? "line-through text-muted-foreground" : ""}`}>
                        {item.item_name}
                        <span className="text-muted-foreground ml-1">×{item.quantity}</span>
                      </p>
                      {item.comment && (
                        <p className="text-xs text-muted-foreground">{item.comment}</p>
                      )}
                    </div>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="$"
                      defaultValue={item.price_cents != null ? (item.price_cents / 100).toFixed(2) : ""}
                      onBlur={(e) => updateItemPrice(item.id, e.target.value)}
                      className="w-20 h-8 text-sm shrink-0"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </main>

      {/* Bottom actions */}
      {(run.status === "open" || run.status === "closed" || run.status === "shopping") && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur border-t p-4">
          <div className="max-w-lg mx-auto flex gap-3">
            {(run.status === "open" || run.status === "closed") && (
              <Button className="flex-1 h-12 font-display font-bold" onClick={startShopping}>
                <ShoppingCart className="w-5 h-5 mr-2" /> Lock the Shopping List
              </Button>
            )}
            {run.status === "shopping" && (
              <Button className="flex-1 h-12 font-display font-bold" onClick={() => setShowFinishDialog(true)}>
                <CheckCheck className="w-5 h-5 mr-2" /> Finish Run
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 text-destructive" onClick={cancelRun}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add costs (optional)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <Label className="cursor-pointer">Enter one receipt total instead</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Skips itemized tax/tip — split by item count</p>
              </div>
              <Switch checked={useLumpSum} onCheckedChange={setUseLumpSum} />
            </div>

            {useLumpSum ? (
              <div className="space-y-2">
                <Label htmlFor="lumpSum">Receipt total</Label>
                <Input
                  id="lumpSum"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={lumpSumInput}
                  onChange={(e) => setLumpSumInput(e.target.value)}
                />
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Itemized subtotal so far: <span className="font-medium text-foreground">{formatCents(itemizedSubtotalCents)}</span>
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="tax">Tax</Label>
                    <Input id="tax" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={taxInput} onChange={(e) => setTaxInput(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tip">Tip</Label>
                    <Input id="tip" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={tipInput} onChange={(e) => setTipInput(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fee">Delivery/other</Label>
                    <Input id="fee" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={feeInput} onChange={(e) => setFeeInput(e.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tax, tip, and fees are split proportionally to what each person ordered.
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowFinishDialog(false)} disabled={finishing}>
              Cancel
            </Button>
            <Button onClick={confirmFinish} disabled={finishing}>
              {finishing ? "Finishing..." : "Finish Run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActiveRunRunner;
