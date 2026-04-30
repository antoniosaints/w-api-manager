import {
  createMessage,
  getSettings,
  getSupportSessionById,
  listAiAgents,
  listMessages,
  listSectors,
  listSupportTags,
  listUsers,
  setSupportSessionTags,
  transferSupportSession
} from './db.js';
import { sendTextMessage } from './wapi.js';

const AGENT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    action: { type: 'STRING', enum: ['reply', 'transfer', 'none'] },
    message: { type: 'STRING' },
    transferMode: { type: 'STRING', enum: ['none', 'user', 'sector'] },
    transferUserId: { type: 'STRING' },
    transferSectorId: { type: 'STRING' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['action']
};

export function shouldRunAutomaticAgent({ settings, session, message }) {
  if (!settings?.automaticAttendance) return false;
  if (!session || !message) return false;
  if (message.direction !== 'inbound') return false;
  const status = session.chatStatus || session.status;
  if (status !== 'waiting') return false;
  if (session.assignedUserId || session.assigned_user_id) return false;
  if (session.isGroup || session.is_group || message.isGroup || message.is_group) {
    return isConfiguredInstanceReferenced(settings, message);
  }
  return true;
}

export function buildAgentPrompt({ agent, users = [], sectors = [], tags = [], messages = [] }) {
  const history = messages
    .filter((item) => item.direction !== 'system')
    .slice(-12)
    .map((item) => `${item.direction === 'outbound' ? 'Atendimento' : 'Cliente'}: ${String(item.body || '').trim()}`)
    .join('\n');
  const transferUsers = users.map((user) => `- ${user.name} (${user.id})`).join('\n') || '- Nenhum usuario ativo';
  const transferSectors = sectors.map((sector) => `- ${sector.name} (${sector.id})`).join('\n') || '- Nenhum setor ativo';
  const availableTags = tags.map((tag) => `- ${tag.name} (${tag.id})`).join('\n') || '- Nenhuma tag cadastrada';

  return [
    `Agente: ${agent.name}`,
    `Contexto: ${agent.context || 'Sem contexto adicional.'}`,
    `Regras: ${agent.rules || 'Responder com clareza e sem inventar informacoes.'}`,
    `Comportamento: ${agent.behavior || 'Profissional, direto e cordial.'}`,
    `Transferencia padrao: ${agent.transferMode || 'none'}`,
    '',
    'Usuarios disponiveis para transferencia:',
    transferUsers,
    '',
    'Setores disponiveis para transferencia:',
    transferSectors,
    '',
    'Tags disponiveis:',
    availableTags,
    '',
    'Historico recente:',
    history || 'Sem historico anterior.',
    '',
    'Responda apenas JSON valido com action, message, transferMode, transferUserId, transferSectorId e tags.'
  ].join('\n');
}

export function parseAgentDecision(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return normalizeAgentDecision(value);
  }
  const text = String(value || '').trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  let parsed = {};
  try {
    parsed = JSON.parse(text || '{}');
  } catch {
    parsed = {};
  }
  return normalizeAgentDecision(parsed);
}

function normalizeAgentDecision(parsed = {}) {
  const action = ['reply', 'transfer', 'none'].includes(parsed.action) ? parsed.action : 'none';
  const transferMode = ['user', 'sector'].includes(parsed.transferMode) ? parsed.transferMode : 'none';
  return {
    action,
    message: String(parsed.message || '').trim(),
    transferMode,
    transferUserId: transferMode === 'user' ? String(parsed.transferUserId || '').trim() : '',
    transferSectorId: transferMode === 'sector' ? String(parsed.transferSectorId || '').trim() : '',
    tags: Array.isArray(parsed.tags) ? parsed.tags.map((item) => String(item || '').trim()).filter(Boolean) : []
  };
}

