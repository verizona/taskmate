"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Task = {
  id: string;
  title: string;
  is_completed: boolean;
  user_id: string;
  created_at?: string;
  due_date?: string | null;
  priority?: string | null;
  list_id: string;
};

type List = {
  id: string;
  name: string | null;
  owner_id: string;
  created_at?: string;
};

type Membership = {
  list_id: string;
  role: "owner" | "editor" | "viewer";
};

type MemberProfile = {
  id: string;
  email: string | null;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [lists, setLists] = useState<List[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [newListName, setNewListName] = useState("");

  const [savingTask, setSavingTask] = useState(false);
  const [savingList, setSavingList] = useState(false);

  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [members, setMembers] = useState<MemberProfile[]>([]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (selectedListId) {
      loadTasksForList(selectedListId);
      loadMembersForList(selectedListId);
    } else {
      setTasks([]);
      setMembers([]);
    }
  }, [selectedListId]);

  async function loadDashboard() {
    setLoading(true);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      window.location.href = "/";
      return;
    }

    const user = session.user;
    setEmail(user.email ?? null);
    setUserId(user.id);

    const { data: membershipData, error: membershipError } = await supabase
      .from("list_members")
      .select("list_id, role")
      .eq("user_id", user.id);

    if (membershipError) {
      alert(membershipError.message);
      setLoading(false);
      return;
    }

    const memberRows = (membershipData ?? []) as Membership[];
    setMemberships(memberRows);

    const listIds = memberRows.map((m) => m.list_id);

    if (listIds.length === 0) {
      setLists([]);
      setSelectedListId("");
      setTasks([]);
      setMembers([]);
      setLoading(false);
      return;
    }

    const { data: listData, error: listError } = await supabase
      .from("lists")
      .select("id, name, owner_id, created_at")
      .in("id", listIds)
      .order("created_at", { ascending: true });

    if (listError) {
      alert(listError.message);
      setLoading(false);
      return;
    }

    const loadedLists = (listData ?? []) as List[];
    setLists(loadedLists);

    const stillValidSelected = loadedLists.some((l) => l.id === selectedListId);
    const nextSelectedListId = stillValidSelected
      ? selectedListId
      : loadedLists[0]?.id ?? "";

    setSelectedListId(nextSelectedListId);

    if (nextSelectedListId) {
      await loadTasksForList(nextSelectedListId);
      await loadMembersForList(nextSelectedListId);
    } else {
      setTasks([]);
      setMembers([]);
    }

    setLoading(false);
  }

  async function loadTasksForList(listId: string) {
    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id, title, is_completed, user_id, created_at, due_date, priority, list_id"
      )
      .eq("list_id", listId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setTasks((data ?? []) as Task[]);
  }

  async function loadMembersForList(listId: string) {
    const { data: memberRows, error: memberError } = await supabase
      .from("list_members")
      .select("user_id")
      .eq("list_id", listId);

    if (memberError) {
      alert(memberError.message);
      return;
    }

    const userIds = (memberRows ?? []).map((m: any) => m.user_id);

    if (userIds.length === 0) {
      setMembers([]);
      return;
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    if (profileError) {
      alert(profileError.message);
      return;
    }

    setMembers((profileRows ?? []) as MemberProfile[]);
  }

  function currentRole(): "owner" | "editor" | "viewer" | null {
    const membership = memberships.find((m) => m.list_id === selectedListId);
    return membership?.role ?? null;
  }

  function canEditCurrentList() {
    const role = currentRole();
    return role === "owner" || role === "editor";
  }

  function isOwner() {
    return currentRole() === "owner";
  }

  async function createList() {
    const name = newListName.trim();
    if (!name || !userId) return;

    setSavingList(true);

    const { data: createdList, error: listError } = await supabase
      .from("lists")
      .insert([{ name, owner_id: userId }])
      .select()
      .single();

    if (listError) {
      alert(listError.message);
      setSavingList(false);
      return;
    }

    const newList = createdList as List;

    const { error: memberError } = await supabase.from("list_members").insert([
      {
        list_id: newList.id,
        user_id: userId,
        role: "owner",
      },
    ]);

    if (memberError) {
      alert(memberError.message);
      setSavingList(false);
      return;
    }

    setNewListName("");
    await loadDashboard();
    setSelectedListId(newList.id);
    setSavingList(false);
  }

  async function addTask() {
    const title = newTask.trim();
    if (!title || !userId || !selectedListId) return;
    if (!canEditCurrentList()) {
      alert("You do not have permission to add tasks to this list.");
      return;
    }

    setSavingTask(true);

    const { data, error } = await supabase
      .from("tasks")
      .insert([
        {
          title,
          user_id: userId,
          is_completed: false,
          list_id: selectedListId,
        },
      ])
      .select()
      .single();

    if (error) {
      alert(error.message);
    } else if (data) {
      setTasks((prev) => [data as Task, ...prev]);
      setNewTask("");
    }

    setSavingTask(false);
  }

  async function toggleTask(taskId: string, currentValue: boolean) {
    if (!canEditCurrentList()) {
      alert("You do not have permission to change tasks in this list.");
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({ is_completed: !currentValue })
      .eq("id", taskId);

    if (error) {
      alert(error.message);
      return;
    }

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, is_completed: !currentValue }
          : task
      )
    );
  }

  async function deleteTask(taskId: string) {
    if (!canEditCurrentList()) {
      alert("You do not have permission to delete tasks from this list.");
      return;
    }

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      alert(error.message);
      return;
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  }

  async function inviteMember() {
    const normalizedEmail = inviteEmail.trim().toLowerCase();

    if (!normalizedEmail || !selectedListId) return;

    if (!isOwner()) {
      alert("Only the list owner can invite members.");
      return;
    }

    setInviting(true);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (profileError) {
      alert(profileError.message);
      setInviting(false);
      return;
    }

    if (!profile) {
      alert("No user found with that email.");
      setInviting(false);
      return;
    }

    const { error: insertError } = await supabase.from("list_members").insert([
      {
        list_id: selectedListId,
        user_id: profile.id,
        role: inviteRole,
      },
    ]);

    if (insertError) {
      if (insertError.message.toLowerCase().includes("duplicate")) {
        alert("That user is already in this list.");
      } else {
        alert(insertError.message);
      }
      setInviting(false);
      return;
    }

    setInviteEmail("");
    setInviteRole("editor");
    await loadMembersForList(selectedListId);
    alert("User invited successfully.");
    setInviting(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-zinc-400 text-lg">Loading TaskMate...</div>
      </main>
    );
  }

  const selectedList = lists.find((l) => l.id === selectedListId);
  const role = currentRole();
  const canEdit = canEditCurrentList();

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-5xl font-semibold tracking-tight">TaskMate</h1>
            <p className="mt-3 text-zinc-400">
              Signed in as {email ?? "unknown user"}
            </p>
          </div>

          <button
            onClick={signOut}
            className="rounded-2xl bg-white px-6 py-4 font-medium text-black hover:bg-zinc-200"
          >
            Sign out
          </button>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-[28px] border border-white/10 bg-zinc-950/90 p-6 shadow-2xl shadow-black/40">
            <h2 className="text-2xl font-semibold">Lists</h2>

            <div className="mt-5 flex gap-3">
              <input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createList();
                }}
                placeholder="New list name..."
                className="flex-1 rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-500"
              />
              <button
                onClick={createList}
                disabled={savingList}
                className="rounded-2xl bg-white px-4 py-3 font-medium text-black hover:bg-zinc-200 disabled:opacity-60"
              >
                {savingList ? "..." : "Add"}
              </button>
            </div>

            <div className="mt-6 space-y-2">
              {lists.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 text-zinc-400">
                  No lists yet.
                </div>
              ) : (
                lists.map((list) => {
                  const listMembership = memberships.find(
                    (m) => m.list_id === list.id
                  );

                  return (
                    <button
                      key={list.id}
                      onClick={() => setSelectedListId(list.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        selectedListId === list.id
                          ? "border-white/30 bg-white/10 text-white"
                          : "border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5"
                      }`}
                    >
                      <div className="font-medium">
                        {list.name || "Untitled List"}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                        {listMembership?.role ?? "member"}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-zinc-950/90 p-6 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">
                  {selectedList?.name || "My Tasks"}
                </h2>
                {role && (
                  <p className="mt-1 text-sm text-zinc-500">
                    Your role: {role}
                  </p>
                )}
              </div>
            </div>

            {isOwner() && selectedListId && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-sm font-medium text-zinc-300">
                  Invite by email
                </div>

                <div className="mt-3 flex flex-col gap-3 md:flex-row">
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="flex-1 rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-500"
                  />

                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as "editor" | "viewer")
                    }
                    className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>

                  <button
                    onClick={inviteMember}
                    disabled={inviting}
                    className="rounded-2xl bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200 disabled:opacity-60"
                  >
                    {inviting ? "Inviting..." : "Invite"}
                  </button>
                </div>

                <div className="mt-4 text-sm text-zinc-500">
                  Members:
                  {members.length > 0 ? (
                    <span className="ml-2">
                      {members
                        .map((m) => m.email || m.id)
                        .sort()
                        .join(", ")}
                    </span>
                  ) : (
                    <span className="ml-2">No members yet.</span>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTask();
                }}
                placeholder={
                  selectedListId
                    ? "Add a new task..."
                    : "Select or create a list first..."
                }
                disabled={!selectedListId || !canEdit}
                className="flex-1 rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-500 disabled:opacity-50"
              />
              <button
                onClick={addTask}
                disabled={savingTask || !selectedListId || !canEdit}
                className="rounded-2xl bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200 disabled:opacity-60"
              >
                {savingTask ? "Adding..." : "Add"}
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {tasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-zinc-400">
                  No tasks in this list yet.
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-4"
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={task.is_completed}
                        onChange={() => toggleTask(task.id, task.is_completed)}
                        disabled={!canEdit}
                        className="h-5 w-5"
                      />
                      <div>
                        <div
                          className={
                            task.is_completed
                              ? "text-zinc-500 line-through"
                              : "text-white"
                          }
                        >
                          {task.title}
                        </div>

                        {(task.priority || task.due_date) && (
                          <div className="mt-1 text-sm text-zinc-500">
                            {task.priority ? `Priority: ${task.priority}` : ""}
                            {task.priority && task.due_date ? " • " : ""}
                            {task.due_date ? `Due: ${task.due_date}` : ""}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => deleteTask(task.id)}
                      disabled={!canEdit}
                      className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
