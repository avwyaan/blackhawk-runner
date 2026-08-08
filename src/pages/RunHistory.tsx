import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

const RunHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("runs")
      .select("*")
      .in("status", ["completed", "closed"])
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRuns(data || []));
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
        {runs.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No completed runs yet</p>
        )}
        {runs.map((run) => (
          <Card key={run.id}>
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <p className="font-display font-semibold text-sm">{run.store_names}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(run.created_at).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline">{run.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
};

export default RunHistory;
