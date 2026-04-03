'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'

type TabType = 'my-tasks' | 'in-progress' | 'completed'

type Task = {
  id: number
  title: string
  subtitle: string
  completed: boolean
  inProgress: boolean
}

export default function DashboardPage() {
  const [tab, setTab] = useState<TabType>('my-tasks')
  const [search, setSearch] = useState('')

  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 1,
      title: 'Finish project presentation',
      subtitle: 'Work',
      completed: false,
      inProgress: true,
    },
    {
      id: 2,
      title: 'Grocery shopping',
      subtitle: 'Shopping',
      completed: false,
      inProgress: false,
    },
    {
      id: 3,
      title: 'Dentist appointment',
      subtitle: 'Reminder',
      completed: false,
      inProgress: false,
    },
    {
      id: 4,
      title: 'Review shared list invites',
      subtitle: 'Work',
      completed: true,
      inProgress: false,
    },
  ])

  function toggleTask(id: number) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    )
  }

  function filteredTasks() {
    let result = tasks

    if (tab === 'my-tasks') {
      result = tasks.filter((t) => !t.completed)
    } else if (tab === 'in-progress') {
      result = tasks.filter((t) => t.inProgress && !t.completed)
    } else if (tab === 'completed') {
      result = tasks.filter((t) => t.completed)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.subtitle.toLowerCase().includes(q)
      )
    }

    return result
  }

  const visibleTasks = useMemo(
    () => filteredTasks(),
    [tasks, tab, search]
  )

  const counts = {
    myTasks: tasks.filter((t) => !t.completed).length,
    inProgress: tasks.filter((t) => t.inProgress && !t.completed).length,
    completed: tasks.filter((t) => t.completed).length,
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-4 py-6 text-slate-900 dark:bg-[#090b10] dark:text-white">
      <div className="mx-auto w-full max-w-md">
        <div className="overflow-hidden rounded-[34px] border border-black/5 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#0f1117]">
          <div className="px-5 pt-5 pb-4">
            <div className="mb-5 flex items-center justify-between">
              <Link
                href="/dashboard"
                className="inline-flex items-center transition hover:opacity-90"
              >
                <Image
                  src="/logo/logo-light.png"
                  alt="TaskMate"
                  width={150}
                  height={40}
                  className="block dark:hidden"
                  priority
                />
                <Image
                  src="/logo/logo-dark.png"
                  alt="TaskMate"
                  width={150}
                  height={40}
                  className="hidden dark:block"
                  priority
                />
              </Link>

              <button
                type="button"
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[#f2f3f7] px-4 py-3 dark:bg-white/8">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                />
              </svg>

              <input
                type="text"
                placeholder="Search Tasks"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />

              <button
                type="button"
                className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Voice search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18v3m0 0h3m-3 0H9m3-3a4 4 0 0 0 4-4V8a4 4 0 1 0-8 0v6a4 4 0 0 0 4 4Z"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-5 flex items-center justify-between border-b border-slate-200 dark:border-white/10">
              <TabButton
                label="My Tasks"
                active={tab === 'my-tasks'}
                onClick={() => setTab('my-tasks')}
              />
              <TabButton
                label="In Progress"
                active={tab === 'in-progress'}
                onClick={() => setTab('in-progress')}
              />
              <TabButton
                label="Completed"
                active={tab === 'completed'}
                onClick={() => setTab('completed')}
              />
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <MiniStat label="My" value={counts.myTasks} />
              <MiniStat label="Doing" value={counts.inProgress} />
              <MiniStat label="Done" value={counts.completed} />
            </div>

            <div className="space-y-3">
              {visibleTasks.length === 0 ? (
                <div className="rounded-2xl bg-[#f2f3f7] px-4 py-8 text-center text-sm text-slate-500 dark:bg-white/8 dark:text-slate-300">
                  No tasks found.
                </div>
              ) : (
                visibleTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-4 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5"
                  >
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        task.completed
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-slate-300 bg-transparent hover:border-sky-500 dark:border-slate-500'
                      }`}
                      aria-label={
                        task.completed ? 'Mark as incomplete' : 'Mark as complete'
                      }
                    >
                      {task.completed ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m5 13 4 4L19 7"
                          />
                        </svg>
                      ) : null}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-[15px] font-semibold ${
                          task.completed
                            ? 'text-slate-400 line-through dark:text-slate-500'
                            : ''
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                        {task.subtitle}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {task.completed ? (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white shadow-sm">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m5 13 4 4L19 7"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-white/10" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-1 pb-3 text-[15px] font-medium transition ${
        active
          ? 'text-slate-900 dark:text-white'
          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      {label}
      {active ? (
        <span className="absolute bottom-0 left-0 h-[3px] w-full rounded-full bg-sky-500" />
      ) : null}
    </button>
  )
}

function MiniStat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl bg-[#f2f3f7] px-3 py-3 dark:bg-white/8">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}
