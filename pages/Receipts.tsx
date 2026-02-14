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
  Info,
  Printer,
  MoreVertical
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
  payment_method: string | null;
  received_at: string | null;
  received_method: string | null;
  received_by: string | null;
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
  status: string | null;
  confirmed_at: string | null;
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
  const [clinicInfo, setClinicInfo] = useState<{ name: string; phone: string | null; email: string | null; address: string | null; logo_url: string | null } | null>(null);
  const [actionsMenuId, setActionsMenuId] = useState<string | null>(null);
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
    status: string | null;
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
  
  // Estados para modal de confirmação de recebimento do comercial
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmPayment, setConfirmPayment] = useState<PaymentWithDetails | null>(null);
  const [confirmForm, setConfirmForm] = useState({ received_method: 'pix', received_at: new Date().toISOString().split('T')[0] });
  const [savingConfirm, setSavingConfirm] = useState(false);
  
  // Estados para modal de cancelamento
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelPaymentData, setCancelPaymentData] = useState<PaymentWithDetails | null>(null);
  const [cancelHasReceipts, setCancelHasReceipts] = useState(false);
  const [savingCancel, setSavingCancel] = useState(false);
  const [showCancelDirectModal, setShowCancelDirectModal] = useState(false);
  const [cancelDirectReceiptId, setCancelDirectReceiptId] = useState<string | null>(null);
  
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

  useEffect(() => {
    const handleClickOutside = () => setActionsMenuId(null);
    if (actionsMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [actionsMenuId]);

  const fetchData = async () => {
    if (!clinicId) return;
    setLoading(true);
    
    try {
      // Buscar todas as queries iniciais em paralelo
      const [
        { data: paymentsData },
        { data: sourcesData },
        { data: receiptsData },
        { data: usersData },
        { data: clinicData }
      ] = await Promise.all([
        supabase
          .from('payments' as any)
          .select('*, chat:chats(id, client_name, phone_number, source_id), creator:users!payments_created_by_fkey(id, name)')
          .eq('clinic_id', clinicId)
          .or('status.is.null,status.eq.active')
          .order('payment_date', { ascending: false }),
        supabase
          .from('lead_sources' as any)
          .select('id, name, color')
          .eq('clinic_id', clinicId),
        supabase
          .from('clinic_receipts' as any)
          .select('*, receipt_payments(*)')
          .eq('clinic_id', clinicId),
        supabase
          .from('users')
          .select('id, name')
          .eq('clinic_id', clinicId),
        supabase
          .from('clinics' as any)
          .select('name, phone, email, address, logo_url')
          .eq('id', clinicId)
          .single()
      ]);

      if (clinicData) setClinicInfo(clinicData as any);

      // Criar mapa de sources para evitar N+1 queries
      const sourcesMap = new Map((sourcesData as any[] || []).map(s => [s.id, s]));
      
      // Pré-indexar receipts por payment_id
      const receiptsByPaymentId = new Map<string, any[]>();
      ((receiptsData || []) as any[]).forEach(r => {
        if (r.payment_id) {
          const list = receiptsByPaymentId.get(r.payment_id) || [];
          list.push(r);
          receiptsByPaymentId.set(r.payment_id, list);
        }
      });

      // Montar payments com detalhes usando mapa local (sem queries adicionais)
      const paymentsWithDetails: PaymentWithDetails[] = ((paymentsData || []) as any[]).map(payment => {
        const source = payment.chat?.source_id ? sourcesMap.get(payment.chat.source_id) || null : null;
        const paymentReceipts = receiptsByPaymentId.get(payment.id) || [];
        return { ...payment, source, receipts: paymentReceipts };
      });

      // Buscar lançamentos diretos (sem payment_id)
      const directReceiptsData = ((receiptsData || []) as any[])
        .filter((r: any) => r.payment_id === null)
        .map((r: any) => ({
          ...r,
          chat: null
        }));
      
      // Buscar dados dos chats para lançamentos diretos
      if (directReceiptsData.length > 0) {
        const chatIds = [...new Set(directReceiptsData.map(r => r.chat_id))];
        const { data: chatsData } = await supabase
          .from('chats')
          .select('id, client_name, phone_number')
          .in('id', chatIds);
        
        const chatsMap = new Map((chatsData as any[] || []).map(c => [c.id, c]));
        directReceiptsData.forEach(r => {
          r.chat = chatsMap.get(r.chat_id) || null;
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

  const openConfirmReceiptModal = (payment: PaymentWithDetails) => {
    setConfirmPayment(payment);
    setConfirmForm({
      received_method: payment.payment_method || 'pix',
      received_at: new Date().toISOString().split('T')[0]
    });
    setShowConfirmModal(true);
  };

  const handleConfirmReceipt = async () => {
    if (!confirmPayment || !user) return;
    setSavingConfirm(true);
    try {
      await supabase
        .from('payments' as any)
        .update({
          received_at: confirmForm.received_at,
          received_method: confirmForm.received_method,
          received_by: user.id
        })
        .eq('id', confirmPayment.id);
      
      setShowConfirmModal(false);
      setConfirmPayment(null);
      await fetchData();
    } catch (err) {
      console.error('Error confirming receipt:', err);
    } finally {
      setSavingConfirm(false);
    }
  };

  const handleUndoConfirmReceipt = async (paymentId: string) => {
    try {
      await supabase
        .from('payments' as any)
        .update({
          received_at: null,
          received_method: null,
          received_by: null
        })
        .eq('id', paymentId);
      
      await fetchData();
    } catch (err) {
      console.error('Error undoing confirm:', err);
    }
  };

  const openCancelModal = async (payment: PaymentWithDetails) => {
    // Verificar se tem clinic_receipts vinculados
    const { data: linkedReceipts } = await supabase
      .from('clinic_receipts' as any)
      .select('id')
      .eq('payment_id', payment.id);
    
    setCancelPaymentData(payment);
    setCancelHasReceipts(!!(linkedReceipts && linkedReceipts.length > 0));
    setShowCancelModal(true);
  };

  const executeCancelPayment = async (mode: 'all' | 'commercial_only') => {
    if (!cancelPaymentData) return;
    setSavingCancel(true);
    try {
      if (mode === 'all') {
        // Marcar clinic_receipts vinculados como cancelled
        await supabase
          .from('clinic_receipts' as any)
          .update({ status: 'cancelled' })
          .eq('payment_id', cancelPaymentData.id);
      } else {
        // Só comercial: desvincular os receipts (tornam-se diretos)
        await supabase
          .from('clinic_receipts' as any)
          .update({ payment_id: null })
          .eq('payment_id', cancelPaymentData.id);
      }
      
      // Cancelar o payment
      await supabase
        .from('payments' as any)
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', cancelPaymentData.id);
      
      setShowCancelModal(false);
      setCancelPaymentData(null);
      await fetchData();
    } catch (err) {
      console.error('Error cancelling payment:', err);
    } finally {
      setSavingCancel(false);
    }
  };

  const handleConfirmDirectReceipt = async (receiptId: string) => {
    if (!user) return;
    try {
      await supabase
        .from('clinic_receipts' as any)
        .update({ confirmed_at: new Date().toISOString(), confirmed_by: user.id })
        .eq('id', receiptId);
      await fetchData();
    } catch (err) {
      console.error('Error confirming direct receipt:', err);
    }
  };

  const handleUndoConfirmDirectReceipt = async (receiptId: string) => {
    try {
      await supabase
        .from('clinic_receipts' as any)
        .update({ confirmed_at: null, confirmed_by: null })
        .eq('id', receiptId);
      await fetchData();
    } catch (err) {
      console.error('Error undoing direct receipt confirmation:', err);
    }
  };

  const handleCancelDirectReceipt = async (receiptId: string) => {
    setCancelDirectReceiptId(receiptId);
    setShowCancelDirectModal(true);
  };

  const executeCancelDirectReceipt = async () => {
    if (!cancelDirectReceiptId) return;
    setSavingCancel(true);
    try {
      await supabase
        .from('clinic_receipts' as any)
        .update({ status: 'cancelled' })
        .eq('id', cancelDirectReceiptId);
      
      setShowCancelDirectModal(false);
      setCancelDirectReceiptId(null);
      await fetchData();
    } catch (err) {
      console.error('Error cancelling direct receipt:', err);
    } finally {
      setSavingCancel(false);
    }
  };

  const generateReceipt = (payment: PaymentWithDetails, type: 'commercial' | 'clinic' | 'complete') => {
    const activeReceipts = payment.receipts.filter(r => r.status !== 'cancelled');
    const now = new Date();
    
    const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
    const formatMoney = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const commercialSection = `
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 12px;font-size:14px;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Recibo Comercial</h3>
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#64748b;">Cliente:</td><td style="padding:4px 0;font-weight:600;">${payment.chat?.client_name || 'N/A'}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">Descrição:</td><td style="padding:4px 0;">${payment.description || '-'}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">Data:</td><td style="padding:4px 0;">${formatDate(payment.payment_date)}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">Atendente:</td><td style="padding:4px 0;">${payment.creator?.name || '-'}</td></tr>
          ${payment.received_method ? `<tr><td style="padding:4px 0;color:#64748b;">Forma de Pagamento:</td><td style="padding:4px 0;">${getPaymentMethodLabel(payment.received_method)}</td></tr>` : ''}
          ${payment.received_at ? `<tr><td style="padding:4px 0;color:#64748b;">Recebido em:</td><td style="padding:4px 0;">${formatDate(payment.received_at)}</td></tr>` : ''}
        </table>
        <div style="margin-top:12px;padding:10px;background:#fef3c7;border-radius:6px;text-align:right;">
          <span style="font-size:12px;color:#92400e;">Valor:</span>
          <span style="font-size:20px;font-weight:800;color:#b45309;margin-left:8px;">R$ ${formatMoney(Number(payment.value))}</span>
        </div>
      </div>
    `;
    
    const clinicSection = activeReceipts.length > 0 ? `
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 12px;font-size:14px;color:#065f46;text-transform:uppercase;letter-spacing:1px;">Recibo Clínica</h3>
        ${activeReceipts.map(r => `
          <div style="border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:8px;">
            <table style="width:100%;font-size:13px;border-collapse:collapse;">
              <tr><td style="padding:3px 0;color:#64748b;">Data:</td><td style="padding:3px 0;">${formatDate(r.receipt_date)}</td></tr>
              ${r.description ? `<tr><td style="padding:3px 0;color:#64748b;">Descrição:</td><td style="padding:3px 0;">${r.description}</td></tr>` : ''}
              ${r.receipt_payments?.map(rp => `
                <tr><td style="padding:3px 0;color:#64748b;">Pagamento:</td><td style="padding:3px 0;">${getPaymentMethodLabel(rp.payment_method)}${rp.installments > 1 ? ` ${rp.installments}x` : ''} - R$ ${formatMoney(Number(rp.value))}</td></tr>
              `).join('') || ''}
            </table>
            <div style="margin-top:8px;padding:8px;background:#d1fae5;border-radius:6px;text-align:right;">
              <span style="font-size:12px;color:#065f46;">Valor:</span>
              <span style="font-size:18px;font-weight:800;color:#047857;margin-left:8px;">R$ ${formatMoney(Number(r.total_value))}</span>
            </div>
          </div>
        `).join('')}
        <div style="padding:10px;background:#ecfdf5;border-radius:6px;text-align:right;">
          <span style="font-size:12px;color:#065f46;">Total Clínica:</span>
          <span style="font-size:20px;font-weight:800;color:#047857;margin-left:8px;">R$ ${formatMoney(activeReceipts.reduce((s, r) => s + Number(r.total_value), 0))}</span>
        </div>
      </div>
    ` : '';
    
    let body = '';
    if (type === 'commercial') body = commercialSection;
    else if (type === 'clinic') body = clinicSection;
    else body = commercialSection + clinicSection;
    
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo</title>
      <style>
        @media print { body { margin: 0; } .no-print { display: none !important; } }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 20px auto; color: #1e293b; }
      </style>
    </head><body>
      <div style="text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #e2e8f0;">
        ${clinicInfo?.logo_url ? `<img src="${clinicInfo.logo_url}" style="max-height:50px;margin-bottom:8px;" />` : ''}
        <h2 style="margin:0;font-size:18px;color:#0f172a;">${clinicInfo?.name || 'Clínica'}</h2>
        ${clinicInfo?.address ? `<p style="margin:4px 0 0;font-size:11px;color:#94a3b8;">${clinicInfo.address}</p>` : ''}
        ${clinicInfo?.phone || clinicInfo?.email ? `<p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">${[clinicInfo?.phone, clinicInfo?.email].filter(Boolean).join(' • ')}</p>` : ''}
      </div>
      ${body}
      <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <p style="font-size:10px;color:#94a3b8;margin:0;">Emitido em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
      <div class="no-print" style="text-align:center;margin-top:20px;">
        <button onclick="window.print()" style="padding:10px 24px;background:#0891b2;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Imprimir / Salvar PDF</button>
      </div>
    </body></html>`;
    
    const win = window.open('', '_blank', 'width=480,height=700');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
    setActionsMenuId(null);
  };

  const generateDirectReceipt = (receipt: typeof directReceipts[0]) => {
    const now = new Date();
    const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
    const formatMoney = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo</title>
      <style>
        @media print { body { margin: 0; } .no-print { display: none !important; } }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 20px auto; color: #1e293b; }
      </style>
    </head><body>
      <div style="text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #e2e8f0;">
        ${clinicInfo?.logo_url ? `<img src="${clinicInfo.logo_url}" style="max-height:50px;margin-bottom:8px;" />` : ''}
        <h2 style="margin:0;font-size:18px;color:#0f172a;">${clinicInfo?.name || 'Clínica'}</h2>
        ${clinicInfo?.address ? `<p style="margin:4px 0 0;font-size:11px;color:#94a3b8;">${clinicInfo.address}</p>` : ''}
        ${clinicInfo?.phone || clinicInfo?.email ? `<p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">${[clinicInfo?.phone, clinicInfo?.email].filter(Boolean).join(' • ')}</p>` : ''}
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
        <h3 style="margin:0 0 12px;font-size:14px;color:#0f766e;text-transform:uppercase;letter-spacing:1px;">Recibo</h3>
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#64748b;">Cliente:</td><td style="padding:4px 0;font-weight:600;">${receipt.chat?.client_name || 'N/A'}</td></tr>
          ${receipt.description ? `<tr><td style="padding:4px 0;color:#64748b;">Descrição:</td><td style="padding:4px 0;">${receipt.description}</td></tr>` : ''}
          <tr><td style="padding:4px 0;color:#64748b;">Data:</td><td style="padding:4px 0;">${formatDate(receipt.receipt_date)}</td></tr>
          ${receipt.receipt_payments?.map(rp => `
            <tr><td style="padding:4px 0;color:#64748b;">Pagamento:</td><td style="padding:4px 0;">${getPaymentMethodLabel(rp.payment_method)} - R$ ${formatMoney(Number(rp.value))}</td></tr>
          `).join('') || ''}
        </table>
        <div style="margin-top:12px;padding:10px;background:#d1fae5;border-radius:6px;text-align:right;">
          <span style="font-size:12px;color:#065f46;">Valor:</span>
          <span style="font-size:20px;font-weight:800;color:#047857;margin-left:8px;">R$ ${formatMoney(Number(receipt.total_value))}</span>
        </div>
      </div>
      <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <p style="font-size:10px;color:#94a3b8;margin:0;">Emitido em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
      <div class="no-print" style="text-align:center;margin-top:20px;">
        <button onclick="window.print()" style="padding:10px 24px;background:#0891b2;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Imprimir / Salvar PDF</button>
      </div>
    </body></html>`;
    
    const win = window.open('', '_blank', 'width=480,height=700');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
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

  const hashSHA256 = async (value: string): Promise<string | null> => {
    if (!value || !value.trim()) return null;
    const normalized = value
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const sendFacebookConversionEvent = async (chatId: string, value: number) => {
    if (!clinicId) return;
    
    try {
      const { data: clinicData } = await (supabase as any)
        .from('clinics')
        .select('facebook_dataset_id, facebook_api_token, meta_event_name, meta_action_source, meta_funnel_events')
        .eq('id', clinicId)
        .single();
      
      if (!clinicData?.facebook_dataset_id || !clinicData?.facebook_api_token) return;
      
      const funnelEvents = clinicData.meta_funnel_events as Record<string, string> | null;
      let eventName: string | null = null;
      
      if (funnelEvents && funnelEvents['Convertido']) {
        eventName = funnelEvents['Convertido'];
      } else {
        eventName = clinicData.meta_event_name || 'Purchase';
      }
      
      if (!eventName) return;
      
      const actionSource = clinicData.meta_action_source || 'website';
      
      const { data: chatData } = await (supabase as any)
        .from('chats')
        .select(`id, phone_number, client_name, lead_id, source_id, leads(email, name, city, state, zip_code, gender, birth_date), lead_sources(name, code)`)
        .eq('id', chatId)
        .single();
      
      const phone = chatData?.phone_number?.replace(/\D/g, '') || '';
      const clientName = chatData?.client_name || chatData?.leads?.name || '';
      const nameParts = clientName.split(' ').filter((p: string) => p.trim());
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const email = chatData?.leads?.email || '';
      const city = chatData?.leads?.city || '';
      const state = chatData?.leads?.state || '';
      const zipCode = chatData?.leads?.zip_code?.replace(/\D/g, '') || '';
      const gender = chatData?.leads?.gender || '';
      const birthDate = chatData?.leads?.birth_date || '';
      const sourceName = chatData?.lead_sources?.name || chatData?.lead_sources?.code || '';
      
      const [phoneHash, emailHash, fnHash, lnHash, externalIdHash, cityHash, stateHash, zipHash, genderHash, dobHash] = await Promise.all([
        phone ? hashSHA256(phone) : null,
        email ? hashSHA256(email) : null,
        firstName ? hashSHA256(firstName) : null,
        lastName ? hashSHA256(lastName) : null,
        hashSHA256(chatId),
        city ? hashSHA256(city) : null,
        state ? hashSHA256(state.toLowerCase()) : null,
        zipCode ? hashSHA256(zipCode) : null,
        gender ? hashSHA256(gender) : null,
        birthDate ? hashSHA256(birthDate.replace(/-/g, '')) : null,
      ]);
      
      const userData: Record<string, string> = {};
      if (phoneHash) userData.ph = phoneHash;
      if (emailHash) userData.em = emailHash;
      if (fnHash) userData.fn = fnHash;
      if (lnHash) userData.ln = lnHash;
      if (externalIdHash) userData.external_id = externalIdHash;
      if (cityHash) userData.ct = cityHash;
      if (stateHash) userData.st = stateHash;
      if (zipHash) userData.zp = zipHash;
      if (genderHash) userData.ge = genderHash;
      if (dobHash) userData.db = dobHash;
      
      const customData: Record<string, string | number> = { currency: 'BRL', value };
      if (sourceName) {
        customData.content_name = sourceName;
        const sourceNameLower = sourceName.toLowerCase();
        if (sourceNameLower.includes('instagram')) customData.content_category = 'Instagram';
        else if (sourceNameLower.includes('facebook') || sourceNameLower.includes('fb')) customData.content_category = 'Facebook';
        else if (sourceNameLower.includes('google')) customData.content_category = 'Google';
        else if (sourceNameLower.includes('tiktok')) customData.content_category = 'TikTok';
        else customData.content_category = 'Outros';
      }
      
      const eventTime = Math.floor(Date.now() / 1000);
      const eventId = `crm_${eventName.toLowerCase()}_${chatId.substring(0, 8)}_${eventTime}`;
      
      const eventData = {
        data: [{
          event_name: eventName,
          event_time: eventTime,
          event_id: eventId,
          action_source: actionSource,
          user_data: userData,
          custom_data: customData,
        }],
      };
      
      console.log('Enviando evento Meta Conversions API (Receipts):', JSON.stringify(eventData, null, 2));
      
      const { data: logEntry } = await (supabase as any)
        .from('meta_conversion_logs')
        .insert({
          clinic_id: clinicId,
          chat_id: chatId,
          event_id: eventId,
          event_name: eventName,
          event_time: eventTime,
          value: value,
          payload: eventData,
          status: 'pending',
        })
        .select('id')
        .single();
      
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${clinicData.facebook_dataset_id}/events?access_token=${clinicData.facebook_api_token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        console.log('Evento Purchase enviado com sucesso (Receipts):', result);
        if (logEntry?.id) {
          await (supabase as any).from('meta_conversion_logs').update({ status: 'success', response: result }).eq('id', logEntry.id);
        }
      } else {
        const errorData = await response.json();
        console.error('Erro ao enviar evento Purchase (Receipts):', errorData);
        if (logEntry?.id) {
          await (supabase as any).from('meta_conversion_logs').update({ status: 'error', response: errorData, error_message: errorData?.error?.message || 'Erro desconhecido' }).eq('id', logEntry.id);
        }
      }
    } catch (err) {
      console.error('Erro ao enviar evento de conversão (Receipts):', err);
    }
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
        
        // Enviar evento Purchase para Meta (Lançamento da Clínica = procedimento realizado)
        await sendFacebookConversionEvent(selectedPayment.chat_id, totalValue);
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
    const activeReceipts = (p: PaymentWithDetails) => p.receipts.filter(r => r.status !== 'cancelled');
    const totalRecebidoComercial = filteredAndSortedPayments.reduce((sum, p) => sum + activeReceipts(p).reduce((rSum, r) => rSum + Number(r.total_value), 0), 0);
    const totalRecebimentosComercial = filteredAndSortedPayments.reduce((sum, p) => sum + activeReceipts(p).length, 0);
    
    // Lançamentos diretos (sem comercial) - só ativos
    const activeDirectReceipts = directReceipts.filter(r => r.status !== 'cancelled');
    const totalRecebidoDireto = activeDirectReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
    const totalRecebimentosDiretos = activeDirectReceipts.length;
    
    // Totais combinados
    const totalRecebido = totalRecebidoComercial + totalRecebidoDireto;
    const totalRecebimentos = totalRecebimentosComercial + totalRecebimentosDiretos;
    
    const vendasComRecebimento = filteredAndSortedPayments.filter(p => activeReceipts(p).length > 0).length;
    const vendasPendentes = filteredAndSortedPayments.filter(p => activeReceipts(p).length === 0).length;
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
              const activePaymentReceipts = payment.receipts.filter(r => r.status !== 'cancelled');
              const totalReceiptsValue = activePaymentReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
              const hasReceipts = activePaymentReceipts.length > 0;
              const isConfirmed = !!payment.received_at;
              
              return (
                <div key={payment.id} className={`bg-white rounded-xl shadow-sm border ${isConfirmed ? 'border-emerald-200' : hasReceipts ? 'border-cyan-200' : 'border-amber-200'}`}>
                  {/* Mobile Layout */}
                  <div className="md:hidden p-3 cursor-pointer hover:bg-slate-50" onClick={() => toggleExpanded(payment.id)}>
                    <div className="flex items-start gap-2 mb-2">
                      <button className="p-0.5 text-slate-400 mt-0.5">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${isConfirmed ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 text-sm">{payment.chat?.client_name || 'Cliente'}</span>
                          {isConfirmed && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(payment.payment_date).toLocaleDateString('pt-BR')}
                          {payment.creator && ` • ${payment.creator.name}`}
                        </div>
                      </div>
                    </div>
                    {isConfirmed && (
                      <div className="ml-6 mb-2 flex items-center gap-1.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                          {getPaymentMethodLabel(payment.received_method || '')}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(payment.received_at!).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pl-6">
                      <div className="flex gap-3">
                        <div>
                          <div className="text-[10px] text-slate-400">Comercial</div>
                          <div className="font-bold text-amber-600 text-sm">{formatCurrency(Number(payment.value))}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Clínica</div>
                          <div className={`font-bold text-sm ${totalReceiptsValue > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{totalReceiptsValue > 0 ? formatCurrency(totalReceiptsValue) : '-'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!isConfirmed && canAddReceipt && (
                          <button onClick={(e) => { e.stopPropagation(); openConfirmReceiptModal(payment); }} className="flex items-center gap-1 px-2 py-1 bg-cyan-50 text-cyan-600 text-[10px] font-medium rounded-lg">
                            <CheckCircle className="w-3 h-3" />Confirmar
                          </button>
                        )}
                        {canAddReceipt && (
                          <button onClick={(e) => { e.stopPropagation(); openAddReceiptModal(payment); }} className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-medium rounded-lg">
                            <Plus className="w-3 h-3" />Clínica
                          </button>
                        )}
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setActionsMenuId(actionsMenuId === `m-${payment.id}` ? null : `m-${payment.id}`); }} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                          {actionsMenuId === `m-${payment.id}` && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-20 min-w-[180px]">
                              <button onClick={(e) => { e.stopPropagation(); generateReceipt(payment, 'commercial'); }} className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                <Printer className="w-3.5 h-3.5 text-amber-500" />Recibo Comercial
                              </button>
                              {activePaymentReceipts.length > 0 && (
                                <>
                                  <button onClick={(e) => { e.stopPropagation(); generateReceipt(payment, 'clinic'); }} className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                    <Printer className="w-3.5 h-3.5 text-emerald-500" />Recibo Clínica
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); generateReceipt(payment, 'complete'); }} className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                    <Printer className="w-3.5 h-3.5 text-cyan-500" />Recibo Completo
                                  </button>
                                </>
                              )}
                              <div className="border-t border-slate-100 my-1"></div>
                              {canAddReceipt && (
                                <button onClick={(e) => { e.stopPropagation(); setActionsMenuId(null); openCancelModal(payment); }} className="w-full px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 flex items-center gap-2">
                                  <Trash2 className="w-3.5 h-3.5" />Cancelar Pagamento
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Desktop Layout */}
                  <div className="hidden md:flex p-4 items-center gap-4 cursor-pointer hover:bg-slate-50" onClick={() => toggleExpanded(payment.id)}>
                    <button className="p-1 text-slate-400">{isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}</button>
                    <div className={`w-2 h-2 rounded-full ${isConfirmed ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">{payment.chat?.client_name || 'Cliente'}</span>
                        {payment.source && <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${payment.source.color}20`, color: payment.source.color }}>{payment.source.name}</span>}
                        {isConfirmed ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            <CheckCircle className="w-3 h-3" />Confirmado • {getPaymentMethodLabel(payment.received_method || '')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <Clock className="w-3 h-3" />Aguardando confirmação
                          </span>
                        )}
                        {hasReceipts && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">Clínica: {formatCurrency(totalReceiptsValue)}</span>}
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                        <span>{payment.description || 'Sem descrição'}</span>
                        <span>-</span>
                        <span>{new Date(payment.payment_date).toLocaleDateString('pt-BR')}</span>
                        {payment.creator && <><span>-</span><span className="flex items-center gap-1"><User className="w-3 h-3" />{payment.creator.name}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Comercial</div>
                        <div className="font-bold text-amber-600">{formatCurrency(Number(payment.value))}</div>
                      </div>
                      {!isConfirmed && canAddReceipt && (
                        <button onClick={(e) => { e.stopPropagation(); openConfirmReceiptModal(payment); }} className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-50 text-cyan-600 text-xs font-medium rounded-lg hover:bg-cyan-100">
                          <CheckCircle className="w-3.5 h-3.5" />Confirmar
                        </button>
                      )}
                      {isConfirmed && canAddReceipt && (
                        <button onClick={(e) => { e.stopPropagation(); handleUndoConfirmReceipt(payment.id); }} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Desfazer confirmação">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="w-px h-10 bg-slate-200"></div>
                    <div className="text-right min-w-[80px]">
                      <div className="text-xs text-slate-400">Clínica</div>
                      <div className={`font-bold ${totalReceiptsValue > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{totalReceiptsValue > 0 ? formatCurrency(totalReceiptsValue) : '-'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canAddReceipt && (
                        <button onClick={(e) => { e.stopPropagation(); openAddReceiptModal(payment); }} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-lg hover:bg-emerald-100">
                          <Plus className="w-4 h-4" />Lançamento Clínica
                        </button>
                      )}
                      <div className="relative">
                        <button onClick={(e) => { e.stopPropagation(); setActionsMenuId(actionsMenuId === payment.id ? null : payment.id); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {actionsMenuId === payment.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-20 min-w-[200px]">
                            <button onClick={(e) => { e.stopPropagation(); generateReceipt(payment, 'commercial'); }} className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                              <Printer className="w-4 h-4 text-amber-500" />Recibo Comercial
                            </button>
                            {activePaymentReceipts.length > 0 && (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); generateReceipt(payment, 'clinic'); }} className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                  <Printer className="w-4 h-4 text-emerald-500" />Recibo Clínica
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); generateReceipt(payment, 'complete'); }} className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                  <Printer className="w-4 h-4 text-cyan-500" />Recibo Completo
                                </button>
                              </>
                            )}
                            <div className="border-t border-slate-100 my-1"></div>
                            {canAddReceipt && (
                              <button onClick={(e) => { e.stopPropagation(); setActionsMenuId(null); openCancelModal(payment); }} className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2">
                                <Trash2 className="w-4 h-4" />Cancelar Pagamento
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded && payment.receipts.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50 p-3 sm:p-4">
                      <div className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase mb-2 sm:mb-3">Recebimentos ({activePaymentReceipts.length}{payment.receipts.length > activePaymentReceipts.length ? ` + ${payment.receipts.length - activePaymentReceipts.length} cancelado(s)` : ''})</div>
                      <div className="space-y-2">
                        {payment.receipts.map((receipt) => {
                          const isCancelled = receipt.status === 'cancelled';
                          const isReceiptConfirmed = !!receipt.confirmed_at;
                          return (
                            <div key={receipt.id} className={`rounded-lg border p-2.5 sm:p-3 flex items-start sm:items-center gap-2 sm:gap-4 ${isCancelled ? 'bg-red-50 border-red-200 opacity-60' : isReceiptConfirmed ? 'bg-white border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-semibold text-sm ${isCancelled ? 'text-red-600 line-through' : 'text-emerald-600'}`}>{formatCurrency(Number(receipt.total_value))}</span>
                                  <span className="text-xs text-slate-400">{new Date(receipt.receipt_date).toLocaleDateString('pt-BR')}</span>
                                  {isCancelled && <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">CANCELADO</span>}
                                  {!isCancelled && (
                                    isReceiptConfirmed ? (
                                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded"><CheckCircle className="w-2.5 h-2.5" />CONFIRMADO</span>
                                    ) : (
                                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded"><Clock className="w-2.5 h-2.5" />PENDENTE</span>
                                    )
                                  )}
                                </div>
                                {receipt.description && <div className={`text-xs truncate ${isCancelled ? 'text-slate-400' : 'text-slate-500'}`}>{receipt.description}</div>}
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {receipt.receipt_payments?.map((rp, idx) => (
                                    <span key={idx} className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs ${isCancelled ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                                      {getPaymentMethodLabel(rp.payment_method)}{rp.installments > 1 && ` ${rp.installments}x`}: {formatCurrency(Number(rp.value))}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              {!isCancelled && (
                                <div className="flex items-center gap-0.5 sm:gap-1">
                                  {!isReceiptConfirmed && canAddReceipt && (
                                    <button onClick={() => handleConfirmDirectReceipt(receipt.id)} className="p-1 sm:p-1.5 text-teal-500 hover:text-teal-700 hover:bg-teal-50 rounded" title="Confirmar recebimento"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                                  )}
                                  {isReceiptConfirmed && canAddReceipt && (
                                    <button onClick={() => handleUndoConfirmDirectReceipt(receipt.id)} className="p-1 sm:p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Desfazer confirmação"><span className="material-symbols-outlined text-[14px] sm:text-[16px]">undo</span></button>
                                  )}
                                  {canEditReceipt && (
                                    <>
                                      <button onClick={() => openEditReceiptModal(payment, receipt)} className="p-1 sm:p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded"><Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                                      <button onClick={() => handleDeleteReceipt(receipt.id)} className="p-1 sm:p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
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
            {directReceipts.map((receipt) => {
              const isDirectCancelled = receipt.status === 'cancelled';
              const isDirectConfirmed = !!receipt.confirmed_at;
              return (
                <div key={`direct-${receipt.id}`} className={`bg-white rounded-xl shadow-sm border ${isDirectCancelled ? 'border-red-200 opacity-60' : isDirectConfirmed ? 'border-teal-200' : 'border-amber-200'}`}>
                  {/* Mobile Layout */}
                  <div className="md:hidden p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <div className={`p-0.5 ${isDirectCancelled ? 'text-red-400' : 'text-teal-400'}`}>
                        {isDirectCancelled ? <X className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </div>
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${isDirectCancelled ? 'bg-red-400' : 'bg-teal-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-semibold text-sm ${isDirectCancelled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{receipt.chat?.client_name || 'Cliente'}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${isDirectCancelled ? 'bg-red-100 text-red-600' : 'bg-teal-100 text-teal-700'}`}>{isDirectCancelled ? 'Cancelado' : 'Direto'}</span>
                          {!isDirectCancelled && (
                            isDirectConfirmed ? (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                                <CheckCircle className="w-2.5 h-2.5" />Confirmado
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                                <Clock className="w-2.5 h-2.5" />Pendente
                              </span>
                            )
                          )}
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
                          <div className={`font-bold text-sm ${isDirectCancelled ? 'text-red-600 line-through' : 'text-teal-600'}`}>{formatCurrency(Number(receipt.total_value))}</div>
                        </div>
                      </div>
                      {!isDirectCancelled && (
                        <div className="flex items-center gap-1">
                          {!isDirectConfirmed && canAddReceipt && (
                            <button onClick={() => handleConfirmDirectReceipt(receipt.id)} className="p-1 text-teal-500 hover:text-teal-700 hover:bg-teal-50 rounded" title="Confirmar recebimento">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isDirectConfirmed && canAddReceipt && (
                            <button onClick={() => handleUndoConfirmDirectReceipt(receipt.id)} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Desfazer confirmação">
                              <span className="material-symbols-outlined text-[14px]">undo</span>
                            </button>
                          )}
                          <button onClick={() => generateDirectReceipt(receipt)} className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded" title="Gerar recibo">
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {canAddReceipt && (
                            <button onClick={() => handleCancelDirectReceipt(receipt.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Cancelar">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Desktop Layout */}
                  <div className="hidden md:flex p-4 items-center gap-4">
                    <div className={`p-1 ${isDirectCancelled ? 'text-red-400' : 'text-teal-400'}`}>
                      {isDirectCancelled ? <X className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    </div>
                    <div className={`w-2 h-2 rounded-full ${isDirectCancelled ? 'bg-red-400' : 'bg-teal-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold ${isDirectCancelled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{receipt.chat?.client_name || 'Cliente'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDirectCancelled ? 'bg-red-100 text-red-600' : 'bg-teal-100 text-teal-700'}`}>{isDirectCancelled ? 'Cancelado' : 'Direto'}</span>
                        {!isDirectCancelled && (
                          isDirectConfirmed ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3" />Confirmado
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              <Clock className="w-3 h-3" />Pendente
                            </span>
                          )
                        )}
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
                      <div className={`font-bold ${isDirectCancelled ? 'text-red-600 line-through' : 'text-teal-600'}`}>{formatCurrency(Number(receipt.total_value))}</div>
                    </div>
                    {!isDirectCancelled && (
                      <div className="flex items-center gap-2">
                        {!isDirectConfirmed && canAddReceipt && (
                          <button onClick={() => handleConfirmDirectReceipt(receipt.id)} className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 text-teal-600 text-sm font-medium rounded-lg hover:bg-teal-100">
                            <CheckCircle className="w-4 h-4" />Confirmar
                          </button>
                        )}
                        {isDirectConfirmed && canAddReceipt && (
                          <button onClick={() => handleUndoConfirmDirectReceipt(receipt.id)} className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-600 text-sm font-medium rounded-lg hover:bg-amber-100">
                            <span className="material-symbols-outlined text-[16px]">undo</span>Desfazer
                          </button>
                        )}
                        <button onClick={() => generateDirectReceipt(receipt)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-100" title="Gerar recibo">
                          <Printer className="w-4 h-4" />Recibo
                        </button>
                        {canAddReceipt && (
                          <button onClick={() => handleCancelDirectReceipt(receipt.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-500 text-sm font-medium rounded-lg hover:bg-red-100">
                            <Trash2 className="w-4 h-4" />Cancelar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
                <h3 className="text-base sm:text-lg font-bold text-slate-800">{editingReceipt ? 'Editar Recebimento' : 'Lançamento Clínica'}</h3>
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

      {/* Modal de Confirmar Recebimento do Comercial */}
      {showConfirmModal && confirmPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-xl sm:rounded-2xl shadow-2xl">
            <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">Confirmar Recebimento</h3>
                <p className="text-xs sm:text-sm text-slate-500">{confirmPayment.chat?.client_name}</p>
              </div>
              <button onClick={() => setShowConfirmModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                <div className="text-[10px] sm:text-xs font-semibold text-amber-600 uppercase">Valor do Comercial</div>
                <div className="text-xl sm:text-2xl font-bold text-amber-700">{formatCurrency(Number(confirmPayment.value))}</div>
                {confirmPayment.description && <div className="text-xs text-amber-600 mt-1">{confirmPayment.description}</div>}
                {confirmPayment.payment_method && (
                  <div className="text-[10px] text-amber-500 mt-1">Informado: {getPaymentMethodLabel(confirmPayment.payment_method)}</div>
                )}
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase">Forma de Pagamento Real *</label>
                <select
                  value={confirmForm.received_method}
                  onChange={(e) => setConfirmForm({ ...confirmForm, received_method: e.target.value })}
                  className="w-full mt-1 h-10 rounded-lg border-slate-200 px-3 text-sm"
                >
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase">Data do Recebimento</label>
                <input
                  type="date"
                  value={confirmForm.received_at}
                  onChange={(e) => setConfirmForm({ ...confirmForm, received_at: e.target.value })}
                  className="w-full mt-1 h-10 rounded-lg border-slate-200 px-3 text-sm"
                />
              </div>
            </div>
            <div className="p-3 sm:p-4 bg-slate-50 flex gap-2 sm:gap-3 rounded-b-xl sm:rounded-b-2xl">
              <button
                onClick={handleConfirmReceipt}
                disabled={savingConfirm}
                className="flex-1 h-10 sm:h-11 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {savingConfirm ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Confirmando...</> : <><CheckCircle className="w-4 h-4" />Confirmar</>}
              </button>
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 h-10 sm:h-11 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelamento */}
      {showCancelModal && cancelPaymentData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowCancelModal(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-xl sm:rounded-2xl shadow-2xl">
            <div className="p-4 sm:p-5 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Cancelar Pagamento</h3>
              <p className="text-sm text-slate-500 mb-1">{cancelPaymentData.chat?.client_name}</p>
              <p className="text-lg font-bold text-amber-600 mb-4">{formatCurrency(Number(cancelPaymentData.value))}</p>
              
              {cancelHasReceipts ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 mb-3">Esta negociação tem lançamentos da clínica vinculados. O que deseja fazer?</p>
                  <button
                    onClick={() => executeCancelPayment('commercial_only')}
                    disabled={savingCancel}
                    className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    {savingCancel ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <X className="w-4 h-4" />}
                    Cancelar só o Comercial
                  </button>
                  <p className="text-[10px] text-slate-400">Lançamentos da clínica serão mantidos como diretos</p>
                  <button
                    onClick={() => executeCancelPayment('all')}
                    disabled={savingCancel}
                    className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    {savingCancel ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Trash2 className="w-4 h-4" />}
                    Cancelar Tudo
                  </button>
                  <p className="text-[10px] text-slate-400">Exclui comercial + lançamentos da clínica vinculados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Tem certeza que deseja cancelar esta negociação?</p>
                  <button
                    onClick={() => executeCancelPayment('all')}
                    disabled={savingCancel}
                    className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    {savingCancel ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Cancelando...</> : <><Trash2 className="w-4 h-4" />Confirmar Cancelamento</>}
                  </button>
                </div>
              )}
              
              <button
                onClick={() => setShowCancelModal(false)}
                className="w-full h-10 mt-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 text-sm"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelamento de Recebimento Direto */}
      {showCancelDirectModal && cancelDirectReceiptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowCancelDirectModal(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-xl sm:rounded-2xl shadow-2xl">
            <div className="p-4 sm:p-5 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Cancelar Recebimento</h3>
              <p className="text-xs text-slate-500 mb-4">Tem certeza que deseja cancelar este recebimento? Ele ficará visível como cancelado no histórico.</p>
              <button
                onClick={executeCancelDirectReceipt}
                disabled={savingCancel}
                className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {savingCancel ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Cancelando...</> : <><Trash2 className="w-4 h-4" />Confirmar Cancelamento</>}
              </button>
              <button
                onClick={() => setShowCancelDirectModal(false)}
                className="w-full h-10 mt-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 text-sm"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Receipts;
