import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download,
  TrendingUp,
  Calendar,
  Filter,
  User,
  ChevronDown,
  ChevronUp,
  Target,
  Clock,
  Users,
  BarChart3,
  Percent,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { GlobalState } from '../types';
import { getDataAccess } from '../lib/permissions';

interface ReportsProps {
  state: GlobalState;
}

interface PaymentData {
  id: string;
  value: number;
  payment_date: string;
  created_by: string | null;
  description: string | null;
  chat: {
    id: string;
    client_name: string;
    source_id: string | null;
  } | null;
  creator: {
    id: string;
    name: string;
  } | null;
}

interface ReceiptData {
  payment_id: string | null;
  total_value: number;
  receipt_date?: string;
  chat_id?: string;
  description?: string | null;
  chat?: { client_name: string } | null;
}

interface LeadSource {
  id: string;
  name: string;
  color: string;
}

interface AttendantStats {
  id: string;
  name: string;
  salesCount: number;
  commercialValue: number;
  receivedValue: number;
  total: number;
}

interface SaleDetail {
  id: string;
  clientName: string;
  paymentDate: string;
  sourceName: string;
  sourceColor: string;
  attendantName: string;
  commercialValue: number;
  receivedValue: number;
  description: string | null;
  status: 'pending' | 'received' | 'partial';
}

type SortField = 'date' | 'client' | 'value' | 'received';
type SortDirection = 'asc' | 'desc';

type DateFilter = 'all' | '7d' | '30d' | 'month' | 'lastMonth';

