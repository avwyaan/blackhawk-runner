import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingBag, Snowflake, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

// Local datetime-local min value — a couple minutes out so "now" doesn't get
// rejected by the input's own min= the instant the page renders.
const minScheduleValue = () => {
  const d = new Date(Date.now() + 2 * 60000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const CreateRun = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [groupId, setGroupId] = useState("");
  const [storeNames, setStoreNames] = useState("");
  const [windowMinutes, setWindowMinutes] = useState("30");
  const [note, setNote] = useState("");
  const [maxOrdersPerPerson, setMaxOrdersPerPerson] = useState("");
  const [maxTotalOrders, setMaxTotalOrders] = useState("");
  const [frozenAllowed, setFrozenAllowed] = useState(true);
  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [recentStores, setRecentStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("groups").select("id, name").then(({ data }) => {
      setGroups(data || []);
      if (data && data.length === 1) setGroupId(data[0].id);
    });
  }, []);

  // Recent/favorite stores for this group, ranked by how often they show up
  // across past runs — no dedicated "favorites" table, just the run history
  // we already have.
  useEffect(() => {
    if (!groupId) { setRecentStores([]); return; }
    supabase
      .from("runs")
      .select("store_names")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const counts = new Map<string, number>();
        (data || []).forEach((r) => {
          r.store_names
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((s) => counts.set(s, (counts.get(s) || 0) + 1));
        });
        const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
        setRecentStores(ranked.slice(0, 6));
      });
  }, [groupId]);

  const addStoreChip = (name: string) => {
    const existing = storeNames.split(",").map((s) => s.trim()).filter(Boolean);
    if (existing.includes(name)) return;
    setStoreNames(existing.length ? `${storeNames}, ${name}` : name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupId || !storeNames.trim()) return;

    let scheduledDate: Date | null = null;
    if (scheduleForLater) {
      if (!scheduledAt) {
        toast.error("Pick a date and time for this run");
        return;
      }
      scheduledDate = new Date(scheduledAt);
      if (scheduledDate.getTime() <= Date.now()) {
        toast.error("Scheduled time must be in the future");
        return;
      }
    }

    setLoading(true);

    const baseTime = scheduledDate ?? new Date();
    const closesAt = new Date(baseTime.getTime() + parseInt(windowMinutes) * 60000).toISOString();

    const { error } = await supabase.from("runs").insert({
      group_id: groupId,
      runner_id: user.id,
      store_names: storeNames.trim(),
      note: note.trim() || null,
      closes_at: closesAt,
      scheduled_at: scheduledDate ? scheduledDate.toISOString() : null,
      max_orders_per_person: maxOrdersPerPerson ? parseInt(maxOrdersPerPerson) : null,
      max_total_orders: maxTotalOrders ? parseInt(maxTotalOrders) : null,
      frozen_allowed: frozenAllowed,
    });

    if (error) {
      toast.error(error.message);
    } else {
      trackEvent("run_created", { groupId, properties: { scheduled: !!scheduledDate } });
      toast.success(
        scheduledDate
          ? "Run scheduled! Your group will get a reminder as it approaches."
          : "Run created! Your group has been notified."
      );
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-bold text-lg">New Store Run</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              Where are you heading?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {groups.length > 1 && (
                <div className="space-y-2">
                  <Label>Group</Label>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="stores">Store(s)</Label>
                <Input
                  id="stores"
                  value={storeNames}
                  onChange={(e) => setStoreNames(e.target.value)}
                  placeholder="e.g. Costco, Trader Joe's"
                  required
                />
                {recentStores.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {recentStores.map((name) => (
                      <Badge
                        key={name}
                        variant="secondary"
                        className="cursor-pointer text-xs font-normal"
                        onClick={() => addStoreChip(name)}
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Schedule for later toggle */}
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div className="flex items-center gap-3">
                  <CalendarClock className={`w-4 h-4 ${scheduleForLater ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <Label className="cursor-pointer">Schedule for later</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {scheduleForLater ? "Group sees it as upcoming, with a reminder" : "Off — this run starts now"}
                    </p>
                  </div>
                </div>
                <Switch checked={scheduleForLater} onCheckedChange={setScheduleForLater} />
              </div>

              {scheduleForLater && (
                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">Start time</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={scheduledAt}
                    min={minScheduleValue()}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required={scheduleForLater}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Order Window</Label>
                <Select value={windowMinutes} onValueChange={setWindowMinutes}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="maxPerson">Max items/person</Label>
                  <Input
                    id="maxPerson"
                    type="number"
                    min="1"
                    value={maxOrdersPerPerson}
                    onChange={(e) => setMaxOrdersPerPerson(e.target.value)}
                    placeholder="No limit"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTotal">Max total items</Label>
                  <Input
                    id="maxTotal"
                    type="number"
                    min="1"
                    value={maxTotalOrders}
                    onChange={(e) => setMaxTotalOrders(e.target.value)}
                    placeholder="No limit"
                  />
                </div>
              </div>

              {/* Frozen items toggle */}
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div className="flex items-center gap-3">
                  <Snowflake className={`w-4 h-4 ${frozenAllowed ? "text-blue-400" : "text-muted-foreground"}`} />
                  <div>
                    <Label className="cursor-pointer">Frozen items</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {frozenAllowed ? "Allowed — I can carry frozen goods" : "Not allowed — no frozen goods"}
                    </p>
                  </div>
                </div>
                <Switch checked={frozenAllowed} onCheckedChange={setFrozenAllowed} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Trunk is small, no bulky items"
                  rows={2}
                />
              </div>

              <Button type="submit" className="w-full h-12 text-base font-display font-bold" disabled={loading}>
                {loading ? "Creating..." : "Start Run 🏃"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CreateRun;
