import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';

export type DbLead = Tables<'leads'>;
export type DbTag = Tables<'tags'>;

export interface LeadWithTags extends DbLead {
  tags: DbTag[];
}

interface UseLeadsReturn {
  leads: LeadWithTags[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateLeadStage: (leadId: string, stage: string) => Promise<void>;
  createLead: (lead: Partial<DbLead>) => Promise<DbLead | null>;
}

export function useLeads(): UseLeadsReturn {
  const [leads, setLeads] = useState<LeadWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);

    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select(`
        *,
        lead_tags (
          tags (*)
        )
      `)
      .order('updated_at', { ascending: false });

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      setError('Erro ao carregar leads');
      setLoading(false);
      return;
    }

    const formattedLeads: LeadWithTags[] = (leadsData || []).map(lead => ({
      ...lead,
      tags: lead.lead_tags?.map((lt: { tags: DbTag }) => lt.tags).filter(Boolean) || [],
    }));

    setLeads(formattedLeads);
    setLoading(false);
  };

  const updateLeadStage = async (leadId: string, stage: string) => {
    const { error } = await supabase
      .from('leads')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', leadId);

    if (error) {
      console.error('Error updating lead stage:', error);
      return;
    }

    setLeads(prev => prev.map(lead => 
      lead.id === leadId ? { ...lead, stage } : lead
    ));
  };

  const createLead = async (leadData: Omit<DbLead, 'id' | 'created_at' | 'updated_at'>): Promise<DbLead | null> => {
    const { data, error } = await supabase
      .from('leads')
      .insert(leadData as any)
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      return null;
    }

    await fetchLeads();
    return data;
  };

  useEffect(() => {
    fetchLeads();

    const leadsSubscription = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leadsSubscription);
    };
  }, []);

  return {
    leads,
    loading,
    error,
    refetch: fetchLeads,
    updateLeadStage,
    createLead,
  };
}
