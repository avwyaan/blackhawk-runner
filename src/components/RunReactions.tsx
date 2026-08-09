import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";

const EMOJI_PALETTE = ["👍", "❤️", "😂", "🎉", "😮"];

interface RunReactionsProps {
  runId: string;
}

const RunReactions = ({ runId }: RunReactionsProps) => {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<{ user_id: string; emoji: string }[]>([]);

  const fetchReactions = useCallback(async () => {
    const { data } = await supabase.from("run_reactions").select("user_id, emoji").eq("run_id", runId);
    setReactions(data || []);
  }, [runId]);

  useEffect(() => {
    fetchReactions();
    const channel = supabase
      .channel(`reactions-${runId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "run_reactions", filter: `run_id=eq.${runId}` },
        () => fetchReactions()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchReactions, runId]);

  const toggleReaction = async (emoji: string) => {
    if (!user) return;
    const mine = reactions.some((r) => r.user_id === user.id && r.emoji === emoji);
    if (mine) {
      await supabase.from("run_reactions").delete().eq("run_id", runId).eq("user_id", user.id).eq("emoji", emoji);
    } else {
      const { error } = await supabase.from("run_reactions").insert({ run_id: runId, user_id: user.id, emoji });
      if (!error) trackEvent("run_reaction_added", { properties: { emoji } });
    }
    fetchReactions();
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {EMOJI_PALETTE.map((emoji) => {
        const count = reactions.filter((r) => r.emoji === emoji).length;
        const mine = reactions.some((r) => r.user_id === user?.id && r.emoji === emoji);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggleReaction(emoji)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-sm transition-colors ${
              mine ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="text-xs font-medium">{count}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default RunReactions;
