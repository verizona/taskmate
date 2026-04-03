'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';

type ListRow = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

type TaskRow = {
  id: string;
  title: string;
  is_complete: boolean;
  user_id: string | null;
  list_id: string | null;
  due_date: string | null;
  due_time?: string | null;
  priority: string | null;
  reminder_minutes: number | null;
  notes?: string | null;
  created_at?: string;
};

type MemberRow = {
  id: string;
  list_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'member';
  created_at: string;
  profiles?: {
    email: string | null;
  } | null;
};

type Screen = 'home' | 'today' | 'all' | 'completed' | 'list';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= breakpoint);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [breakpoint]);

  return isMobile;
}

function todayYMD() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatReminder(minutes: number | null | undefined) {
  if (minutes == null) return 'No reminder';
  if (minutes === 0) return 'At time';
  if (minutes === 5) return '5 min before';
  if (minutes === 10) return '10 min before';
  if (minutes === 15) return '15 min before';
  if (minutes === 30) return '30 min before';
  if (minutes === 60) return '1 hour before';
  if (minutes === 120) return '2 hours before';
  if (minutes === 1440) return '1 day before';
  if (minutes === 2880) return '2 days before';
  if (minutes === 10080) return '1 week before';
  return `${minutes} min before`;
}

function formatTaskDate(dateString: string | null | undefined, timeString?: string | null) {
  if (!dateString) return '';
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  const datePart = date.toLocaleDateString();
  if (!timeString) return datePart;

  const [hh, mm] = timeString.split(':');
  if (hh == null || mm == null) return datePart;

  const temp = new Date();
  temp.setHours(Number(hh), Number(mm), 0, 0);

  const timePart = temp.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${datePart}, ${timePart}`;
}

function isOverdue(task: TaskRow) {
  if (task.is_complete || !task.due_date) return false;
  const now = new Date();
  const due = new Date(`${task.due_date}T${task.due_time || '23:59'}:00`);
  return due.getTime() < now.getTime();
}

export default function DashboardPage() {
  const isMobile = useIsMobile();
  const bootstrappedRef = useRef(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [lists, setLists] = useState<ListRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);

  const [selectedListId, setSelectedListId] = useState<string>('');
  const [screen, setScreen] = useState<Screen>('home');

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newListName, setNewListName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editListName, setEditListName] = useState('');

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskDateEnabled, setNewTaskDateEnabled] = useState(true);
  const [newTaskTimeEnabled, setNewTaskTimeEnabled] = useState(false);
  const [newTaskDueDate, setNewTaskDueDate] = useState(todayYMD());
  const [newTaskDueTime, setNewTaskDueTime] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskReminder, setNewTaskReminder] = useState('60');
  const [newTaskListId, setNewTaskListId] = useState('');

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDateEnabled, setEditDateEnabled] = useState(true);
  const [editTimeEnabled, setEditTimeEnabled] = useState(false);
  const [editDueDate, setEditDueDate] = useState('');
  const [editDueTime, setEditDueTime] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [editReminder, setEditReminder] = useState('60');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deletingList, setDeletingList] = useState(false);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      if (bootstrappedRef.current) return;
      bootstrappedRef.current = true;

      try {
        setLoading(true);
        setError('');
        setMessage('');

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          if (mounted) {
            window.location.href = '/';
          }
          return;
        }

        await initializeDashboard(user.id, user.email ?? '', {
          fullName:
            (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            '',
          avatarUrl:
            (user.user_metadata?.avatar_url as string | undefined) ||
            (user.user_metadata?.picture as string | undefined) ||
            '',
        });
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || 'Failed to load dashboard');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        window.location.href = '/';
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        try {
          setLoading(true);
          await initializeDashboard(session.user.id, session.user.email ?? '', {
            fullName:
              (session.user.user_metadata?.full_name as string | undefined) ||
              (session.user.user_metadata?.name as string | undefined) ||
              '',
            avatarUrl:
              (session.user.user_metadata?.avatar_url as string | undefined) ||
              (session.user.user_metadata?.picture as string | undefined) ||
              '',
          });
        } catch (e: any) {
          setError(e?.message || 'Failed to refresh dashboard');
        } finally {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedListId) {
      loadMembers(selectedListId);
    } else {
      setMembers([]);
    }
  }, [selectedListId]);

  async function initializeDashboard(
    uid: string,
    email: string,
    meta?: { fullName?: string; avatarUrl?: string }
  ) {
    setUserId(uid);
    setUserEmail(email);

    await ensureProfile(uid, email, meta?.fullName || '', meta?.avatarUrl || '');
    await ensurePersonalList(uid);
    await loadLists(uid);
    await loadAllTasks(uid);
  }

  async function ensureProfile(uid: string, email: string, fullName = '', avatarUrl = '') {
    const payload = {
      id: uid,
      email,
      full_name: fullName || null,
      avatar_url: avatarUrl || null,
    };

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }

  async function ensurePersonalList(uid: string) {
    const { data: ownedLists, error: ownedListsError } = await supabase
      .from('lists')
      .select('id, name')
      .eq('owner_id', uid)
      .limit(1);

    if (ownedListsError) throw ownedListsError;
    if (ownedLists && ownedLists.length > 0) return;

    const { data: insertedList, error: listError } = await supabase
      .from('lists')
      .insert({
        name: 'Personal',
        owner_id: uid,
      })
      .select('id, name, owner_id, created_at')
      .single();

    if (listError) throw listError;
    if (!insertedList?.id) {
      throw new Error('Failed to create personal list');
    }

    const { error: memberError } = await supabase.from('list_members').insert({
      list_id: insertedList.id,
      user_id: uid,
      role: 'owner',
    });

    if (memberError) throw memberError;

    // Best effort only. Do not break dashboard load if old orphan tasks exist and RLS blocks the update.
    const { error: backfillError } = await supabase
      .from('tasks')
      .update({ list_id: insertedList.id })
      .eq('user_id', uid)
      .is('list_id', null);

    if (backfillError) {
      console.warn('Task backfill skipped:', backfillError.message);
    }
  }

  async function loadLists(uid?: string) {
    const actualUserId = uid || userId;
    if (!actualUserId) return;

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
      .eq('user_id', actualUserId);

    if (membershipError) throw membershipError;

    const loadedLists = ((memberships || [])
      .map((m: any) => m.lists)
      .filter(Boolean) as ListRow[]).filter(
      (list, index, arr) => arr.findIndex((x) => x.id === list.id) === index
    );

    loadedLists.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return aTime - bTime;
    });

    setLists(loadedLists);

    setSelectedListId((current) => {
      const stillExists = current && loadedLists.some((l) => l.id === current);
      const nextId = stillExists ? current : loadedLists[0]?.id || '';
      setNewTaskListId((prev) => prev || nextId);
      return nextId;
    });
  }

  async function loadAllTasks(uid?: string) {
    const actualUserId = uid || userId;
    if (!actualUserId) return;

    const { data: memberships, error: membershipError } = await supabase
      .from('list_members')
      .select('list_id')
      .eq('user_id', actualUserId);

    if (membershipError) throw membershipError;

    const ids = (memberships || []).map((m) => m.list_id);
    if (!ids.length) {
      setTasks([]);
      return;
    }

    const { data, error } = await supabase
      .from('tasks')
      .select(
        'id, title, is_complete, user_id, list_id, due_date, due_time, priority, reminder_minutes, notes, created_at'
      )
      .in('list_id', ids)
      .order('is_complete', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    setTasks((data || []) as TaskRow[]);
  }

  async function loadMembers(listId: string) {
    const { data, error } = await supabase
      .from('list_members')
      .select(`
        id,
        created_at,
        list_id,
        user_id,
        role,
        profiles (
          email
        )
      `)
      .eq('list_id', listId)
      .order('created_at', { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setMembers((data as MemberRow[]) || []);
  }

  async function createList() {
    try {
      if (!userId) return;
      if (!newListName.trim()) {
        setError('List name is required.');
        return;
      }

      setError('');
      setMessage('');

      const { data: list, error: listError } = await supabase
        .from('lists')
        .insert({
          name: newListName.trim(),
          owner_id: userId,
        })
        .select('id, name, owner_id, created_at')
        .single();

      if (listError) throw listError;

      const { error: memberError } = await supabase.from('list_members').insert({
        list_id: list.id,
        user_id: userId,
        role: 'owner',
      });

      if (memberError) throw memberError;

      setNewListName('');
      await loadLists();
      await loadAllTasks();
      setSelectedListId(list.id);
      setScreen('list');
      setMessage('List created');
    } catch (e: any) {
      setError(e.message || 'Failed to create list');
    }
  }

  function startEditList(list: ListRow) {
    setEditingListId(list.id);
    setEditListName(list.name);
  }

  function cancelEditList() {
    setEditingListId(null);
    setEditListName('');
  }

  async function saveEditList() {
    try {
      if (!editingListId) return;
      if (!editListName.trim()) {
        setError('List name is required.');
        return;
      }

      setError('');
      setMessage('');

      const { error } = await supabase
        .from('lists')
        .update({ name: editListName.trim() })
        .eq('id', editingListId);

      if (error) throw error;

      await loadLists();
      cancelEditList();
      setMessage('List updated');
    } catch (e: any) {
      setError(e.message || 'Failed to update list');
    }
  }

  async function addTask() {
    try {
      if (!userId) return;
      if (!newTaskTitle.trim()) {
        setError('Title is required.');
        return;
      }
      if (!newTaskListId) {
        setError('Select a list.');
        return;
      }

      setError('');
      setMessage('');

      const dueDate = newTaskDateEnabled ? newTaskDueDate || null : null;
      const dueTime = newTaskDateEnabled && newTaskTimeEnabled ? newTaskDueTime || null : null;
      const reminderValue = dueDate ? Number(newTaskReminder) : null;

      const payload = {
        title: newTaskTitle.trim(),
        notes: newTaskNotes.trim() || null,
        is_complete: false,
        user_id: userId,
        list_id: newTaskListId,
        due_date: dueDate,
        due_time: dueTime,
        priority: newTaskPriority || 'medium',
        reminder_minutes: reminderValue,
      };

      const { error } = await supabase.from('tasks').insert(payload);
      if (error) throw error;

      resetCreateForm();
      setShowCreateModal(false);
      await loadAllTasks();
      setSelectedListId(newTaskListId);
      setScreen('list');
      setMessage('Task added');
    } catch (e: any) {
      setError(e.message || 'Failed to add task');
    }
  }

  function resetCreateForm() {
    setNewTaskTitle('');
    setNewTaskNotes('');
    setNewTaskDateEnabled(true);
    setNewTaskTimeEnabled(false);
    setNewTaskDueDate(todayYMD());
    setNewTaskDueTime('');
    setNewTaskPriority('medium');
    setNewTaskReminder('60');
    setNewTaskListId(selectedListId || lists[0]?.id || '');
  }

  async function toggleTask(task: TaskRow) {
    try {
      const nextComplete = !task.is_complete;

      const { error } = await supabase
        .from('tasks')
        .update({
          is_complete: nextComplete,
          completed_at: nextComplete ? new Date().toISOString() : null,
        })
        .eq('id', task.id);

      if (error) throw error;

      if (expandedTaskId === task.id) setExpandedTaskId(null);
      if (editingTaskId === task.id) cancelEdit();

      await loadAllTasks();
      setMessage(nextComplete ? 'Task completed' : 'Task reopened');
    } catch (e: any) {
      setError(e.message || 'Failed to update task');
    }
  }

  function startEdit(task: TaskRow) {
    setEditingTaskId(task.id);
    setExpandedTaskId(task.id);
    setEditTitle(task.title);
    setEditNotes(task.notes || '');
    setEditDateEnabled(!!task.due_date);
    setEditTimeEnabled(!!task.due_time);
    setEditDueDate(task.due_date || todayYMD());
    setEditDueTime(task.due_time || '');
    setEditPriority(task.priority || 'medium');
    setEditReminder(task.reminder_minutes == null ? '60' : String(task.reminder_minutes));
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setEditTitle('');
    setEditNotes('');
    setEditDateEnabled(true);
    setEditTimeEnabled(false);
    setEditDueDate(todayYMD());
    setEditDueTime('');
    setEditPriority('medium');
    setEditReminder('60');
  }

  async function saveEdit(taskId: string) {
    try {
      if (!editTitle.trim()) {
        setError('Title is required.');
        return;
      }

      const dueDate = editDateEnabled ? editDueDate || null : null;
      const dueTime = editDateEnabled && editTimeEnabled ? editDueTime || null : null;
      const reminderValue = dueDate ? Number(editReminder) : null;

      const { error } = await supabase
        .from('tasks')
        .update({
          title: editTitle.trim(),
          notes: editNotes.trim() || null,
          due_date: dueDate,
          due_time: dueTime,
          priority: editPriority || 'medium',
          reminder_minutes: reminderValue,
        })
        .eq('id', taskId);

      if (error) throw error;

      cancelEdit();
      await loadAllTasks();
      setMessage('Task updated');
    } catch (e: any) {
      setError(e.message || 'Failed to save task');
    }
  }

  async function deleteTask(taskId: string) {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;

      if (expandedTaskId === taskId) setExpandedTaskId(null);
      if (editingTaskId === taskId) cancelEdit();

      await loadAllTasks();
      setMessage('Task deleted');
    } catch (e: any) {
      setError(e.message || 'Failed to delete task');
    }
  }

  async function inviteMember() {
    try {
      if (!selectedListId) return;
      if (!inviteEmail.trim()) {
        setError('Email is required.');
        return;
      }

      setError('');
      setMessage('');

      const normalized = inviteEmail.trim().toLowerCase();

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', normalized)
        .single();

      if (profileError || !profile) {
        throw new Error('That user must sign in once before you can invite them.');
      }

      const { data: existingMember, error: existingMemberError } = await supabase
        .from('list_members')
        .select('id')
        .eq('list_id', selectedListId)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existingMemberError) throw existingMemberError;
      if (existingMember) {
        throw new Error('That user is already in this list.');
      }

      const { error: insertError } = await supabase.from('list_members').insert({
        list_id: selectedListId,
        user_id: profile.id,
        role: 'editor',
      });

      if (insertError) throw insertError;

      setInviteEmail('');
      await loadMembers(selectedListId);
      await loadLists();
      setMessage(`Invited ${normalized}`);
    } catch (e: any) {
      setError(e.message || 'Failed to invite member');
    }
  }

  async function removeMember(member: MemberRow) {
    try {
      const currentList = lists.find((l) => l.id === selectedListId);
      if (!currentList) return;

      if (member.user_id === currentList.owner_id) {
        setError('You cannot remove the owner.');
        return;
      }

      const { error } = await supabase.from('list_members').delete().eq('id', member.id);

      if (error) throw error;

      await loadMembers(selectedListId);
      setMessage('Member removed');
    } catch (e: any) {
      setError(e.message || 'Failed to remove member');
    }
  }

  async function leaveCurrentList() {
    try {
      if (!userId || !selectedListId) return;

      const currentList = lists.find((l) => l.id === selectedListId);
      if (!currentList) return;

      if (currentList.owner_id === userId) {
        setError('Owners cannot leave their own list. Delete it instead.');
        return;
      }

      setError('');
      setMessage('');

      const { error } = await supabase
        .from('list_members')
        .delete()
        .eq('list_id', selectedListId)
        .eq('user_id', userId);

      if (error) throw error;

      await loadLists();
      await loadAllTasks();
      setScreen('home');
      setMessage('You left the list');
    } catch (e: any) {
      setError(e.message || 'Failed to leave list');
    }
  }

  async function deleteCurrentList() {
    try {
      if (!selectedListId || !userId) return;

      const currentList = lists.find((l) => l.id === selectedListId);
      if (!currentList) return;

      if (currentList.owner_id !== userId) {
        setError('Only the owner can delete this list.');
        return;
      }

      const ok = window.confirm(
        `Delete list "${currentList.name}"? This will remove its tasks and memberships.`
      );
      if (!ok) return;

      setDeletingList(true);
      setError('');
      setMessage('');

      const { error } = await supabase.from('lists').delete().eq('id', selectedListId);

      if (error) throw error;

      setExpandedTaskId(null);
      setEditingTaskId(null);
      cancelEditList();
      await loadLists();
      await loadAllTasks();
      setScreen('home');
      setMessage('List deleted');
    } catch (e: any) {
      setError(e.message || 'Failed to delete list');
    } finally {
      setDeletingList(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  function openCreateModal(defaultListId?: string) {
    setNewTaskListId(defaultListId || selectedListId || lists[0]?.id || '');
    setShowCreateModal(true);
  }

  function toggleExpanded(taskId: string) {
    setExpandedTaskId((current) => (current === taskId ? null : taskId));
  }

  function goBackHome() {
    setScreen('home');
    setExpandedTaskId(null);
    setEditingTaskId(null);
    cancelEditList();
  }

  const selectedList = useMemo(
    () => lists.find((l) => l.id === selectedListId) || null,
    [lists, selectedListId]
  );

  const currentUserMembership = useMemo(
    () => members.find((m) => m.user_id === userId) || null,
    [members, userId]
  );

  const activeTasks = useMemo(() => tasks.filter((t) => !t.is_complete), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.is_complete), [tasks]);

  const todayTasks = useMemo(
    () => activeTasks.filter((t) => t.due_date === todayYMD()),
    [activeTasks]
  );

  const listCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of activeTasks) {
      if (!t.list_id) continue;
      map[t.list_id] = (map[t.list_id] || 0) + 1;
    }
    return map;
  }, [activeTasks]);

  const tasksByList = useMemo(() => {
    const source =
      screen === 'today'
        ? todayTasks
        : screen === 'completed'
          ? completedTasks
          : activeTasks;

    const grouped: Array<{ list: ListRow; tasks: TaskRow[] }> = [];

    for (const list of lists) {
      const listTasks = source.filter((t) => t.list_id === list.id);

      if (screen === 'all' || screen === 'today' || screen === 'completed') {
        if (listTasks.length) grouped.push({ list, tasks: listTasks });
      } else if (screen === 'list' && selectedListId === list.id) {
        grouped.push({ list, tasks: listTasks });
      }
    }

    return grouped;
  }, [screen, todayTasks, completedTasks, activeTasks, lists, selectedListId]);

  const homeListRows = useMemo(
    () =>
      lists.map((list) => ({
        ...list,
        count: listCounts[list.id] || 0,
      })),
    [lists, listCounts]
  );

  const isOwner = !!selectedList && selectedList.owner_id === userId;

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingWrap}>Loading...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {message ? <div style={styles.success}>{message}</div> : null}
        {error ? <div style={styles.error}>{error}</div> : null}

        {screen === 'home' ? (
          <>
            <div style={styles.homeHeader}>
              <div>
                <h1 style={styles.appTitle}>TaskMate</h1>
                <div style={styles.subtle}>Signed in as {userEmail}</div>
              </div>
              <button style={styles.ghostButton} onClick={signOut}>
                Sign out
              </button>
            </div>

            <div
              style={{
                ...styles.cardGrid,
                ...(isMobile ? styles.cardGridMobile : {}),
              }}
            >
              <button
                style={{ ...styles.statCard, ...styles.todayCard }}
                onClick={() => setScreen('today')}
              >
                <div style={styles.statCount}>{todayTasks.length}</div>
                <div style={styles.statLabel}>Today</div>
              </button>

              <button
                style={{ ...styles.statCard, ...styles.allCard }}
                onClick={() => setScreen('all')}
              >
                <div style={styles.statCount}>{activeTasks.length}</div>
                <div style={styles.statLabel}>All</div>
              </button>

              <button
                style={{ ...styles.statCard, ...styles.completedCard }}
                onClick={() => setScreen('completed')}
              >
                <div style={styles.statCount}>{completedTasks.length}</div>
                <div style={styles.statLabel}>Completed</div>
              </button>
            </div>

            <div style={styles.homePanel}>
              <div style={styles.sectionRow}>
                <h2 style={styles.sectionTitle}>Lists</h2>
              </div>

              <div style={styles.newListRow}>
                <input
                  style={styles.input}
                  placeholder="New list name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                />
                <button style={styles.secondaryActionButton} onClick={createList}>
                  New List
                </button>
              </div>

              <div style={{ marginTop: 14 }}>
                {homeListRows.length === 0 ? (
                  <div style={styles.empty}>No lists yet.</div>
                ) : (
                  homeListRows.map((list) => (
                    <button
                      key={list.id}
                      style={styles.listRow}
                      onClick={() => {
                        setSelectedListId(list.id);
                        setScreen('list');
                      }}
                    >
                      <div>
                        <div style={styles.listRowTitle}>{list.name}</div>
                        <div style={styles.listRowMeta}>
                          {list.owner_id === userId ? 'Owner' : 'Shared with you'}
                        </div>
                      </div>
                      <div style={styles.listRowCount}>{list.count}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={styles.topBar}>
              <button style={styles.iconCircle} onClick={goBackHome}>
                ‹
              </button>

              <div style={styles.topBarTitleWrap}>
                <div style={styles.topBarSmall}>
                  {screen === 'today'
                    ? 'Today'
                    : screen === 'all'
                      ? 'All'
                      : screen === 'completed'
                        ? 'Completed'
                        : 'List'}
                </div>

                <div style={styles.topBarTitle}>
                  {screen === 'list' && selectedList
                    ? selectedList.name
                    : screen === 'today'
                      ? 'Today'
                      : screen === 'all'
                        ? 'All'
                        : 'Completed'}
                </div>
              </div>

              <button style={styles.ghostButton} onClick={signOut}>
                Sign out
              </button>
            </div>

            {screen === 'list' && selectedList ? (
              <div style={styles.detailActionRow}>
                {isOwner ? (
                  <>
                    <button
                      style={styles.smallDarkButton}
                      onClick={() => startEditList(selectedList)}
                    >
                      Edit List Name
                    </button>

                    <button
                      style={{
                        ...styles.deleteListButton,
                        ...(deletingList ? styles.disabledButton : {}),
                      }}
                      disabled={deletingList}
                      onClick={deleteCurrentList}
                    >
                      {deletingList ? 'Deleting...' : 'Delete List'}
                    </button>
                  </>
                ) : (
                  <button style={styles.secondaryActionButton} onClick={leaveCurrentList}>
                    Leave List
                  </button>
                )}
              </div>
            ) : null}

            {screen === 'list' && selectedList ? (
              <div style={styles.membersPanelDark}>
                <h2 style={styles.membersTitle}>List Details</h2>

                <div style={styles.detailBoxDark}>
                  <div style={styles.detailLabelDark}>List name</div>

                  {editingListId === selectedList.id ? (
                    <div style={styles.inlineEditWrap}>
                      <input
                        style={styles.inputDark}
                        value={editListName}
                        onChange={(e) => setEditListName(e.target.value)}
                        placeholder="List name"
                      />
                      <div
                        style={{
                          ...styles.editButtonRow,
                          ...(isMobile ? styles.editButtonRowMobile : {}),
                          marginTop: 10,
                        }}
                      >
                        <button style={styles.saveButton} onClick={saveEditList}>
                          Save
                        </button>
                        <button style={styles.cancelButton} onClick={cancelEditList}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={styles.inlineDetailRow}>
                      <div style={styles.detailValueDark}>{selectedList.name}</div>
                    </div>
                  )}
                </div>

                <div style={styles.detailBoxDark}>
                  <div style={styles.detailLabelDark}>Your role</div>
                  <div style={styles.detailValueDark}>
                    {currentUserMembership?.role || (isOwner ? 'owner' : 'member')}
                  </div>
                </div>
              </div>
            ) : null}

            <div style={styles.groupWrap}>
              {tasksByList.length === 0 ? (
                <div style={styles.emptyDark}>Nothing here yet.</div>
              ) : (
                tasksByList.map(({ list, tasks: groupTasks }) => (
                  <div key={list.id} style={styles.groupSection}>
                    <div style={styles.groupTitle}>{list.name}</div>

                    {groupTasks.map((task) => {
                      const isExpanded = expandedTaskId === task.id;
                      const isEditing = editingTaskId === task.id;
                      const overdue = isOverdue(task);

                      return (
                        <div key={task.id} style={styles.taskRowWrap}>
                          <div style={styles.taskRow} onClick={() => toggleExpanded(task.id)}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTask(task);
                              }}
                              style={{
                                ...styles.circleButton,
                                ...(task.is_complete ? styles.circleButtonChecked : {}),
                              }}
                            >
                              {task.is_complete ? '✓' : ''}
                            </button>

                            <div style={styles.taskBody}>
                              <div
                                style={{
                                  ...styles.taskTitle,
                                  ...(task.is_complete ? styles.taskTitleDone : {}),
                                }}
                              >
                                {task.title}
                              </div>

                              {task.notes ? <div style={styles.taskNotes}>{task.notes}</div> : null}

                              {task.due_date || task.reminder_minutes != null ? (
                                <div
                                  style={{
                                    ...styles.taskMeta,
                                    ...(overdue ? styles.taskMetaOverdue : {}),
                                  }}
                                >
                                  {task.due_date
                                    ? formatTaskDate(task.due_date, task.due_time)
                                    : 'No due date'}
                                  {task.reminder_minutes != null
                                    ? ` • ${formatReminder(task.reminder_minutes)}`
                                    : ''}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {isExpanded ? (
                            <div style={styles.expandedArea}>
                              {isEditing ? (
                                <div style={styles.editGrid}>
                                  <input
                                    style={styles.inputDark}
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="Title"
                                  />

                                  <textarea
                                    style={styles.textareaDark}
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    placeholder="Notes"
                                  />

                                  <div style={styles.appleRow}>
                                    <div style={styles.appleRowLeft}>
                                      <div style={styles.appleIcon}>🗓️</div>
                                      <div style={styles.appleLabel}>Date</div>
                                    </div>

                                    <label style={styles.switch}>
                                      <input
                                        type="checkbox"
                                        checked={editDateEnabled}
                                        onChange={(e) => setEditDateEnabled(e.target.checked)}
                                        style={{ display: 'none' }}
                                      />
                                      <span
                                        style={{
                                          ...styles.slider,
                                          background: editDateEnabled ? '#34c759' : '#6b7280',
                                        }}
                                      >
                                        <span
                                          style={{
                                            position: 'absolute',
                                            top: 3,
                                            left: editDateEnabled ? 27 : 3,
                                            width: 28,
                                            height: 28,
                                            borderRadius: '50%',
                                            background: '#ffffff',
                                            transition: 'left 0.18s ease',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                                          }}
                                        />
                                      </span>
                                    </label>
                                  </div>

                                  {editDateEnabled ? (
                                    <div style={styles.dateInputWrap}>
                                      <input
                                        style={styles.inputDark}
                                        type="date"
                                        value={editDueDate}
                                        onChange={(e) => setEditDueDate(e.target.value)}
                                      />
                                      <span style={styles.dateIcon}>🗓️</span>
                                    </div>
                                  ) : null}

                                  <div style={styles.appleRow}>
                                    <div style={styles.appleRowLeft}>
                                      <div style={styles.appleIcon}>🕒</div>
                                      <div style={styles.appleLabel}>Time</div>
                                    </div>

                                    <label style={styles.switch}>
                                      <input
                                        type="checkbox"
                                        checked={editTimeEnabled}
                                        onChange={(e) => setEditTimeEnabled(e.target.checked)}
                                        style={{ display: 'none' }}
                                      />
                                      <span
                                        style={{
                                          ...styles.slider,
                                          background: editTimeEnabled ? '#34c759' : '#6b7280',
                                        }}
                                      >
                                        <span
                                          style={{
                                            position: 'absolute',
                                            top: 3,
                                            left: editTimeEnabled ? 27 : 3,
                                            width: 28,
                                            height: 28,
                                            borderRadius: '50%',
                                            background: '#ffffff',
                                            transition: 'left 0.18s ease',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                                          }}
                                        />
                                      </span>
                                    </label>
                                  </div>

                                  {editDateEnabled && editTimeEnabled ? (
                                    <input
                                      style={styles.inputDark}
                                      type="time"
                                      value={editDueTime}
                                      onChange={(e) => setEditDueTime(e.target.value)}
                                    />
                                  ) : null}

                                  {editDateEnabled ? (
                                    <select
                                      style={styles.selectDark}
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
                                  ) : null}

                                  <select
                                    style={styles.selectDark}
                                    value={editPriority}
                                    onChange={(e) => setEditPriority(e.target.value)}
                                  >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                  </select>

                                  <div
                                    style={{
                                      ...styles.editButtonRow,
                                      ...(isMobile ? styles.editButtonRowMobile : {}),
                                    }}
                                  >
                                    <button style={styles.saveButton} onClick={() => saveEdit(task.id)}>
                                      Save
                                    </button>
                                    <button style={styles.cancelButton} onClick={cancelEdit}>
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={styles.expandedButtons}>
                                  <button style={styles.smallDarkButton} onClick={() => startEdit(task)}>
                                    Edit
                                  </button>
                                  <button
                                    style={styles.smallDeleteButton}
                                    onClick={() => deleteTask(task.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {screen === 'list' && selectedList ? (
              <div style={styles.membersPanelDark}>
                <h2 style={styles.membersTitle}>Members</h2>

                {isOwner ? (
                  <div
                    style={{
                      ...styles.inviteRowDark,
                      ...(isMobile ? styles.inviteRowDarkMobile : {}),
                    }}
                  >
                    <input
                      style={styles.inputDark}
                      placeholder="Invite by email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <button style={styles.secondaryActionButton} onClick={inviteMember}>
                      Invite
                    </button>
                  </div>
                ) : null}

                <div style={{ marginTop: 12 }}>
                  {members.map((member) => (
                    <div key={member.id} style={styles.memberRowDark}>
                      <div>
                        <div style={styles.memberEmailDark}>
                          {member.profiles?.email || member.user_id}
                        </div>
                        <div style={styles.memberRoleDark}>{member.role}</div>
                      </div>

                      {isOwner && member.role !== 'owner' ? (
                        <button style={styles.smallDeleteButton} onClick={() => removeMember(member)}>
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}

        <button style={styles.fab} onClick={() => openCreateModal()}>
          +
        </button>

        {showCreateModal ? (
          <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
            <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <button style={styles.iconCircle} onClick={() => setShowCreateModal(false)}>
                  ✕
                </button>
                <div style={styles.modalTitle}>New Reminder</div>
                <button style={styles.iconCircle} onClick={addTask}>
                  ✓
                </button>
              </div>

              <div style={styles.modalSection}>
                <div style={styles.modalFieldStack}>
                  <input
                    style={styles.inputDark}
                    placeholder="Title"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                  />
                  <textarea
                    style={styles.textareaDark}
                    placeholder="Notes"
                    value={newTaskNotes}
                    onChange={(e) => setNewTaskNotes(e.target.value)}
                  />
                </div>
              </div>

              <div style={styles.modalSection}>
                <div style={styles.sectionHeading}>Date & Time</div>

                <div style={styles.appleRow}>
                  <div style={styles.appleRowLeft}>
                    <div style={styles.appleIcon}>🗓️</div>
                    <div style={styles.appleLabel}>Date</div>
                  </div>

                  <label style={styles.switch}>
                    <input
                      type="checkbox"
                      checked={newTaskDateEnabled}
                      onChange={(e) => setNewTaskDateEnabled(e.target.checked)}
                      style={{ display: 'none' }}
                    />
                    <span
                      style={{
                        ...styles.slider,
                        background: newTaskDateEnabled ? '#34c759' : '#6b7280',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 3,
                          left: newTaskDateEnabled ? 27 : 3,
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#ffffff',
                          transition: 'left 0.18s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                        }}
                      />
                    </span>
                  </label>
                </div>

                {newTaskDateEnabled ? (
                  <div style={styles.dateInputWrap}>
                    <input
                      style={styles.inputDark}
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                    />
                    <span style={styles.dateIcon}>🗓️</span>
                  </div>
                ) : null}

                <div style={styles.appleRow}>
                  <div style={styles.appleRowLeft}>
                    <div style={styles.appleIcon}>🕒</div>
                    <div style={styles.appleLabel}>Time</div>
                  </div>

                  <label style={styles.switch}>
                    <input
                      type="checkbox"
                      checked={newTaskTimeEnabled}
                      onChange={(e) => setNewTaskTimeEnabled(e.target.checked)}
                      style={{ display: 'none' }}
                    />
                    <span
                      style={{
                        ...styles.slider,
                        background: newTaskTimeEnabled ? '#34c759' : '#6b7280',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 3,
                          left: newTaskTimeEnabled ? 27 : 3,
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#ffffff',
                          transition: 'left 0.18s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                        }}
                      />
                    </span>
                  </label>
                </div>

                {newTaskDateEnabled && newTaskTimeEnabled ? (
                  <input
                    style={styles.inputDark}
                    type="time"
                    value={newTaskDueTime}
                    onChange={(e) => setNewTaskDueTime(e.target.value)}
                  />
                ) : null}
              </div>

              <div style={styles.modalSection}>
                <div style={styles.sectionHeading}>More Options</div>

                <select
                  style={styles.selectDark}
                  value={newTaskListId}
                  onChange={(e) => setNewTaskListId(e.target.value)}
                >
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>

                {newTaskDateEnabled ? (
                  <select
                    style={styles.selectDark}
                    value={newTaskReminder}
                    onChange={(e) => setNewTaskReminder(e.target.value)}
                  >
                    <option value="0">Reminder: At time</option>
                    <option value="5">Reminder: 5 min before</option>
                    <option value="10">Reminder: 10 min before</option>
                    <option value="15">Reminder: 15 min before</option>
                    <option value="30">Reminder: 30 min before</option>
                    <option value="60">Reminder: 1 hour before</option>
                    <option value="120">Reminder: 2 hours before</option>
                    <option value="1440">Reminder: 1 day before</option>
                    <option value="2880">Reminder: 2 days before</option>
                    <option value="10080">Reminder: 1 week before</option>
                  </select>
                ) : null}

                <select
                  style={styles.selectDark}
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                >
                  <option value="low">Priority: Low</option>
                  <option value="medium">Priority: Medium</option>
                  <option value="high">Priority: High</option>
                </select>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#000',
    color: '#fff',
    fontFamily: 'Arial, sans-serif',
    padding: '20px 16px 90px',
  },
  container: {
    maxWidth: 820,
    margin: '0 auto',
  },
  homeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 34,
    fontWeight: 700,
    margin: 0,
    color: '#fff',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  topBarTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  topBarSmall: {
    color: '#6b7280',
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  topBarTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1.1,
    wordBreak: 'break-word',
  },
  subtle: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 6,
    wordBreak: 'break-word',
  },
  success: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    background: '#052e16',
    color: '#86efac',
    fontWeight: 600,
  },
  error: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    background: '#3f1111',
    color: '#fca5a5',
    fontWeight: 600,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 14,
    marginBottom: 20,
  },
  cardGridMobile: {
    gridTemplateColumns: '1fr 1fr',
  },
  statCard: {
    border: 'none',
    borderRadius: 22,
    padding: '18px 18px',
    color: '#fff',
    textAlign: 'left',
    minHeight: 118,
    cursor: 'pointer',
  },
  statCount: {
    fontSize: 42,
    fontWeight: 700,
    lineHeight: 1,
    marginBottom: 14,
  },
  statLabel: {
    fontSize: 18,
    fontWeight: 700,
  },
  todayCard: {
    background: 'linear-gradient(135deg, #89b9ff, #5f88f7)',
  },
  allCard: {
    background: 'linear-gradient(135deg, #3d3d3d, #1e1e1e)',
  },
  completedCard: {
    background: 'linear-gradient(135deg, #a9afb9, #8d949f)',
  },
  homePanel: {
    background: '#121317',
    borderRadius: 24,
    padding: 18,
    border: '1px solid #22252c',
  },
  sectionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
  },
  newListRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 10,
  },
  listRow: {
    width: '100%',
    background: '#1a1c22',
    color: '#fff',
    border: '1px solid #2a2e37',
    borderRadius: 18,
    padding: '16px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: 10,
  },
  listRowTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  listRowMeta: {
    color: '#9ca3af',
    fontSize: 13,
  },
  listRowCount: {
    fontSize: 34,
    fontWeight: 700,
    color: '#9db8ff',
    marginLeft: 14,
  },
  groupWrap: {
    marginTop: 8,
  },
  groupSection: {
    marginBottom: 22,
  },
  groupTitle: {
    fontSize: 19,
    fontWeight: 700,
    color: '#60a5fa',
    marginBottom: 10,
    paddingLeft: 2,
  },
  emptyDark: {
    color: '#9ca3af',
    padding: '12px 2px',
    fontSize: 15,
  },
  taskRowWrap: {
    borderBottom: '1px solid #1f2430',
    paddingBottom: 8,
    marginBottom: 8,
  },
  taskRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '10px 2px',
    cursor: 'pointer',
  },
  circleButton: {
    width: 28,
    height: 28,
    minWidth: 28,
    borderRadius: '50%',
    border: '2px solid #404552',
    background: 'transparent',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    lineHeight: '22px',
    textAlign: 'center',
    padding: 0,
    marginTop: 2,
  },
  circleButtonChecked: {
    background: '#4f8cff',
    borderColor: '#4f8cff',
  },
  taskBody: {
    flex: 1,
    minWidth: 0,
  },
  taskTitle: {
    fontSize: 17,
    lineHeight: 1.3,
    color: '#fff',
    fontWeight: 500,
    wordBreak: 'break-word',
  },
  taskTitleDone: {
    textDecoration: 'line-through',
    color: '#808691',
  },
  taskNotes: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  taskMeta: {
    fontSize: 14,
    color: '#8b92a0',
    marginTop: 4,
  },
  taskMetaOverdue: {
    color: '#f87171',
  },
  expandedArea: {
    padding: '10px 0 2px 40px',
  },
  expandedButtons: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  editGrid: {
    display: 'grid',
    gap: 10,
  },
  editButtonRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  editButtonRowMobile: {
    flexDirection: 'column',
  },
  membersPanelDark: {
    marginTop: 18,
    background: '#121317',
    border: '1px solid #22252c',
    borderRadius: 24,
    padding: 18,
  },
  membersTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
    margin: 0,
  },
  inviteRowDark: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 10,
    marginTop: 14,
  },
  inviteRowDarkMobile: {
    gridTemplateColumns: '1fr',
  },
  memberRowDark: {
    padding: '14px 0',
    borderBottom: '1px solid #1f2430',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  memberEmailDark: {
    color: '#fff',
    fontWeight: 600,
    fontSize: 15,
  },
  memberRoleDark: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 4,
  },
  detailActionRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  detailBoxDark: {
    border: '1px solid #262b36',
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
    background: '#181b22',
  },
  detailLabelDark: {
    fontSize: 12,
    color: '#8b93a1',
    marginBottom: 6,
  },
  detailValueDark: {
    fontSize: 18,
    fontWeight: 700,
    color: '#ffffff',
  },
  inlineDetailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  inlineEditWrap: {
    marginTop: 6,
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 16,
    border: '1px solid #313642',
    background: '#1b1d24',
    color: '#fff',
    fontSize: 16,
    outline: 'none',
    boxSizing: 'border-box',
  },
  inputDark: {
    width: '100%',
    padding: '16px 18px',
    borderRadius: 18,
    border: '1px solid #3a4150',
    background: '#1d212b',
    color: '#ffffff',
    fontSize: 17,
    outline: 'none',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
    boxSizing: 'border-box',
  },
  textareaDark: {
    width: '100%',
    minHeight: 120,
    padding: '16px 18px',
    borderRadius: 18,
    border: '1px solid #3a4150',
    background: '#1d212b',
    color: '#ffffff',
    fontSize: 17,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'Arial, sans-serif',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
    boxSizing: 'border-box',
  },
  selectDark: {
    width: '100%',
    padding: '16px 18px',
    borderRadius: 18,
    border: '1px solid #3a4150',
    background: '#1d212b',
    color: '#ffffff',
    fontSize: 17,
    outline: 'none',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
    boxSizing: 'border-box',
  },
  ghostButton: {
    padding: '10px 14px',
    borderRadius: 14,
    border: '1px solid #343a46',
    background: '#171a21',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 600,
    height: 'fit-content',
  },
  secondaryActionButton: {
    padding: '12px 16px',
    borderRadius: 16,
    border: 'none',
    background: '#2a2d36',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  deleteListButton: {
    padding: '12px 16px',
    borderRadius: 16,
    border: 'none',
    background: '#dc2626',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  saveButton: {
    padding: '12px 16px',
    borderRadius: 16,
    border: 'none',
    background: '#4f8cff',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  cancelButton: {
    padding: '12px 16px',
    borderRadius: 16,
    border: 'none',
    background: '#2a2d36',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  smallDarkButton: {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #3b4250',
    background: '#1f2430',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  },
  smallDeleteButton: {
    padding: '10px 14px',
    borderRadius: 12,
    border: 'none',
    background: '#dc2626',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  },
  disabledButton: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  fab: {
    position: 'fixed',
    right: 22,
    bottom: 22,
    width: 64,
    height: 64,
    borderRadius: '50%',
    border: 'none',
    background: '#79a7ff',
    color: '#fff',
    fontSize: 38,
    lineHeight: '64px',
    textAlign: 'center',
    cursor: 'pointer',
    boxShadow: '0 12px 30px rgba(121,167,255,0.35)',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 'max(16px, env(safe-area-inset-top))',
    paddingRight: 'max(16px, env(safe-area-inset-right))',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    paddingLeft: 'max(16px, env(safe-area-inset-left))',
    zIndex: 50,
    overflowY: 'auto',
    boxSizing: 'border-box',
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    background: '#111318',
    border: '1px solid #2d3340',
    borderRadius: 28,
    padding: 18,
    boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  modalHeader: {
    display: 'grid',
    gridTemplateColumns: '48px 1fr 48px',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 700,
    textAlign: 'center',
    lineHeight: 1.2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: '1px solid #4b5563',
    background: 'linear-gradient(180deg, #3a3f4a, #2d313b)',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: 24,
    lineHeight: '44px',
    textAlign: 'center',
    padding: 0,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
    justifySelf: 'center',
  },
  modalSection: {
    background: '#181b22',
    borderRadius: 24,
    padding: 18,
    marginTop: 14,
    display: 'grid',
    gap: 14,
    border: '1px solid #262b36',
    boxSizing: 'border-box',
  },
  modalFieldStack: {
    display: 'grid',
    gap: 12,
  },
  sectionHeading: {
    color: '#d1d5db',
    fontSize: 17,
    fontWeight: 700,
    marginBottom: 2,
  },
  appleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    padding: '10px 0',
    borderBottom: '1px solid #2a2f39',
  },
  appleRowLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    minWidth: 0,
  },
  appleIcon: {
    width: 28,
    textAlign: 'center',
    color: '#a1a1aa',
    fontSize: 20,
    flexShrink: 0,
  },
  appleLabel: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 500,
  },
  switch: {
    position: 'relative',
    display: 'inline-block',
    width: 58,
    height: 34,
  },
  slider: {
    position: 'absolute',
    inset: 0,
    background: '#6b7280',
    borderRadius: 999,
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)',
  },
  dateInputWrap: {
    position: 'relative',
  },
  dateIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#9ca3af',
    fontSize: 18,
    pointerEvents: 'none',
  },
  loadingWrap: {
    minHeight: '60vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 18,
  },
  empty: {
    color: '#9ca3af',
    padding: '8px 0',
  },
};
