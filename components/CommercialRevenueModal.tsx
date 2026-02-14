import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CommercialRevenueModalProps {
  clinicId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface CommercialDetail {
  id: string;
  value: number;
  payment_date: string;
  payment_method: string | null;
  client_name: string;
  origem: string;
  origem_color: string;
  received_at: string | null;
}

const getPaymentMethodLabel = (method: string) => {
  const labels: Record<string, string> = {
    pix: 'PIX',
    dinheiro: 'Dinheiro',
    cartao_credito: 'Cartão Crédito',
    cartao_debito: 'Cartão Débito',
    boleto: 'Boleto',
    transferencia: 'Transferência',
  };
  return labels[method] || method;
};

export default function CommercialRevenueModal({ clinicId, isOpen, onClose }: CommercialRevenueModalProps) {
  const [details, setDetails] = useState<CommercialDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && clinicId) {
      fetchDetails();
    }
  }, [isOpen, clinicId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data } = await supabase
        .from('payments' as any)
        .select('id, value, payment_date, payment_method, received_at, chat_id')
        .eq('clinic_id', clinicId)
        .or('status.is.null,status.eq.active')
        .gte('payment_date', firstDayOfMonth)
        .lte('payment_date', lastDayOfMonth)
        .order('payment_date', { ascending: false });

      if (data && data.length > 0) {
        const chatIds = [...new Set((data as any[]).map(r => r.chat_id).filter(Boolean))];

        const { data: chatsInfo } = await (supabase as any)
          .from('chats')
          .select('id, client_name, source_id')
          .in('id', chatIds);

        const sourceIds = [...new Set((chatsInfo || []).map((c: any) => c.source_id).filter(Boolean))];
        let sourcesMap: Record<string, { name: string; color: string }> = {};

        if (sourceIds.length > 0) {
          const { data: sources } = await supabase
            .from('lead_sources' as any)
            .select('id, name, color')
            .in('id', sourceIds);
          if (sources) {
            (sources as any[]).forEach(s => {
              sourcesMap[s.id] = { name: s.name, color: s.color || '#6B7280' };
            });
          }
        }

        const chatsMap: Record<string, { client_name: string; source_id: string | null }> = {};
        (chatsInfo || []).forEach((c: any) => {
          chatsMap[c.id] = { client_name: c.client_name, source_id: c.source_id };
        });

        const mapped = (data as any[]).map(r => {
          const chat = chatsMap[r.chat_id] || { client_name: 'Desconhecido', source_id: null };
          const source = chat.source_id ? sourcesMap[chat.source_id] : null;
          return {
            id: r.id,
            value: Number(r.value),
            payment_date: r.payment_date,
            payment_method: r.payment_method || null,
            client_name: chat.client_name,
            origem: source?.name || 'Sem origem',
            origem_color: source?.color || '#6B7280',
            received_at: r.received_at || null,
          };
        });

        setDetails(mapped);
      } else {
        setDetails([]);
      }
    } catch (err) {
      console.error('Error fetching commercial revenue details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const confirmedTotal = details.filter(r => r.received_at).reduce((sum, r) => sum + r.value, 0);
  const pendingItems = details.filter(r => !r.received_at);
  const pendingTotal = pendingItems.reduce((sum, r) => sum + r.value, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">Receita Comercial</h3>
              <p className="text-orange-100 text-xs mt-0.5">
                {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} - {details.length} pagamento{details.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black">
                R$ {confirmedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-orange-200 text-[10px]">confirmado</p>
            </div>
          </div>
          {pendingItems.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/20 flex justify-between items-center">
              <span className="text-orange-200 text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                {pendingItems.length} pendente{pendingItems.length !== 1 ? 's' : ''}
              </span>
              <span className="text-orange-200 text-xs font-bold">
                R$ {pendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-center py-10 text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-2 animate-spin">progress_activity</span>
              <p className="text-sm">Carregando...</p>
            </div>
          ) : details.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-2">receipt_long</span>
              <p className="text-sm">Nenhum pagamento no mês</p>
            </div>
          ) : (
            details.map(r => (
              <div key={r.id} className={`rounded-xl p-3 border ${r.received_at ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-slate-800">{r.client_name}</p>
                    {r.received_at ? (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">check_circle</span>
                      </span>
                    ) : (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">schedule</span>
                      </span>
                    )}
                  </div>
                  <p className={`text-sm font-black shrink-0 ml-3 ${r.received_at ? 'text-emerald-600' : 'text-amber-600'}`}>
                    R$ {r.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                    {new Date(r.payment_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                  {r.payment_method && (
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">payments</span>
                      {getPaymentMethodLabel(r.payment_method)}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.origem_color }}></span>
                    {r.origem}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-200 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
