import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import CountdownTimer from "@/components/CountdownTimer";

interface OrderItem {
  id?: string;
  item_name: string;
  quantity: number;
  comment: string;
  is_picked_up: boolean;
}

interface Run {
  id: string;
  store_names: string;
  status: string;
  closes_at: string;
  runner_id: string;
  note: string | null;
}

const ActiveRunFriend = () => {
  const { runId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [newItem, setNewItem] = useState({ item_name: "", quantity: 1, comment: "" });
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!runId || !user) return;

    const { data: runData } = await supabase
      .from("runs")
      .select("*")
      .eq("id", runId)
      .single();
    setRun(runData);

    const { data: orderData } = await supabase
      .from("orders")
      .select("id")
      .eq("run_id", runId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderData) {
      setOrderId(orderData.id);
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderData.id);
      setItems(itemsData || []);
    }
  }, [runId, user]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`run-${runId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "runs", filter: `id=eq.${runId}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData, runId]);

  const isOpen = run?.status === "open" && new Date(run.closes_at) > new Date();

  const addItem = async () => {
    if (!newItem.item_name.trim() || !user || !runId) return;
    setLoading(true);

    let currentOrderId = orderId;
    if (!currentOrderId) {
      const { data, error } = await supabase
        .from("orders")
        .insert({ run_id: runId, user_id: user.id })
        .select("id")
        .single();
      if (error) { toast.error(error.message); setLoading(false); return; }
      currentOrderId = data.id;
      setOrderId(data.id);
    }

    const { error } = await supabase.from("order_items").insert({
      order_id: currentOrderId,
      item_name: newItem.item_name.trim(),
      quantity: newItem.quantity,
      comment: newItem.comment.trim() || null,
    });

    if (error) toast.error(error.message);
    else {
      setNewItem({ item_name: "", quantity: 1, comment: "" });
      fetchData();
    }
    setLoading(false);
  };

  const removeItem = async (itemId: string) => {
    await supabase.from("order_items").delete().eq("id", itemId);
    fetchData();
  };

  if (!run) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header with timer */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-base">{run.store_names}</h1>
              <Badge variant="outline" className="text-xs mt-0.5">{run.status}</Badge>
            </div>
          </div>
          <CountdownTimer closesAt={run.closes_at} />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {run.note && (
          <Card className="bg-accent/10 border-accent/20">
            <CardContent className="py-3 text-sm">
              📝 {run.note}
            </CardContent>
          </Card>
        )}

        {/* My Items */}
        <section className="space-y-3">
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            My Items ({items.length})
          </h2>
          {items.map((item) => (
            <Card key={item.id} className={item.is_picked_up ? "opacity-50" : ""}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {item.item_name}
                    <span className="text-muted-foreground ml-2">×{item.quantity}</span>
                  </p>
                  {item.comment && <p className="text-xs text-muted-foreground mt-0.5">{item.comment}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {item.is_picked_up && <Badge className="bg-primary text-primary-foreground text-xs">✓ Picked</Badge>}
                  {isOpen && item.id && (
                    <Button variant="ghost" size="icon" onClick={() => removeItem(item.id!)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Add Item */}
        {isOpen && (
          <Card className="border-2 border-dashed border-primary/30">
            <CardContent className="py-4 space-y-3">
              <Input
                value={newItem.item_name}
                onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                placeholder="Item name"
                className="font-medium"
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                  className="w-20"
                  placeholder="Qty"
                />
                <Input
                  value={newItem.comment}
                  onChange={(e) => setNewItem({ ...newItem, comment: e.target.value })}
                  placeholder="Comment (optional)"
                  className="flex-1"
                />
              </div>
              <Button onClick={addItem} disabled={loading || !newItem.item_name.trim()} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Add Item
              </Button>
            </CardContent>
          </Card>
        )}

        {!isOpen && (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="font-display font-semibold">Order window closed</p>
            <p className="text-sm">The runner is shopping your items!</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ActiveRunFriend;
