import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronDown } from "lucide-react";
import RunFeedback from "@/components/RunFeedback";

interface Run {
  id: string;
  store_names: string;
  status: string;
  created_at: string;
  runner_id: string;
}

const RunHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const { data: runs = [] } = useQuery({
    queryKey: ["runs", "history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("runs")
        .select("id, store_names, status, created_at, runner_id")
        .in("status", ["completed", "closed"])
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Run[];
    },
  });

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
                  <div className="pt-2 border-t">
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
