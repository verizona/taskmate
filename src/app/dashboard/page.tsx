"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Priority = "low" | "medium" | "high";
type MemberRole = "owner" | "editor" | "viewer";
type FilterType = "all" | "today" | "scheduled" | "completed";

type Task = {
  id: string;
  created_at: string;
  user_id: string;
  list_id: string;
  title: string;
  is_completed: boolean;
  due_date: string | null;
  priority: Priority | null;
};

type TaskList = {
  id: string;
  created_at: string;
  owner_user_id: string;
  name: string;
  is_personal: boolean;
};

type ListMember = {
  id: string;
  created_at: string;
  list_id: string;
  user_id: string;
  role: MemberRole;
};

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
};

type MemberWithProfile = {
  membershipId: string;
  userId: string;
  role: MemberRole;
  email: string;
  full_name: string | null;
};

function formatDueDate(date: string | null) {
  if (!date) return "No date";
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function priorityStyle(priority: Priority | null) {
  switch (priority) {
    case "high":
      return "bg-red-500/15 text-red-300 border border-red-400/20";
    case "low":
      return "bg-sky-500/15 text-sky-300 border border-sky-400/20";
    default:
      return "bg-zinc-700/60 text-zinc-200 border border-white/5";
  }
}

function isTodayDate(date: string | null) {
  if (!date) return false;
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return date === `${yyyy}-${mm}-${dd}`;
}

function hasScheduledDate(date: string | null) {
  return !!date;
}

export default function DashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [lists, setLists] = useState<TaskList[]>([]);
  const [memberships, setMemberships] = useState<ListMember[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);

  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);

  const [newListName, setNewListName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>("medium");

  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<MemberRole>("editor");

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("medium");

  const [filter, setFilter] = useState<FilterType>("all");

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId) ?? null,
    [lists, selectedListId]
  );

  const myMembership = useMemo(
    () => memberships.find((m) => m.list_id === selectedListId) ?? null,
    [memberships, selectedListId]
  );

  const canEdit =
    myMembership?.role === "owner" || myMembership?.role === "editor";
  const isOwner = myMembership?.role === "owner";

  const completedCount = tasks.filter((t) => t.is_completed).length;
  const openCount = tasks.filter((t) => !t.is_completed).length;
  const todayCount = tasks.filter(
    (t) => !t.is_completed && isTodayDate(t.due_date)
  ).length;
  const scheduledCount = tasks.filter(
    (t) => !t.is_completed && hasScheduledDate(t.due_date)
  ).length;
  const allCount = tasks.length;

  const filteredTasks = useMemo(() => {
    switch (filter) {
      case "today":
        return tasks.filter((t) => !t.is_completed && isTodayDate(t.due_date));
      case "scheduled":
        return tasks.filter(
          (t) => !t.is_completed && hasScheduledDate(t.due_date)
        );
      case "completed":
        return tasks.filter((t) => t.is_completed);
      default:
        return tasks;
    }
  }, [tasks, filter]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedListId) return;
    loadTasks(selectedListId);
    loadMembers(selectedListId);
  }, [selectedListId]);

  async function loadInitialData() {
    setLoading(true);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      window.location.href = "/";
      return;
    }

    const normalizedUserEmail = (user.email ?? "").trim().toLowerCase();

    setUserId(user.id);
    setUserEmail(normalizedUserEmail);

    await ensureProfile(user.id, normalizedUserEmail);
    await loadListsAndMemberships(user.id);

    setLoading(false);
  }

  async function ensureProfile(id: string, email: string) {
    await supabase.from("profiles").upsert(
      {
        id,
        email: email.trim().toLowerCase(),
      },
      { onConflict: "id" }
    );
  }

  async function loadListsAndMemberships(currentUserId: string) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from("list_members")
      .select("*")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: true });

    if (membershipError) {
      alert(membershipError.message);
      return;
    }

    const membershipsData = (membershipRows ?? []) as ListMember[];
    setMemberships(membershipsData);

    const listIds = membershipsData.map((m) => m.list_id);

    if (listIds.length === 0) {
      setLists([]);
      setSelectedListId("");
      setTasks([]);
      setMembers([]);
      return;
    }

    const { data: listRows, error: listError } = await supabase
      .from("task_lists")
      .select("*")
      .in("id", listIds)
      .order("created_at", { ascending: true });

    if (listError) {
      alert(listError.message);
      return;
    }

    const fetchedLists = (listRows ?? []) as TaskList[];
    setLists(fetchedLists);

    setSelectedListId((current) => {
      if (current && fetchedLists.some((list) => list.id === current)) {
        return current;
      }
      const personal = fetchedLists.find((list) => list.is_personal);
      return personal?.id ?? fetchedLists[0]?.id ?? "";
    });
  }

  async function loadTasks(listId: string) {
    setTasksLoading(true);

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("list_id", listId)
      .order("is_completed", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setTasksLoading(false);
      return;
    }

    setTasks((data ?? []) as Task[]);
    setTasksLoading(false);
  }

  async function loadMembers(listId: string) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from("list_members")
      .select("*")
      .eq("list_id", listId)
      .order("created_at", { ascending: true });

    if (membershipError) {
      alert(membershipError.message);
      return;
    }

    const membershipData = (membershipRows ?? []) as ListMember[];
    const userIds = membershipData.map((m) => m.user_id);

    if (userIds.length === 0) {
      setMembers([]);
      return;
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url")
      .in("id", userIds);

    if (profileError) {
      alert(profileError.message);
      return;
    }

    const profiles = (profileRows ?? []) as Profile[];

    const combined: MemberWithProfile[] = membershipData.map((member) => {
      const profile = profiles.find((p) => p.id === member.user_id);
      return {
        membershipId: member.id,
        userId: member.user_id,
        role: member.role,
        email: profile?.email ?? "",
        full_name: profile?.full_name ?? null,
      };
    });

    setMembers(combined);
  }

  async function createList() {
    if (!userId) return;

    const name = newListName.trim();
    if (!name) {
      alert("Please enter a list name.");
      return;
    }

    const { data, error } = await supabase
      .from("task_lists")
      .insert({
        owner_user_id: userId,
        name,
        is_personal: false,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setNewListName("");
    await loadListsAndMemberships(userId);
    setSelectedListId(data.id);
  }

  async function addTask() {
    if (!userId || !selectedListId) return;

    if (!canEdit) {
      alert("You only have viewer access for this list.");
      return;
    }

    const title = newTaskTitle.trim();
    if (!title) {
      alert("Please enter a task title.");
      return;
    }

    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      list_id: selectedListId,
      title,
      is_completed: false,
      due_date: newTaskDueDate || null,
      priority: newTaskPriority,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewTaskTitle("");
    setNewTaskDueDate("");
    setNewTaskPriority("medium");
    await loadTasks(selectedListId);
  }

  async function toggleTask(task: Task) {
    if (!selectedListId || !canEdit) return;

    const { error } = await supabase
      .from("tasks")
      .update({ is_completed: !task.is_completed })
      .eq("id", task.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadTasks(selectedListId);
  }

  function startEdit(task: Task) {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDueDate(task.due_date ?? "");
    setEditPriority(task.priority ?? "medium");
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setEditTitle("");
    setEditDueDate("");
    setEditPriority("medium");
  }

  async function saveEdit(taskId: string) {
    if (!selectedListId || !canEdit) return;

    const title = editTitle.trim();
    if (!title) {
      alert("Title cannot be empty.");
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({
        title,
        due_date: editDueDate || null,
        priority: editPriority,
      })
      .eq("id", taskId);

    if (error) {
      alert(error.message);
      return;
    }

    cancelEdit();
    await loadTasks(selectedListId);
  }

  async function deleteTask(taskId: string) {
    if (!selectedListId || !canEdit) return;

    const confirmed = window.confirm("Delete this task?");
    if (!confirmed) return;

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadTasks(selectedListId);
  }

  async function shareList() {
    if (!selectedListId || !isOwner) return;

    const normalizedEmail = shareEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      alert("Please enter an email.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", normalizedEmail)
      .single();

    if (profileError) {
      alert("User not found. That user must sign in first.");
      return;
    }

    if (profile.id === userId) {
      alert("You are already the owner of this list.");
      return;
    }

    const { error } = await supabase.from("list_members").insert({
      list_id: selectedListId,
      user_id: profile.id,
      role: shareRole,
    });

    if (error) {
      if (error.code === "23505") {
        alert("That user is already in this list.");
        return;
      }
      alert(error.message);
      return;
    }

    setShareEmail("");
    setShareRole("editor");
    await loadMembers(selectedListId);
  }

  async function removeMember(member: MemberWithProfile) {
    if (!selectedListId || !isOwner) return;
    if (member.role === "owner") return;

    const confirmed = window.confirm(`Remove ${member.email} from this list?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("list_members")
      .delete()
      .eq("id", member.membershipId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadMembers(selectedListId);
  }

  async function renameList() {
    if (!selectedList || !isOwner) return;

    const newName = window.prompt("Enter new list name", selectedList.name);
    if (!newName) return;

    const trimmed = newName.trim();
    if (!trimmed) return;

    const { error } = await supabase
      .from("task_lists")
      .update({ name: trimmed })
      .eq("id", selectedList.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (userId) {
      await loadListsAndMemberships(userId);
    }
  }

  async function deleteList() {
    if (!selectedList || !isOwner) return;

    if (selectedList.is_personal) {
      alert("You cannot delete your personal list.");
      return;
    }

    const confirmed = window.confirm(
      `Delete list "${selectedList.name}" and all tasks inside it?`
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("task_lists")
      .delete()
      .eq("id", selectedList.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (userId) {
      await loadListsAndMemberships(userId);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-zinc-400 text-lg">Loading TaskMate...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="rounded-[28px] border border-white/10 bg-zinc-950/90 p-5 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="mb-6">
              <h1 className="text-4xl font-semibold tracking-tight">TaskMate</h1>
              <p className="mt-2 text-sm text-zinc-400">{userEmail}</p>
            </div>

            <div className="mb-6">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Create List
              </h2>
              <div className="flex gap-2">
                <input
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="New list name"
                  className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
                />
                <button
                  onClick={createList}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Your Lists
              </h2>

              <div className="space-y-3">
                {lists.map((list) => {
                  const membership = memberships.find((m) => m.list_id === list.id);
                  const active = selectedListId === list.id;

                  return (
                    <button
                      key={list.id}
                      onClick={() => {
                        setSelectedListId(list.id);
                        setFilter("all");
                      }}
                      className={`w-full rounded-[24px] border p-4 text-left transition ${
                        active
                          ? "border-white/10 bg-zinc-800 shadow-lg"
                          : "border-white/5 bg-zinc-900/80 hover:bg-zinc-900"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-xl font-semibold">{list.name}</span>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-200">
                          {membership?.role}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-zinc-400">
                        {list.is_personal ? "Personal" : "Shared"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={signOut}
              className="mt-6 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-zinc-200 transition hover:bg-zinc-800"
            >
              Sign out
            </button>
          </aside>

          <main className="space-y-6">
            {!selectedList ? (
              <div className="rounded-[28px] border border-white/10 bg-zinc-950/90 p-8 text-zinc-300">
                No list selected.
              </div>
            ) : (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <button
                    onClick={() => setFilter("today")}
                    className={`rounded-[26px] p-5 text-left transition ${
                      filter === "today"
                        ? "bg-sky-500 text-white"
                        : "bg-sky-500/80 text-white hover:bg-sky-500"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="rounded-lg border border-white/40 px-2 py-1 text-xs">
                        Today
                      </div>
                      <div className="text-4xl font-semibold">{todayCount}</div>
                    </div>
                    <div className="mt-5 text-2xl font-semibold">Today</div>
                  </button>

                  <button
                    onClick={() => setFilter("scheduled")}
                    className={`rounded-[26px] p-5 text-left transition ${
                      filter === "scheduled"
                        ? "bg-rose-400 text-white"
                        : "bg-rose-400/85 text-white hover:bg-rose-400"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="rounded-lg border border-white/40 px-2 py-1 text-xs">
                        Date
                      </div>
                      <div className="text-4xl font-semibold">{scheduledCount}</div>
                    </div>
                    <div className="mt-5 text-2xl font-semibold">Scheduled</div>
                  </button>

                  <button
                    onClick={() => setFilter("all")}
                    className={`rounded-[26px] p-5 text-left transition ${
                      filter === "all"
                        ? "bg-zinc-700 text-white"
                        : "bg-zinc-700/90 text-white hover:bg-zinc-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="rounded-lg border border-white/30 px-2 py-1 text-xs">
                        All
                      </div>
                      <div className="text-4xl font-semibold">{allCount}</div>
                    </div>
                    <div className="mt-5 text-2xl font-semibold">All</div>
                  </button>

                  <button
                    onClick={() => setFilter("completed")}
                    className={`rounded-[26px] p-5 text-left transition ${
                      filter === "completed"
                        ? "bg-zinc-400 text-black"
                        : "bg-zinc-400/90 text-black hover:bg-zinc-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="rounded-lg border border-black/20 px-2 py-1 text-xs">
                        Done
                      </div>
                      <div className="text-4xl font-semibold">{completedCount}</div>
                    </div>
                    <div className="mt-5 text-2xl font-semibold">Completed</div>
                  </button>
                </section>

                <section className="rounded-[28px] border border-white/10 bg-zinc-950/90 p-6 shadow-2xl shadow-black/20">
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm text-zinc-500">
                        {selectedList.is_personal ? "Personal List" : "Shared List"}
                      </div>
                      <h2 className="mt-1 text-5xl font-semibold tracking-tight">
                        {selectedList.name}
                      </h2>
                      <p className="mt-2 text-lg text-zinc-400">
                        Role: <span className="font-medium text-zinc-200">{myMembership?.role}</span>
                      </p>
                    </div>

                    {isOwner && (
                      <div className="flex gap-3">
                        <button
                          onClick={renameList}
                          className="rounded-2xl border border-white/10 bg-zinc-900 px-5 py-3 text-zinc-100 transition hover:bg-zinc-800"
                        >
                          Rename
                        </button>
                        {!selectedList.is_personal && (
                          <button
                            onClick={deleteList}
                            className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-3 text-red-300 transition hover:bg-red-500/15"
                          >
                            Delete List
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {isOwner && (
                  <section className="rounded-[28px] border border-white/10 bg-zinc-950/90 p-6 shadow-2xl shadow-black/20">
                    <h3 className="mb-4 text-2xl font-semibold">Share List</h3>

                    <div className="flex flex-col gap-3 lg:flex-row">
                      <input
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        placeholder="User email"
                        className="flex-1 rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
                      />

                      <select
                        value={shareRole}
                        onChange={(e) => setShareRole(e.target.value as MemberRole)}
                        className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none"
                      >
                        <option value="editor">editor</option>
                        <option value="viewer">viewer</option>
                      </select>

                      <button
                        onClick={shareList}
                        className="rounded-2xl bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200"
                      >
                        Share
                      </button>
                    </div>

                    <div className="mt-5 space-y-3">
                      {members.map((member) => (
                        <div
                          key={member.membershipId}
                          className="flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-zinc-900 p-4"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-lg font-medium text-white">
                              {member.full_name || member.email}
                            </div>
                            <div className="truncate text-sm text-zinc-400">
                              {member.email}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-zinc-200">
                              {member.role}
                            </span>
                            {member.role !== "owner" && (
                              <button
                                onClick={() => removeMember(member)}
                                className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/15"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="rounded-[28px] border border-white/10 bg-zinc-950/90 p-6 shadow-2xl shadow-black/20">
                  <h3 className="mb-4 text-2xl font-semibold">Add Task</h3>

                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
                    <input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Task title"
                      className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
                      disabled={!canEdit}
                    />

                    <input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none"
                      disabled={!canEdit}
                    />

                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                      className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none"
                      disabled={!canEdit}
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>

                    <button
                      onClick={addTask}
                      disabled={!canEdit}
                      className={`rounded-2xl px-5 py-3 font-medium transition ${
                        canEdit
                          ? "bg-white text-black hover:bg-zinc-200"
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      Add
                    </button>
                  </div>

                  {!canEdit && (
                    <p className="mt-3 text-sm text-zinc-500">
                      You have viewer access for this list.
                    </p>
                  )}
                </section>

                <section className="rounded-[28px] border border-white/10 bg-zinc-950/90 p-6 shadow-2xl shadow-black/20">
                  <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h3 className="text-2xl font-semibold">
                      {filter === "today" && "Today"}
                      {filter === "scheduled" && "Scheduled"}
                      {filter === "all" && "Tasks"}
                      {filter === "completed" && "Completed"}
                    </h3>

                    <div className="flex flex-wrap gap-2">
                      {(["all", "today", "scheduled", "completed"] as FilterType[]).map((item) => (
                        <button
                          key={item}
                          onClick={() => setFilter(item)}
                          className={`rounded-full px-4 py-2 text-sm transition ${
                            filter === item
                              ? "bg-white text-black"
                              : "bg-zinc-900 text-zinc-300 border border-white/10"
                          }`}
                        >
                          {item === "all" && "All"}
                          {item === "today" && "Today"}
                          {item === "scheduled" && "Scheduled"}
                          {item === "completed" && "Completed"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {tasksLoading ? (
                    <p className="text-zinc-500">Loading tasks...</p>
                  ) : filteredTasks.length === 0 ? (
                    <p className="text-zinc-500">No tasks in this section.</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredTasks.map((task) => {
                        const isEditing = editingTaskId === task.id;

                        return (
                          <div
                            key={task.id}
                            className="rounded-[24px] border border-white/10 bg-zinc-900/90 p-4"
                          >
                            {isEditing ? (
                              <div className="space-y-3">
                                <input
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none"
                                />

                                <div className="grid gap-3 md:grid-cols-2">
                                  <input
                                    type="date"
                                    value={editDueDate}
                                    onChange={(e) => setEditDueDate(e.target.value)}
                                    className="rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none"
                                  />
                                  <select
                                    value={editPriority}
                                    onChange={(e) =>
                                      setEditPriority(e.target.value as Priority)
                                    }
                                    className="rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none"
                                  >
                                    <option value="low">low</option>
                                    <option value="medium">medium</option>
                                    <option value="high">high</option>
                                  </select>
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    onClick={() => saveEdit(task.id)}
                                    className="rounded-2xl bg-white px-4 py-2 text-black transition hover:bg-zinc-200"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="rounded-2xl border border-white/10 bg-zinc-950 px-4 py-2 text-zinc-200 transition hover:bg-zinc-800"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div className="flex min-w-0 items-start gap-4">
                                  <button
                                    onClick={() => toggleTask(task)}
                                    disabled={!canEdit}
                                    className={`mt-1 h-7 w-7 rounded-full border-2 transition ${
                                      task.is_completed
                                        ? "border-sky-400 bg-sky-400"
                                        : "border-zinc-500 bg-transparent"
                                    } ${!canEdit ? "opacity-60" : ""}`}
                                  >
                                    {task.is_completed ? (
                                      <span className="block text-center text-sm text-black">
                                        ✓
                                      </span>
                                    ) : null}
                                  </button>

                                  <div className="min-w-0">
                                    <div
                                      className={`text-2xl leading-tight ${
                                        task.is_completed
                                          ? "text-zinc-500 line-through"
                                          : "text-white"
                                      }`}
                                    >
                                      {task.title}
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <span
                                        className={`rounded-full px-3 py-1 text-sm ${priorityStyle(
                                          task.priority
                                        )}`}
                                      >
                                        {task.priority ?? "medium"}
                                      </span>
                                      <span className="rounded-full border border-white/5 bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
                                        {formatDueDate(task.due_date)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {canEdit && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => startEdit(task)}
                                      className="rounded-2xl border border-white/10 bg-zinc-950 px-4 py-2 text-zinc-100 transition hover:bg-zinc-800"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => deleteTask(task.id)}
                                      className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-red-300 transition hover:bg-red-500/15"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}