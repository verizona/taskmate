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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [lists, setLists] = useState<List[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [newListName, setNewListName] = useState("");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [savingList, setSavingList] = useState(false);

  useEffect(() => {
    loadSessionAndData();
  }, []);

  useEffect(() => {
    if (selectedListId) {
      loadTasks(selectedListId);
    }
  }, [selectedListId]);

  async function loadSessionAndData() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      window.location.href = "/";
      return;
    }

    setEmail(session.user.email ?? null);
    setUserId(session.user.id);

    const { data: ownedLists, error: listsError } = await supabase
      .from("lists")
      .select("id, name, owner_id, created_at")
      .order("created_at", { ascending: true });

    if (listsError) {
      alert(listsError.message);
      setLoading(false);
      return;
    }

    const normalizedLists = (ownedLists ?? []) as List[];
    setLists(normalizedLists);

    if (normalizedLists.length > 0) {
      setSelectedListId(normalizedLists[0].id);
    }

    setLoading(false);
  }

  async function loadTasks(listId: string) {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, is_completed, user_id, created_at, due_date, priority, list_id")
      .eq("list_id", listId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setTasks((data ?? []) as Task[]);
  }

  async function createList() {
    const name = newListName.trim();
    if (!name || !userId) return;

    setSavingList(true);

    const { data, error } = await supabase
      .from("lists")
      .insert([{ name, owner_id: userId }])
      .select()
      .single();

    if (error) {
      alert(error.message);
    } else if (data) {
      const created = data as List;
      setLists((prev) => [...prev, created]);
      setNewListName("");
      setSelectedListId(created.id);
    }

    setSavingList(false);
  }

  async function addTask() {
    const title = newTask.trim();
    if (!title || !userId || !selectedListId) return;

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
        task.id === taskId ? { ...task, is_completed: !currentValue } : task
      )
    );
  }

  async function deleteTask(taskId: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      alert(error.message);
      return;
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
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

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
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
                lists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => setSelectedListId(list.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      selectedListId === list.id
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    {list.name || "Untitled List"}
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-zinc-950/90 p-6 shadow-2xl shadow-black/40">
            <h2 className="text-2xl font-semibold">
              {lists.find((l) => l.id === selectedListId)?.name || "My Tasks"}
            </h2>

            <div className="mt-6 flex gap-3">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTask();
                }}
                placeholder="Add a new task..."
                className="flex-1 rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-500"
              />
              <button
                onClick={addTask}
                disabled={savingTask || !selectedListId}
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
                      className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
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