export async function runAutomaticAgentForMessage(message, options = {}) {
  const settings = getSettings();
  const session = getSupportSessionById(message.sessionId);
  if (!shouldRunAutomaticAgent({
    settings: {
      automaticAttendance: settings.automaticAttendance === 'true' || settings.automaticAttendance === true,
      instanceJid: settings.instanceJid
    },
    session,
    message
  })) return null;

  const agent = listAiAgents({ activeOnly: true })[0];
  if (!agent || !settings.geminiApiKey) return null;

  const users = listUsers({ activeOnly: true });
  const sectors = listSectors({ activeOnly: true });
  const supportTags = listSupportTags({ activeOnly: true });
  const messages = listMessages(message.sessionId);
  const prompt = buildAgentPrompt({ agent, users, sectors, tags: supportTags, messages });
  const generateDecision = options.generateDecision || ((input) => generateGeminiDecision(input, settings.geminiApiKey));
  const decision = parseAgentDecision(await generateDecision({ agent, prompt }));
  const finalDecision = applyDefaultTransfer(decision, agent);

  let reply = null;
  if (finalDecision.action === 'reply' && finalDecision.message) {
    const sendText = options.sendText || sendTextMessage;
    const result = await sendText({ phone: message.phone, message: finalDecision.message });
    reply = createMessage({
      phone: message.phone,
      sessionId: message.sessionId,
      direction: 'outbound',
      type: 'text',
      body: finalDecision.message,
      status: 'sent',
      externalId: result?.messageId || result?.id || null,
      raw: {
        ...result,
        aiAgentId: agent.id,
        automaticAttendance: true
      }
    });
  }

  let transferred = null;
  if (finalDecision.transferMode === 'user' && finalDecision.transferUserId) {
    transferred = transferSupportSession(message.sessionId, { targetUserId: finalDecision.transferUserId }, { name: agent.name });
  }
  if (finalDecision.transferMode === 'sector' && finalDecision.transferSectorId) {
    transferred = transferSupportSession(message.sessionId, { targetSectorId: finalDecision.transferSectorId }, { name: agent.name });
  }

  if (finalDecision.tags.length) {
    const tagIds = supportTags
      .filter((tag) => finalDecision.tags.includes(tag.id) || finalDecision.tags.includes(tag.name))
      .map((tag) => tag.id);
    if (tagIds.length) setSupportSessionTags(message.sessionId, tagIds);
  }

  return { agent, reply, transferred, decision: finalDecision };
}

function isConfiguredInstanceReferenced(settings = {}, message = {}) {
  const identity = normalizeMentionIdentity(settings.instanceJid || settings.instancePhone || settings.botJid || '');
  if (!identity) return false;
  return isConfiguredInstanceMentioned(identity, message) || isConfiguredInstanceQuoted(identity, message);
}

function isConfiguredInstanceMentioned(identity, message = {}) {
  const sourceMentions = Array.isArray(message.mentions)
    ? message.mentions
    : Array.isArray(message.raw?.normalizedMentions)
      ? message.raw.normalizedMentions
      : Array.isArray(message.raw?.mentions)
        ? message.raw.mentions
        : [];
  const mentions = sourceMentions.map(normalizeMentionIdentity).filter(Boolean);
  return mentions.includes(identity);
}

function isConfiguredInstanceQuoted(identity, message = {}) {
  const participants = [
    message.replyParticipant,
    message.raw?.normalizedReplyParticipant,
    ...extractQuotedParticipants(message.raw)
  ].map(normalizeMentionIdentity).filter(Boolean);
  return participants.includes(identity);
}

function extractQuotedParticipants(raw) {
  if (!raw || typeof raw !== 'object') return [];
  const content = raw.msgContent || raw.message || raw;
  const contexts = [
    content.extendedTextMessage?.contextInfo,
    content.imageMessage?.contextInfo,
    content.videoMessage?.contextInfo,
    content.stickerMessage?.contextInfo,
    content.documentMessage?.contextInfo,
    content.audioMessage?.contextInfo,
    content.contextInfo,
    raw.contextInfo,
    raw.messageContextInfo
  ].filter(Boolean);
  return contexts.flatMap((context) => [
    context.participant,
    context.participantJid,
    context.key?.participant
  ]);
}

function normalizeMentionIdentity(value) {
  const clean = String(value || '').replace(/\s/g, '').trim().toLowerCase();
  if (!clean) return '';
  if (clean.endsWith('@s.whatsapp.net') || clean.endsWith('@c.us')) return clean.split('@')[0];
  return clean.replace(/\D/g, '') || clean;
}

async function generateGeminiDecision({ agent, prompt }, apiKey) {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: agent.model || 'gemini-2.0-flash',
    contents: prompt,
    config: {
      temperature: agent.temperature ?? 0.4,
      responseMimeType: 'application/json',
      responseSchema: AGENT_RESPONSE_SCHEMA,
      systemInstruction: 'Voce e um agente de atendimento de WhatsApp. Retorne somente JSON valido.'
    }
  });
  return response.text;
}

function applyDefaultTransfer(decision, agent) {
  if (decision.transferMode !== 'none') return decision;
  if (!['reply', 'transfer'].includes(decision.action)) return decision;
  if (agent.transferMode === 'user' && agent.transferUserId) {
    return { ...decision, transferMode: 'user', transferUserId: agent.transferUserId };
  }
  if (agent.transferMode === 'sector' && agent.transferSectorId) {
    return { ...decision, transferMode: 'sector', transferSectorId: agent.transferSectorId };
  }
  return decision;
}
