'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  email: string | null
}

type ListMember = {
  user_id: string
  role: 'owner' | 'editor' | 'member'
  profile?: Profile | null
}

type TaskList = {
  id: string
  name: string
  owner_id: string
  created_at?: string
  color?: string | null
  members?: ListMember[]
}

type Task = {
  id: string
  title: string
  completed: boolean
  list_id: string
  user_id?: string | null
  notes?: string | null
  due_date?: string | null
  due_time?: string | null
  reminder_minutes?: number | null
  priority?: 'low' | 'medium' | 'high' | null
  created_at?: string
  completed_at?: string | null
}

type ViewMode = 'home' | 'today' | 'all' | 'completed' | 'list'

const PRIORITIES: Array<{ value: 'low' | 'medium' | 'high'; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const REMINDER_OPTIONS = [
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
]

const LIST_COLORS = [
  'bg-sky-400',
  'bg-emerald-400',
  'bg-orange-400',
  'bg-pink-400',
  'bg-violet-400',
  'bg-yellow-400',
]

function isSameDay(dateA: Date, dateB: Date) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  )
}

function formatDue(task: Task) {
  if (!task.due_date && !task.due_time) return ''

  let text = ''

  if (task.due_date) {
    const d = new Date(`${task.due_date}T00:00:00`)
    const now = new Date()

    if (isSameDay(d, now)) {
      text += 'Today'
    } else {
      text += d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      })
    }
  }

  if (task.due_time) {
    const [h, m] = task.due_time.split(':')
    const dt = new Date()
    dt.setHours(Number(h), Number(m), 0, 0)
    const timeText = dt.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
    text += text ? ` at ${timeText}` : timeText
  }

  return text
}

