import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronDown, Sparkles, ThumbsUp } from "lucide-react";
import RunFeedback from "@/components/RunFeedback";
import RunReactions from "@/components/RunReactions";
import SettleUp from "@/components/SettleUp";

interface Run {
  id: string;
  store_names: string;
  status: string;
  created_at: string;
  updated_at: string;
  runner_id: string;
}

interface Stats {
  hostedCount: number;
  karmaTotal: number;
  avgTurnaroundMins: number | null;
  ratingUpPct: number | null;
}

const RunHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    (async () => {
      const { data } = await supabase
        .from("runs")
        .select("id, store_names, status, created_at, updated_at, runner_id")
        .in("status", ["dropped_off", "cancelled", "completed", "closed"])
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false });

      const runsData = data || [];
      setRuns(runsData);

      const hostedRuns = runsData.filter((r) => r.runner_id === user.id);
      const droppedOffHosted = hostedRuns.filter((r) => r.status === "dropped_off");

      const avgTurnaroundMins =
        droppedOffHosted.length > 0
          ? droppedOffHosted.reduce(
              (sum, r) => sum + (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / 60000,
              0
            ) / droppedOffHosted.length
          : null;

      const [{ data: karmaRow }, { data: ratings }] = await Promise.all([
        supabase.from("karma_totals").select("karma_total").eq("user_id", user.id).maybeSingle(),
        hostedRuns.length > 0
          ? supabase
              .from("run_ratings")
              .select("thumbs_up")
              .in(
                "run_id",
                hostedRuns.map((r) => r.id)
              )
          : Promise.resolve({ data: [] as { thumbs_up: boolean | null }[] }),
      ]);

      const rated = (ratings || []).filter((r) => r.thumbs_up !== null);
      const ratingUpPct =
        rated.length > 0
          ? Math.round((rated.filter((r) => r.thumbs_up === true).length / rated.length) * 100)
          : null;

      setStats({
        hostedCount: hostedRuns.length,
        karmaTotal: karmaRow?.karma_total ?? 0,
        avgTurnaroundMins,
        ratingUpPct,
      });
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-bold text-lg">Run History</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-3">
        {stats && (
          <Card className="bg-muted/40">
            <CardContent className="py-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-display font-bold">{stats.hostedCount}</p>
                <p className="text-xs text-muted-foreground">Runs hosted (60d)</p>
              </div>
              <div>
                <p className="text-2xl font-display font-bold flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-primary" /> {stats.karmaTotal}
                </p>
                <p className="text-xs text-muted-foreground">Total karma</p>
              </div>
              <div>
                <p className="text-2xl font-display font-bold">
                  {stats.avgTurnaroundMins !== null ? `${Math.round(stats.avgTurnaroundMins)}m` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Avg turnaround</p>
              </div>
              <div>
                <p className="text-2xl font-display font-bold flex items-center gap-1">
                  {stats.ratingUpPct !== null ? (
                    <>
                      <ThumbsUp className="w-4 h-4 text-primary" /> {stats.ratingUpPct}%
                    </>
                  ) : (
                    "—"
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Positive ratings</p>
              </div>
            </CardContent>
          </Card>
        )}

        {runs.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No completed runs yet</p>
        )}
        {runs.map((run) => {
          const isExpanded = expandedRun === run.id;
          return (
            <Card key={run.id}>
              <CardContent className="py-3 space-y-3">
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                >
                  <div>
                    <p className="font-display font-semibold text-sm">{run.store_names}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(run.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{run.status}</Badge>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>
                {isExpanded && (
                  <div className="pt-2 border-t space-y-3">
                    <RunReactions runId={run.id} />
                    <SettleUp runId={run.id} runnerId={run.runner_id} />
                    <RunFeedback runId={run.id} runnerId={run.runner_id} />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
};

export default RunHistory;
