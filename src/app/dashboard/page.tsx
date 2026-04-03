'use client'

import Image from 'next/image'

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo/logo-light.png"
              alt="TaskMate"
              width={180}
              height={44}
              className="block dark:hidden"
              priority
            />
            <Image
              src="/logo/logo-dark.png"
              alt="TaskMate"
              width={180}
              height={44}
              className="hidden dark:block"
              priority
            />
          </div>

          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm dark:border-slate-800 dark:bg-slate-900">
            Dashboard
          </div>
        </header>

        <section className="mb-8">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Welcome back
                </p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight">
                  Stay on top of your tasks
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Organize your lists, track progress, and finish what matters.
                </p>
              </div>

              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-md dark:bg-slate-900">
                <Image
                  src="/logo/icon.png"
                  alt="TaskMate icon"
                  width={56}
                  height={56}
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">Today</p>
            <h2 className="mt-2 text-3xl font-bold">12</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Tasks scheduled for today
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">All Tasks</p>
            <h2 className="mt-2 text-3xl font-bold">48</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Across all lists
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">Completed</p>
            <h2 className="mt-2 text-3xl font-bold">31</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Finished this week
            </p>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">My Lists</h3>
              <span className="text-sm text-slate-500 dark:text-slate-400">4 lists</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                <div>
                  <p className="font-medium">Work</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">8 tasks</p>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                <div>
                  <p className="font-medium">Personal</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">5 tasks</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Updated
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                <div>
                  <p className="font-medium">Shopping</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">3 tasks</p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  Pending
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Upcoming Tasks</h3>
              <span className="text-sm text-slate-500 dark:text-slate-400">Next up</span>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="font-medium">Finish project presentation</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Due today at 12:00 PM
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="font-medium">Review shared list invites</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Due tomorrow at 9:00 AM
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="font-medium">Plan weekend errands</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Due Friday at 5:30 PM
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
