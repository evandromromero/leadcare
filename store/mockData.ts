
import { GlobalState, User, Clinic, Chat, Lead } from '../types';
import { assets } from '../config/assets';

const clinics: Clinic[] = [
  { id: 'c1', name: 'OdontoClínica Centro', idCode: '8834-SP', logoUrl: assets.logoClinicUrl },
  { id: 'c2', name: 'Clínica Sorriso Sul', idCode: '9122-SP', logoUrl: assets.logoClinicUrl },
];

const users: User[] = [
  { id: 'u1', name: 'Ricardo Silva', email: 'admin@clinica.com', role: 'Admin', clinicId: 'c1', avatarUrl: 'https://i.pravatar.cc/150?u=u1', status: 'Ativo' },
  { id: 'u2', name: 'Ana Oliveira', email: 'atendente1@clinica.com', role: 'Atendente', clinicId: 'c1', avatarUrl: 'https://i.pravatar.cc/150?u=u2', status: 'Ativo' },
  { id: 'u3', name: 'Paulo Santos', email: 'atendente2@clinica.com', role: 'Atendente', clinicId: 'c1', avatarUrl: 'https://i.pravatar.cc/150?u=u3', status: 'Ativo' },
];

const tags = [
  { label: 'Novo', color: 'bg-blue-100 text-blue-700' },
  { label: 'Urgente', color: 'bg-red-100 text-red-700' },
  { label: 'Agendado', color: 'bg-purple-100 text-purple-700' },
  { label: 'Retorno', color: 'bg-yellow-100 text-yellow-700' },
  { label: 'Sem Resposta', color: 'bg-slate-100 text-slate-600' },
];

const chats: Chat[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `chat-${i}`,
  clientName: `Paciente ${i + 1}`,
  phoneNumber: `(11) 9${Math.floor(10000000 + Math.random() * 89999999)}`,
  avatarUrl: `https://i.pravatar.cc/150?u=paciente${i}`,
  lastMessage: i % 2 === 0 ? 'Gostaria de agendar uma consulta.' : 'Obrigado pelo atendimento!',
  lastMessageTime: '14:32',
  unreadCount: i < 2 ? i + 1 : 0,
  tags: [tags[i % tags.length]],
  messages: [
    { id: 'm1', text: 'Olá, bom dia!', sender: 'client', timestamp: '14:30' },
    { id: 'm2', text: 'Olá, como podemos ajudar?', sender: 'me', timestamp: '14:31', status: 'read' },
    { id: 'm3', text: 'Gostaria de agendar uma consulta.', sender: 'client', timestamp: '14:32' },
  ],
  status: (['Novo Lead', 'Em Atendimento', 'Agendado', 'Fechado', 'Perdido'] as const)[i % 5],
}));

const leads: Lead[] = chats.map(chat => ({
  id: `lead-${chat.id}`,
  name: chat.clientName,
  phone: chat.phoneNumber,
  email: `${chat.clientName.toLowerCase().replace(' ', '.')}@email.com`,
  stage: chat.status,
  tags: chat.tags,
  notes: 'Interessado em tratamento ortodôntico.',
  lastUpdate: '2023-10-10',
}));

export const initialState: GlobalState = {
  currentUser: null,
  selectedClinic: null,
  whatsappStatus: 'disconnected',
  chats: [],
  leads: [],
  clinics: [],
  users: [],
};
