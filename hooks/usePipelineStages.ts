import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface PipelineStage {
  id: string;
  clinic_id: string;
  status_key: string;
  label: string;
  color: string;
  position: number;
  is_system: boolean;
}

// Etapas padrão caso a clínica não tenha configuração
const DEFAULT_STAGES: Omit<PipelineStage, 'id' | 'clinic_id'>[] = [
  { status_key: 'Novo Lead', label: 'Novos', color: '#3B82F6', position: 0, is_system: true },
  { status_key: 'Em Atendimento', label: 'Atendimento', color: '#F97316', position: 1, is_system: false },
  { status_key: 'Follow-up', label: 'Follow-up', color: '#F59E0B', position: 2, is_system: false },
  { status_key: 'Agendado', label: 'Agendados', color: '#8B5CF6', position: 3, is_system: false },
  { status_key: 'Convertido', label: 'Ganhos', color: '#10B981', position: 4, is_system: true },
  { status_key: 'Recorrente', label: 'Recorrentes', color: '#0891B2', position: 5, is_system: false },
  { status_key: 'Mentoria', label: 'Mentoria', color: '#EAB308', position: 6, is_system: false },
  { status_key: 'Perdido', label: 'Perdidos', color: '#EF4444', position: 7, is_system: true },
];

export function usePipelineStages(clinicId: string | undefined) {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStages = useCallback(async () => {
    if (!clinicId) {
      setStages([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('pipeline_settings' as any)
        .select('id, clinic_id, status_key, label, color, position, is_system')
        .eq('clinic_id', clinicId)
        .order('position', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setStages(data as unknown as PipelineStage[]);
      } else {
        // Sem configuração: usar padrão
        setStages(DEFAULT_STAGES.map((s, i) => ({
          ...s,
          id: `default-${i}`,
          clinic_id: clinicId,
        })));
      }
    } catch (err) {
      console.error('Error fetching pipeline stages:', err);
      setStages(DEFAULT_STAGES.map((s, i) => ({
        ...s,
        id: `default-${i}`,
        clinic_id: clinicId || '',
      })));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  // Criar nova etapa
  const createStage = async (label: string, color: string): Promise<boolean> => {
    if (!clinicId) return false;

    try {
      // Gerar status_key a partir do label (sem acentos, com espaços)
      const statusKey = label.trim();
      const maxPosition = stages.length > 0 ? Math.max(...stages.map(s => s.position)) : -1;

      // Inserir antes de "Perdido" (última posição do sistema)
      const perdidoStage = stages.find(s => s.status_key === 'Perdido');
      const newPosition = perdidoStage ? perdidoStage.position : maxPosition + 1;

      // Mover Perdido para frente
      if (perdidoStage) {
        await supabase
          .from('pipeline_settings' as any)
          .update({ position: newPosition + 1 })
          .eq('id', perdidoStage.id);
      }

      const { error } = await supabase
        .from('pipeline_settings' as any)
        .insert({
          clinic_id: clinicId,
          status_key: statusKey,
          label: label.trim(),
          color,
          position: newPosition,
          is_system: false,
        });

      if (error) throw error;

      await fetchStages();
      return true;
    } catch (err) {
      console.error('Error creating stage:', err);
      return false;
    }
  };

  // Atualizar etapa existente
  const updateStage = async (stageId: string, label: string, color: string): Promise<boolean> => {
    if (!clinicId) return false;

    try {
      const stage = stages.find(s => s.id === stageId);
      if (!stage) return false;

      const updateData: Record<string, unknown> = {
        label: label.trim(),
        color,
        updated_at: new Date().toISOString(),
      };

      // Se não é system, também atualiza o status_key
      if (!stage.is_system) {
        updateData.status_key = label.trim();
      }

      const { error } = await supabase
        .from('pipeline_settings' as any)
        .update(updateData)
        .eq('id', stageId);

      if (error) throw error;

      // Se mudou o status_key, atualizar os chats que tinham o status antigo
      if (!stage.is_system && label.trim() !== stage.status_key) {
        await supabase
          .from('chats' as any)
          .update({ status: label.trim() })
          .eq('clinic_id', clinicId)
          .eq('status', stage.status_key);
      }

      await fetchStages();
      return true;
    } catch (err) {
      console.error('Error updating stage:', err);
      return false;
    }
  };

  // Excluir etapa (mover leads para outra etapa)
  const deleteStage = async (stageId: string, moveToStatusKey: string): Promise<boolean> => {
    if (!clinicId) return false;

    try {
      const stage = stages.find(s => s.id === stageId);
      if (!stage || stage.is_system) return false;

      // Mover leads da etapa excluída para a etapa destino
      await supabase
        .from('chats' as any)
        .update({ status: moveToStatusKey, updated_at: new Date().toISOString() })
        .eq('clinic_id', clinicId)
        .eq('status', stage.status_key);

      // Excluir a etapa
      const { error } = await supabase
        .from('pipeline_settings' as any)
        .delete()
        .eq('id', stageId);

      if (error) throw error;

      // Reordenar posições
      const remaining = stages.filter(s => s.id !== stageId).sort((a, b) => a.position - b.position);
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].position !== i) {
          await supabase
            .from('pipeline_settings' as any)
            .update({ position: i })
            .eq('id', remaining[i].id);
        }
      }

      await fetchStages();
      return true;
    } catch (err) {
      console.error('Error deleting stage:', err);
      return false;
    }
  };

  // Reordenar etapas
  const reorderStages = async (newOrder: PipelineStage[]): Promise<boolean> => {
    if (!clinicId) return false;

    try {
      for (let i = 0; i < newOrder.length; i++) {
        if (newOrder[i].position !== i) {
          await supabase
            .from('pipeline_settings' as any)
            .update({ position: i })
            .eq('id', newOrder[i].id);
        }
      }

      setStages(newOrder.map((s, i) => ({ ...s, position: i })));
      return true;
    } catch (err) {
      console.error('Error reordering stages:', err);
      return false;
    }
  };

  // Helpers
  const getStageKeys = (): string[] => stages.map(s => s.status_key);
  const getStageLabel = (statusKey: string): string => {
    const stage = stages.find(s => s.status_key === statusKey);
    return stage?.label || statusKey;
  };
  const getStageColor = (statusKey: string): string => {
    const stage = stages.find(s => s.status_key === statusKey);
    return stage?.color || '#6B7280';
  };

  return {
    stages,
    loading,
    fetchStages,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
    getStageKeys,
    getStageLabel,
    getStageColor,
  };
}
