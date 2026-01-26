import React, { useState, useEffect } from 'react';
import { 
  CreditCard,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Users,
  MessageSquare,
  Zap,
  Crown,
  Gift,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  trial_days: number;
  max_users: number;
  max_whatsapp_instances: number;
  max_messages_month: number | null;
  has_cloud_api: boolean;
  has_instagram: boolean;
  has_facebook: boolean;
  has_mass_messaging: boolean;
  has_reports: boolean;
  has_api_access: boolean;
  has_priority_support: boolean;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
  created_at: string;
}

const AdminPlans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    trial_days: 0,
    max_users: 1,
    max_whatsapp_instances: 1,
    max_messages_month: null as number | null,
    has_cloud_api: false,
    has_instagram: false,
    has_facebook: false,
    has_mass_messaging: false,
    has_reports: false,
    has_api_access: false,
    has_priority_support: false,
    is_active: true,
    is_public: true,
    sort_order: 0,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans' as any)
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const openCreateModal = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      price_monthly: 0,
      price_yearly: 0,
      trial_days: 0,
      max_users: 1,
      max_whatsapp_instances: 1,
      max_messages_month: null,
      has_cloud_api: false,
      has_instagram: false,
      has_facebook: false,
      has_mass_messaging: false,
      has_reports: false,
      has_api_access: false,
      has_priority_support: false,
      is_active: true,
      is_public: true,
      sort_order: plans.length + 1,
    });
    setError('');
    setShowModal(true);
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      trial_days: plan.trial_days,
      max_users: plan.max_users,
      max_whatsapp_instances: plan.max_whatsapp_instances,
      max_messages_month: plan.max_messages_month,
      has_cloud_api: plan.has_cloud_api,
      has_instagram: plan.has_instagram,
      has_facebook: plan.has_facebook,
      has_mass_messaging: plan.has_mass_messaging,
      has_reports: plan.has_reports,
      has_api_access: plan.has_api_access,
      has_priority_support: plan.has_priority_support,
      is_active: plan.is_active,
      is_public: plan.is_public,
      sort_order: plan.sort_order,
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const planData = {
        ...formData,
        max_messages_month: formData.max_messages_month || null,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('plans' as any)
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('plans' as any)
          .insert(planData);

        if (error) throw error;
      }

      setShowModal(false);
      fetchPlans();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar plano');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (plan: Plan) => {
    try {
      const { error } = await supabase
        .from('plans' as any)
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id);

      if (error) throw error;
      fetchPlans();
    } catch (err) {
      console.error('Error toggling plan:', err);
    }
  };

  const deletePlan = async (id: string) => {
    try {
      const { error } = await supabase
        .from('plans' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      setDeleteConfirm(null);
      fetchPlans();
    } catch (err) {
      console.error('Error deleting plan:', err);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getPlanIcon = (slug: string) => {
    switch (slug) {
      case 'free':
        return <Gift className="w-6 h-6" />;
      case 'starter':
        return <Zap className="w-6 h-6" />;
      case 'pro':
        return <Crown className="w-6 h-6" />;
      case 'enterprise':
        return <CreditCard className="w-6 h-6" />;
      case 'mentoradas':
        return <Users className="w-6 h-6" />;
      default:
        return <CreditCard className="w-6 h-6" />;
    }
  };

  const getPlanColor = (slug: string) => {
    switch (slug) {
      case 'free':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'starter':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'pro':
        return 'bg-purple-100 text-purple-600 border-purple-200';
      case 'enterprise':
        return 'bg-cyan-100 text-cyan-600 border-cyan-200';
      case 'mentoradas':
        return 'bg-pink-100 text-pink-600 border-pink-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
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
    <div className="p-4 sm:p-6">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Planos</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Gerencie os planos de assinatura</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm sm:text-base"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Plano</span>
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all ${
              plan.is_active ? 'border-slate-200' : 'border-red-200 opacity-60'
            }`}
          >
            {/* Header */}
            <div className={`p-3 ${getPlanColor(plan.slug)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {React.cloneElement(getPlanIcon(plan.slug), { className: 'w-5 h-5' })}
                  <div>
                    <h3 className="font-bold text-sm">{plan.name}</h3>
                    {!plan.is_public && (
                      <span className="text-xs bg-white/50 px-2 py-0.5 rounded">Especial</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={() => openEditModal(plan)}
                    className="p-1.5 hover:bg-white/30 rounded transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleActive(plan)}
                    className="p-1.5 hover:bg-white/30 rounded transition-colors"
                    title={plan.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {plan.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-800">
                  {plan.price_monthly === 0 ? 'Grátis' : formatCurrency(plan.price_monthly)}
                </span>
                {plan.price_monthly > 0 && (
                  <span className="text-slate-500 text-xs">/mês</span>
                )}
              </div>
              {plan.price_yearly > 0 && (
                <p className="text-xs text-slate-500">
                  ou {formatCurrency(plan.price_yearly)}/ano
                </p>
              )}
              {plan.trial_days > 0 && (
                <p className="text-xs text-green-600 mt-1 font-medium">
                  {plan.trial_days} dias grátis
                </p>
              )}
            </div>

            {/* Limits */}
            <div className="p-3 border-b border-slate-100">
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Limites</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Usuários</span>
                  <span className="font-medium text-slate-800">
                    {plan.max_users >= 999 ? 'Ilimitado' : plan.max_users}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Instâncias WhatsApp</span>
                  <span className="font-medium text-slate-800">{plan.max_whatsapp_instances}</span>
                </div>
                {plan.max_messages_month && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Mensagens/mês</span>
                    <span className="font-medium text-slate-800">
                      {plan.max_messages_month.toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Features */}
            <div className="p-3">
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Recursos</h4>
              <div className="space-y-1 text-xs">
                <FeatureItem enabled={plan.has_reports} label="Relatórios" />
                <FeatureItem enabled={plan.has_cloud_api} label="Cloud API" />
                <FeatureItem enabled={plan.has_instagram} label="Instagram" />
                <FeatureItem enabled={plan.has_facebook} label="Facebook" />
                <FeatureItem enabled={plan.has_mass_messaging} label="Envio em Massa" />
                <FeatureItem enabled={plan.has_api_access} label="Acesso à API" />
                <FeatureItem enabled={plan.has_priority_support} label="Suporte Prioritário" />
              </div>
            </div>

            {/* Delete */}
            {deleteConfirm === plan.id ? (
              <div className="p-2 bg-red-50 border-t border-red-100">
                <p className="text-xs text-red-700 mb-2">Confirma exclusão?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => deletePlan(plan.id)}
                    className="flex-1 px-2 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                  >
                    Excluir
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-2 py-1.5 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2 border-t border-slate-100">
                <button
                  onClick={() => setDeleteConfirm(plan.id)}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-red-600 hover:bg-red-50 rounded transition-colors text-xs"
                >
                  <Trash2 className="w-3 h-3" />
                  Excluir
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingPlan ? 'Editar Plano' : 'Novo Plano'}
                  </h2>
                  <p className="text-xs text-white/70">Configure os detalhes do plano</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">error</span>
                    {error}
                  </div>
                )}

                {/* Basic Info */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">info</span>
                    Informações Básicas
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Nome do Plano *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({
                          ...formData,
                          name: e.target.value,
                          slug: editingPlan ? formData.slug : generateSlug(e.target.value),
                        })}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm transition-all"
                        placeholder="Ex: Pro"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Slug (URL) *</label>
                      <input
                        type="text"
                        required
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm font-mono transition-all"
                        placeholder="pro"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Descrição</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm transition-all"
                      placeholder="Descrição curta do plano"
                    />
                  </div>
                </div>

                {/* Pricing & Trial */}
                <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 rounded-xl p-4 border border-emerald-100">
                  <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">payments</span>
                    Preços e Trial
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Mensal</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.price_monthly}
                          onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Anual</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.price_yearly}
                          onChange={(e) => setFormData({ ...formData, price_yearly: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Trial</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          value={formData.trial_days}
                          onChange={(e) => setFormData({ ...formData, trial_days: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">dias</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Limits */}
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
                  <h3 className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">tune</span>
                    Limites
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Usuários</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.max_users}
                        onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm transition-all"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">999 = ilimitado</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Instâncias</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.max_whatsapp_instances}
                        onChange={(e) => setFormData({ ...formData, max_whatsapp_instances: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Msgs/Mês</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.max_messages_month || ''}
                        onChange={(e) => setFormData({ ...formData, max_messages_month: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm transition-all"
                        placeholder="∞"
                      />
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                  <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">star</span>
                    Recursos Incluídos
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <FeatureToggle
                      label="Relatórios"
                      checked={formData.has_reports}
                      onChange={(v) => setFormData({ ...formData, has_reports: v })}
                    />
                    <FeatureToggle
                      label="Cloud API"
                      checked={formData.has_cloud_api}
                      onChange={(v) => setFormData({ ...formData, has_cloud_api: v })}
                    />
                    <FeatureToggle
                      label="Instagram"
                      checked={formData.has_instagram}
                      onChange={(v) => setFormData({ ...formData, has_instagram: v })}
                    />
                    <FeatureToggle
                      label="Facebook"
                      checked={formData.has_facebook}
                      onChange={(v) => setFormData({ ...formData, has_facebook: v })}
                    />
                    <FeatureToggle
                      label="Envio em Massa"
                      checked={formData.has_mass_messaging}
                      onChange={(v) => setFormData({ ...formData, has_mass_messaging: v })}
                    />
                    <FeatureToggle
                      label="Acesso API"
                      checked={formData.has_api_access}
                      onChange={(v) => setFormData({ ...formData, has_api_access: v })}
                    />
                    <FeatureToggle
                      label="Suporte VIP"
                      checked={formData.has_priority_support}
                      onChange={(v) => setFormData({ ...formData, has_priority_support: v })}
                    />
                  </div>
                </div>

                {/* Visibility */}
                <div className="flex flex-wrap gap-3">
                  <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl cursor-pointer transition-all border-2 ${formData.is_active ? 'bg-green-50 border-green-300 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <span className="text-sm font-medium">Ativo</span>
                  </label>
                  <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl cursor-pointer transition-all border-2 ${formData.is_public ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <input
                      type="checkbox"
                      checked={formData.is_public}
                      onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium">Público</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 sm:p-5 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-3 flex-shrink-0 bg-slate-50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-100 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 text-sm font-medium shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {editingPlan ? 'Salvar Alterações' : 'Criar Plano'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const FeatureItem: React.FC<{ enabled: boolean; label: string }> = ({ enabled, label }) => (
  <div className="flex items-center gap-1.5">
    {enabled ? (
      <Check className="w-3 h-3 text-green-500" />
    ) : (
      <X className="w-3 h-3 text-slate-300" />
    )}
    <span className={enabled ? 'text-slate-700' : 'text-slate-400'}>{label}</span>
  </div>
);

const FeatureToggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label,
  checked,
  onChange,
}) => (
  <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg transition-all border ${checked ? 'bg-white border-amber-300 shadow-sm' : 'bg-white/50 border-transparent hover:bg-white'}`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500 border-slate-300"
    />
    <span className={`text-xs font-medium ${checked ? 'text-amber-700' : 'text-slate-500'}`}>{label}</span>
  </label>
);

export default AdminPlans;
