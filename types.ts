
export type UserRole = 'Admin' | 'Gerente' | 'Supervisor' | 'Comercial' | 'Recepcionista' | 'Financeiro' | 'Visualizador';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  clinicId: string;
  avatarUrl: string;
  status: 'Ativo' | 'Inativo';
}

export interface Clinic {
  id: string;
  name: string;
  idCode: string;
  logoUrl: string;
}

export type WhatsAppStatus = 'connected' | 'disconnected' | 'reconnecting';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'client';
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
}

export interface Tag {
  label: string;
  color: string;
}

export interface Chat {
  id: string;
  clientName: string;
  phoneNumber: string;
  avatarUrl: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  tags: Tag[];
  messages: Message[];
  status: 'Novo Lead' | 'Em Atendimento' | 'Agendado' | 'Fechado' | 'Perdido';
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  stage: Chat['status'];
  tags: Tag[];
  notes: string;
  lastUpdate: string;
}

export interface GlobalState {
  currentUser: User | null;
  selectedClinic: Clinic | null;
  whatsappStatus: WhatsAppStatus;
  chats: Chat[];
  leads: Lead[];
  clinics: Clinic[];
  users: User[];
}
