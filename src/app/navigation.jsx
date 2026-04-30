import {
  BarChart3,
  Bot,
  History,
  MessageCircle,
  Navigation,
  Send,
  Settings,
  Smartphone,
  Users,
  Webhook
} from 'lucide-react';

export const navItems = [
  ['dashboard', BarChart3, 'Dashboard', 'Insights centrais'],
  ['inbox', MessageCircle, 'Atendimento', 'Fila e conversas'],
  ['history', History, 'Historico', 'Consulta geral'],
  ['agents', Bot, 'Agentes', 'IA e setores', 'admin'],
  ['users', Users, 'Usuarios', 'Equipe e acessos', 'admin'],
  ['contacts', Navigation, 'Contatos', 'CRM leve'],
  ['send', Send, 'Enviar', 'Mensagem direta'],
  ['connection', Smartphone, 'Conexao', 'Status e QR Code', 'admin'],
  ['webhooks', Webhook, 'Webhooks', 'Tempo real', 'admin'],
  ['settings', Settings, 'Ajustes', 'Credenciais locais', 'admin']
];

export const pageMeta = {
  dashboard: ['Dashboard', 'Centralize os principais insights da operacao.'],
  inbox: ['Atendimento', 'Monitore conversas recebidas e responda em tempo real.'],
  history: ['Historico', 'Consulte todos os atendimentos encerrados e em andamento.'],
  agents: ['Agentes', 'Configure IA, setores e etiquetas de atendimento.'],
  users: ['Usuarios', 'Gerencie equipe, perfis e acessos ao atendimento.'],
  contacts: ['Contatos', 'Organize clientes, dados de contato e envio posterior.'],
  send: ['Enviar mensagem', 'Dispare uma mensagem direta sem sair da operacao.'],
  connection: ['Conexao W-API', 'Confira status da instancia e gere QR Code quando necessario.'],
  webhooks: ['Webhooks', 'Registre endpoints e acompanhe eventos recebidos.'],
  settings: ['Ajustes da API', 'Configure credenciais e URL publica do servidor.']
};
