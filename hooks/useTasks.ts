import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Task {
  id: string;
  chat_id: string;
  clinic_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  chat_name?: string;
  chat_phone?: string;
}

interface UseTasksReturn {
  tasks: Task[];
  todayTasks: Task[];
  upcomingTasks: Task[];
  overdueTasks: Task[];
  weekTasks: Task[];
  loading: boolean;
  refetch: () => Promise<void>;
  toggleTask: (taskId: string, completed: boolean) => Promise<void>;
}

export function useTasks(clinicId?: string, userId?: string): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tasks' as any)
        .select(`
          id,
          chat_id,
          clinic_id,
          title,
          description,
          due_date,
          completed,
          completed_at,
          created_by,
          created_at,
          chats (
            client_name,
            phone_number
          )
        `)
        .eq('clinic_id', clinicId)
        .eq('completed', false)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        setLoading(false);
        return;
      }

      const formattedTasks: Task[] = (data || []).map((task: any) => ({
        id: task.id,
        chat_id: task.chat_id,
        clinic_id: task.clinic_id,
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        completed: task.completed,
        completed_at: task.completed_at,
        created_by: task.created_by,
        created_at: task.created_at,
        chat_name: task.chats?.client_name || 'Cliente',
        chat_phone: task.chats?.phone_number || '',
      }));

      setTasks(formattedTasks);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  const toggleTask = async (taskId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('tasks' as any)
        .update({
          completed: !completed,
          completed_at: !completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (!error) {
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Calcular datas
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  // Filtrar tarefas
  const todayTasks = tasks.filter(t => t.due_date === todayStr);
  
  const overdueTasks = tasks.filter(t => 
    t.due_date && t.due_date < todayStr
  );

  const upcomingTasks = tasks.filter(t => 
    t.due_date && t.due_date > todayStr && t.due_date <= weekEndStr
  );

  const weekTasks = tasks.filter(t => 
    t.due_date && t.due_date >= todayStr && t.due_date <= weekEndStr
  );

  return {
    tasks,
    todayTasks,
    upcomingTasks,
    overdueTasks,
    weekTasks,
    loading,
    refetch: fetchTasks,
    toggleTask,
  };
}
