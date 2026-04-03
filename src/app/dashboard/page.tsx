'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function DashboardPage() {
  const stats = [
    { label: 'Today', value: '12', sub: 'Tasks scheduled' },
    { label: 'All', value: '48', sub: 'Across all lists' },
    { label: 'Completed', value: '31', sub: 'Finished this week' },
  ]

  const lists = [
    { name: 'Work', count: 8, badge: 'Active' },
    { name: 'Personal', count: 5, badge: 'Today' },
    { name: 'Shopping', count: 3, badge: 'Pending' },
    { name: 'Ideas', count: 7, badge: 'New' },
  ]

  const tasks = [
    { title: 'Finish project presentation', time: 'Today · 12:00 PM' },
    { title: 'Review shared list invites', time: 'Tomorrow · 9:00 AM' },
    { title: 'Plan weekend errands', time: 'Friday · 5:30 PM' },
    { title: 'Update app branding', time: 'Saturday · 11:00 AM' },
  ]

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.08),transparent_26%)] dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.12),transparent_26%),linear-gradient(to_bottom,#020617,#000000)]">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-40 mb-6">
          <div className="rounded-[28px] border border-white/50 bg-white/70 px-4 py-3 shadow-[0_10px_40px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-4">
              <Link
                href="/dashboard"
                className="group flex items-center gap-3 rounded-2xl px-2 py-1 transition hover:bg-slate-100/80 dark:hover:bg-white/5"
              >
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl bg-sky-400/20 blur-xl transition duration-300 group-hover:bg-emerald-400/20" />
                  <Image
                    src="/logo/logo-light.png"
                    alt="TaskMate"
                    width={176}
                    height={44}
                    className="relative block dark:hidden transition duration-300 group-hover:scale-[1.02]"
                    priority
                  />
                  <Image
                    src="/logo/logo-dark.png"
                    alt="TaskMate"
                    width={176}
                    height={44}
                    className="relative hidden dark:block transition duration-300 group-hover:scale-[1.02]"
                    priority
                  />
                </div>
              </Link>

              <div className="hidden items-center gap-3 md:flex">
                <button className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  Today
                </button>
                <button className="rounded-full border border-transparent bg-gradient-to-r from-sky-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(34,197,94,0.28)] transition hover:scale-[1.02]">
                  + New Task
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-6">
          <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="overflow-hidden rounded-[32px] border border-white/60 bg-white/75 p-6 shadow-[0_14px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_14px_50px_rgba(0,0,0,0.35)]">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">
                    Good day
                  </p>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                    Your tasks, beautifully organized.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    TaskMate keeps your day focused with lists, reminders, and shared tasks in one clean space.
                  </p>
                </div>

                <div className="flex justify-center sm:justify-end">
                  <div className="group relative">
                    <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-sky-400/25 to-emerald-400/25 blur-2xl transition duration-500 group-hover:from-sky-400/35 group-hover:to-emerald-400/35" />
                    <div className="relative rounded-[28px] border border-white/60 bg-white/80 p-4 shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/5">
                      <Image
                        src="/logo/icon.png"
                        alt="TaskMate icon"
                        width={88}
                        height={88}
                        priority
                        className="transition duration-500 group-hover:scale-105 group-hover:-rotate-2 motion-safe:animate-[float_4.2s_ease-in-out_infinite]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/60 bg-white/75 p-6 shadow-[0_14px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_14px_50px_rgba(0,0,0,0.35)]">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Quick Focus</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-slate-50/90 p-4 dark:bg-white/5">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Next task</p>
                  <p className="mt-1 font-semibold">Finish project presentation</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">12:00 PM</p>
                </div>
                <div className="rounded-2xl bg-slate-50/90 p-4 dark:bg-white/5">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Shared lists</p>
                  <p className="mt-1 font-semibold">3 active collaborators</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-[28px] border border-white/60 bg-white/75 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_10px_35px_rgba(0,0,0,0.3)]"
            >
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">{item.value}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.sub}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[32px] border border-white/60 bg-white/75 p-6 shadow-[0_14px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_14px_50px_rgba(0,0,0,0.35)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-tight">My Lists</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                {lists.length} lists
              </span>
            </div>

            <div className="space-y-3">
              {lists.map((list) => (
                <div
                  key={list.name}
                  className="flex items-center justify-between rounded-[22px] border border-slate-200/70 bg-white/80 px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 p-[1px]">
                      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-white dark:bg-slate-950">
                        <Image src="/logo/icon.png" alt="" width={22} height={22} />
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold">{list.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{list.count} tasks</p>
                    </div>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                    {list.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/60 bg-white/75 p-6 shadow-[0_14px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_14px_50px_rgba(0,0,0,0.35)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-tight">Upcoming Tasks</h3>
              <span className="rounded-full bg-gradient-to-r from-sky-500/15 to-emerald-500/15 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                Priority View
              </span>
            </div>

            <div className="space-y-3">
              {tasks.map((task, index) => (
                <div
                  key={task.title}
                  className="group rounded-[24px] border border-slate-200/70 bg-white/85 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex items-start gap-4">
                    <button
                      aria-label={`Mark ${task.title} complete`}
                      className="mt-0.5 h-6 w-6 rounded-full border-2 border-slate-300 transition group-hover:border-emerald-500 dark:border-slate-600"
                    />
                    <div className="flex-1">
                      <p className="font-semibold">{task.title}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{task.time}</p>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      #{index + 1}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }
      `}</style>
    </main>
  )
}