const Reports: React.FC<ReportsProps> = ({ state }) => {
  const { user } = useAuth();
  const clinicId = state.selectedClinic?.id;
  
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [attendants, setAttendants] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [attendantFilter, setAttendantFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const [expandedSection, setExpandedSection] = useState<'comercial' | 'origem' | 'details' | null>('comercial');
  const [hoveredBar, setHoveredBar] = useState<{ type: string; idx: number } | null>(null);

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
        .select('id, value, payment_date, created_by, description, chat:chats(id, client_name, source_id, assigned_to, attendant:users!chats_assigned_to_fkey(id, name)), creator:users!payments_created_by_fkey(id, name)')
        .eq('clinic_id', clinicId)
        .or('status.is.null,status.eq.active')
        .order('payment_date', { ascending: false });

      const { data: receiptsData } = await supabase
        .from('clinic_receipts' as any)
        .select('payment_id, total_value, receipt_date, chat_id, description, chat:chats(client_name)')
        .eq('clinic_id', clinicId);

      const { data: sourcesData } = await supabase
        .from('lead_sources' as any)
        .select('id, name, color')
        .eq('clinic_id', clinicId);

      const { data: usersData } = await supabase
        .from('users')
        .select('id, name')
        .eq('clinic_id', clinicId);

      setPayments((paymentsData || []) as unknown as PaymentData[]);
      setReceipts((receiptsData || []) as unknown as ReceiptData[]);
      setSources((sourcesData || []) as unknown as LeadSource[]);
      setAttendants((usersData || []) as unknown as { id: string; name: string }[]);
      
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = useMemo(() => {
    let filtered = [...payments];
    
    // Filtro por data personalizada
    if (customDateStart && customDateEnd) {
      const startDate = new Date(customDateStart);
      const endDate = new Date(customDateEnd);
      endDate.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter(p => {
        const payDate = new Date(p.payment_date);
        return payDate >= startDate && payDate <= endDate;
      });
    } else if (dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;
      
      switch (dateFilter) {
        case '7d': 
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); 
          break;
        case '30d': 
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); 
          break;
        case 'month': 
          startDate = new Date(now.getFullYear(), now.getMonth(), 1); 
          break;
        case 'lastMonth':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        default: 
          startDate = new Date(0);
      }
      
      filtered = filtered.filter(p => {
        const payDate = new Date(p.payment_date);
        return payDate >= startDate && payDate <= endDate;
      });
    }
    
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(p => p.chat?.source_id === sourceFilter);
    }
    
    if (attendantFilter !== 'all') {
      filtered = filtered.filter(p => p.created_by === attendantFilter);
    }
    
    // Filtro por busca de cliente
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.chat?.client_name?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [payments, dateFilter, sourceFilter, attendantFilter, searchQuery, customDateStart, customDateEnd]);

  // Calcular período anterior para comparativo
  const previousPeriodPayments = useMemo(() => {
    if (customDateStart && customDateEnd) {
      const start = new Date(customDateStart);
      const end = new Date(customDateEnd);
      const diff = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - diff - 24 * 60 * 60 * 1000);
      const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
      
      return payments.filter(p => {
        const payDate = new Date(p.payment_date);
        return payDate >= prevStart && payDate <= prevEnd;
      });
    }
    
    const now = new Date();
    let prevStart: Date;
    let prevEnd: Date;
    
    switch (dateFilter) {
      case '7d':
        prevStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        prevEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        prevStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        prevEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'lastMonth':
        prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
        break;
      default:
        return [];
    }
    
    return payments.filter(p => {
      const payDate = new Date(p.payment_date);
      return payDate >= prevStart && payDate <= prevEnd;
    });
  }, [payments, dateFilter, customDateStart, customDateEnd]);

  const metrics = useMemo(() => {
    const totalComercial = filteredPayments.reduce((sum, p) => sum + Number(p.value), 0);
    
    // Receita via comercial (vinculada a payments)
    const filteredPaymentIds = filteredPayments.map(p => p.id);
    const filteredReceipts = receipts.filter(r => r.payment_id && filteredPaymentIds.includes(r.payment_id));
    const totalRecebidoComercial = filteredReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
    
    // Receita direta (sem payment_id) - filtrar por período
    const directReceipts = receipts.filter(r => r.payment_id === null && r.receipt_date);
    let filteredDirectReceipts = directReceipts;
    
    if (customDateStart && customDateEnd) {
      const startDate = new Date(customDateStart);
      const endDate = new Date(customDateEnd);
      endDate.setHours(23, 59, 59, 999);
      filteredDirectReceipts = directReceipts.filter(r => {
        const receiptDate = new Date(r.receipt_date!);
        return receiptDate >= startDate && receiptDate <= endDate;
      });
    } else if (dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;
      
      switch (dateFilter) {
        case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'lastMonth':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        default: startDate = new Date(0);
      }
      
      filteredDirectReceipts = directReceipts.filter(r => {
        const receiptDate = new Date(r.receipt_date!);
        return receiptDate >= startDate && receiptDate <= endDate;
      });
    }
    
    const totalRecebidoDireto = filteredDirectReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
    const totalRecebido = totalRecebidoComercial + totalRecebidoDireto;
    
    const total = totalComercial + totalRecebido;
    
    // Métricas do período anterior
    const prevComercial = previousPeriodPayments.reduce((sum, p) => sum + Number(p.value), 0);
    const prevPaymentIds = previousPeriodPayments.map(p => p.id);
    const prevReceipts = receipts.filter(r => r.payment_id && prevPaymentIds.includes(r.payment_id));
    const prevRecebido = prevReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
    const prevTotal = prevComercial + prevRecebido;
    const prevVendas = previousPeriodPayments.length;
    
    // Calcular variação percentual
    const varComercial = prevComercial > 0 ? ((totalComercial - prevComercial) / prevComercial) * 100 : 0;
    const varRecebido = prevRecebido > 0 ? ((totalRecebido - prevRecebido) / prevRecebido) * 100 : 0;
    const varTotal = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
    const varVendas = prevVendas > 0 ? ((filteredPayments.length - prevVendas) / prevVendas) * 100 : 0;
    
    return { 
      totalComercial, totalRecebido, total, totalVendas: filteredPayments.length,
      prevComercial, prevRecebido, prevTotal, prevVendas,
      varComercial, varRecebido, varTotal, varVendas
    };
  }, [filteredPayments, receipts, previousPeriodPayments, dateFilter, customDateStart, customDateEnd]);

  const byAttendant = useMemo((): AttendantStats[] => {
    const attendantMap = new Map<string, { salesCount: number; commercialValue: number; receivedValue: number }>();
    
    filteredPayments.forEach(p => {
      const attendantId = p.created_by || 'unknown';
      if (!attendantMap.has(attendantId)) {
        attendantMap.set(attendantId, { salesCount: 0, commercialValue: 0, receivedValue: 0 });
      }
      const att = attendantMap.get(attendantId)!;
      att.salesCount++;
      att.commercialValue += Number(p.value);
      
      const paymentReceipts = receipts.filter(r => r.payment_id === p.id);
      att.receivedValue += paymentReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
    });

    return Array.from(attendantMap.entries()).map(([attendantId, data]) => {
      const attendant = attendants.find(a => a.id === attendantId);
      return {
        id: attendantId,
        name: attendant?.name || 'Desconhecido',
        salesCount: data.salesCount,
        commercialValue: data.commercialValue,
        receivedValue: data.receivedValue,
        total: data.commercialValue + data.receivedValue
      };
    }).sort((a, b) => b.commercialValue - a.commercialValue);
  }, [filteredPayments, receipts, attendants]);

  // Dados agregados por dia para gráfico de evolução
  const dailyData = useMemo(() => {
    const dayMap = new Map<string, { comercial: number; recebido: number; vendas: number }>();
    
    filteredPayments.forEach(p => {
      const date = p.payment_date.split('T')[0];
      if (!dayMap.has(date)) {
        dayMap.set(date, { comercial: 0, recebido: 0, vendas: 0 });
      }
      const day = dayMap.get(date)!;
      day.comercial += Number(p.value);
      day.vendas++;
      
      const paymentReceipts = receipts.filter(r => r.payment_id === p.id);
      day.recebido += paymentReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
    });
    
    return Array.from(dayMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredPayments, receipts]);

  // Dados agregados por origem para gráfico
  const bySource = useMemo(() => {
    const sourceMap = new Map<string, { name: string; color: string; comercial: number; recebido: number; vendas: number }>();
    
    filteredPayments.forEach(p => {
      const sourceId = p.chat?.source_id || 'unknown';
      const source = sources.find(s => s.id === sourceId);
      
      if (!sourceMap.has(sourceId)) {
        sourceMap.set(sourceId, { 
          name: source?.name || 'Sem origem', 
          color: source?.color || '#94a3b8',
          comercial: 0, 
          recebido: 0, 
          vendas: 0 
        });
      }
      const s = sourceMap.get(sourceId)!;
      s.comercial += Number(p.value);
      s.vendas++;
      
      const paymentReceipts = receipts.filter(r => r.payment_id === p.id);
      s.recebido += paymentReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
    });
    
    return Array.from(sourceMap.values()).sort((a, b) => b.comercial - a.comercial);
  }, [filteredPayments, receipts, sources]);

  const details = useMemo((): SaleDetail[] => {
    // Vendas comerciais
    const mapped = filteredPayments.map(p => {
      const paymentReceipts = receipts.filter(r => r.payment_id === p.id);
      const receivedValue = paymentReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
      const source = sources.find(s => s.id === p.chat?.source_id);
      
      let status: 'pending' | 'received' | 'partial' = 'pending';
      if (receivedValue > 0) {
        status = receivedValue >= Number(p.value) ? 'received' : 'partial';
      }
      
      return {
        id: p.id,
        clientName: p.chat?.client_name || 'Cliente',
        paymentDate: p.payment_date,
        sourceName: source?.name || '-',
        sourceColor: source?.color || '#94a3b8',
        attendantName: (p.chat as any)?.attendant?.name || p.creator?.name || 'Desconhecido',
        commercialValue: Number(p.value),
        receivedValue,
        description: p.description,
        status,
        isDirect: false
      };
    });
    
    // Lançamentos diretos (sem payment_id) - filtrar por período
    const directReceipts = receipts.filter(r => r.payment_id === null && r.receipt_date);
    let filteredDirectReceipts = directReceipts;
    
    if (customDateStart && customDateEnd) {
      const startDate = new Date(customDateStart);
      const endDate = new Date(customDateEnd);
      endDate.setHours(23, 59, 59, 999);
      filteredDirectReceipts = directReceipts.filter(r => {
        const receiptDate = new Date(r.receipt_date!);
        return receiptDate >= startDate && receiptDate <= endDate;
      });
    } else if (dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;
      
      switch (dateFilter) {
        case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'lastMonth':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        default: startDate = new Date(0);
      }
      
      filteredDirectReceipts = directReceipts.filter(r => {
        const receiptDate = new Date(r.receipt_date!);
        return receiptDate >= startDate && receiptDate <= endDate;
      });
    }
    
    // Adicionar lançamentos diretos à lista
    const directMapped = filteredDirectReceipts.map(r => ({
      id: `direct-${r.chat_id}-${r.receipt_date}`,
      clientName: (r.chat as any)?.client_name || 'Cliente',
      paymentDate: r.receipt_date!,
      sourceName: 'Direto',
      sourceColor: '#14b8a6',
      attendantName: '-',
      commercialValue: 0,
      receivedValue: Number(r.total_value),
      description: r.description || null,
      status: 'received' as const,
      isDirect: true
    }));
    
    const allDetails = [...mapped, ...directMapped];
    
    // Ordenação
    return allDetails.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime();
          break;
        case 'client':
          comparison = a.clientName.localeCompare(b.clientName);
          break;
        case 'value':
          comparison = a.commercialValue - b.commercialValue;
          break;
        case 'received':
          comparison = a.receivedValue - b.receivedValue;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredPayments, receipts, sources, sortField, sortDirection, dateFilter, customDateStart, customDateEnd]);
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-cyan-600" />
      : <ArrowDown className="w-3 h-3 text-cyan-600" />;
  };

  const exportToCSV = () => {
    let csv = 'Comercial;Vendas;Valor Comercial;Recebido;Total\n';
    byAttendant.forEach(att => {
      csv += `${att.name};${att.salesCount};${att.commercialValue.toFixed(2)};${att.receivedValue.toFixed(2)};${att.total.toFixed(2)}\n`;
    });
    csv += '\n\nCliente;Data;Origem;Comercial;Valor;Recebido;Status\n';
    details.forEach(d => {
      csv += `${d.clientName};${new Date(d.paymentDate).toLocaleDateString('pt-BR')};${d.sourceName};${d.attendantName};${d.commercialValue.toFixed(2)};${d.receivedValue.toFixed(2)};${d.status}\n`;
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case '7d': return 'Ultimos 7 dias';
      case '30d': return 'Ultimos 30 dias';
      case 'month': return 'Este mes';
      case 'lastMonth': return 'Mes anterior';
      default: return 'Todo periodo';
    }
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
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Relatórios Financeiros</h1>
          <p className="text-slate-500 text-xs sm:text-sm">Análise de vendas e recebimentos</p>
        </div>
        <button onClick={exportToCSV} className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 text-xs sm:text-sm">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar CSV</span>
          <span className="sm:hidden">Exportar</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 mb-4 sm:mb-6">
        {/* Mobile: Filtros em grid */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 items-center">
          <div className="flex items-center gap-1 sm:gap-2">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 hidden sm:block" />
            <select 
              value={customDateStart ? 'custom' : dateFilter} 
              onChange={(e) => {
                if (e.target.value !== 'custom') {
                  setDateFilter(e.target.value as DateFilter);
                  setCustomDateStart('');
                  setCustomDateEnd('');
                }
              }} 
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs sm:text-sm w-full sm:w-auto"
            >
              <option value="all">Todo período</option>
              <option value="7d">7 dias</option>
              <option value="30d">30 dias</option>
              <option value="month">Este mês</option>
              <option value="lastMonth">Mês anterior</option>
              {customDateStart && <option value="custom">Personalizado</option>}
            </select>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Filter className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 hidden sm:block" />
            <select 
              value={sourceFilter} 
              onChange={(e) => setSourceFilter(e.target.value)} 
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs sm:text-sm w-full sm:w-auto"
            >
              <option value="all">Todas origens</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <User className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 hidden sm:block" />
            <select 
              value={attendantFilter} 
              onChange={(e) => setAttendantFilter(e.target.value)} 
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs sm:text-sm w-full sm:w-auto"
            >
              <option value="all">Todos comerciais</option>
              {attendants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Search className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 hidden sm:block" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs sm:text-sm w-full sm:w-36"
            />
          </div>
          {/* Datas personalizadas - só no desktop */}
          <div className="hidden lg:flex items-center gap-1">
            <input
              type="date"
              value={customDateStart}
              onChange={(e) => setCustomDateStart(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm w-32"
            />
            <span className="text-slate-400 text-xs">até</span>
            <input
              type="date"
              value={customDateEnd}
              onChange={(e) => setCustomDateEnd(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm w-32"
            />
            {(customDateStart || customDateEnd) && (
              <button
                onClick={() => { setCustomDateStart(''); setCustomDateEnd(''); }}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            )}
          </div>
          <div className="col-span-2 sm:col-span-1 text-center sm:text-left text-xs sm:text-sm text-slate-500 sm:ml-auto">
            {metrics.totalVendas} venda(s)
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-3 sm:p-5 rounded-xl sm:rounded-2xl shadow-lg text-white relative group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <p className="text-amber-100 text-[10px] sm:text-xs font-medium uppercase tracking-wider">Valor Comercial</p>
            </div>
            {metrics.varComercial !== 0 && (
              <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded ${metrics.varComercial > 0 ? 'bg-white/20' : 'bg-amber-700/50'}`}>
                {metrics.varComercial > 0 ? '+' : ''}{metrics.varComercial.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xl sm:text-2xl font-black mt-1">{formatCurrency(metrics.totalComercial)}</p>
          <p className="text-amber-100 text-[10px] sm:text-xs mt-1 sm:mt-2 hidden sm:block">
            {metrics.prevComercial > 0 ? `Anterior: ${formatCurrency(metrics.prevComercial)}` : 'Total fechado'}
          </p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3 sm:p-5 rounded-xl sm:rounded-2xl shadow-lg text-white relative group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <p className="text-emerald-100 text-[10px] sm:text-xs font-medium uppercase tracking-wider">Receita Clínica</p>
            </div>
            {metrics.varRecebido !== 0 && (
              <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded ${metrics.varRecebido > 0 ? 'bg-white/20' : 'bg-emerald-700/50'}`}>
                {metrics.varRecebido > 0 ? '+' : ''}{metrics.varRecebido.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xl sm:text-2xl font-black mt-1">{formatCurrency(metrics.totalRecebido)}</p>
          <p className="text-emerald-100 text-[10px] sm:text-xs mt-1 sm:mt-2 hidden sm:block">
            {metrics.prevRecebido > 0 ? `Anterior: ${formatCurrency(metrics.prevRecebido)}` : 'Total recebido'}
          </p>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-3 sm:p-5 rounded-xl sm:rounded-2xl shadow-lg text-white relative group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-violet-200" />
              <p className="text-violet-100 text-[10px] sm:text-xs font-medium uppercase tracking-wider">Total</p>
            </div>
            {metrics.varTotal !== 0 && (
              <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded ${metrics.varTotal > 0 ? 'bg-white/20' : 'bg-violet-700/50'}`}>
                {metrics.varTotal > 0 ? '+' : ''}{metrics.varTotal.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xl sm:text-2xl font-black mt-1">{formatCurrency(metrics.total)}</p>
          <p className="text-violet-100 text-[10px] sm:text-xs mt-1 sm:mt-2 hidden sm:block">
            {metrics.prevTotal > 0 ? `Anterior: ${formatCurrency(metrics.prevTotal)}` : 'Comercial + Receita'}
          </p>
        </div>
      </div>

      {/* Gráficos */}
      {dailyData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Gráfico de Evolução Diária */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1 sm:gap-2">
                  <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-600" />
                  <span className="hidden sm:inline">Evolução por Dia</span>
                  <span className="sm:hidden">Por Dia</span>
                </h3>
              </div>
              <span className="text-[10px] sm:text-xs text-slate-500">{dailyData.length} dias</span>
            </div>
            
            {/* Barras Comercial */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="w-2 h-2 bg-amber-500 rounded"></span>
                  Comercial
                </span>
                <span className="text-xs font-medium text-amber-600">
                  {hoveredBar?.type === 'comercial' && dailyData[hoveredBar.idx] 
                    ? `${new Date(dailyData[hoveredBar.idx].date).toLocaleDateString('pt-BR')}: ${formatCurrency(dailyData[hoveredBar.idx].comercial)}`
                    : formatCurrency(dailyData.reduce((sum, d) => sum + d.comercial, 0))
                  }
                </span>
              </div>
              <div className="flex items-end gap-[2px] h-12">
                {dailyData.map((day, idx) => {
                  const max = Math.max(...dailyData.map(d => d.comercial), 1);
                  const height = (day.comercial / max) * 100;
                  return (
                    <div 
                      key={idx}
                      className="flex-1 bg-amber-500 rounded-t hover:bg-amber-400 transition-colors cursor-pointer"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      onMouseEnter={() => setHoveredBar({ type: 'comercial', idx })}
                      onMouseLeave={() => setHoveredBar(null)}
                    />
                  );
                })}
              </div>
            </div>
            
            {/* Barras Recebido */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded"></span>
                  Recebido
                </span>
                <span className="text-xs font-medium text-emerald-600">
                  {hoveredBar?.type === 'recebido' && dailyData[hoveredBar.idx] 
                    ? `${new Date(dailyData[hoveredBar.idx].date).toLocaleDateString('pt-BR')}: ${formatCurrency(dailyData[hoveredBar.idx].recebido)}`
                    : formatCurrency(dailyData.reduce((sum, d) => sum + d.recebido, 0))
                  }
                </span>
              </div>
              <div className="flex items-end gap-[2px] h-12">
                {dailyData.map((day, idx) => {
                  const max = Math.max(...dailyData.map(d => d.recebido), 1);
                  const height = (day.recebido / max) * 100;
                  return (
                    <div 
                      key={idx}
                      className="flex-1 bg-emerald-500 rounded-t hover:bg-emerald-400 transition-colors cursor-pointer"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      onMouseEnter={() => setHoveredBar({ type: 'recebido', idx })}
                      onMouseLeave={() => setHoveredBar(null)}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Gráfico por Origem */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1 sm:gap-2">
                  <Filter className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-600" />
                  Por Origem
                </h3>
              </div>
              <span className="text-[10px] sm:text-xs text-slate-500">{bySource.length} origens</span>
            </div>
            
            <div className="space-y-3">
              {bySource.slice(0, 6).map((source, idx) => {
                const maxComercial = Math.max(...bySource.map(s => s.comercial), 1);
                const widthComercial = (source.comercial / maxComercial) * 100;
                const widthRecebido = (source.recebido / maxComercial) * 100;
                
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
                        <span className="w-2 h-2 rounded" style={{ backgroundColor: source.color }}></span>
                        {source.name}
                      </span>
                      <span className="text-xs text-slate-500">{source.vendas} vendas</span>
                    </div>
                    <div className="flex gap-1 h-4">
                      <div 
                        className="bg-amber-500 rounded-l"
                        style={{ width: `${widthComercial}%` }}
                        title={`Comercial: ${formatCurrency(source.comercial)}`}
                      />
                      <div 
                        className="bg-emerald-500 rounded-r"
                        style={{ width: `${widthRecebido}%` }}
                        title={`Recebido: ${formatCurrency(source.recebido)}`}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                      <span>{formatCurrency(source.comercial)}</span>
                      <span>{formatCurrency(source.recebido)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Por Comercial */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm mb-4 sm:mb-6">
        <button 
          onClick={() => setExpandedSection(expandedSection === 'comercial' ? null : 'comercial')}
          className="w-full p-3 sm:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h3 className="text-sm sm:text-lg font-bold text-slate-900">Por Comercial</h3>
          {expandedSection === 'comercial' ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />}
        </button>
        
        {expandedSection === 'comercial' && (
          <div className="border-t border-slate-100">
            {byAttendant.length === 0 ? (
              <div className="p-6 text-center text-slate-500">Nenhum dado disponivel</div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Comercial</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Vendas</th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Valor Comercial</th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Recebido</th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {byAttendant.map(att => (
                        <tr key={att.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-800">{att.name}</td>
                          <td className="py-3 px-4 text-center text-slate-600">{att.salesCount}</td>
                          <td className="py-3 px-4 text-right font-bold text-amber-600">
                            {formatCurrency(att.commercialValue)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">
                            {formatCurrency(att.receivedValue)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-violet-600">
                            {formatCurrency(att.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-700">Total</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">{metrics.totalVendas}</td>
                        <td className="py-3 px-4 text-right font-black text-amber-600">{formatCurrency(metrics.totalComercial)}</td>
                        <td className="py-3 px-4 text-right font-black text-emerald-600">{formatCurrency(metrics.totalRecebido)}</td>
                        <td className="py-3 px-4 text-right font-black text-violet-600">{formatCurrency(metrics.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {byAttendant.map(att => (
                    <div key={att.id} className="p-4">
                      <p className="font-medium text-slate-800 mb-2">{att.name}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">Vendas</p>
                          <p className="font-medium">{att.salesCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Total</p>
                          <span className="font-bold text-violet-600">
                            {formatCurrency(att.total)}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Comercial</p>
                          <p className="font-bold text-amber-600">{formatCurrency(att.commercialValue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Recebido</p>
                          <p className="font-bold text-emerald-600">{formatCurrency(att.receivedValue)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Por Origem */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm mb-4 sm:mb-6">
        <button 
          onClick={() => setExpandedSection(expandedSection === 'origem' ? null : 'origem')}
          className="w-full p-3 sm:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h3 className="text-sm sm:text-lg font-bold text-slate-900">Por Origem</h3>
          {expandedSection === 'origem' ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />}
        </button>
        
        {expandedSection === 'origem' && (
          <div className="border-t border-slate-100">
            {bySource.length === 0 ? (
              <div className="p-6 text-center text-slate-500">Nenhum dado disponivel</div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Origem</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Vendas</th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Valor Comercial</th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Recebido</th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bySource.map((source, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-800 flex items-center gap-2">
                            <span className="w-3 h-3 rounded" style={{ backgroundColor: source.color }}></span>
                            {source.name}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-600">{source.vendas}</td>
                          <td className="py-3 px-4 text-right font-bold text-amber-600">
                            {formatCurrency(source.comercial)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">
                            {formatCurrency(source.recebido)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-violet-600">
                            {formatCurrency(source.comercial + source.recebido)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-700">Total</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">{metrics.totalVendas}</td>
                        <td className="py-3 px-4 text-right font-black text-amber-600">{formatCurrency(metrics.totalComercial)}</td>
                        <td className="py-3 px-4 text-right font-black text-emerald-600">{formatCurrency(metrics.totalRecebido)}</td>
                        <td className="py-3 px-4 text-right font-black text-violet-600">{formatCurrency(metrics.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {bySource.map((source, idx) => (
                    <div key={idx} className="p-4">
                      <p className="font-medium text-slate-800 mb-2 flex items-center gap-2">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: source.color }}></span>
                        {source.name}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">Vendas</p>
                          <p className="font-medium">{source.vendas}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Total</p>
                          <span className="font-bold text-violet-600">
                            {formatCurrency(source.comercial + source.recebido)}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Comercial</p>
                          <p className="font-bold text-amber-600">{formatCurrency(source.comercial)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Recebido</p>
                          <p className="font-bold text-emerald-600">{formatCurrency(source.recebido)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Detalhamento */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
        <button 
          onClick={() => setExpandedSection(expandedSection === 'details' ? null : 'details')}
          className="w-full p-3 sm:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h3 className="text-sm sm:text-lg font-bold text-slate-900">Detalhamento</h3>
          {expandedSection === 'details' ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />}
        </button>
        
        {expandedSection === 'details' && (
          <div className="border-t border-slate-100">
            {details.length === 0 ? (
              <div className="p-6 text-center text-slate-500">Nenhum dado disponivel</div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th 
                          className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('client')}
                        >
                          <div className="flex items-center gap-1">Cliente {getSortIcon('client')}</div>
                        </th>
                        <th 
                          className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('date')}
                        >
                          <div className="flex items-center justify-center gap-1">Data {getSortIcon('date')}</div>
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Descrição</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Origem</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Comercial</th>
                        <th 
                          className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('value')}
                        >
                          <div className="flex items-center justify-end gap-1">Valor {getSortIcon('value')}</div>
                        </th>
                        <th 
                          className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('received')}
                        >
                          <div className="flex items-center justify-end gap-1">Recebido {getSortIcon('received')}</div>
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {details.map(sale => (
                        <tr key={sale.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-800">{sale.clientName}</td>
                          <td className="py-3 px-4 text-center text-sm text-slate-600">
                            {new Date(sale.paymentDate).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-4 text-center text-sm text-slate-600">
                            {sale.description || '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span 
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: `${sale.sourceColor}20`, color: sale.sourceColor }}
                            >
                              {sale.sourceName}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-sm text-slate-600">{sale.attendantName}</td>
                          <td className="py-3 px-4 text-right font-bold text-amber-600">
                            {formatCurrency(sale.commercialValue)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-bold ${sale.receivedValue > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {sale.receivedValue > 0 ? formatCurrency(sale.receivedValue) : '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {sale.status === 'received' && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                Recebido
                              </span>
                            )}
                            {sale.status === 'partial' && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                Parcial
                              </span>
                            )}
                            {sale.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                Pendente
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {details.map(sale => (
                    <div key={sale.id} className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">{sale.clientName}</p>
                          <p className="text-xs text-slate-500">{sale.attendantName} - {new Date(sale.paymentDate).toLocaleDateString('pt-BR')}</p>
                        </div>
                        {sale.status === 'received' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 shrink-0">
                            Recebido
                          </span>
                        )}
                        {sale.status === 'partial' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 shrink-0">
                            Parcial
                          </span>
                        )}
                        {sale.status === 'pending' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 shrink-0">
                            Pendente
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span 
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ backgroundColor: `${sale.sourceColor}20`, color: sale.sourceColor }}
                        >
                          {sale.sourceName}
                        </span>
                        {sale.description && (
                          <span className="text-xs text-slate-500">• {sale.description}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">Comercial</p>
                          <p className="font-bold text-amber-600">{formatCurrency(sale.commercialValue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Recebido</p>
                          <p className={`font-bold ${sale.receivedValue > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {sale.receivedValue > 0 ? formatCurrency(sale.receivedValue) : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
