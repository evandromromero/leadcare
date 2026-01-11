export type UserRole = 'SuperAdmin' | 'Admin' | 'Gerente' | 'Supervisor' | 'Comercial' | 'Recepcionista' | 'Financeiro' | 'Visualizador';

export type MenuPage = 'dashboard' | 'inbox' | 'kanban' | 'users' | 'settings' | 'connect';

export type Action = 
  | 'create_user' 
  | 'edit_user' 
  | 'delete_user' 
  | 'change_role'
  | 'change_status'
  | 'send_message' 
  | 'move_lead' 
  | 'create_lead'
  | 'add_payment' 
  | 'add_quote'
  | 'edit_tags'
  | 'edit_quick_replies'
  | 'edit_clinic_profile'
  | 'create_instance'
  | 'delete_instance'
  | 'edit_pipeline_labels';

export type DataAccess = 'all_billing' | 'own_billing' | 'no_billing';

interface RolePermissions {
  menu: MenuPage[];
  actions: Action[];
  data: DataAccess;
  description: string;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  SuperAdmin: {
    menu: ['dashboard', 'inbox', 'kanban', 'users', 'settings', 'connect'],
    actions: [
      'create_user', 'edit_user', 'delete_user', 'change_role', 'change_status',
      'send_message', 'move_lead', 'create_lead',
      'add_payment', 'add_quote',
      'edit_tags', 'edit_quick_replies', 'edit_clinic_profile',
      'create_instance', 'delete_instance', 'edit_pipeline_labels'
    ],
    data: 'all_billing',
    description: 'Acesso total ao sistema',
  },
  Admin: {
    menu: ['dashboard', 'inbox', 'kanban', 'users', 'settings', 'connect'],
    actions: [
      'create_user', 'edit_user', 'delete_user', 'change_role', 'change_status',
      'send_message', 'move_lead', 'create_lead',
      'add_payment', 'add_quote',
      'edit_tags', 'edit_quick_replies', 'edit_clinic_profile',
      'create_instance', 'delete_instance', 'edit_pipeline_labels'
    ],
    data: 'all_billing',
    description: 'Acesso total. Pode criar usuários e configurar a clínica.',
  },
  Gerente: {
    menu: ['dashboard', 'inbox', 'kanban', 'users', 'settings'],
    actions: [
      'send_message', 'move_lead', 'create_lead',
      'add_payment', 'add_quote',
      'edit_tags', 'edit_quick_replies'
    ],
    data: 'all_billing',
    description: 'Gerencia equipe. Vê relatórios e faturamento de todos.',
  },
  Supervisor: {
    menu: ['dashboard', 'inbox', 'kanban', 'users'],
    actions: [
      'send_message', 'move_lead', 'create_lead'
    ],
    data: 'all_billing',
    description: 'Monitora equipe. Vê métricas sem acesso a configurações.',
  },
  Comercial: {
    menu: ['dashboard', 'inbox', 'kanban'],
    actions: [
      'send_message', 'move_lead', 'create_lead', 'add_quote'
    ],
    data: 'own_billing',
    description: 'Atende conversas. Vê apenas próprio faturamento.',
  },
  Recepcionista: {
    menu: ['dashboard', 'inbox', 'kanban'],
    actions: [
      'send_message', 'move_lead'
    ],
    data: 'no_billing',
    description: 'Foco em agendamentos. Acesso limitado ao Inbox e Kanban.',
  },
  Financeiro: {
    menu: ['dashboard', 'inbox'],
    actions: [
      'add_payment', 'add_quote'
    ],
    data: 'all_billing',
    description: 'Acesso ao faturamento e pagamentos. Não responde mensagens.',
  },
  Visualizador: {
    menu: ['dashboard', 'inbox'],
    actions: [],
    data: 'no_billing',
    description: 'Apenas leitura. Visualiza sem interagir.',
  },
};

export function hasPermission(role: string | undefined, action: Action): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role as UserRole];
  if (!permissions) return false;
  return permissions.actions.includes(action);
}

export function canAccessPage(role: string | undefined, page: MenuPage): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role as UserRole];
  if (!permissions) return false;
  return permissions.menu.includes(page);
}

export function getDataAccess(role: string | undefined): DataAccess {
  if (!role) return 'no_billing';
  const permissions = ROLE_PERMISSIONS[role as UserRole];
  if (!permissions) return 'no_billing';
  return permissions.data;
}

export function getRoleDescription(role: string | undefined): string {
  if (!role) return '';
  const permissions = ROLE_PERMISSIONS[role as UserRole];
  if (!permissions) return '';
  return permissions.description;
}

export function getMenuItems(role: string | undefined): MenuPage[] {
  if (!role) return [];
  const permissions = ROLE_PERMISSIONS[role as UserRole];
  if (!permissions) return [];
  return permissions.menu;
}

export function isAdminRole(role: string | undefined): boolean {
  return role === 'SuperAdmin' || role === 'Admin';
}

export function canManageUsers(role: string | undefined): boolean {
  return hasPermission(role, 'create_user') || hasPermission(role, 'edit_user');
}
