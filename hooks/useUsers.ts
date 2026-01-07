import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';

export type DbUser = Tables<'users'>;

interface UseUsersReturn {
  users: DbUser[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateUserStatus: (userId: string, status: string) => Promise<void>;
  updateUserRole: (userId: string, role: string) => Promise<void>;
}

export function useUsers(): UseUsersReturn {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    const { data, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('Error fetching users:', usersError);
      setError('Erro ao carregar usuários');
      setLoading(false);
      return;
    }

    setUsers(data || []);
    setLoading(false);
  };

  const updateUserStatus = async (userId: string, status: string) => {
    const { error } = await supabase
      .from('users')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user status:', error);
      return;
    }

    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, status } : user
    ));
  };

  const updateUserRole = async (userId: string, role: string) => {
    const { error } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user role:', error);
      return;
    }

    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, role } : user
    ));
  };

  useEffect(() => {
    fetchUsers();

    const usersSubscription = supabase
      .channel('users-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(usersSubscription);
    };
  }, []);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    updateUserStatus,
    updateUserRole,
  };
}
