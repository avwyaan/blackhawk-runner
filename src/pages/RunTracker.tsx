import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ShoppingBag, Check, Clock, ShoppingCart, PackageCheck, X, Ban } from "lucide-react";
import { motion } from "framer-motion";
import CountdownTimer from "@/components/CountdownTimer";
import RunReactions from "@/components/RunReactions";
import SettleUp from "@/components/SettleUp";

interface Run {
  id: string;
  store_names: string;
  status: "open" | "closed" | "shopping" | "completed" | "dropped_off" | "cancelled";
  closes_at: string;
  runner_id: string;
  note: string | null;
}

const STAGES: { key: Run["status"]; label: string; icon: typeof Clock }[] = [
  { key: "open", label: "Accepting orders", icon: Clock },
  { key: "closed", label: "Orders closed", icon: PackageCheck },
  { key: "shopping", label: "Shopping in store", icon: ShoppingCart },
  { key: "dropped_off", label: "Dropped off", icon: Check },
];

const skipKey = (runId: string) => `runcart:skipped:${runId}`;

const RunTracker = () => {
  const { runId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [runnerName, setRunnerName] = useState<string>("");

  const fetchData = useCallback(async () => {
    if (!runId) return;
    const { data: runData } = await supabase
      .from("runs")
      .select("*")
      .eq("id", runId)
      .single();
    setRun(runData as Run | null);
    if (runData?.runner_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", runData.runner_id)
        .single();
      setRunnerName(profile?.display_name || "Runner");
    }
  }, [runId]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`tracker-${runId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "runs", filter: `id=eq.${runId}` },
        () => fetchData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, runId]);

  if (!run) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Loading…
      </div>
    );
  }

  const isRunner = run.runner_id === user?.id;
  const isCancelled = run.status === "cancelled";
  const currentIdx = STAGES.findIndex((s) => s.key === run.status);
  const isFinal = run.status === "dropped_off";

  const handleSkip = () => {
    if (runId) localStorage.setItem(skipKey(runId), "1");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-base">{run.store_names}</h1>
              <p className="text-xs text-muted-foreground">{runnerName} is running</p>
            </div>
          </div>
          {!isFinal && !isCancelled && <CountdownTimer closesAt={run.closes_at} />}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {run.note && (
          <Card className="bg-accent/10 border-accent/20">
            <CardContent className="py-3 text-sm">📝 {run.note}</CardContent>
          </Card>
        )}

        <RunReactions runId={run.id} />

        <SettleUp runId={run.id} runnerId={run.runner_id} />

        {isCancelled && (
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="py-6 text-center space-y-2">
              <Ban className="w-10 h-10 text-destructive mx-auto" />
              <p className="font-display font-semibold">Run cancelled</p>
              <p className="text-sm text-muted-foreground">
                {runnerName} cancelled this run.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stages tracker */}
        {!isCancelled && (
        <>
        <Card>
          <CardContent className="py-6">
            <div className="space-y-5">
              {STAGES.map((stage, idx) => {
                const Icon = stage.icon;
                const done = idx < currentIdx || isFinal;
                const active = idx === currentIdx && !isFinal;
                const upcoming = idx > currentIdx && !isFinal;

                return (
                  <div key={stage.key} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <motion.div
                        initial={false}
                        animate={{
                          scale: active ? [1, 1.1, 1] : 1,
                        }}
                        transition={
                          active
                            ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                            : { duration: 0.2 }
                        }
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          done
                            ? "bg-primary text-primary-foreground"
                            : active
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/40"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                      </motion.div>
                      {idx < STAGES.length - 1 && (
                        <div
                          className={`w-0.5 h-8 mt-1 ${
                            done ? "bg-primary" : "bg-muted"
                          }`}
                        />
                      )}
                    </div>
                    <div className="pt-2">
                      <p
                        className={`font-display font-semibold ${
                          upcoming ? "text-muted-foreground" : ""
                        }`}
                      >
                        {stage.label}
                      </p>
                      {active && (
                        <p className="text-xs text-primary mt-0.5 font-medium">In progress</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Actions: only show for non-runners while orders are open */}
        {!isRunner && run.status === "open" && (
          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full h-14 text-base font-display font-bold"
              onClick={() => navigate(`/run/${runId}`)}
            >
              <ShoppingBag className="w-5 h-5 mr-2" /> Submit Items
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full h-12 font-display"
              onClick={handleSkip}
            >
              <X className="w-4 h-4 mr-2" /> Skip this run
            </Button>
          </div>
        )}

        {/* If runner, route to runner view */}
        {isRunner && !isFinal && (
          <Button
            size="lg"
            className="w-full h-14 font-display font-bold"
            onClick={() => navigate(`/run/${runId}/runner`)}
          >
            Open Runner View
          </Button>
        )}

        {/* If past open and not runner, still allow viewing items */}
        {!isRunner && run.status !== "open" && !isFinal && (
          <Button
            size="lg"
            variant="outline"
            className="w-full h-12 font-display"
            onClick={() => navigate(`/run/${runId}`)}
          >
            View My Items
          </Button>
        )}

        {isFinal && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-6 text-center space-y-2">
              <Check className="w-10 h-10 text-primary mx-auto" />
              <p className="font-display font-semibold">All done!</p>
              <p className="text-sm text-muted-foreground">
                {runnerName} has completed this run.
              </p>
            </CardContent>
          </Card>
        )}
        </>
        )}
      </main>
    </div>
  );
};

export default RunTracker;
