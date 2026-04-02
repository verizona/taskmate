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

  const [inviteEmail, setInviteEmail] = useState('')

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editPriority, setEditPriority] = useState('medium')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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

      const payload = {
        title: newTaskTitle.trim(),
        is_complete: false,
        user_id: userId,
        list_id: selectedListId,
        due_date: newTaskDueDate || null,
        priority: newTaskPriority || 'medium',
      }

      const { error } = await supabase.from('tasks').insert(payload)
      if (error) throw error

      setNewTaskTitle('')
      setNewTaskDueDate('')
      setNewTaskPriority('medium')
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
    setEditTitle(task.title)
    setEditDueDate(task.due_date || '')
    setEditPriority(task.priority || 'medium')
  }

  function cancelEdit() {
    setEditingTaskId(null)
    setEditTitle('')
    setEditDueDate('')
    setEditPriority('medium')
  }

  async function saveEdit(taskId: string) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editTitle.trim(),
          due_date: editDueDate || null,
          priority: editPriority || 'medium',
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
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>TaskMate</h1>
            <div style={styles.subtle}>Signed in as {userEmail}</div>
          </div>
          <button style={styles.secondaryButton} onClick={signOut}>
            Sign out
          </button>
        </div>

        {message ? <div style={styles.success}>{message}</div> : null}
        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={styles.grid}>
          <section style={styles.sidebar}>
            <h2 style={styles.sectionTitle}>Your Lists</h2>

            <div style={styles.row}>
              <input
                style={styles.input}
                placeholder="New list name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
              <button style={styles.button} onClick={createList}>
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
                  <div style={{ fontWeight: 600 }}>{list.name}</div>
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

              <div style={styles.taskComposer}>
                <input
                  style={{ ...styles.input, flex: 2 }}
                  placeholder="New task..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                />
                <input
                  style={styles.input}
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                />
                <select
                  style={styles.input}
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <button style={styles.button} onClick={addTask}>
                  Add
                </button>
              </div>

              <div style={{ marginTop: 14 }}>
                {tasks.length === 0 ? (
                  <div style={styles.empty}>No tasks yet.</div>
                ) : (
                  tasks.map((task) => (
                    <div key={task.id} style={styles.taskCard}>
                      {editingTaskId === task.id ? (
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
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value)}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                          <div style={styles.row}>
                            <button style={styles.button} onClick={() => saveEdit(task.id)}>
                              Save
                            </button>
                            <button style={styles.secondaryButton} onClick={cancelEdit}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={styles.taskTop}>
                            <label style={styles.checkboxRow}>
                              <input
                                type="checkbox"
                                checked={task.is_complete}
                                onChange={() => toggleTask(task)}
                              />
                              <span
                                style={{
                                  ...styles.taskTitle,
                                  textDecoration: task.is_complete ? 'line-through' : 'none',
                                  opacity: task.is_complete ? 0.65 : 1,
                                }}
                              >
                                {task.title}
                              </span>
                            </label>

                            <div style={styles.row}>
                              <button
                                style={styles.secondaryButton}
                                onClick={() => startEdit(task)}
                              >
                                Edit
                              </button>
                              <button
                                style={styles.dangerButton}
                                onClick={() => deleteTask(task.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          <div style={styles.metaRow}>
                            <span style={styles.metaPill}>
                              Priority: {task.priority || 'medium'}
                            </span>
                            <span style={styles.metaPill}>
                              Due: {task.due_date || '—'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>Members / Invite</h2>

              {isOwner ? (
                <div style={styles.row}>
                  <input
                    style={{ ...styles.input, flex: 1 }}
                    placeholder="Invite by email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <button style={styles.button} onClick={inviteMember}>
                    Invite
                  </button>
                </div>
              ) : (
                <div style={styles.subtle}>Only the list owner can invite members.</div>
              )}

              <div style={{ marginTop: 12 }}>
                {members.map((member) => (
                  <div key={member.id} style={styles.memberRow}>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {member.profiles?.email || member.user_id}
                      </div>
                      <div style={styles.smallText}>{member.role}</div>
                    </div>

                    {isOwner && member.role !== 'owner' ? (
                      <button
                        style={styles.dangerButton}
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
    background: '#f4f7fb',
    padding: '24px',
    fontFamily: 'Arial, sans-serif',
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 32,
  },
  subtle: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: 20,
  },
  sidebar: {
    background: '#fff',
    borderRadius: 14,
    padding: 16,
    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
    height: 'fit-content',
  },
  main: {
    display: 'grid',
    gap: 20,
  },
  panel: {
    background: '#fff',
    borderRadius: 14,
    padding: 16,
    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 12,
    fontSize: 20,
  },
  row: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d0d7e2',
    borderRadius: 10,
    fontSize: 14,
    background: '#fff',
  },
  button: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 10,
    background: '#111827',
    color: '#fff',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '10px 14px',
    border: '1px solid #d0d7e2',
    borderRadius: 10,
    background: '#fff',
    color: '#111827',
    cursor: 'pointer',
  },
  dangerButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 10,
    background: '#dc2626',
    color: '#fff',
    cursor: 'pointer',
  },
  listButton: {
    width: '100%',
    textAlign: 'left',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 12,
    background: '#fff',
    cursor: 'pointer',
    marginBottom: 8,
  },
  listButtonActive: {
    border: '1px solid #111827',
    background: '#f9fafb',
  },
  taskComposer: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  taskCard: {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    background: '#fff',
  },
  taskTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: 600,
  },
  metaRow: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  metaPill: {
    fontSize: 12,
    background: '#f3f4f6',
    borderRadius: 999,
    padding: '6px 10px',
  },
  memberRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  smallText: {
    fontSize: 12,
    color: '#666',
  },
  success: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    background: '#ecfdf5',
    color: '#065f46',
  },
  error: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    background: '#fef2f2',
    color: '#991b1b',
  },
  empty: {
    color: '#666',
    padding: '12px 0',
  },
  editBlock: {
    display: 'grid',
    gap: 8,
  },
  card: {
    maxWidth: 500,
    margin: '80px auto',
    background: '#fff',
    padding: 20,
    borderRadius: 14,
    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
  },
}
