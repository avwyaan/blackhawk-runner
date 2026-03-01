import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, CheckCheck, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import CountdownTimer from "@/components/CountdownTimer";

interface OrderItemWithUser {
  id: string;
  item_name: string;
  quantity: number;
  comment: string | null;
  is_picked_up: boolean;
  order_id: string;
  user_id: string;
  display_name: string;
  is_order_complete: boolean;
}

interface Run {
  id: string;
  store_names: string;
  status: string;
  closes_at: string;
  runner_id: string;
  note: string | null;
}

const ActiveRunRunner = () => {
  const { runId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [items, setItems] = useState<OrderItemWithUser[]>([]);

  const fetchData = useCallback(async () => {
    if (!runId) return;

    const { data: runData } = await supabase.from("runs").select("*").eq("id", runId).single();
    setRun(runData);

    // Get all orders for this run with user profiles
    const { data: orders } = await supabase
      .from("orders")
      .select("id, user_id, is_complete")
      .eq("run_id", runId);

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

  const toggleItemPickup = async (itemId: string, currentValue: boolean) => {
    await supabase.from("order_items").update({ is_picked_up: !currentValue }).eq("id", itemId);
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

  const updateRunStatus = async (status: "open" | "closed" | "shopping" | "completed") => {
    await supabase.from("runs").update({ status }).eq("id", runId);
    fetchData();
    toast.success(`Run marked as ${status}`);
  };

  if (!run) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;

  // Group items by person
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

          return (
            <Card key={key} className={allPicked ? "opacity-50" : ""}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-display font-semibold text-sm">{displayName}</p>
                  {!allPicked && (
                    <Button variant="ghost" size="sm" onClick={() => markPersonComplete(orderId)} className="text-xs h-7">
                      <CheckCheck className="w-3.5 h-3.5 mr-1" /> All done
                    </Button>
                  )}
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
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </main>

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur border-t p-4">
        <div className="max-w-lg mx-auto flex gap-3">
          {run.status === "open" && (
            <Button className="flex-1 h-12 font-display font-bold" onClick={() => updateRunStatus("shopping")}>
              <ShoppingCart className="w-5 h-5 mr-2" /> Start Shopping
            </Button>
          )}
          {run.status === "shopping" && (
            <Button className="flex-1 h-12 font-display font-bold" onClick={() => updateRunStatus("completed")}>
              <CheckCheck className="w-5 h-5 mr-2" /> Complete Run
            </Button>
          )}
          {run.status === "closed" && (
            <Button className="flex-1 h-12 font-display font-bold" onClick={() => updateRunStatus("shopping")}>
              <ShoppingCart className="w-5 h-5 mr-2" /> Start Shopping
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActiveRunRunner;
