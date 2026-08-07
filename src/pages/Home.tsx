import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Plus, Clock, Users, LogOut, Settings, History } from "lucide-react";
import { motion } from "framer-motion";

interface Run {
  id: string;
  store_names: string;
  status: string;
  closes_at: string;
  runner_id: string;
  note: string | null;
  created_at: string;
}

interface Group {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  open: "bg-status-open text-primary-foreground",
  closed: "bg-status-closed text-primary-foreground",
  shopping: "bg-status-shopping text-accent-foreground",
  completed: "bg-status-completed text-primary-foreground",
};

const Home = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("display_name").eq("user_id", user!.id).single();
      if (error) throw error;
      return data as { display_name: string };
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("id, name");
      if (error) throw error;
      return (data ?? []) as Group[];
    },
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["runs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Bounded: the UI shows a handful of active runs and the 3 most recent.
      // Selecting the whole table grew unbounded with the group's history.
      const { data, error } = await supabase
        .from("runs").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as Run[];
    },
  });

  const groupIds = useMemo(() => groups.map((g) => g.id).sort().join(","), [groups]);

  useEffect(() => {
    if (!user || !groupIds) return;

    // Scoped to the user's own groups. Previously this listened to every change
    // on `runs` with no filter, so one write anywhere woke every connected
    // client — and each then refetched profile, groups and runs together.
    // Invalidating just the runs key refetches only what actually changed.
    const channel = supabase
      .channel(`runs-home-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "runs", filter: `group_id=in.(${groupIds})` },
        () => queryClient.invalidateQueries({ queryKey: ["runs", user.id] })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, groupIds, queryClient]);

  const activeRuns = runs.filter(
    (r) =>
      (r.status === "open" || r.status === "shopping") &&
      !(r.runner_id !== user?.id && localStorage.getItem(`runcart:skipped:${r.id}`) === "1")
  );
  const recentRuns = runs.filter((r) => r.status === "completed" || r.status === "closed").slice(0, 3);

  const getTimeLeft = (closesAt: string) => {
    const diff = new Date(closesAt).getTime() - Date.now();
    if (diff <= 0) return "Closed";
    const mins = Math.floor(diff / 60000);
    return `${mins}m left`;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg">RunCart</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/history")}>
              <History className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/groups")}>
              <Users className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold">
            Hey, {profile?.display_name || "there"} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {activeRuns.length > 0
              ? `${activeRuns.length} active run${activeRuns.length > 1 ? "s" : ""} right now`
              : "No active runs — start one!"}
          </p>
        </motion.div>

        {/* No groups prompt */}
        {groups.length === 0 && (
          <Card className="border-2 border-dashed border-primary/30">
            <CardContent className="py-6 text-center space-y-3">
              <Users className="w-10 h-10 text-primary mx-auto" />
              <p className="font-display font-semibold">Join or create a group first</p>
              <p className="text-sm text-muted-foreground">You need a group to start store runs</p>
              <Button onClick={() => navigate("/groups")} className="mt-2">
                <Plus className="w-4 h-4 mr-2" /> Set Up Group
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Active Runs */}
        {activeRuns.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Active Runs
            </h2>
            {activeRuns.map((run) => (
              <motion.div key={run.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                  onClick={() =>
                    navigate(run.runner_id === user?.id ? `/run/${run.id}/runner` : `/run/${run.id}/tracker`)
                  }
                >
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-display font-semibold">{run.store_names}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{getTimeLeft(run.closes_at)}</span>
                      </div>
                    </div>
                    <Badge className={statusColors[run.status] || ""}>
                      {run.status}
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </section>
        )}

        {/* Recent Runs */}
        {recentRuns.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Recent
            </h2>
            {recentRuns.map((run) => (
              <Card key={run.id} className="opacity-60">
                <CardContent className="py-3 flex items-center justify-between">
                  <p className="text-sm">{run.store_names}</p>
                  <Badge variant="outline" className="text-xs">{run.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </main>

      {/* FAB - "I'm heading out" */}
      {groups.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50">
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              size="lg"
              className="h-14 px-8 rounded-full shadow-xl text-base font-display font-bold"
              onClick={() => navigate("/create-run")}
            >
              <ShoppingBag className="w-5 h-5 mr-2" />
              I'm heading out!
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Home;
