"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Task = {
  id: number;
  title: string;
  is_complete: boolean;
  user_id: string;
  created_at?: string;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSessionAndTasks();
  }, []);

  async function loadSessionAndTasks() {
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

    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select("id, title, is_complete, user_id, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (!taskError && taskData) {
      setTasks(taskData);
    }

    setLoading(false);
  }

  async function addTask() {
    const title = newTask.trim();
    if (!title || !userId) return;

    setSaving(true);

    const { data, error } = await supabase
      .from("tasks")
      .insert([
        {
          title,
          user_id: userId,
          is_complete: false,
        },
      ])
      .select()
      .single();

    if (!error && data) {
      setTasks((prev) => [data as Task, ...prev]);
      setNewTask("");
    } else if (error) {
      alert(error.message);
    }

    setSaving(false);
  }

  async function toggleTask(taskId: number, currentValue: boolean) {
    const { error } = await supabase
      .from("tasks")
      .update({ is_complete: !currentValue })
      .eq("id", taskId);

    if (error) {
      alert(error.message);
      return;
    }

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, is_complete: !currentValue }
          : task
      )
    );
  }

  async function deleteTask(taskId: number) {
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
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">TaskMate</h1>
            <p className="mt-3 text-zinc-400">
              Signed in as {email ?? "unknown user"}
            </p>
          </div>

          <button
            onClick={signOut}
            className="rounded-2xl bg-white px-4 py-3 font-medium text-black hover:bg-zinc-200"
          >
            Sign out
          </button>
        </div>

        <div className="mt-10 rounded-[28px] border border-white/10 bg-zinc-950/90 p-6 shadow-2xl shadow-black/40">
          <h2 className="text-2xl font-semibold">My Tasks</h2>

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
              disabled={saving}
              className="rounded-2xl bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200 disabled:opacity-60"
            >
              {saving ? "Adding..." : "Add"}
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-zinc-400">
                No tasks yet.
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.is_complete}
                      onChange={() => toggleTask(task.id, task.is_complete)}
                      className="h-5 w-5"
                    />
                    <span
                      className={
                        task.is_complete
                          ? "text-zinc-500 line-through"
                          : "text-white"
                      }
                    >
                      {task.title}
                    </span>
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
        </div>
      </div>
    </main>
  );
}
