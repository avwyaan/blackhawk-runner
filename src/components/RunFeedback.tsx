import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ThumbsUp, ThumbsDown, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

interface RunFeedbackProps {
  runId: string;
  runnerId: string;
}

interface RatingRow {
  id: string;
  rater_id: string;
  thumbs_up: boolean | null;
  comment: string | null;
  rater_name?: string;
}

interface ProductFeedbackRow {
  id: string;
  user_id: string;
  comment: string;
  user_name?: string;
}

const RunFeedback = ({ runId, runnerId }: RunFeedbackProps) => {
  const { user } = useAuth();
  const isRunner = user?.id === runnerId;

  const [hadOrder, setHadOrder] = useState(false);
  const [myRatingExists, setMyRatingExists] = useState(false);
  const [myThumbs, setMyThumbs] = useState<boolean | null>(null);
  const [myComment, setMyComment] = useState("");
  const [savingRating, setSavingRating] = useState(false);

  const [productComment, setProductComment] = useState("");
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [myProductFeedback, setMyProductFeedback] = useState<ProductFeedbackRow[]>([]);

  const [receivedRatings, setReceivedRatings] = useState<RatingRow[]>([]);
  const [receivedProductFeedback, setReceivedProductFeedback] = useState<ProductFeedbackRow[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    if (!isRunner) {
      const [{ data: order }, { data: rating }] = await Promise.all([
        supabase.from("orders").select("id").eq("run_id", runId).eq("user_id", user.id).maybeSingle(),
        supabase.from("run_ratings").select("*").eq("run_id", runId).eq("rater_id", user.id).maybeSingle(),
      ]);
      setHadOrder(!!order);
      setMyRatingExists(!!rating);
      setMyThumbs(rating?.thumbs_up ?? null);
      setMyComment(rating?.comment ?? "");

      const { data: myPF } = await supabase
        .from("run_product_feedback")
        .select("id, user_id, comment")
        .eq("run_id", runId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setMyProductFeedback(myPF || []);
    } else {
      const [{ data: ratings }, { data: pf }] = await Promise.all([
        supabase.from("run_ratings").select("id, rater_id, thumbs_up, comment").eq("run_id", runId),
        supabase.from("run_product_feedback").select("id, user_id, comment").eq("run_id", runId),
      ]);
      const allIds = [...new Set([...(ratings || []).map((r) => r.rater_id), ...(pf || []).map((f) => f.user_id)])];
      const { data: profiles } = allIds.length
        ? await supabase.from("profiles").select("user_id, display_name").in("user_id", allIds)
        : { data: [] as { user_id: string; display_name: string }[] };
      const nameMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.display_name]));
      setReceivedRatings((ratings || []).map((r) => ({ ...r, rater_name: nameMap[r.rater_id] || "Someone" })));
      setReceivedProductFeedback((pf || []).map((f) => ({ ...f, user_name: nameMap[f.user_id] || "Someone" })));
    }
  }, [runId, user, isRunner]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveRating = async () => {
    if (!user || (myThumbs === null && !myComment.trim())) return;
    setSavingRating(true);
    const { error } = await supabase.from("run_ratings").upsert(
      { run_id: runId, rater_id: user.id, thumbs_up: myThumbs, comment: myComment.trim() || null },
      { onConflict: "run_id,rater_id" }
    );
    if (error) toast.error(error.message);
    else toast.success(myRatingExists ? "Rating updated" : "Thanks for the feedback!");
    setSavingRating(false);
    fetchData();
  };

  const submitProductFeedback = async () => {
    if (!user || !productComment.trim()) return;
    setSubmittingProduct(true);
    const { error } = await supabase
      .from("run_product_feedback")
      .insert({ run_id: runId, user_id: user.id, comment: productComment.trim() });
    if (error) toast.error(error.message);
    else {
      toast.success("Feedback sent");
      setProductComment("");
    }
    setSubmittingProduct(false);
    fetchData();
  };

  if (isRunner) {
    if (receivedRatings.length === 0 && receivedProductFeedback.length === 0) {
      return <p className="text-xs text-muted-foreground px-1">No feedback on this run yet.</p>;
    }
    return (
      <div className="space-y-3">
        {receivedRatings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ratings</p>
            {receivedRatings.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{r.rater_name}</span>
                    {r.thumbs_up === true && <ThumbsUp className="w-4 h-4 text-primary" />}
                    {r.thumbs_up === false && <ThumbsDown className="w-4 h-4 text-destructive" />}
                  </div>
                  {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {receivedProductFeedback.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Product Feedback
            </p>
            {receivedProductFeedback.map((f) => (
              <Card key={f.id}>
                <CardContent className="py-2.5 space-y-1">
                  <span className="text-sm font-medium">{f.user_name}</span>
                  <p className="text-xs text-muted-foreground">{f.comment}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hadOrder && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rate this run
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={myThumbs === true ? "default" : "outline"}
              onClick={() => setMyThumbs(myThumbs === true ? null : true)}
            >
              <ThumbsUp className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={myThumbs === false ? "default" : "outline"}
              onClick={() => setMyThumbs(myThumbs === false ? null : false)}
            >
              <ThumbsDown className="w-4 h-4" />
            </Button>
          </div>
          <Textarea
            value={myComment}
            onChange={(e) => setMyComment(e.target.value)}
            placeholder="Optional comment for the runner..."
            rows={2}
          />
          <Button size="sm" onClick={saveRating} disabled={savingRating}>
            {myRatingExists ? "Update rating" : "Submit rating"}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Something not work well?
        </p>
        <Textarea
          value={productComment}
          onChange={(e) => setProductComment(e.target.value)}
          placeholder="Optional — tell us what happened..."
          rows={2}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={submitProductFeedback}
          disabled={submittingProduct || !productComment.trim()}
        >
          <MessageSquarePlus className="w-4 h-4 mr-1.5" /> Send feedback
        </Button>
        {myProductFeedback.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {myProductFeedback.map((f) => (
              <p key={f.id} className="text-xs text-muted-foreground">
                • {f.comment}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RunFeedback;
