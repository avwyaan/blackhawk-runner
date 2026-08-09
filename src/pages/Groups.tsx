import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, Users, Copy, Trash2, Mail, UserMinus, Share2, EyeOff } from "lucide-react";

// Update this with your TestFlight invite link after uploading the build
const TESTFLIGHT_LINK = "https://testflight.apple.com/v1/app/6764227177";
import { toast } from "sonner";

interface GroupInvite {
  id: string;
  email: string;
  invite_code: string;
  used_at: string | null;
  created_at: string;
}

interface GroupMember {
  user_id: string;
  display_name: string;
}

interface Group {
  id: string;
  name: string;
  created_by: string;
}

const Groups = () => {
  const { user } = useAuth();
  const { isAdmin, viewMode } = useUserRole();
  const canManageGroups = isAdmin && viewMode === "admin";
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Record<string, GroupMember[]>>({});
  const [invites, setInvites] = useState<Record<string, GroupInvite[]>>({});
  const [karma, setKarma] = useState<Record<string, number>>({});
  const [newGroupName, setNewGroupName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [showJoin, setShowJoin] = useState(false);

  const fetchGroups = async () => {
    if (!user) return;
    const { data } = await supabase.from("groups").select("id, name, created_by");
    setGroups(data || []);

    if (data) {
      const results = await Promise.all(
        data.map(async (g) => {
          const [{ data: gm }, { data: inv }] = await Promise.all([
            supabase
              .from("group_members")
              .select("user_id")
              .eq("group_id", g.id),
            supabase
              .from("group_invites")
              .select("id, email, invite_code, used_at, created_at")
              .eq("group_id", g.id)
              .order("created_at", { ascending: false }),
          ]);

          const userIds = (gm || []).map((m) => m.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", userIds.length > 0 ? userIds : ["none"]);

          return {
            groupId: g.id,
            members: (profiles || []) as GroupMember[],
            invites: (inv || []) as GroupInvite[],
          };
        })
      );

      setMembers(Object.fromEntries(results.map((r) => [r.groupId, r.members])));
      setInvites(Object.fromEntries(results.map((r) => [r.groupId, r.invites])));

      const allUserIds = [...new Set(results.flatMap((r) => r.members.map((m) => m.user_id)))];
      if (allUserIds.length > 0) {
        const { data: karmaRows } = await supabase
          .from("karma_totals")
          .select("user_id, karma_total")
          .in("user_id", allUserIds);
        setKarma(
          Object.fromEntries((karmaRows || []).map((k) => [k.user_id, k.karma_total ?? 0]))
        );
      }
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [user]);

  const createGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    const { error } = await supabase
      .from("groups")
      .insert({ name: newGroupName.trim(), created_by: user.id })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewGroupName("");
    setShowCreate(false);
    toast.success("Group created!");
    fetchGroups();
  };

  const createInvite = async (groupId: string) => {
    const email = inviteEmail[groupId]?.trim().toLowerCase();
    if (!user || !email) return;

    // Also add email to allowed_emails (ignore conflict if already exists)
    await supabase.from("allowed_emails").upsert({ email }, { onConflict: "email" });

    const { error } = await supabase.from("group_invites").insert({
      group_id: groupId,
      email,
      created_by: user.id,
    });

    if (error) {
      if (error.code === "23505") toast.error("Invite already exists for this email");
      else toast.error(error.message);
      return;
    }

    setInviteEmail((prev) => ({ ...prev, [groupId]: "" }));
    toast.success(`Invite created for ${email}`);
    fetchGroups();
  };

  const deleteInvite = async (inviteId: string) => {
    const { error } = await supabase.from("group_invites").delete().eq("id", inviteId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invite deleted");
    fetchGroups();
  };

  const removeMember = async (groupId: string, userId: string) => {
    if (userId === user?.id) {
      toast.error("You can't remove yourself");
      return;
    }
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Member removed");
    fetchGroups();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Invite code copied!");
  };

  const shareInvite = async (inv: GroupInvite, groupName: string) => {
    const message =
      `Hey! You've been invited to join *${groupName}* on RunCart 🛒\n\n` +
      `Here's how to get started:\n\n` +
      `1️⃣ Download the app via TestFlight:\n${TESTFLIGHT_LINK}\n\n` +
      `2️⃣ Open the app and tap *Sign Up*\n\n` +
      `3️⃣ Enter your details:\n` +
      `   • Email: ${inv.email}\n` +
      `   • Invite code: *${inv.invite_code}*\n\n` +
      `⚠️ This invite code is personal to you — please don't share it with anyone else.`;

    if (navigator.share) {
      await navigator.share({ text: message });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    }
  };

  const joinGroup = async () => {
    if (!user || !joinCode.trim()) return;
    const { error } = await supabase.rpc("redeem_invite", {
      p_code: joinCode.trim().toLowerCase(),
    });

    if (error) {
      if (error.message?.includes("already")) toast.info("You're already in this group!");
      else toast.error(error.message || "Invalid or already used invite code");
      return;
    }

    setJoinCode("");
    setShowJoin(false);
    toast.success("Joined group!");
    fetchGroups();
  };

  const optOutOfGroup = async (groupId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("admin_group_optouts")
      .insert({ admin_id: user.id, group_id: groupId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Stopped overseeing this group");
    fetchGroups();
  };

  const isCreator = (group: Group) => group.created_by === user?.id;
  const isMember = (group: Group) => (members[group.id] || []).some((m) => m.user_id === user?.id);

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
          {canManageGroups && (
            <Button
              onClick={() => {
                setShowCreate(true);
                setShowJoin(false);
              }}
              variant="outline"
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-2" /> Create Group
            </Button>
          )}
          <Button
            onClick={() => {
              setShowJoin(true);
              setShowCreate(false);
            }}
            variant="outline"
            className="flex-1"
          >
            <Mail className="w-4 h-4 mr-2" /> Join with Code
          </Button>
        </div>
        {isAdmin && !canManageGroups && (
          <p className="text-xs text-muted-foreground text-center -mt-2">
            Switch to Admin Mode in Profile to create groups or manage invites
          </p>
        )}

        {showCreate && (
          <Card className="border-primary/30">
            <CardContent className="py-4 space-y-3">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name"
              />
              <div className="flex gap-2">
                <Button onClick={createGroup} disabled={!newGroupName.trim()} className="flex-1">
                  Create
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
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
                placeholder="Enter your invite code"
              />
              <div className="flex gap-2">
                <Button onClick={joinGroup} disabled={!joinCode.trim()} className="flex-1">
                  Join
                </Button>
                <Button variant="ghost" onClick={() => setShowJoin(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {groups.map((group) => {
          const isExpanded = expandedGroup === group.id;
          const groupMembers = members[group.id] || [];
          const groupInvites = invites[group.id] || [];
          const creator = isCreator(group);
          const member = isMember(group);
          const overseeing = canManageGroups && !member;

          return (
            <Card key={group.id}>
              <CardContent className="py-4 space-y-3">
                {/* Group header */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                >
                  <div>
                    <p className="font-display font-semibold">{group.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {groupMembers.length} member{groupMembers.length !== 1 ? "s" : ""}
                      {creator && " · You're the admin"}
                      {overseeing && " · Admin oversight (not a member)"}
                    </p>
                  </div>
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>

                {overseeing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      optOutOfGroup(group.id);
                    }}
                  >
                    <EyeOff className="w-3.5 h-3.5 mr-1" /> Stop overseeing
                  </Button>
                )}

                {isExpanded && (
                  <div className="space-y-4 pt-2">
                    {/* Members section */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Members
                      </p>
                      {groupMembers.map((m) => (
                        <div key={m.user_id} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-xs">
                              {m.display_name}
                              {m.user_id === group.created_by && " (admin)"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              ✨ {karma[m.user_id] ?? 0}
                            </span>
                          </div>
                          {creator && canManageGroups && m.user_id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeMember(group.id, m.user_id)}
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {/* Invites section */}
                    {creator && canManageGroups && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Invites
                        </p>

                        {/* Create new invite */}
                        <div className="flex gap-2">
                          <Input
                            type="email"
                            value={inviteEmail[group.id] || ""}
                            onChange={(e) =>
                              setInviteEmail((prev) => ({
                                ...prev,
                                [group.id]: e.target.value,
                              }))
                            }
                            placeholder="friend@example.com"
                          />
                          <Button
                            size="sm"
                            onClick={() => createInvite(group.id)}
                            disabled={!inviteEmail[group.id]?.trim()}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Existing invites */}
                        {groupInvites.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">
                            No invites yet — add an email above
                          </p>
                        )}
                        {groupInvites.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{inv.email}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <button
                                  onClick={() => copyCode(inv.invite_code)}
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <Copy className="w-3 h-3" />
                                  {inv.invite_code}
                                </button>
                                {inv.used_at ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] text-green-600 border-green-300"
                                  >
                                    Joined
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px]">
                                    Pending
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {!inv.used_at && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-primary"
                                  onClick={() => shareInvite(inv, group.name)}
                                >
                                  <Share2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => deleteInvite(inv.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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

export default Groups;