function formatTimeValue(value: string | null | undefined) {
  if (!value) return 'Time'
  const [h, m] = value.split(':')
  const d = new Date()
  d.setHours(Number(h), Number(m), 0, 0)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function getInitials(email?: string | null) {
  if (!email) return 'U'
  const left = email.split('@')[0] || 'U'
  const parts = left.split(/[.\-_ ]+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const [lists, setLists] = useState<TaskList[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  const [viewMode, setViewMode] = useState<ViewMode>('home')
  const [selectedListId, setSelectedListId] = useState<string | null>(null)

  const [showQuickSheet, setShowQuickSheet] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showListModal, setShowListModal] = useState(false)

  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [editingListName, setEditingListName] = useState('')
  const editInputRef = useRef<HTMLInputElement | null>(null)

  const [menuTaskId, setMenuTaskId] = useState<string | null>(null)
  const [menuListId, setMenuListId] = useState<string | null>(null)

  const [showCompleted, setShowCompleted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [taskForm, setTaskForm] = useState({
    title: '',
    notes: '',
    list_id: '',
    due_date: '',
    due_time: '',
    reminder_minutes: '60',
    priority: 'medium' as 'low' | 'medium' | 'high',
  })

  const [listFormName, setListFormName] = useState('')

  const taskTitleRef = useRef<HTMLInputElement | null>(null)
  const listTitleRef = useRef<HTMLInputElement | null>(null)
  const timeInputRef = useRef<HTMLInputElement | null>(null)

  const selectedList = useMemo(
    () => lists.find((l) => l.id === selectedListId) || null,
    [lists, selectedListId]
  )

  const listMap = useMemo(() => {
    const map = new Map<string, TaskList>()
    for (const list of lists) map.set(list.id, list)
    return map
  }, [lists])

  const refreshAll = useCallback(async () => {
    setLoading(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setLoading(false)
      return
    }

    setUserId(user.id)
    setUserEmail(user.email ?? null)

    const { data: membershipRows, error: membershipError } = await supabase
      .from('list_members')
      .select(
        `
        list_id,
        role
      `
      )
      .eq('user_id', user.id)

    if (membershipError) {
      console.error(membershipError)
      setLoading(false)
      return
    }

    const listIds = (membershipRows || []).map((m: any) => m.list_id)

    if (listIds.length === 0) {
      setLists([])
      setTasks([])
      setLoading(false)
      return
    }

    const { data: listsData, error: listsError } = await supabase
      .from('lists')
      .select('*')
      .in('id', listIds)
      .order('created_at', { ascending: true })

    if (listsError) {
      console.error(listsError)
      setLoading(false)
      return
    }

    const { data: membersData, error: membersError } = await supabase
      .from('list_members')
      .select(
        `
        list_id,
        user_id,
        role,
        profiles (
          id,
          email
        )
      `
      )
      .in('list_id', listIds)

    if (membersError) {
      console.error(membersError)
      setLoading(false)
      return
    }

    const memberMap = new Map<string, ListMember[]>()

    for (const row of membersData || []) {
      const existing = memberMap.get(row.list_id) || []
      existing.push({
        user_id: row.user_id,
        role: row.role,
        profile: Array.isArray((row as any).profiles)
          ? (row as any).profiles[0] ?? null
          : (row as any).profiles ?? null,
      })
      memberMap.set(row.list_id, existing)
    }

    const combinedLists: TaskList[] = (listsData || []).map((list: any, index: number) => ({
      ...list,
      color: list.color || LIST_COLORS[index % LIST_COLORS.length],
      members: memberMap.get(list.id) || [],
    }))

    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .in('list_id', listIds)
      .order('completed', { ascending: true })
      .order('created_at', { ascending: false })

    if (tasksError) {
      console.error(tasksError)
      setLoading(false)
      return
    }

    setLists(combinedLists)
    setTasks(tasksData || [])

    if (!selectedListId && combinedLists.length > 0) {
      setSelectedListId(combinedLists[0].id)
    }

    setLoading(false)
  }, [selectedListId])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  useEffect(() => {
    if (editingListId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingListId])

  useEffect(() => {
    if (showTaskModal && taskTitleRef.current) {
      taskTitleRef.current.focus()
    }
  }, [showTaskModal])

  useEffect(() => {
    if (showListModal && listTitleRef.current) {
      listTitleRef.current.focus()
    }
  }, [showListModal])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(timer)
  }, [toast])

  const allOpenTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks])

  const todayTasks = useMemo(() => {
    const now = new Date()
    return tasks.filter((task) => {
      if (task.completed || !task.due_date) return false
      const due = new Date(`${task.due_date}T00:00:00`)
      return isSameDay(now, due)
    })
  }, [tasks])

  const completedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.completed)
        .sort((a, b) => {
          const aDate = a.completed_at || a.created_at || ''
          const bDate = b.completed_at || b.created_at || ''
          return aDate < bDate ? 1 : -1
        }),
    [tasks]
  )

  const visibleTasks = useMemo(() => {
    if (viewMode === 'today') return todayTasks
    if (viewMode === 'all') return allOpenTasks
    if (viewMode === 'completed') return completedTasks
    if (viewMode === 'list' && selectedListId) {
      return tasks.filter((t) => t.list_id === selectedListId && !t.completed)
    }
    return []
  }, [viewMode, todayTasks, allOpenTasks, completedTasks, tasks, selectedListId])

  const visibleCompletedForList = useMemo(() => {
    if (!selectedListId) return []
    return tasks
      .filter((t) => t.list_id === selectedListId && t.completed)
      .sort((a, b) => {
        const aDate = a.completed_at || a.created_at || ''
        const bDate = b.completed_at || b.created_at || ''
        return aDate < bDate ? 1 : -1
      })
  }, [tasks, selectedListId])

  const openCreateTask = (listId?: string) => {
    setEditingTask(null)
    setTaskForm({
      title: '',
      notes: '',
      list_id: listId || selectedListId || lists[0]?.id || '',
      due_date: '',
      due_time: '',
      reminder_minutes: '60',
      priority: 'medium',
    })
    setShowTaskModal(true)
  }

  const openEditTask = (task: Task) => {
    setEditingTask(task)
    setTaskForm({
      title: task.title || '',
      notes: task.notes || '',
      list_id: task.list_id || '',
      due_date: task.due_date || '',
      due_time: task.due_time || '',
      reminder_minutes: String(task.reminder_minutes ?? 60),
      priority: (task.priority as 'low' | 'medium' | 'high') || 'medium',
    })
    setShowTaskModal(true)
    setMenuTaskId(null)
  }

  const openCreateList = () => {
    setListFormName('')
    setShowListModal(true)
  }

  const closeAllModals = () => {
    setShowQuickSheet(false)
    setShowTaskModal(false)
    setShowListModal(false)
    setMenuTaskId(null)
    setMenuListId(null)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const isTyping =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable

      if (e.key === 'Escape') {
        closeAllModals()
        setEditingListId(null)
        return
      }

      if (isTyping) return

      if (e.key === 'n' && !e.shiftKey) {
        e.preventDefault()
        openCreateTask()
      }

      if (e.key === 'N' && e.shiftKey) {
        e.preventDefault()
        openCreateList()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lists, selectedListId])

  async function saveTask() {
    const title = taskForm.title.trim()
    if (!title || !taskForm.list_id) return

    if (editingTask) {
      const optimistic: Task = {
        ...editingTask,
        title,
        notes: taskForm.notes || null,
        list_id: taskForm.list_id,
        due_date: taskForm.due_date || null,
        due_time: taskForm.due_time || null,
        reminder_minutes: Number(taskForm.reminder_minutes),
        priority: taskForm.priority,
      }

      setTasks((curr) => curr.map((t) => (t.id === editingTask.id ? optimistic : t)))
      setShowTaskModal(false)

      const { error } = await supabase
        .from('tasks')
        .update({
          title,
          notes: taskForm.notes || null,
          list_id: taskForm.list_id,
          due_date: taskForm.due_date || null,
          due_time: taskForm.due_time || null,
          reminder_minutes: Number(taskForm.reminder_minutes),
          priority: taskForm.priority,
        })
        .eq('id', editingTask.id)

      if (error) {
        console.error(error)
        setToast('Could not save task')
        await refreshAll()
      } else {
        setToast('Task updated')
      }

      return
    }

    const insertPayload = {
      title,
      completed: false,
      list_id: taskForm.list_id,
      user_id: userId,
      notes: taskForm.notes || null,
      due_date: taskForm.due_date || null,
      due_time: taskForm.due_time || null,
      reminder_minutes: Number(taskForm.reminder_minutes),
      priority: taskForm.priority,
    }

    const { data, error } = await supabase.from('tasks').insert(insertPayload).select().single()

    if (error) {
      console.error(error)
      setToast('Could not create task')
      return
    }

    setTasks((curr) => [data, ...curr])
    setShowTaskModal(false)
    setToast('Task created')
  }

  async function saveList() {
    const name = listFormName.trim()
    if (!name || !userId) return

    const { data: insertedList, error: listError } = await supabase
      .from('lists')
      .insert({
        name,
        owner_id: userId,
      })
      .select()
      .single()

    if (listError || !insertedList) {
      console.error(listError)
      setToast('Could not create list')
      return
    }

    const { error: memberError } = await supabase.from('list_members').insert({
      list_id: insertedList.id,
      user_id: userId,
      role: 'owner',
    })

    if (memberError) {
      console.error(memberError)
      setToast('List created, but membership failed')
      await refreshAll()
      return
    }

    const newList: TaskList = {
      ...insertedList,
      color: LIST_COLORS[lists.length % LIST_COLORS.length],
      members: [
        {
          user_id: userId,
          role: 'owner',
          profile: userEmail ? { id: userId, email: userEmail } : null,
        },
      ],
    }

    setLists((curr) => [...curr, newList])
    setSelectedListId(insertedList.id)
    setViewMode('list')
    setShowListModal(false)
    setToast('List created')
  }

  function startEditListName(list: TaskList) {
    setEditingListId(list.id)
    setEditingListName(list.name)
    setMenuListId(null)
  }

  function cancelEditListName() {
    setEditingListId(null)
    setEditingListName('')
  }

  async function saveListName(id: string) {
    const name = editingListName.trim()
    if (!name) {
      cancelEditListName()
      return
    }

    const previous = lists
    setLists((curr) => curr.map((l) => (l.id === id ? { ...l, name } : l)))
    cancelEditListName()

    const { error } = await supabase.from('lists').update({ name }).eq('id', id)
    if (error) {
      console.error(error)
      setLists(previous)
      setToast('Could not rename list')
    } else {
      setToast('List renamed')
    }
  }

  async function toggleTask(taskId: string, completed: boolean) {
    const previous = tasks
    const now = new Date().toISOString()

    setTasks((curr) =>
      curr.map((t) =>
        t.id === taskId
          ? { ...t, completed, completed_at: completed ? now : null }
          : t
      )
    )

    const { error } = await supabase
      .from('tasks')
      .update({
        completed,
        completed_at: completed ? now : null,
      })
      .eq('id', taskId)

    if (error) {
      console.error(error)
      setTasks(previous)
      setToast('Could not update task')
      return
    }

    setToast(completed ? 'Task completed' : 'Task reopened')
  }

  async function deleteTask(taskId: string) {
    const previous = tasks
    setTasks((curr) => curr.filter((t) => t.id !== taskId))
    setMenuTaskId(null)

    const { error } = await supabase.from('tasks').delete().eq('id', taskId)

    if (error) {
      console.error(error)
      setTasks(previous)
      setToast('Could not delete task')
      return
    }

    setToast('Task deleted')
  }

  async function leaveList(listId: string) {
    if (!userId) return

    const { error } = await supabase
      .from('list_members')
      .delete()
      .eq('list_id', listId)
      .eq('user_id', userId)

    if (error) {
      console.error(error)
      setToast('Could not leave list')
      return
    }

    const remainingLists = lists.filter((l) => l.id !== listId)
    const remainingTasks = tasks.filter((t) => t.list_id !== listId)

    setLists(remainingLists)
    setTasks(remainingTasks)
    setMenuListId(null)

    if (selectedListId === listId) {
      setSelectedListId(remainingLists[0]?.id || null)
      setViewMode('home')
    }

    setToast('You left the list')
  }

  async function deleteList(listId: string) {
    const listTasks = tasks.filter((t) => t.list_id === listId).map((t) => t.id)

    if (listTasks.length > 0) {
      const { error: taskError } = await supabase.from('tasks').delete().eq('list_id', listId)
      if (taskError) {
        console.error(taskError)
        setToast('Could not delete list tasks')
        return
      }
    }

    const { error: memberError } = await supabase.from('list_members').delete().eq('list_id', listId)
    if (memberError) {
      console.error(memberError)
      setToast('Could not delete list members')
      return
    }

    const { error: listError } = await supabase.from('lists').delete().eq('id', listId)
    if (listError) {
      console.error(listError)
      setToast('Could not delete list')
      return
    }

    const remainingLists = lists.filter((l) => l.id !== listId)
    const remainingTasks = tasks.filter((t) => t.list_id !== listId)

    setLists(remainingLists)
    setTasks(remainingTasks)
    setMenuListId(null)

    if (selectedListId === listId) {
      setSelectedListId(remainingLists[0]?.id || null)
      setViewMode('home')
    }

    setToast('List deleted')
  }

  function openList(listId: string) {
    setSelectedListId(listId)
    setViewMode('list')
  }

  function getRole(list: TaskList) {
    return list.members?.find((m) => m.user_id === userId)?.role || 'member'
  }

  function isShared(list: TaskList) {
    return (list.members?.length || 0) > 1
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#111827,_#020617_65%)] text-white">
        <div className="mx-auto max-w-3xl px-5 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-40 rounded-2xl bg-white/10" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="h-28 rounded-3xl bg-white/10" />
              <div className="h-28 rounded-3xl bg-white/10" />
              <div className="h-28 rounded-3xl bg-white/10" />
            </div>
            <div className="h-80 rounded-3xl bg-white/10" />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#131a2b,_#04070f_60%,_#010204_100%)] text-white">
      <div className="mx-auto max-w-3xl px-5 pb-28 pt-6">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            {viewMode !== 'home' ? (
              <button
                onClick={() => setViewMode('home')}
                className="mb-3 inline-flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10 active:scale-[0.98]"
              >
                <span>←</span>
                <span>Back</span>
              </button>
            ) : null}

            <h1 className="text-4xl font-semibold tracking-tight">
              {viewMode === 'home' && 'TaskMate'}
              {viewMode === 'today' && 'Today'}
              {viewMode === 'all' && 'All Tasks'}
              {viewMode === 'completed' && 'Completed'}
              {viewMode === 'list' && (selectedList?.name || 'List')}
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              {viewMode === 'home'
                ? 'A calmer way to keep track of everything.'
                : viewMode === 'list'
                ? `${visibleTasks.length} open • ${visibleCompletedForList.length} completed`
                : `${visibleTasks.length} tasks`}
            </p>
          </div>

          <button
            onClick={refreshAll}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10 active:scale-[0.98]"
          >
            Refresh
          </button>
        </header>

        {viewMode === 'home' ? (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                onClick={() => setViewMode('today')}
                className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition hover:bg-white/10 active:scale-[0.98]"
              >
                <div className="text-sm text-zinc-400">Today</div>
                <div className="mt-3 text-4xl font-semibold">{todayTasks.length}</div>
                <div className="mt-2 text-sm text-zinc-500">Due today</div>
              </button>

              <button
                onClick={() => setViewMode('all')}
                className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition hover:bg-white/10 active:scale-[0.98]"
              >
                <div className="text-sm text-zinc-400">All</div>
                <div className="mt-3 text-4xl font-semibold">{allOpenTasks.length}</div>
                <div className="mt-2 text-sm text-zinc-500">Open tasks</div>
              </button>

              <button
                onClick={() => setViewMode('completed')}
                className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition hover:bg-white/10 active:scale-[0.98]"
              >
                <div className="text-sm text-zinc-400">Completed</div>
                <div className="mt-3 text-4xl font-semibold">{completedTasks.length}</div>
                <div className="mt-2 text-sm text-zinc-500">Finished items</div>
              </button>
            </section>

            <section className="mt-7 rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Lists</h2>
                <button
                  onClick={openCreateList}
                  className="rounded-2xl bg-white/5 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
                >
                  New List
                </button>
              </div>

              {lists.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 px-5 py-10 text-center">
                  <div className="text-lg font-medium text-white">No Lists Yet</div>
                  <div className="mt-2 text-sm text-zinc-400">
                    Create your first list with the + button.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {lists.map((list) => {
                    const role = getRole(list)
                    const openCount = tasks.filter(
                      (t) => t.list_id === list.id && !t.completed
                    ).length

                    return (
                      <div
                        key={list.id}
                        className="group relative flex items-center justify-between rounded-[22px] px-4 py-3 transition hover:bg-white/8 active:scale-[0.99]"
                      >
                        <button
                          onClick={() => openList(list.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <div className={cn('h-3 w-3 rounded-full', list.color || 'bg-sky-400')} />
                          <div className="min-w-0">
                            {editingListId === list.id ? (
                              <input
                                ref={editInputRef}
                                value={editingListName}
                                onChange={(e) => setEditingListName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveListName(list.id)
                                  if (e.key === 'Escape') cancelEditListName()
                                }}
                                onBlur={() => saveListName(list.id)}
                                className="w-full rounded-xl bg-white/10 px-3 py-2 text-[17px] font-medium text-white outline-none ring-1 ring-white/15 focus:ring-white/30"
                              />
                            ) : (
                              <>
                                <div className="truncate text-[17px] font-medium text-white">
                                  {list.name}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                                  {isShared(list) && <span>Shared</span>}
                                  {isShared(list) && <span>•</span>}
                                  <span className="capitalize">{role}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </button>

                        <div className="ml-3 flex items-center gap-3">
                          {isShared(list) ? (
                            <div className="hidden sm:flex -space-x-2">
                              {(list.members || []).slice(0, 3).map((m) => (
                                <div
                                  key={m.user_id}
                                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0a0d14] bg-white/10 text-[10px] text-white"
                                  title={m.profile?.email || 'Member'}
                                >
                                  {getInitials(m.profile?.email)}
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <button
                            onClick={() => openList(list.id)}
                            className="text-sm text-zinc-400"
                          >
                            {openCount}
                          </button>

                          <div className="relative">
                            <button
                              onClick={() =>
                                setMenuListId((prev) => (prev === list.id ? null : list.id))
                              }
                              className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                            >
                              ⋯
                            </button>

                            {menuListId === list.id && (
                              <div className="absolute right-0 top-11 z-20 w-44 rounded-2xl border border-white/10 bg-[#0d1220]/95 p-2 shadow-2xl backdrop-blur-xl">
                                <button
                                  onClick={() => startEditListName(list)}
                                  className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                                >
                                  Edit Name
                                </button>

                                {role === 'owner' ? (
                                  <button
                                    onClick={() => deleteList(list.id)}
                                    className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
                                  >
                                    Delete List
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => leaveList(list.id)}
                                    className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
                                  >
                                    Leave List
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            {viewMode === 'list' && selectedList ? (
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn('h-3 w-3 rounded-full', selectedList.color || 'bg-sky-400')} />
                  <div className="min-w-0">
                    <div className="truncate text-lg font-semibold text-white">{selectedList.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                      {(selectedList.members || []).slice(0, 4).map((m) => (
                        <div
                          key={m.user_id}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] text-white"
                          title={m.profile?.email || 'Member'}
                        >
                          {getInitials(m.profile?.email)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => openCreateTask(selectedList.id)}
                  className="rounded-2xl bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/15"
                >
                  Add Task
                </button>
              </div>
            ) : null}

            {visibleTasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 px-5 py-12 text-center">
                <div className="text-lg font-medium text-white">
                  {viewMode === 'completed' ? 'Nothing completed yet' : 'No Tasks'}
                </div>
                <div className="mt-2 text-sm text-zinc-400">
                  {viewMode === 'completed'
                    ? 'Completed tasks will appear here.'
                    : 'Tap + to add your first task.'}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    list={listMap.get(task.list_id) || null}
                    isCompletedScreen={viewMode === 'completed'}
                    menuOpen={menuTaskId === task.id}
                    onToggle={() => toggleTask(task.id, !task.completed)}
                    onEdit={() => openEditTask(task)}
                    onDelete={() => deleteTask(task.id)}
                    onMenu={() => setMenuTaskId((prev) => (prev === task.id ? null : task.id))}
                  />
                ))}
              </div>
            )}

            {viewMode === 'list' && selectedListId ? (
              <div className="mt-5">
                <button
                  onClick={() => setShowCompleted((v) => !v)}
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-zinc-300 transition hover:bg-white/5"
                >
                  <span className="text-sm font-medium">
                    Completed ({visibleCompletedForList.length})
                  </span>
                  <span className="text-xs text-zinc-500">{showCompleted ? 'Hide' : 'Show'}</span>
                </button>

                {showCompleted && visibleCompletedForList.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {visibleCompletedForList.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        list={listMap.get(task.list_id) || null}
                        isCompletedScreen
                        menuOpen={menuTaskId === task.id}
                        onToggle={() => toggleTask(task.id, false)}
                        onEdit={() => openEditTask(task)}
                        onDelete={() => deleteTask(task.id)}
                        onMenu={() =>
                          setMenuTaskId((prev) => (prev === task.id ? null : task.id))
                        }
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        )}
      </div>

      <button
        onClick={() => setShowQuickSheet(true)}
        className="fixed bottom-7 right-7 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-sky-400 to-sky-500 text-4xl font-light text-white shadow-[0_20px_50px_rgba(14,165,233,0.35)] transition hover:scale-[1.03] active:scale-[0.97]"
        aria-label="Create"
      >
        +
      </button>

      {showQuickSheet && (
        <div
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-md"
          onClick={() => setShowQuickSheet(false)}
        >
          <div
            className="absolute bottom-28 right-6 w-56 rounded-3xl border border-white/10 bg-[#0d1220]/95 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowQuickSheet(false)
                openCreateTask()
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white transition hover:bg-white/10"
            >
              <span className="text-lg">✓</span>
              <span>New Task</span>
            </button>

            <button
              onClick={() => {
                setShowQuickSheet(false)
                openCreateList()
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white transition hover:bg-white/10"
            >
              <span className="text-lg">≡</span>
              <span>New List</span>
            </button>
          </div>
        </div>
      )}

      {showTaskModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-md sm:items-center"
          onClick={() => setShowTaskModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-t-[28px] border border-white/10 bg-[#0d1220]/95 p-5 shadow-2xl sm:rounded-[28px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">
                {editingTask ? 'Edit Task' : 'New Task'}
              </h3>
              <button
                onClick={() => setShowTaskModal(false)}
                className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                <label className="mb-2 block text-sm text-zinc-400">Title</label>
                <input
                  ref={taskTitleRef}
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((s) => ({ ...s, title: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && taskForm.title.trim()) saveTask()
                  }}
                  placeholder="New Task"
                  className="w-full bg-transparent text-xl font-medium text-white outline-none placeholder:text-zinc-500"
                />
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                <label className="mb-2 block text-sm text-zinc-400">Notes</label>
                <textarea
                  value={taskForm.notes}
                  onChange={(e) => setTaskForm((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Add notes"
                  rows={3}
                  className="w-full resize-none bg-transparent text-base text-white outline-none placeholder:text-zinc-500"
                />
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                <div className="mb-3 text-sm font-medium text-zinc-300">When</div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                    <label className="mb-1 block text-xs text-zinc-500">Date</label>
                    <input
                      type="date"
                      value={taskForm.due_date}
                      onChange={(e) => setTaskForm((s) => ({ ...s, due_date: e.target.value }))}
                      className="w-full bg-transparent text-base text-white outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => timeInputRef.current?.showPicker?.() || timeInputRef.current?.click()}
                    className="relative rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.06]"
                  >
                    <div className="mb-1 text-xs text-zinc-500">Time</div>
                    <div className="flex items-center justify-between">
                      <span className="text-base text-white">
                        {formatTimeValue(taskForm.due_time)}
                      </span>
                      <span className="rounded-full bg-sky-400/15 px-3 py-1 text-sm text-sky-300">
                        {taskForm.due_time ? formatTimeValue(taskForm.due_time) : 'Select'}
                      </span>
                    </div>

                    <input
                      ref={timeInputRef}
                      type="time"
                      value={taskForm.due_time}
                      onChange={(e) => setTaskForm((s) => ({ ...s, due_time: e.target.value }))}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </button>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                <div className="mb-3 text-sm font-medium text-zinc-300">More Options</div>

                <div className="space-y-3">
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                    <label className="mb-2 block text-xs text-zinc-500">List</label>
                    <select
                      value={taskForm.list_id}
                      onChange={(e) => setTaskForm((s) => ({ ...s, list_id: e.target.value }))}
                      className="w-full bg-transparent text-base text-white outline-none"
                    >
                      {lists.map((list) => (
                        <option key={list.id} value={list.id} className="bg-[#0d1220]">
                          {list.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                    <label className="mb-2 block text-xs text-zinc-500">Reminder</label>
                    <select
                      value={taskForm.reminder_minutes}
                      onChange={(e) =>
                        setTaskForm((s) => ({ ...s, reminder_minutes: e.target.value }))
                      }
                      className="w-full bg-transparent text-base text-white outline-none"
                    >
                      {REMINDER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#0d1220]">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="mb-3 text-xs text-zinc-500">Priority</div>
                    <div className="grid grid-cols-3 gap-2">
                      {PRIORITIES.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() =>
                            setTaskForm((s) => ({
                              ...s,
                              priority: opt.value,
                            }))
                          }
                          className={cn(
                            'rounded-2xl px-3 py-2 text-sm transition',
                            taskForm.priority === opt.value
                              ? 'bg-white/16 text-white ring-1 ring-white/20'
                              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="rounded-2xl px-4 py-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  disabled={!taskForm.title.trim()}
                  onClick={saveTask}
                  className={cn(
                    'rounded-2xl px-5 py-2 font-medium transition',
                    taskForm.title.trim()
                      ? 'bg-sky-400 text-white hover:brightness-110 active:scale-[0.98]'
                      : 'cursor-not-allowed bg-white/10 text-zinc-500'
                  )}
                >
                  {editingTask ? 'Save' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showListModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-md sm:items-center"
          onClick={() => setShowListModal(false)}
        >
          <div
            className="w-full max-w-md rounded-t-[28px] border border-white/10 bg-[#0d1220]/95 p-5 shadow-2xl sm:rounded-[28px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">New List</h3>
              <button
                onClick={() => setShowListModal(false)}
                className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
              <label className="mb-2 block text-sm text-zinc-400">List Name</label>
              <input
                ref={listTitleRef}
                value={listFormName}
                onChange={(e) => setListFormName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && listFormName.trim()) saveList()
                }}
                placeholder="My Tasks"
                className="w-full bg-transparent text-xl font-medium text-white outline-none placeholder:text-zinc-500"
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowListModal(false)}
                className="rounded-2xl px-4 py-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>

              <button
                disabled={!listFormName.trim()}
                onClick={saveList}
                className={cn(
                  'rounded-2xl px-5 py-2 font-medium transition',
                  listFormName.trim()
                    ? 'bg-sky-400 text-white hover:brightness-110 active:scale-[0.98]'
                    : 'cursor-not-allowed bg-white/10 text-zinc-500'
                )}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0d1220]/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-xl">
          {toast}
        </div>
      )}
    </main>
  )
}

function TaskRow({
  task,
  list,
  isCompletedScreen,
  menuOpen,
  onToggle,
  onEdit,
  onDelete,
  onMenu,
}: {
  task: Task
  list: TaskList | null
  isCompletedScreen?: boolean
  menuOpen: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onMenu: () => void
}) {
  return (
    <div className="group relative flex items-start gap-3 rounded-[22px] px-4 py-3 transition hover:bg-white/5">
      <button
        onClick={onToggle}
        className={cn(
          'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
          task.completed
            ? 'border-emerald-400 bg-emerald-400 text-[#08120d]'
            : 'border-white/25 hover:border-white/45'
        )}
      >
        {task.completed ? '✓' : ''}
      </button>

      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <div
          className={cn(
            'truncate text-[15px]',
            task.completed ? 'text-zinc-500 line-through' : 'text-white'
          )}
        >
          {task.title}
        </div>

        {task.notes ? (
          <div className="mt-1 line-clamp-1 text-sm text-zinc-400">{task.notes}</div>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          {formatDue(task) ? <span>{formatDue(task)}</span> : null}
          {list ? (
            <>
              {formatDue(task) ? <span>•</span> : null}
              <span>{list.name}</span>
            </>
          ) : null}
          {task.priority ? (
            <>
              <span>•</span>
              <span className="capitalize">{task.priority}</span>
            </>
          ) : null}
          {isCompletedScreen && task.completed_at ? (
            <>
              <span>•</span>
              <span>
                Completed{' '}
                {new Date(task.completed_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </>
          ) : null}
        </div>
      </button>

      <div className="relative">
        <button
          onClick={onMenu}
          className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
        >
          ⋯
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-11 z-20 w-40 rounded-2xl border border-white/10 bg-[#0d1220]/95 p-2 shadow-2xl backdrop-blur-xl">
            <button
              onClick={onEdit}
              className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-white hover:bg-white/10"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
