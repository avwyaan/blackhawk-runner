import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Send, X, Snowflake, Plus } from "lucide-react";
import { toast } from "sonner";
import CountdownTimer from "@/components/CountdownTimer";

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  comment: string | null;
  is_picked_up: boolean;
}

interface Run {
  id: string;
  store_names: string;
  status: string;
  closes_at: string;
  runner_id: string;
  note: string | null;
  max_orders_per_person: number | null;
  max_total_orders: number | null;
  frozen_allowed: boolean;
}

const ActiveRunFriend = () => {
  const { runId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [submittedItems, setSubmittedItems] = useState<OrderItem[]>([]);

  // ── Draft flow state (before first submit) ────────────────────────────────
  // Each entry is just the item name; qty defaults to 1 on submit.
  // Always starts with one empty slot so the user sees a field immediately.
  const [draftNames, setDraftNames] = useState<string[]>([""]);
  const draftRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Edit flow state (after submit, run still open) ────────────────────────
  const [editName, setEditName] = useState("");
  const [addingDirect, setAddingDirect] = useState(false);
  const [frequentItems, setFrequentItems] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);

  // "You usually get X" — frequency-ranked from this user's own past orders,
  // across all their groups (habits are stable regardless of which group).
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: myOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      const orderIds = (myOrders || []).map((o) => o.id);
      if (orderIds.length === 0) return;
      const { data: items } = await supabase
        .from("order_items")
        .select("item_name")
        .in("order_id", orderIds);
      const counts = new Map<string, number>();
      (items || []).forEach((it) => {
        const key = it.item_name.trim();
        if (key) counts.set(key, (counts.get(key) || 0) + 1);
      });
      const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
      setFrequentItems(ranked.slice(0, 8));
    })();
  }, [user]);

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
      setSubmittedItems(itemsData || []);
    }
  }, [runId, user]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`run-friend-${runId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "runs", filter: `id=eq.${runId}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, runId]);

  // Auto-focus newly appended draft input
  useEffect(() => {
    const lastIdx = draftNames.length - 1;
    if (draftNames[lastIdx] === "") {
      draftRefs.current[lastIdx]?.focus();
    }
  }, [draftNames.length]);

  const isOpen = run?.status === "open" && new Date(run.closes_at) > new Date();
  const alreadySubmitted = orderId !== null;
  const perPersonLimit = run?.max_orders_per_person ?? null;
  const filledDraftCount = draftNames.filter((n) => n.trim()).length;

  // ── Draft handlers ────────────────────────────────────────────────────────

  const handleDraftChange = (index: number, value: string) => {
    setDraftNames((prev) => {
      const updated = [...prev];
      updated[index] = value;
      // Auto-append a new empty slot when typing in the last field, if within limit
      const isLast = index === prev.length - 1;
      const underLimit = perPersonLimit === null || prev.length < perPersonLimit;
      if (isLast && value.trim() && underLimit) {
        updated.push("");
      }
      return updated;
    });
  };

  const removeDraftName = (index: number) => {
    setDraftNames((prev) => {
      if (prev.length === 1) return [""]; // always keep at least one slot
      return prev.filter((_, i) => i !== index);
    });
  };

  const addDraftChip = (name: string) => {
    const emptyIdx = draftNames.findIndex((n) => !n.trim());
    if (emptyIdx === -1) return; // at limit, no empty slot to fill
    handleDraftChange(emptyIdx, name);
  };

  const submitOrder = async () => {
    const items = draftNames.map((n) => n.trim()).filter(Boolean);
    if (!items.length || !user || !runId) return;
    setSubmitting(true);

    // Check total run limit
    if (run?.max_total_orders) {
      const { data: allOrders } = await supabase.from("orders").select("id").eq("run_id", runId);
      const orderIds = (allOrders || []).map((o) => o.id);
      let currentTotal = 0;
      if (orderIds.length > 0) {
        const { count } = await supabase
          .from("order_items")
          .select("*", { count: "exact", head: true })
          .in("order_id", orderIds);
        currentTotal = count ?? 0;
      }
      if (currentTotal + items.length > run.max_total_orders) {
        const remaining = Math.max(0, run.max_total_orders - currentTotal);
        toast.error(
          remaining === 0
            ? "This run is full — total item limit reached."
            : `Only ${remaining} slot${remaining !== 1 ? "s" : ""} left. Remove some items and try again.`
        );
        setSubmitting(false);
        return;
      }
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({ run_id: runId, user_id: user.id })
      .select("id")
      .single();
    if (orderError) { toast.error(orderError.message); setSubmitting(false); return; }

    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((name) => ({ order_id: orderData.id, item_name: name, quantity: 1 }))
    );
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", orderData.id);
      toast.error(itemsError.message);
      setSubmitting(false);
      return;
    }

    setDraftNames([""]);
    await fetchData();
    toast.success("Order submitted!");
    setSubmitting(false);
  };

  // ── Edit mode handlers (post-submit, run still open) ──────────────────────

  const editAtLimit = perPersonLimit !== null && submittedItems.length >= perPersonLimit;

  const addItemDirect = async (nameOverride?: string) => {
    const name = (nameOverride ?? editName).trim();
    if (!name || !orderId) return;
    if (editAtLimit) {
      toast.error(`Max ${perPersonLimit} item${perPersonLimit !== 1 ? "s" : ""} per person`);
      return;
    }
    if (run?.max_total_orders) {
      const { data: allOrders } = await supabase.from("orders").select("id").eq("run_id", runId);
      const orderIds = (allOrders || []).map((o) => o.id);
      if (orderIds.length > 0) {
        const { count } = await supabase
          .from("order_items")
          .select("*", { count: "exact", head: true })
          .in("order_id", orderIds);
        if ((count ?? 0) >= run.max_total_orders) {
          toast.error("Run is full — total item limit reached.");
          return;
        }
      }
    }
    setAddingDirect(true);
    const { error } = await supabase.from("order_items").insert({
      order_id: orderId,
      item_name: name,
      quantity: 1,
    });
    if (error) toast.error(error.message);
    else if (!nameOverride) setEditName("");
    await fetchData();
    setAddingDirect(false);
  };

  const removeSubmittedItem = async (itemId: string) => {
    await supabase.from("order_items").delete().eq("id", itemId);
    fetchData();
  };

  if (!run) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;

  const atDraftLimit = perPersonLimit !== null && draftNames.filter((n) => n.trim()).length >= perPersonLimit;

  const alreadyHave = new Set([
    ...draftNames.map((n) => n.trim().toLowerCase()),
    ...submittedItems.map((i) => i.item_name.trim().toLowerCase()),
  ]);
  const suggestionChips = frequentItems.filter((n) => !alreadyHave.has(n.toLowerCase())).slice(0, 6);

  return (
    <div className="min-h-screen bg-background pb-6">
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
            <CardContent className="py-3 text-sm">📝 {run.note}</CardContent>
          </Card>
        )}

        {/* Run rules banner */}
        <Card className={`border ${!run.frozen_allowed ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40" : "border-border bg-muted/40"}`}>
          <CardContent className="py-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <div className={`flex items-center gap-1.5 font-medium ${!run.frozen_allowed ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}>
              <Snowflake className="w-4 h-4 flex-shrink-0" />
              {run.frozen_allowed ? "Frozen items OK" : "No frozen items"}
            </div>
            {perPersonLimit && (
              <div className={`flex items-center gap-1.5 ${(alreadySubmitted ? editAtLimit : atDraftLimit) ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                Max {perPersonLimit} item{perPersonLimit !== 1 ? "s" : ""}/person
                {isOpen && (
                  <span className="text-xs">
                    ({alreadySubmitted ? submittedItems.length : filledDraftCount} used)
                  </span>
                )}
              </div>
            )}
            {run.max_total_orders && (
              <div className="text-muted-foreground">
                Run total: max {run.max_total_orders} items
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── STATE: not yet submitted + run open → fluid draft flow ── */}
        {!alreadySubmitted && isOpen && (
          <>
            <section className="space-y-2">
              {draftNames.map((name, i) => {
                const isOnlyEmpty = draftNames.length === 1 && !name.trim();
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      ref={(el) => { draftRefs.current[i] = el; }}
                      value={name}
                      onChange={(e) => handleDraftChange(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          // Jump to next field if it exists, otherwise submit if we have items
                          const next = draftRefs.current[i + 1];
                          if (next) next.focus();
                          else if (filledDraftCount > 0) submitOrder();
                        }
                        if (e.key === "Backspace" && !name && draftNames.length > 1) {
                          e.preventDefault();
                          removeDraftName(i);
                          draftRefs.current[i - 1]?.focus();
                        }
                      }}
                      placeholder={i === 0 ? "Type an item and keep going..." : "Next item..."}
                      className="flex-1 font-medium"
                    />
                    {!isOnlyEmpty && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          removeDraftName(i);
                          draftRefs.current[Math.max(0, i - 1)]?.focus();
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })}

              {/* Limit reached — no more auto-append, show message */}
              {atDraftLimit && (
                <p className="text-xs text-muted-foreground px-1">
                  ✋ Limit reached ({perPersonLimit} item{perPersonLimit !== 1 ? "s" : ""} max).
                </p>
              )}

              {!atDraftLimit && suggestionChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {suggestionChips.map((name) => (
                    <Badge
                      key={name}
                      variant="secondary"
                      className="cursor-pointer text-xs font-normal"
                      onClick={() => addDraftChip(name)}
                    >
                      + {name}
                    </Badge>
                  ))}
                </div>
              )}
            </section>

            <Button
              onClick={submitOrder}
              disabled={submitting || filledDraftCount === 0}
              className="w-full h-12 font-display font-bold"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting
                ? "Submitting..."
                : filledDraftCount > 0
                  ? `Submit ${filledDraftCount} Item${filledDraftCount !== 1 ? "s" : ""}`
                  : "Submit Items"}
            </Button>
          </>
        )}

        {/* ── STATE: submitted + run still open → show items + single add field ── */}
        {alreadySubmitted && isOpen && (
          <>
            <section className="space-y-2">
              <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                My Items ({submittedItems.length})
              </h2>
              {submittedItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-md border bg-background text-sm font-medium">
                    {item.item_name}
                    {item.quantity > 1 && (
                      <span className="text-muted-foreground ml-2">×{item.quantity}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSubmittedItem(item.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {submittedItems.length === 0 && (
                <p className="text-sm text-muted-foreground px-1">No items yet.</p>
              )}
            </section>

            {!editAtLimit && (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItemDirect()}
                  placeholder="Add another item..."
                  className="flex-1 font-medium"
                />
                <Button
                  size="icon"
                  onClick={() => addItemDirect()}
                  disabled={addingDirect || !editName.trim()}
                  className="flex-shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
            {editAtLimit && (
              <p className="text-xs text-muted-foreground px-1">
                ✋ Limit reached ({perPersonLimit} item{perPersonLimit !== 1 ? "s" : ""} max).
              </p>
            )}

            {!editAtLimit && suggestionChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestionChips.map((name) => (
                  <Badge
                    key={name}
                    variant="secondary"
                    className="cursor-pointer text-xs font-normal"
                    onClick={() => addItemDirect(name)}
                  >
                    + {name}
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── STATE: submitted + run locked → read-only ── */}
        {alreadySubmitted && !isOpen && (
          <section className="space-y-3">
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              My Items
              <Badge className="bg-green-600 text-white text-[10px] font-normal">Locked</Badge>
            </h2>
            {submittedItems.map((item) => (
              <Card key={item.id} className={item.is_picked_up ? "opacity-50" : ""}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {item.item_name}
                      {item.quantity > 1 && <span className="text-muted-foreground ml-2">×{item.quantity}</span>}
                    </p>
                    {item.comment && <p className="text-xs text-muted-foreground mt-0.5">{item.comment}</p>}
                  </div>
                  {item.is_picked_up && (
                    <Badge className="bg-primary text-primary-foreground text-xs">✓ Picked</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </section>
        )}

        {/* ── STATE: not submitted + run closed ── */}
        {!alreadySubmitted && !isOpen && (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="font-display font-semibold">Order window closed</p>
            <p className="text-sm">The runner has locked the list.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ActiveRunFriend;
