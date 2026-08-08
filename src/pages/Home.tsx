import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Plus, Clock, Users, Settings, History, CalendarClock, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

interface Run {
  id: string;
  store_names: string;
  status: string;
  closes_at: string;
  runner_id: string;
  note: string | null;
  created_at: string;
  scheduled_at: string | null;
}

interface Group {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  open: "bg-status-open text-primary-foreground",
  closed: "bg-status-closed text-primary-foreground",
  shopping: "bg-status-shopping text-accent-foreground",
};

const VISIBLE_LIMIT = 3;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [profile, setProfile] = useState<{ display_name: string } | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [{ data: profileData }, { data: groupsData }, { data: runsData }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("user_id", user.id).single(),
        supabase.from("groups").select("id, name"),
        supabase.from("runs").select("*").in("status", ["open", "shopping"]),
      ]);
      setProfile(profileData);
      setGroups(groupsData || []);
      setRuns(runsData || []);
    };
    fetchData();

    // Realtime subscription for runs
    const channel = supabase
      .channel("runs-home")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const now = Date.now();
  const isUpcoming = (r: Run) => !!r.scheduled_at && new Date(r.scheduled_at).getTime() > now;

  // Home only ever shows runs currently in progress, or scheduled runs starting
  // within the next 3 days — everything else lives in Run History.
  const visibleRuns = runs
    .filter((r) => !r.scheduled_at || new Date(r.scheduled_at).getTime() - now <= THREE_DAYS_MS)
    .filter((r) => !(r.runner_id !== user?.id && localStorage.getItem(`runcart:skipped:${r.id}`) === "1"))
    .sort((a, b) => {
      const aUp = isUpcoming(a);
      const bUp = isUpcoming(b);
      if (aUp !== bUp) return aUp ? 1 : -1;
      if (aUp && bUp) return new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const inProgressCount = visibleRuns.filter((r) => !isUpcoming(r)).length;
  const upcomingCount = visibleRuns.length - inProgressCount;
  const displayedRuns = showAll ? visibleRuns : visibleRuns.slice(0, VISIBLE_LIMIT);

  const getTimeLeft = (closesAt: string) => {
    const diff = new Date(closesAt).getTime() - Date.now();
    if (diff <= 0) return "Closed";
    const mins = Math.floor(diff / 60000);
    return `${mins}m left`;
  };

  const getScheduledLabel = (scheduledAt: string) => {
    const d = new Date(scheduledAt);
    const isToday = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return isToday ? `Today, ${time}` : `${d.toLocaleDateString([], { weekday: "short" })}, ${time}`;
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
            {visibleRuns.length === 0
              ? "No active runs — start one!"
              : [
                  inProgressCount > 0 ? `${inProgressCount} in progress` : null,
                  upcomingCount > 0 ? `${upcomingCount} upcoming` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </motion.div>

        {/* No groups prompt */}
        {groups.length === 0 && (
          <Card className="border-2 border-dashed border-primary/30">
            <CardContent className="py-6 text-center space-y-3">
              <Users className="w-10 h-10 text-primary mx-auto" />
              <p className="font-display font-semibold">Join a group first</p>
              <p className="text-sm text-muted-foreground">Ask your group admin for an invite code</p>
              <Button onClick={() => navigate("/groups")} className="mt-2">
                <Plus className="w-4 h-4 mr-2" /> Join with Code
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Runs */}
        {displayedRuns.length > 0 && (
          <section className="space-y-3">
            {displayedRuns.map((run) => {
              const upcoming = isUpcoming(run);
              return (
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
                          {upcoming ? (
                            <>
                              <CalendarClock className="w-3.5 h-3.5" />
                              <span>{getScheduledLabel(run.scheduled_at!)}</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              <span>{getTimeLeft(run.closes_at)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge className={upcoming ? "" : statusColors[run.status] || ""} variant={upcoming ? "outline" : "default"}>
                        {upcoming ? "Scheduled" : run.status}
                      </Badge>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}

            {!showAll && visibleRuns.length > VISIBLE_LIMIT && (
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setShowAll(true)}>
                See {visibleRuns.length - VISIBLE_LIMIT} more <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            )}
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
