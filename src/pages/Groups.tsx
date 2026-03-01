import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Users, Copy, LogIn } from "lucide-react";
import { toast } from "sonner";

const Groups = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<any[]>([]);
  const [members, setMembers] = useState<Record<string, any[]>>({});
  const [newGroupName, setNewGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const fetchGroups = async () => {
    if (!user) return;
    const { data } = await supabase.from("groups").select("*");
    setGroups(data || []);

    // Fetch members for each group
    if (data) {
      const memberPromises = data.map(async (g) => {
        const { data: gm } = await supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", g.id);
        const userIds = (gm || []).map((m) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds.length > 0 ? userIds : ["none"]);
        return [g.id, profiles || []] as const;
      });
      const results = await Promise.all(memberPromises);
      setMembers(Object.fromEntries(results));
    }
  };

  useEffect(() => { fetchGroups(); }, [user]);

  const createGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    const { data, error } = await supabase
      .from("groups")
      .insert({ name: newGroupName.trim(), created_by: user.id })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }

    // Add creator as member
    await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id });
    setNewGroupName("");
    setShowCreate(false);
    toast.success("Group created!");
    fetchGroups();
  };

  const joinGroup = async () => {
    if (!user || !joinCode.trim()) return;
    const { data: group } = await supabase
      .from("groups")
      .select("id")
      .eq("invite_code", joinCode.trim().toLowerCase())
      .single();
    if (!group) { toast.error("Invalid invite code"); return; }

    const { error } = await supabase.from("group_members").insert({ group_id: group.id, user_id: user.id });
    if (error) {
      if (error.code === "23505") toast.info("You're already in this group!");
      else toast.error(error.message);
      return;
    }
    setJoinCode("");
    setShowJoin(false);
    toast.success("Joined group!");
    fetchGroups();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Invite code copied!");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-bold text-lg">My Groups</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="flex gap-2">
          <Button onClick={() => { setShowCreate(true); setShowJoin(false); }} variant="outline" className="flex-1">
            <Plus className="w-4 h-4 mr-2" /> Create Group
          </Button>
          <Button onClick={() => { setShowJoin(true); setShowCreate(false); }} variant="outline" className="flex-1">
            <LogIn className="w-4 h-4 mr-2" /> Join Group
          </Button>
        </div>

        {showCreate && (
          <Card className="border-primary/30">
            <CardContent className="py-4 space-y-3">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name"
              />
              <div className="flex gap-2">
                <Button onClick={createGroup} disabled={!newGroupName.trim()} className="flex-1">Create</Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showJoin && (
          <Card className="border-primary/30">
            <CardContent className="py-4 space-y-3">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter invite code"
              />
              <div className="flex gap-2">
                <Button onClick={joinGroup} disabled={!joinCode.trim()} className="flex-1">Join</Button>
                <Button variant="ghost" onClick={() => setShowJoin(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {groups.map((group) => (
          <Card key={group.id}>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold">{group.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(members[group.id] || []).length} member{(members[group.id] || []).length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => copyCode(group.invite_code)}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> {group.invite_code}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {(members[group.id] || []).map((m) => (
                  <Badge key={m.user_id} variant="secondary" className="text-xs">
                    {m.display_name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
};

export default Groups;
