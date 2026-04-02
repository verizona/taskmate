'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ListRow = {
  id: string
  name: string
  owner_id: string
  created_at: string
}

type TaskRow = {
  id: string
  title: string
  is_complete: boolean
  user_id: string | null
  list_id: string | null
  due_date: string | null
  priority: string | null
  reminder_minutes: number | null
  notes?: string | null
  created_at?: string
}

type MemberRow = {
  id: string
  list_id: string
  user_id: string
  role: 'owner' | 'editor' | 'member'
  created_at: string
  profiles?: {
    email: string | null
  } | null
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= breakpoint)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [breakpoint])

  return isMobile
}

function formatReminder(minutes: number | null | undefined) {
  if (minutes == null) return 'No reminder'
  if (minutes === 0) return 'At time'
  if (minutes === 5) return '5 min before'
  if (minutes === 10) return '10 min before'
  if (minutes === 15) return '15 min before'
  if (minutes === 30) return '30 min before'
  if (minutes === 60) return '1 hour before'
  if (minutes === 120) return '2 hours before'
  if (minutes === 1440) return '1 day before'
  if (minutes === 2880) return '2 days before'
  if (minutes === 10080) return '1 week before'
  return `${minutes} min before`
}

export default function DashboardPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const [lists, setLists] = useState<ListRow[]>([])
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])

  const [newListName, setNewListName] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('medium')
  const [newTaskReminder, setNewTaskReminder] = useState('60')

  const [inviteEmail, setInviteEmail] = useState('')

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editPriority, setEditPriority] = useState('medium')
  const [editReminder, setEditReminder] = useState('60')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isMobile = useIsMobile()

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (selectedListId) {
      loadTasks(selectedListId)
      loadMembers(selectedListId)
    } else {
      setTasks([])
      setMembers([])
    }
  }, [selectedListId])

  async function init() {
    try {
      setLoading(true)
      setError('')
      setMessage('')

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError

      if (!session?.user) {
        window.location.href = '/'
        return
      }

      const uid = session.user.id
      const email = session.user.email ?? ''

      setUserId(uid)
      setUserEmail(email)

      await ensureProfile(uid, email)
      await ensurePersonalList(uid)
      await loadLists(uid)
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  async function ensureProfile(uid: string, email: string) {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: uid, email }, { onConflict: 'id' })

    if (error) throw error
  }

  async function ensurePersonalList(uid: string) {
    const { data: existingMemberships, error: membershipError } = await supabase
      .from('list_members')
      .select('id, list_id')
      .eq('user_id', uid)
      .limit(1)

    if (membershipError) throw membershipError
    if (existingMemberships && existingMemberships.length > 0) return

    const { data: newList, error: listError } = await supabase
      .from('lists')
      .insert({
        name: 'My Tasks',
        owner_id: uid,
      })
      .select()
      .single()

    if (listError) throw listError

    const { error: memberError } = await supabase.from('list_members').insert({
      list_id: newList.id,
      user_id: uid,
      role: 'owner',
    })

    if (memberError) throw memberError

    const { error: backfillError } = await supabase
      .from('tasks')
      .update({ list_id: newList.id })
      .eq('user_id', uid)
      .is('list_id', null)

    if (backfillError) throw backfillError
  }

  async function loadLists(uid?: string) {
    const actualUserId = uid || userId
    if (!actualUserId) return

    const { data: memberships, error: membershipError } = await supabase
      .from('list_members')
      .select(`
        list_id,
        role,
        lists (
          id,
          name,
          owner_id,
          created_at
        )
      `)
      .eq('user_id', actualUserId)

    if (membershipError) throw membershipError

    const loadedLists = (memberships || [])
      .map((m: any) => m.lists)
      .filter(Boolean) as ListRow[]

    setLists(loadedLists)

    setSelectedListId((current) => {
      if (current && loadedLists.some((l) => l.id === current)) return current
      return loadedLists?.[0]?.id || ''
    })
  }

  async function loadTasks(listId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('list_id', listId)
      .order('is_complete', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      return
    }

    setTasks(data || [])
  }

  async function loadMembers(listId: string) {
    const { data, error } = await supabase
      .from('list_members')
      .select(`
        *,
        profiles (
          email
        )
      `)
      .eq('list_id', listId)
      .order('created_at', { ascending: true })

    if (error) {
      setError(error.message)
      return
    }

    setMembers((data as MemberRow[]) || [])
  }

  async function createList() {
    try {
      if (!userId) return
      if (!newListName.trim()) return

      setError('')
      setMessage('')

      const { data: list, error: listError } = await supabase
        .from('lists')
        .insert({
          name: newListName.trim(),
          owner_id: userId,
        })
        .select()
        .single()

      if (listError) throw listError

      const { error: memberError } = await supabase.from('list_members').insert({
        list_id: list.id,
        user_id: userId,
        role: 'owner',
      })

      if (memberError) throw memberError

      setNewListName('')
      await loadLists()
      setSelectedListId(list.id)
      setMessage('List created')
    } catch (e: any) {
      setError(e.message || 'Failed to create list')
    }
  }

  async function addTask() {
    try {
      if (!userId) return
      if (!selectedListId) {
        setError('Select a list first')
        return
      }
      if (!newTaskTitle.trim()) return

      setError('')
      setMessage('')

      const reminderValue =
        newTaskDueDate && newTaskReminder !== ''
          ? Number(newTaskReminder)
          : null

      const payload = {
        title: newTaskTitle.trim(),
        is_complete: false,
        user_id: userId,
        list_id: selectedListId,
        due_date: newTaskDueDate || null,
        priority: newTaskPriority || 'medium',
        reminder_minutes: reminderValue,
      }

      const { error } = await supabase.from('tasks').insert(payload)
      if (error) throw error

      setNewTaskTitle('')
      setNewTaskDueDate('')
      setNewTaskPriority('medium')
      setNewTaskReminder('60')
      await loadTasks(selectedListId)
      setMessage('Task added')
    } catch (e: any) {
      setError(e.message || 'Failed to add task')
    }
  }

  async function toggleTask(task: TaskRow) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ is_complete: !task.is_complete })
        .eq('id', task.id)

      if (error) throw error
      await loadTasks(selectedListId)
    } catch (e: any) {
      setError(e.message || 'Failed to update task')
    }
  }

  function startEdit(task: TaskRow) {
    setEditingTaskId(task.id)
    setExpandedTaskId(task.id)
    setEditTitle(task.title)
    setEditDueDate(task.due_date || '')
    setEditPriority(task.priority || 'medium')
    setEditReminder(
      task.reminder_minutes == null ? '60' : String(task.reminder_minutes)
    )
  }

  function cancelEdit() {
    setEditingTaskId(null)
    setEditTitle('')
    setEditDueDate('')
    setEditPriority('medium')
    setEditReminder('60')
  }

  async function saveEdit(taskId: string) {
    try {
      const reminderValue =
        editDueDate && editReminder !== '' ? Number(editReminder) : null

      const { error } = await supabase
        .from('tasks')
        .update({
          title: editTitle.trim(),
          due_date: editDueDate || null,
          priority: editPriority || 'medium',
          reminder_minutes: reminderValue,
        })
        .eq('id', taskId)

      if (error) throw error

      cancelEdit()
      await loadTasks(selectedListId)
      setMessage('Task updated')
    } catch (e: any) {
      setError(e.message || 'Failed to save task')
    }
  }

  async function deleteTask(taskId: string) {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) throw error

      if (expandedTaskId === taskId) setExpandedTaskId(null)
      if (editingTaskId === taskId) cancelEdit()

      await loadTasks(selectedListId)
      setMessage('Task deleted')
    } catch (e: any) {
      setError(e.message || 'Failed to delete task')
    }
  }

  async function inviteMember() {
    try {
      if (!selectedListId) return
      if (!inviteEmail.trim()) return

      setError('')
      setMessage('')

      const normalized = inviteEmail.trim().toLowerCase()

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', normalized)
        .single()

      if (profileError || !profile) {
        throw new Error('That user must sign in once before you can invite them.')
      }

      const { error: insertError } = await supabase.from('list_members').insert({
        list_id: selectedListId,
        user_id: profile.id,
        role: 'editor',
      })

      if (insertError) {
        if (insertError.message.toLowerCase().includes('duplicate')) {
          throw new Error('That user is already in this list.')
        }
        throw insertError
      }

      setInviteEmail('')
      await loadMembers(selectedListId)
      setMessage(`Invited ${normalized}`)
    } catch (e: any) {
      setError(e.message || 'Failed to invite member')
    }
  }

  async function removeMember(member: MemberRow) {
    try {
      const currentList = lists.find((l) => l.id === selectedListId)
      if (!currentList) return

      if (member.user_id === currentList.owner_id) {
        setError('You cannot remove the owner.')
        return
      }

      const { error } = await supabase
        .from('list_members')
        .delete()
        .eq('id', member.id)

      if (error) throw error

      await loadMembers(selectedListId)
      setMessage('Member removed')
    } catch (e: any) {
      setError(e.message || 'Failed to remove member')
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  function toggleExpanded(taskId: string) {
    setExpandedTaskId((current) => (current === taskId ? null : taskId))
  }

  const selectedList = useMemo(
    () => lists.find((l) => l.id === selectedListId) || null,
    [lists, selectedListId]
  )

  const isOwner = !!selectedList && selectedList.owner_id === userId

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Loading...</div>
      </main>
    )
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div
          style={{
            ...styles.header,
            ...(isMobile ? styles.headerMobile : {}),
          }}
        >
          <div>
            <h1 style={styles.title}>TaskMate</h1>
            <div style={styles.subtle}>Signed in as {userEmail}</div>
          </div>
          <button
            style={{
              ...styles.secondaryButton,
              ...(isMobile ? styles.fullWidthButton : {}),
            }}
            onClick={signOut}
          >
            Sign out
          </button>
        </div>

        {message ? <div style={styles.success}>{message}</div> : null}
        {error ? <div style={styles.error}>{error}</div> : null}

        <div
          style={{
            ...styles.grid,
            ...(isMobile ? styles.gridMobile : {}),
          }}
        >
          <section style={styles.sidebar}>
            <h2 style={styles.sectionTitle}>Your Lists</h2>

            <div style={{ ...styles.row, ...(isMobile ? styles.stackColumn : {}) }}>
              <input
                style={{ ...styles.input, ...(isMobile ? styles.fullWidthInput : {}) }}
                placeholder="New list name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
              <button
                style={{ ...styles.button, ...(isMobile ? styles.fullWidthButton : {}) }}
                onClick={createList}
              >
                Create
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => setSelectedListId(list.id)}
                  style={{
                    ...styles.listButton,
                    ...(selectedListId === list.id ? styles.listButtonActive : {}),
                  }}
                >
                  <div style={styles.listName}>{list.name}</div>
                  <div style={styles.smallText}>
                    {list.owner_id === userId ? 'Owner' : 'Shared with you'}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section style={styles.main}>
            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>
                {selectedList ? `Tasks · ${selectedList.name}` : 'Tasks'}
              </h2>

              <div
                style={{
                  ...styles.taskComposerCompact,
                  ...(isMobile ? styles.taskComposerCompactMobile : {}),
                }}
              >
                <input
                  style={{
                    ...styles.input,
                    flex: isMobile ? undefined : 2,
                    ...(isMobile ? styles.fullWidthInput : {}),
                  }}
                  placeholder="New task..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                />

                <input
                  style={{
                    ...styles.input,
                    ...(isMobile ? styles.fullWidthInput : {}),
                  }}
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                />

                <select
                  style={{
                    ...styles.input,
                    ...(isMobile ? styles.fullWidthInput : {}),
                  }}
                  value={newTaskReminder}
                  onChange={(e) => setNewTaskReminder(e.target.value)}
                >
                  <option value="0">At time</option>
                  <option value="5">5 min before</option>
                  <option value="10">10 min before</option>
                  <option value="15">15 min before</option>
                  <option value="30">30 min before</option>
                  <option value="60">1 hour before</option>
                  <option value="120">2 hours before</option>
                  <option value="1440">1 day before</option>
                  <option value="2880">2 days before</option>
                  <option value="10080">1 week before</option>
                </select>

                <select
                  style={{
                    ...styles.input,
                    ...(isMobile ? styles.fullWidthInput : {}),
                  }}
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>

                <button
                  style={{
                    ...styles.button,
                    ...(isMobile ? styles.fullWidthButton : {}),
                  }}
                  onClick={addTask}
                >
                  Add
                </button>
              </div>

              <div style={{ marginTop: 16 }}>
                {tasks.length === 0 ? (
                  <div style={styles.empty}>No tasks yet.</div>
                ) : (
                  tasks.map((task) => {
                    const isExpanded = expandedTaskId === task.id
                    const isEditing = editingTaskId === task.id

                    return (
                      <div key={task.id} style={styles.taskCompactCard}>
                        <div
                          style={styles.taskCompactHeader}
                          onClick={() => toggleExpanded(task.id)}
                        >
                          <div style={styles.taskLeft}>
                            <input
                              type="checkbox"
                              checked={task.is_complete}
                              onChange={(e) => {
                                e.stopPropagation()
                                toggleTask(task)
                              }}
                              style={styles.checkbox}
                            />
                            <div style={styles.taskTextWrap}>
                              <div
                                style={{
                                  ...styles.taskCompactTitle,
                                  textDecoration: task.is_complete ? 'line-through' : 'none',
                                  opacity: task.is_complete ? 0.6 : 1,
                                }}
                              >
                                {task.title}
                              </div>

                              <div style={styles.taskCompactMeta}>
                                <span style={styles.inlineMeta}>
                                  {task.due_date ? `Due ${task.due_date}` : 'No due date'}
                                </span>
                                <span style={styles.inlineMetaDot}>•</span>
                                <span style={styles.inlineMeta}>
                                  {formatReminder(task.reminder_minutes)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div style={styles.expandHint}>{isExpanded ? 'Hide' : 'Open'}</div>
                        </div>

                        {isExpanded ? (
                          <div style={styles.taskExpandedArea}>
                            {isEditing ? (
                              <div style={styles.editBlock}>
                                <input
                                  style={styles.input}
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                />

                                <input
                                  style={styles.input}
                                  type="date"
                                  value={editDueDate}
                                  onChange={(e) => setEditDueDate(e.target.value)}
                                />

                                <select
                                  style={styles.input}
                                  value={editReminder}
                                  onChange={(e) => setEditReminder(e.target.value)}
                                >
                                  <option value="0">At time</option>
                                  <option value="5">5 min before</option>
                                  <option value="10">10 min before</option>
                                  <option value="15">15 min before</option>
                                  <option value="30">30 min before</option>
                                  <option value="60">1 hour before</option>
                                  <option value="120">2 hours before</option>
                                  <option value="1440">1 day before</option>
                                  <option value="2880">2 days before</option>
                                  <option value="10080">1 week before</option>
                                </select>

                                <select
                                  style={styles.input}
                                  value={editPriority}
                                  onChange={(e) => setEditPriority(e.target.value)}
                                >
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                </select>

                                <div
                                  style={{
                                    ...styles.row,
                                    ...(isMobile ? styles.stackColumn : {}),
                                  }}
                                >
                                  <button
                                    style={{
                                      ...styles.button,
                                      ...(isMobile ? styles.fullWidthButton : {}),
                                    }}
                                    onClick={() => saveEdit(task.id)}
                                  >
                                    Save
                                  </button>
                                  <button
                                    style={{
                                      ...styles.secondaryButton,
                                      ...(isMobile ? styles.fullWidthButton : {}),
                                    }}
                                    onClick={cancelEdit}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div style={styles.compactBadges}>
                                  <span style={styles.metaPill}>
                                    Priority: {task.priority || 'medium'}
                                  </span>
                                  <span style={styles.metaPill}>
                                    Reminder: {formatReminder(task.reminder_minutes)}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    ...styles.row,
                                    ...(isMobile ? styles.stackColumn : {}),
                                    marginTop: 12,
                                  }}
                                >
                                  <button
                                    style={{
                                      ...styles.secondaryButton,
                                      ...(isMobile ? styles.fullWidthButton : {}),
                                    }}
                                    onClick={() => startEdit(task)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    style={{
                                      ...styles.dangerButton,
                                      ...(isMobile ? styles.fullWidthButton : {}),
                                    }}
                                    onClick={() => deleteTask(task.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>Members / Invite</h2>

              {isOwner ? (
                <div style={{ ...styles.row, ...(isMobile ? styles.stackColumn : {}) }}>
                  <input
                    style={{
                      ...styles.input,
                      flex: isMobile ? undefined : 1,
                      ...(isMobile ? styles.fullWidthInput : {}),
                    }}
                    placeholder="Invite by email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <button
                    style={{
                      ...styles.button,
                      ...(isMobile ? styles.fullWidthButton : {}),
                    }}
                    onClick={inviteMember}
                  >
                    Invite
                  </button>
                </div>
              ) : (
                <div style={styles.subtle}>Only the list owner can invite members.</div>
              )}

              <div style={{ marginTop: 12 }}>
                {members.map((member) => (
                  <div
                    key={member.id}
                    style={{
                      ...styles.memberRow,
                      ...(isMobile ? styles.memberRowMobile : {}),
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {member.profiles?.email || member.user_id}
                      </div>
                      <div style={styles.smallText}>{member.role}</div>
                    </div>

                    {isOwner && member.role !== 'owner' ? (
                      <button
                        style={{
                          ...styles.dangerButton,
                          ...(isMobile ? styles.fullWidthButton : {}),
                        }}
                        onClick={() => removeMember(member)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#eef2f7',
    padding: '16px',
    fontFamily: 'Arial, sans-serif',
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  headerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 700,
    color: '#111827',
  },
  subtle: {
    color: '#374151',
    fontSize: 14,
    marginTop: 4,
    wordBreak: 'break-word',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: 20,
  },
  gridMobile: {
    gridTemplateColumns: '1fr',
  },
  sidebar: {
    background: '#ffffff',
    borderRadius: 14,
    padding: 16,
    border: '1px solid #d1d5db',
  },
  main: {
    display: 'grid',
    gap: 20,
  },
  panel: {
    background: '#ffffff',
    borderRadius: 14,
    padding: 18,
    border: '1px solid #d1d5db',
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: 700,
    color: '#111827',
  },
  row: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  stackColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  input: {
    padding: '12px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    fontSize: 16,
    background: '#fff',
    color: '#111827',
    minWidth: 0,
  },
  fullWidthInput: {
    width: '100%',
  },
  button: {
    padding: '12px 16px',
    borderRadius: 10,
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 16,
  },
  secondaryButton: {
    padding: '12px 16px',
    borderRadius: 10,
    background: '#fff',
    border: '1px solid #cbd5e1',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 16,
    color: '#111827',
  },
  dangerButton: {
    padding: '12px 16px',
    borderRadius: 10,
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 16,
  },
  fullWidthButton: {
    width: '100%',
    justifyContent: 'center',
  },
  listButton: {
    width: '100%',
    textAlign: 'left',
    border: '1px solid #d1d5db',
    borderRadius: 12,
    padding: 14,
    background: '#fff',
    cursor: 'pointer',
    marginBottom: 10,
    color: '#111827',
  },
  listButtonActive: {
    border: '2px solid #2563eb',
    background: '#eff6ff',
  },
  listName: {
    fontWeight: 700,
    fontSize: 16,
    color: '#111827',
  },
  taskComposerCompact: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
    gap: 8,
    alignItems: 'center',
  },
  taskComposerCompactMobile: {
    gridTemplateColumns: '1fr',
  },
  taskCompactCard: {
    border: '1px solid #d1d5db',
    borderRadius: 14,
    padding: 12,
    background: '#ffffff',
    marginBottom: 10,
  },
  taskCompactHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    cursor: 'pointer',
  },
  taskLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  checkbox: {
    marginTop: 4,
    width: 20,
    height: 20,
    flexShrink: 0,
  },
  taskTextWrap: {
    minWidth: 0,
    flex: 1,
  },
  taskCompactTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#111827',
    lineHeight: 1.3,
    wordBreak: 'break-word',
  },
  taskCompactMeta: {
    marginTop: 6,
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    color: '#6b7280',
    fontSize: 14,
  },
  inlineMeta: {
    color: '#6b7280',
  },
  inlineMetaDot: {
    color: '#9ca3af',
  },
  expandHint: {
    fontSize: 12,
    fontWeight: 700,
    color: '#2563eb',
    flexShrink: 0,
    paddingTop: 4,
  },
  taskExpandedArea: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: '1px solid #e5e7eb',
  },
  compactBadges: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaPill: {
    fontSize: 12,
    background: '#e5e7eb',
    borderRadius: 999,
    padding: '6px 10px',
    color: '#111827',
    fontWeight: 600,
  },
  memberRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    border: '1px solid #d1d5db',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    background: '#fff',
  },
  memberRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  smallText: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 4,
  },
  success: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    background: '#dcfce7',
    color: '#166534',
    fontWeight: 600,
  },
  error: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    background: '#fee2e2',
    color: '#991b1b',
    fontWeight: 600,
  },
  empty: {
    color: '#4b5563',
    padding: '12px 0',
  },
  editBlock: {
    display: 'grid',
    gap: 8,
  },
  card: {
    maxWidth: 500,
    margin: '80px auto',
    background: '#ffffff',
    padding: 20,
    borderRadius: 14,
    border: '1px solid #d1d5db',
  },
}
