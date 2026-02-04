import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  Plus, 
  Search, 
  Calendar,
  X,
  Trash2,
  Edit,
  CreditCard,
  Banknote,
  Smartphone,
  FileText,
  ArrowUpDown,
  Filter,
  ChevronDown,
  ChevronRight,
  Download,
  TrendingUp,
  CheckCircle,
  Clock,
  User,
  ArrowUp,
  ArrowDown,
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { GlobalState } from '../types';
import { hasPermission } from '../lib/permissions';

interface ReceiptsProps {
  state: GlobalState;
}

interface PaymentWithDetails {
  id: string;
  chat_id: string;
  clinic_id: string;
  value: number;
  description: string | null;
  payment_date: string;
  created_by: string | null;
  created_at: string;
  chat: {
    id: string;
    client_name: string;
    phone_number: string;
    source_id: string | null;
  } | null;
  creator: {
    id: string;
    name: string;
  } | null;
  source: {
    id: string;
    name: string;
    color: string;
  } | null;
  receipts: ClinicReceipt[];
}

interface ClinicReceipt {
  id: string;
  payment_id: string | null;
  total_value: number;
  description: string | null;
  receipt_date: string;
  receipt_payments: ReceiptPaymentItem[];
}

interface ReceiptPaymentItem {
  id: string;
  value: number;
  payment_method: string;
  installments: number;
}

interface LeadSource {
  id: string;
  name: string;
  color: string;
}

interface Attendant {
  id: string;
  name: string;
}

type SortField = 'date' | 'client' | 'commercial' | 'received';
type SortOrder = 'asc' | 'desc';

const PAYMENT_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'cartao_credito', label: 'Cartao Credito', icon: CreditCard },
  { value: 'cartao_debito', label: 'Cartao Debito', icon: CreditCard },
  { value: 'boleto', label: 'Boleto', icon: FileText },
  { value: 'transferencia', label: 'Transferencia', icon: ArrowUpDown },
  { value: 'outro', label: 'Outro', icon: DollarSign },
];

const ITEMS_PER_PAGE = 20;

