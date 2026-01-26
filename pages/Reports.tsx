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
  XCircle
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
  payment_id: string;
  total_value: number;
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
  roi: string;
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
  status: 'pending' | 'received' | 'partial';
}

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
  
  const [expandedSection, setExpandedSection] = useState<'comercial' | 'details' | null>('comercial');

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
        .select('id, value, payment_date, created_by, chat:chats(id, client_name, source_id), creator:users!payments_created_by_fkey(id, name)')
        .eq('clinic_id', clinicId)
        .or('status.is.null,status.eq.active')
        .order('payment_date', { ascending: false });

      const { data: receiptsData } = await supabase
        .from('clinic_receipts' as any)
        .select('payment_id, total_value')
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
    
    if (dateFilter !== 'all') {
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
    
    return filtered;
  }, [payments, dateFilter, sourceFilter, attendantFilter]);

  const metrics = useMemo(() => {
    const totalComercial = filteredPayments.reduce((sum, p) => sum + Number(p.value), 0);
    
    const filteredPaymentIds = filteredPayments.map(p => p.id);
    const filteredReceipts = receipts.filter(r => filteredPaymentIds.includes(r.payment_id));
    const totalRecebido = filteredReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
    
    const roi = totalComercial > 0 ? ((totalRecebido / totalComercial) * 100).toFixed(1) : '0';
    
    return { totalComercial, totalRecebido, roi, totalVendas: filteredPayments.length };
  }, [filteredPayments, receipts]);

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
        roi: data.commercialValue > 0 ? ((data.receivedValue / data.commercialValue) * 100).toFixed(1) : '0'
      };
    }).sort((a, b) => b.commercialValue - a.commercialValue);
  }, [filteredPayments, receipts, attendants]);

  const details = useMemo((): SaleDetail[] => {
    return filteredPayments.map(p => {
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
        attendantName: p.creator?.name || 'Desconhecido',
        commercialValue: Number(p.value),
        receivedValue,
        status
      };
    });
  }, [filteredPayments, receipts, sources]);

  const exportToCSV = () => {
    let csv = 'Comercial;Vendas;Valor Comercial;Recebido;ROI\n';
    byAttendant.forEach(att => {
      csv += `${att.name};${att.salesCount};${att.commercialValue.toFixed(2)};${att.receivedValue.toFixed(2)};${att.roi}%\n`;
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Relatorios Financeiros</h1>
          <p className="text-slate-500 text-sm">Analise de vendas e recebimentos por comercial</p>
        </div>
        <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value as DateFilter)} 
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">Todo periodo</option>
              <option value="7d">Ultimos 7 dias</option>
              <option value="30d">Ultimos 30 dias</option>
              <option value="month">Este mes</option>
              <option value="lastMonth">Mes anterior</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={sourceFilter} 
              onChange={(e) => setSourceFilter(e.target.value)} 
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">Todas origens</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <select 
              value={attendantFilter} 
              onChange={(e) => setAttendantFilter(e.target.value)} 
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">Todos comerciais</option>
              {attendants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="ml-auto text-sm text-slate-500">
            {getDateFilterLabel()} - {metrics.totalVendas} venda(s)
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-5 rounded-2xl shadow-lg text-white">
          <p className="text-amber-100 text-xs font-medium uppercase tracking-wider">Valor Comercial</p>
          <p className="text-2xl font-black mt-1">{formatCurrency(metrics.totalComercial)}</p>
          <p className="text-amber-100 text-xs mt-2">Total fechado pelos comerciais</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl shadow-lg text-white">
          <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Receita Clinica</p>
          <p className="text-2xl font-black mt-1">{formatCurrency(metrics.totalRecebido)}</p>
          <p className="text-emerald-100 text-xs mt-2">Total recebido pela clinica</p>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-5 rounded-2xl shadow-lg text-white">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="w-3 h-3 text-violet-200" />
            <p className="text-violet-100 text-xs font-medium uppercase tracking-wider">ROI</p>
          </div>
          <p className="text-2xl font-black mt-1">{metrics.roi}%</p>
          <p className="text-violet-100 text-xs mt-2">Retorno sobre vendas</p>
        </div>
      </div>

      {/* Por Comercial */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6">
        <button 
          onClick={() => setExpandedSection(expandedSection === 'comercial' ? null : 'comercial')}
          className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h3 className="text-base sm:text-lg font-bold text-slate-900">Por Comercial</h3>
          {expandedSection === 'comercial' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
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
                        <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">ROI</th>
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
                          <td className="py-3 px-4 text-center">
                            <span className={`font-bold ${Number(att.roi) >= 100 ? 'text-emerald-600' : 'text-slate-600'}`}>
                              {att.roi}%
                            </span>
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
                        <td className="py-3 px-4 text-center font-black text-violet-600">{metrics.roi}%</td>
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
                          <p className="text-xs text-slate-500">ROI</p>
                          <span className={`font-bold ${Number(att.roi) >= 100 ? 'text-emerald-600' : 'text-slate-600'}`}>
                            {att.roi}%
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

      {/* Detalhamento */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <button 
          onClick={() => setExpandedSection(expandedSection === 'details' ? null : 'details')}
          className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h3 className="text-base sm:text-lg font-bold text-slate-900">Detalhamento</h3>
          {expandedSection === 'details' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
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
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Cliente</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Data</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Origem</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Comercial</th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Valor</th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Recebido</th>
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