const Receipts: React.FC<ReceiptsProps> = ({ state }) => {
  const { user } = useAuth();
  const clinicId = state.selectedClinic?.id;
  
  const canAddReceipt = hasPermission(user?.role, 'add_receipt');
  const canEditReceipt = hasPermission(user?.role, 'edit_receipt');
  
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
  
  // Lançamentos diretos da clínica (sem comercial)
  const [directReceipts, setDirectReceipts] = useState<Array<{
    id: string;
    chat_id: string;
    total_value: number;
    description: string | null;
    receipt_date: string;
    created_at: string;
    chat: { id: string; client_name: string; phone_number: string } | null;
    receipt_payments: Array<{ payment_method: string; value: number }>;
  }>>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<ClinicReceipt | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | 'month'>('month');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'received'>('all');
  const [attendantFilter, setAttendantFilter] = useState<string>('all');
  
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  
  const [formData, setFormData] = useState({
    description: '',
    receipt_date: new Date().toISOString().split('T')[0],
    payments: [{ value: '', payment_method: 'pix', installments: 1 }] as Array<{
      value: string;
      payment_method: string;
      installments: number;
    }>
  });

  useEffect(() => {
    if (clinicId) {
      fetchData();
    }
  }, [clinicId]);

  const fetchData = async () => {
    if (!clinicId) return;
    setLoading(true);
    
    try {
      const { data: paymentsData } = await supabase
        .from('payments' as any)
        .select('*, chat:chats(id, client_name, phone_number, source_id), creator:users!payments_created_by_fkey(id, name)')
        .eq('clinic_id', clinicId)
        .or('status.is.null,status.eq.active')
        .order('payment_date', { ascending: false });

      const { data: sourcesData } = await supabase
        .from('lead_sources' as any)
        .select('id, name, color')
        .eq('clinic_id', clinicId);

      const { data: receiptsData } = await supabase
        .from('clinic_receipts' as any)
        .select('*, receipt_payments(*)')
        .eq('clinic_id', clinicId);

      const { data: usersData } = await supabase
        .from('users')
        .select('id, name')
        .eq('clinic_id', clinicId);

      const paymentsWithDetails: PaymentWithDetails[] = await Promise.all(
        ((paymentsData || []) as any[]).map(async (payment) => {
          let source = null;
          if (payment.chat?.source_id) {
            const { data: sourceData } = await supabase
              .from('lead_sources' as any)
              .select('id, name, color')
              .eq('id', payment.chat.source_id)
              .single();
            source = sourceData;
          }
          
          const paymentReceipts = ((receiptsData || []) as any[]).filter(
            (r: any) => r.payment_id === payment.id
          );
          
          return { ...payment, source, receipts: paymentReceipts };
        })
      );

      // Buscar lançamentos diretos (sem payment_id)
      const directReceiptsData = ((receiptsData || []) as any[])
        .filter((r: any) => r.payment_id === null)
        .map((r: any) => ({
          ...r,
          chat: null // Será preenchido abaixo
        }));
      
      // Buscar dados dos chats para lançamentos diretos
      if (directReceiptsData.length > 0) {
        const chatIds = [...new Set(directReceiptsData.map(r => r.chat_id))];
        const { data: chatsData } = await supabase
          .from('chats')
          .select('id, client_name, phone_number')
          .in('id', chatIds);
        
        directReceiptsData.forEach(r => {
          r.chat = (chatsData as any[] || []).find(c => c.id === r.chat_id) || null;
        });
      }
      
      setDirectReceipts(directReceiptsData);
      setPayments(paymentsWithDetails);
      if (sourcesData) setSources(sourcesData as unknown as LeadSource[]);
      if (usersData) setAttendants(usersData as unknown as Attendant[]);
      
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (paymentId: string) => {
    const newExpanded = new Set(expandedPayments);
    if (newExpanded.has(paymentId)) {
      newExpanded.delete(paymentId);
    } else {
      newExpanded.add(paymentId);
    }
    setExpandedPayments(newExpanded);
  };

  const openAddReceiptModal = (payment: PaymentWithDetails) => {
    setSelectedPayment(payment);
    setEditingReceipt(null);
    setFormData({
      description: '',
      receipt_date: new Date().toISOString().split('T')[0],
      payments: [{ value: '', payment_method: 'pix', installments: 1 }]
    });
    setError(null);
    setShowModal(true);
  };

  const openEditReceiptModal = (payment: PaymentWithDetails, receipt: ClinicReceipt) => {
    setSelectedPayment(payment);
    setEditingReceipt(receipt);
    
    const existingPayments = receipt.receipt_payments?.map(rp => ({
      value: rp.value.toString(),
      payment_method: rp.payment_method,
      installments: rp.installments
    })) || [{ value: receipt.total_value.toString(), payment_method: 'pix', installments: 1 }];
    
    setFormData({
      description: receipt.description || '',
      receipt_date: receipt.receipt_date,
      payments: existingPayments
    });
    setError(null);
    setShowModal(true);
  };

  const addPaymentMethod = () => {
    setFormData({
      ...formData,
      payments: [...formData.payments, { value: '', payment_method: 'pix', installments: 1 }]
    });
  };

  const removePaymentMethod = (index: number) => {
    if (formData.payments.length > 1) {
      setFormData({
        ...formData,
        payments: formData.payments.filter((_, i) => i !== index)
      });
    }
  };

  const updatePaymentMethod = (index: number, field: string, value: string | number) => {
    const newPayments = [...formData.payments];
    newPayments[index] = { ...newPayments[index], [field]: value };
    setFormData({ ...formData, payments: newPayments });
  };

  const calculateTotalFromPayments = () => {
    return formData.payments.reduce((sum, p) => sum + (parseFloat(p.value) || 0), 0);
  };

  const handleSave = async () => {
    if (!clinicId || !user || !selectedPayment) return;
    
    const totalValue = calculateTotalFromPayments();
    if (totalValue <= 0) {
      setError('Informe pelo menos um valor de pagamento');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      if (editingReceipt) {
        await supabase
          .from('clinic_receipts' as any)
          .update({
            total_value: totalValue,
            description: formData.description || null,
            receipt_date: formData.receipt_date,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingReceipt.id);
        
        await supabase.from('receipt_payments' as any).delete().eq('receipt_id', editingReceipt.id);
        
        for (const payment of formData.payments) {
          if (parseFloat(payment.value) > 0) {
            await supabase.from('receipt_payments' as any).insert({
              receipt_id: editingReceipt.id,
              value: parseFloat(payment.value),
              payment_method: payment.payment_method,
              installments: payment.installments
            });
          }
        }
      } else {
        const { data: newReceipt } = await supabase
          .from('clinic_receipts' as any)
          .insert({
            clinic_id: clinicId,
            chat_id: selectedPayment.chat_id,
            payment_id: selectedPayment.id,
            total_value: totalValue,
            description: formData.description || null,
            receipt_date: formData.receipt_date,
            created_by: user.id
          })
          .select()
          .single();
        
        const receiptId = (newReceipt as any).id;
        for (const payment of formData.payments) {
          if (parseFloat(payment.value) > 0) {
            await supabase.from('receipt_payments' as any).insert({
              receipt_id: receiptId,
              value: parseFloat(payment.value),
              payment_method: payment.payment_method,
              installments: payment.installments
            });
          }
        }
      }
      
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    if (!confirm('Tem certeza que deseja excluir este recebimento?')) return;
    
    try {
      await supabase.from('clinic_receipts' as any).delete().eq('id', receiptId);
      fetchData();
    } catch (err) {
      console.error('Error deleting receipt:', err);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedPayments = useMemo(() => {
    let filtered = [...payments];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.chat?.client_name?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.creator?.name?.toLowerCase().includes(term)
      );
    }
    
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;
      
      switch (dateFilter) {
        case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
        default: startDate = new Date(0);
      }
      
      filtered = filtered.filter(p => new Date(p.payment_date) >= startDate);
    }
    
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(p => p.source?.id === sourceFilter);
    }
    
    if (statusFilter === 'pending') {
      filtered = filtered.filter(p => p.receipts.length === 0);
    } else if (statusFilter === 'received') {
      filtered = filtered.filter(p => p.receipts.length > 0);
    }
    
    if (attendantFilter !== 'all') {
      filtered = filtered.filter(p => p.created_by === attendantFilter);
    }
    
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date': comparison = new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime(); break;
        case 'client': comparison = (a.chat?.client_name || '').localeCompare(b.chat?.client_name || ''); break;
        case 'commercial': comparison = Number(a.value) - Number(b.value); break;
        case 'received':
          const aR = a.receipts.reduce((s, r) => s + Number(r.total_value), 0);
          const bR = b.receipts.reduce((s, r) => s + Number(r.total_value), 0);
          comparison = aR - bR;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [payments, searchTerm, dateFilter, sourceFilter, statusFilter, attendantFilter, sortField, sortOrder]);

  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedPayments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedPayments, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedPayments.length / ITEMS_PER_PAGE);

  const metrics = useMemo(() => {
    const totalComercial = filteredAndSortedPayments.reduce((sum, p) => sum + Number(p.value), 0);
    const totalRecebidoComercial = filteredAndSortedPayments.reduce((sum, p) => sum + p.receipts.reduce((rSum, r) => rSum + Number(r.total_value), 0), 0);
    const totalRecebimentosComercial = filteredAndSortedPayments.reduce((sum, p) => sum + p.receipts.length, 0);
    
    // Lançamentos diretos (sem comercial)
    const totalRecebidoDireto = directReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
    const totalRecebimentosDiretos = directReceipts.length;
    
    // Totais combinados
    const totalRecebido = totalRecebidoComercial + totalRecebidoDireto;
    const totalRecebimentos = totalRecebimentosComercial + totalRecebimentosDiretos;
    
    const vendasComRecebimento = filteredAndSortedPayments.filter(p => p.receipts.length > 0).length;
    const vendasPendentes = filteredAndSortedPayments.filter(p => p.receipts.length === 0).length;
    const roi = totalComercial > 0 ? ((totalRecebidoComercial / totalComercial) * 100).toFixed(1) : '0';
    const ticketMedio = totalRecebimentos > 0 ? totalRecebido / totalRecebimentos : 0;
    
    return { 
      totalComercial, 
      totalRecebido, 
      totalRecebidoComercial,
      totalRecebidoDireto,
      totalRecebimentos, 
      totalRecebimentosDiretos,
      vendasComRecebimento, 
      vendasPendentes, 
      roi, 
      ticketMedio, 
      totalVendas: filteredAndSortedPayments.length 
    };
  }, [filteredAndSortedPayments, directReceipts]);

  const exportToCSV = () => {
    const clinic = state.selectedClinic;
    if (!clinic) return;
    
    let csv = 'Data;Cliente;Origem;Comercial;Valor Comercial;Recebido;Formas\n';
    filteredAndSortedPayments.forEach(p => {
      const totalReceived = p.receipts.reduce((sum, r) => sum + Number(r.total_value), 0);
      const methods = p.receipts.flatMap(r => r.receipt_payments?.map(rp => getPaymentMethodLabel(rp.payment_method)) || []).join('+');
      csv += `${new Date(p.payment_date).toLocaleDateString('pt-BR')};${p.chat?.client_name || '-'};${p.source?.name || '-'};${p.creator?.name || '-'};${Number(p.value).toFixed(2)};${totalReceived.toFixed(2)};${methods || '-'}\n`;
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `lancamentos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const getPaymentMethodLabel = (method: string) => PAYMENT_METHODS.find(m => m.value === method)?.label || method;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-600" /> : <ArrowDown className="w-3 h-3 text-cyan-600" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Lançamentos</h1>
            <p className="text-slate-500 text-xs sm:text-sm">Vendas e receitas</p>
          </div>
          <div className="relative hidden sm:block">
            <button
              onMouseEnter={() => setShowInfoTooltip(true)}
              onMouseLeave={() => setShowInfoTooltip(false)}
              className="w-8 h-8 bg-cyan-50 hover:bg-cyan-100 rounded-full flex items-center justify-center transition-colors"
            >
              <Info className="w-4 h-4 text-cyan-600" />
            </button>
            
            {showInfoTooltip && (
              <div className="absolute left-0 top-10 z-50 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-4 animate-in fade-in duration-200">
                <div className="absolute -top-2 left-4 w-4 h-4 bg-white border-l border-t border-slate-200 rotate-45"></div>
                <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-cyan-100 rounded-lg flex items-center justify-center">
                    <Info className="w-3.5 h-3.5 text-cyan-600" />
                  </span>
                  Como funciona?
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg flex-shrink-0"></div>
                    <div>
                      <p className="font-semibold text-slate-700">Valor Comercial</p>
                      <p className="text-slate-500 text-xs">Valor total das vendas registradas pelo comercial. Representa o potencial de receita.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex-shrink-0"></div>
                    <div>
                      <p className="font-semibold text-slate-700">Receita Clinica</p>
                      <p className="text-slate-500 text-xs">Valor efetivamente recebido pela clinica. Soma dos recebimentos confirmados.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg flex-shrink-0"></div>
                    <div>
                      <p className="font-semibold text-slate-700">ROI</p>
                      <p className="text-slate-500 text-xs">Retorno sobre o investimento. Percentual da receita em relacao ao valor comercial.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg flex-shrink-0"></div>
                    <div>
                      <p className="font-semibold text-slate-700">Ticket Medio</p>
                      <p className="text-slate-500 text-xs">Valor medio por recebimento. Receita total dividida pelo numero de recebimentos.</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">Passe o mouse sobre os cards para mais detalhes.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <button onClick={exportToCSV} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-xs sm:text-sm">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar CSV</span>
          <span className="sm:hidden">Exportar</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-2.5 sm:p-4 text-white">
          <p className="text-amber-100 text-[10px] sm:text-xs mb-1">Comercial</p>
          <p className="text-lg sm:text-2xl font-bold">{formatCurrency(metrics.totalComercial)}</p>
          <p className="text-amber-100 text-[10px] sm:text-xs mt-1 hidden sm:block">{metrics.totalVendas} venda(s)</p>
        </div>
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-2.5 sm:p-4 text-white">
          <p className="text-emerald-100 text-[10px] sm:text-xs mb-1">Receita</p>
          <p className="text-lg sm:text-2xl font-bold">{formatCurrency(metrics.totalRecebido)}</p>
          <p className="text-emerald-100 text-[10px] sm:text-xs mt-1 hidden sm:block">{metrics.totalRecebimentos} recebimento(s)</p>
        </div>
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl p-2.5 sm:p-4 text-white">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="w-3 h-3 text-violet-200" />
            <p className="text-violet-100 text-[10px] sm:text-xs">ROI</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold">{metrics.roi}%</p>
          <p className="text-violet-100 text-[10px] sm:text-xs mt-1 hidden sm:block">Retorno</p>
        </div>
        <div className="bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl p-2.5 sm:p-4 text-white">
          <p className="text-slate-300 text-[10px] sm:text-xs mb-1">Ticket</p>
          <p className="text-lg sm:text-2xl font-bold">{formatCurrency(metrics.ticketMedio)}</p>
          <p className="text-slate-300 text-[10px] sm:text-xs mt-1 hidden sm:block">Por recebimento</p>
        </div>
      </div>

      <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4 overflow-x-auto pb-1">
        <button onClick={() => setStatusFilter('all')} className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap ${statusFilter === 'all' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          Todos ({metrics.totalVendas})
        </button>
        <button onClick={() => setStatusFilter('pending')} className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap ${statusFilter === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Pendentes</span> ({metrics.vendasPendentes})
        </button>
        <button onClick={() => setStatusFilter('received')} className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap ${statusFilter === 'received' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Recebido</span> ({metrics.vendasComRecebimento})
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 sm:mb-6">
        <div className="p-3 sm:p-4">
          {/* Mobile: Grid layout */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 items-center">
            <div className="col-span-2 sm:flex-1 sm:min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-10 pr-4 py-1.5 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 hidden sm:block" />
              <select value={dateFilter} onChange={(e) => { setDateFilter(e.target.value as any); setCurrentPage(1); }} className="w-full sm:w-auto border border-slate-200 rounded-lg px-2 py-1.5 sm:py-2 text-xs sm:text-sm">
                <option value="all">Todo período</option>
                <option value="7d">7 dias</option>
                <option value="30d">30 dias</option>
                <option value="month">Este mês</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <Filter className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 hidden sm:block" />
              <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1); }} className="w-full sm:w-auto border border-slate-200 rounded-lg px-2 py-1.5 sm:py-2 text-xs sm:text-sm">
                <option value="all">Todas origens</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-center gap-1">
              <User className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 hidden sm:block" />
              <select value={attendantFilter} onChange={(e) => { setAttendantFilter(e.target.value); setCurrentPage(1); }} className="w-full sm:w-auto border border-slate-200 rounded-lg px-2 py-1.5 sm:py-2 text-xs sm:text-sm">
                <option value="all">Todos comerciais</option>
                {attendants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-slate-500 overflow-x-auto">
          <span className="hidden sm:inline">Ordenar:</span>
          <button onClick={() => handleSort('date')} className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded whitespace-nowrap ${sortField === 'date' ? 'bg-cyan-50 text-cyan-700' : ''}`}>Data <SortIcon field="date" /></button>
          <button onClick={() => handleSort('client')} className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded whitespace-nowrap ${sortField === 'client' ? 'bg-cyan-50 text-cyan-700' : ''}`}>Cliente <SortIcon field="client" /></button>
          <button onClick={() => handleSort('commercial')} className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded whitespace-nowrap ${sortField === 'commercial' ? 'bg-cyan-50 text-cyan-700' : ''}`}>Comercial <SortIcon field="commercial" /></button>
          <button onClick={() => handleSort('received')} className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded whitespace-nowrap ${sortField === 'received' ? 'bg-cyan-50 text-cyan-700' : ''}`}>Recebido <SortIcon field="received" /></button>
        </div>
      </div>

      <div className="space-y-2 sm:space-y-3">
        {paginatedPayments.length === 0 && directReceipts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 sm:p-12 text-center text-slate-500 text-sm">Nenhum lançamento encontrado</div>
        ) : (
          <>
            {paginatedPayments.map((payment) => {
              const isExpanded = expandedPayments.has(payment.id);
              const totalReceiptsValue = payment.receipts.reduce((sum, r) => sum + Number(r.total_value), 0);
              const hasReceipts = payment.receipts.length > 0;
              
              return (
                <div key={payment.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${hasReceipts ? 'border-emerald-200' : 'border-slate-200'}`}>
                  {/* Mobile Layout */}
                  <div className="md:hidden p-3 cursor-pointer hover:bg-slate-50" onClick={() => toggleExpanded(payment.id)}>
                    <div className="flex items-start gap-2 mb-2">
                      <button className="p-0.5 text-slate-400 mt-0.5">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${hasReceipts ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 text-sm">{payment.chat?.client_name || 'Cliente'}</span>
                          {hasReceipts && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(payment.payment_date).toLocaleDateString('pt-BR')}
                          {payment.creator && ` • ${payment.creator.name}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pl-6">
                      <div className="flex gap-3">
                        <div>
                          <div className="text-[10px] text-slate-400">Comercial</div>
                          <div className="font-bold text-amber-600 text-sm">{formatCurrency(Number(payment.value))}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Recebido</div>
                          <div className={`font-bold text-sm ${totalReceiptsValue > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{totalReceiptsValue > 0 ? formatCurrency(totalReceiptsValue) : '-'}</div>
                        </div>
                      </div>
                      {canAddReceipt && (
                        <button onClick={(e) => { e.stopPropagation(); openAddReceiptModal(payment); }} className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-lg">
                          <Plus className="w-3 h-3" />Lançar
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Desktop Layout */}
                  <div className="hidden md:flex p-4 items-center gap-4 cursor-pointer hover:bg-slate-50" onClick={() => toggleExpanded(payment.id)}>
                    <button className="p-1 text-slate-400">{isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}</button>
                    <div className={`w-2 h-2 rounded-full ${hasReceipts ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">{payment.chat?.client_name || 'Cliente'}</span>
                        {payment.source && <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${payment.source.color}20`, color: payment.source.color }}>{payment.source.name}</span>}
                        {hasReceipts && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CheckCircle className="w-3 h-3" />Recebido</span>}
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                        <span>{payment.description || 'Sem descrição'}</span>
                        <span>-</span>
                        <span>{new Date(payment.payment_date).toLocaleDateString('pt-BR')}</span>
                        {payment.creator && <><span>-</span><span className="flex items-center gap-1"><User className="w-3 h-3" />{payment.creator.name}</span></>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Comercial</div>
                      <div className="font-bold text-amber-600">{formatCurrency(Number(payment.value))}</div>
                    </div>
                    <div className="w-px h-10 bg-slate-200"></div>
                    <div className="text-right min-w-[100px]">
                      <div className="text-xs text-slate-400">Recebido</div>
                      <div className={`font-bold ${totalReceiptsValue > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{totalReceiptsValue > 0 ? formatCurrency(totalReceiptsValue) : '-'}</div>
                    </div>
                    {canAddReceipt && (
                      <button onClick={(e) => { e.stopPropagation(); openAddReceiptModal(payment); }} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-lg hover:bg-emerald-100">
                        <Plus className="w-4 h-4" />Lançar
                      </button>
                    )}
                  </div>
                  {isExpanded && payment.receipts.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50 p-3 sm:p-4">
                      <div className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase mb-2 sm:mb-3">Recebimentos ({payment.receipts.length})</div>
                      <div className="space-y-2">
                        {payment.receipts.map((receipt) => (
                          <div key={receipt.id} className="bg-white rounded-lg border border-slate-200 p-2.5 sm:p-3 flex items-start sm:items-center gap-2 sm:gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-emerald-600 text-sm">{formatCurrency(Number(receipt.total_value))}</span>
                                <span className="text-xs text-slate-400">{new Date(receipt.receipt_date).toLocaleDateString('pt-BR')}</span>
                              </div>
                              {receipt.description && <div className="text-xs text-slate-500 truncate">{receipt.description}</div>}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {receipt.receipt_payments?.map((rp, idx) => (
                                  <span key={idx} className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs bg-slate-100 text-slate-600">
                                    {getPaymentMethodLabel(rp.payment_method)}{rp.installments > 1 && ` ${rp.installments}x`}: {formatCurrency(Number(rp.value))}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {canEditReceipt && (
                              <div className="flex items-center gap-0.5 sm:gap-1">
                                <button onClick={() => openEditReceiptModal(payment, receipt)} className="p-1 sm:p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded"><Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                                <button onClick={() => handleDeleteReceipt(receipt.id)} className="p-1 sm:p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {isExpanded && payment.receipts.length === 0 && (
                    <div className="border-t border-slate-100 bg-amber-50 p-3 sm:p-4 text-center">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 mx-auto mb-1" />
                      <p className="text-xs sm:text-sm text-amber-600">Nenhum recebimento lançado</p>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Lançamentos Diretos (sem comercial) */}
            {directReceipts.map((receipt) => (
              <div key={`direct-${receipt.id}`} className="bg-white rounded-xl shadow-sm border overflow-hidden border-teal-200">
                {/* Mobile Layout */}
                <div className="md:hidden p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="p-0.5 text-teal-400">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-800 text-sm">{receipt.chat?.client_name || 'Cliente'}</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-teal-100 text-teal-700">Direto</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(receipt.receipt_date).toLocaleDateString('pt-BR')}
                        {receipt.receipt_payments?.[0]?.payment_method && ` • ${getPaymentMethodLabel(receipt.receipt_payments[0].payment_method)}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pl-6">
                    <div className="flex gap-3">
                      <div>
                        <div className="text-[10px] text-slate-400">Comercial</div>
                        <div className="font-bold text-slate-300 text-sm">-</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Recebido</div>
                        <div className="font-bold text-teal-600 text-sm">{formatCurrency(Number(receipt.total_value))}</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Desktop Layout */}
                <div className="hidden md:flex p-4 items-center gap-4">
                  <div className="p-1 text-teal-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="w-2 h-2 rounded-full bg-teal-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{receipt.chat?.client_name || 'Cliente'}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">Direto</span>
                    </div>
                    <div className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                      <span>{receipt.description || 'Lançamento direto'}</span>
                      <span>-</span>
                      <span>{new Date(receipt.receipt_date).toLocaleDateString('pt-BR')}</span>
                      {receipt.receipt_payments?.[0]?.payment_method && (
                        <>
                          <span>-</span>
                          <span>{getPaymentMethodLabel(receipt.receipt_payments[0].payment_method)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Comercial</div>
                    <div className="font-bold text-slate-300">-</div>
                  </div>
                  <div className="w-px h-10 bg-slate-200"></div>
                  <div className="text-right min-w-[100px]">
                    <div className="text-xs text-slate-400">Recebido</div>
                    <div className="font-bold text-teal-600">{formatCurrency(Number(receipt.total_value))}</div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 sm:mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-slate-500">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedPayments.length)} de {filteredAndSortedPayments.length}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-lg disabled:opacity-50">Anterior</button>
            <span className="text-xs sm:text-sm text-slate-600">{currentPage}/{totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-lg disabled:opacity-50">Próxima</button>
          </div>
        </div>
      )}

      {showModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-xl sm:rounded-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">{editingReceipt ? 'Editar Recebimento' : 'Lançar Recebimento'}</h3>
                <p className="text-xs sm:text-sm text-slate-500">{selectedPayment.chat?.client_name}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              {error && <div className="p-2.5 sm:p-3 bg-red-50 border border-red-200 rounded-lg text-xs sm:text-sm text-red-700">{error}</div>}
              <div className="p-2.5 sm:p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="text-[10px] sm:text-xs font-semibold text-amber-600 uppercase">Venda do Comercial</div>
                <div className="text-base sm:text-lg font-bold text-amber-700">{formatCurrency(Number(selectedPayment.value))}</div>
                <div className="text-xs sm:text-sm text-amber-600 truncate">{selectedPayment.description || 'Sem descrição'}{selectedPayment.creator && ` - ${selectedPayment.creator.name}`}</div>
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase">Data do Recebimento</label>
                <input type="date" value={formData.receipt_date} onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })} className="w-full mt-1 h-9 sm:h-10 rounded-lg border-slate-200 px-3 text-sm" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase">Formas de Pagamento *</label>
                  <button type="button" onClick={addPaymentMethod} className="text-[10px] sm:text-xs text-cyan-600 font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar</button>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  {formData.payments.map((payment, index) => (
                    <div key={index} className="flex flex-wrap sm:flex-nowrap gap-2 items-start p-2.5 sm:p-3 bg-slate-50 rounded-lg">
                      <input type="number" placeholder="Valor" value={payment.value} onChange={(e) => updatePaymentMethod(index, 'value', e.target.value)} className="w-full sm:flex-1 h-9 rounded-lg border-slate-200 px-3 text-sm" />
                      <div className="flex gap-2 w-full sm:w-auto">
                        <select value={payment.payment_method} onChange={(e) => updatePaymentMethod(index, 'payment_method', e.target.value)} className="flex-1 sm:flex-none h-9 rounded-lg border-slate-200 px-2 text-xs sm:text-sm">
                          {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        {payment.payment_method === 'cartao_credito' && (
                          <select value={payment.installments} onChange={(e) => updatePaymentMethod(index, 'installments', parseInt(e.target.value))} className="w-16 sm:w-20 h-9 rounded-lg border-slate-200 px-2 text-xs sm:text-sm">
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
                          </select>
                        )}
                        {formData.payments.length > 1 && <button type="button" onClick={() => removePaymentMethod(index)} className="p-2 text-red-400 hover:text-red-600 rounded"><X className="w-4 h-4" /></button>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 sm:mt-3 p-2.5 sm:p-3 bg-emerald-50 rounded-lg flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-medium text-emerald-700">Total:</span>
                  <span className="text-base sm:text-lg font-bold text-emerald-700">{formatCurrency(calculateTotalFromPayments())}</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase">Descrição</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Ex: Tratamento ortodôntico..." rows={2} className="w-full mt-1 rounded-lg border-slate-200 px-3 py-2 text-xs sm:text-sm" />
              </div>
            </div>
            <div className="sticky bottom-0 bg-slate-50 p-3 sm:p-4 flex gap-2 sm:gap-3">
              <button onClick={handleSave} disabled={saving} className="flex-1 h-10 sm:h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Salvando...</> : 'Salvar'}
              </button>
              <button onClick={() => setShowModal(false)} className="flex-1 h-10 sm:h-11 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Receipts;
