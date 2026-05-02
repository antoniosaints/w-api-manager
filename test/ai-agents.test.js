import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAiAgent,
  createMessage,
  createSector,
  getSupportSessionByIdForTest,
  publicSettings,
  saveSettings
} from '../server/db.js';
import {
  buildAgentContents,
  buildAgentPrompt,
  parseAgentDecision,
  runAutomaticAgentForMessage,
  shouldRunAutomaticAgent
} from '../server/ai-agents.js';

test('automatic agents are gated by settings and waiting unassigned sessions', () => {
  const message = createMessage({
    phone: `551180${Date.now()}`,
    name: 'Cliente Agente',
    direction: 'inbound',
    type: 'text',
    body: 'Ola',
    status: 'received'
  });
  const session = getSupportSessionByIdForTest(message.sessionId);

  assert.equal(shouldRunAutomaticAgent({ settings: { automaticAttendance: false }, session, message }), false);
  assert.equal(shouldRunAutomaticAgent({ settings: { automaticAttendance: true }, session, message }), true);
  assert.equal(shouldRunAutomaticAgent({ settings: { automaticAttendance: true }, session: { ...session, chatStatus: 'active' }, message }), false);
});

test('automatic agents in groups require a mention of the configured instance jid', () => {
  const message = createMessage({
    phone: `120363${Date.now()}@g.us`,
    name: 'Grupo Agente',
    isGroup: true,
    direction: 'inbound',
    type: 'text',
    body: '@Bot Ola',
    status: 'received',
    raw: {
      mentions: ['5511999999999@s.whatsapp.net']
    }
  });
  const session = getSupportSessionByIdForTest(message.sessionId);
  const settings = { automaticAttendance: true, instanceJid: '5511999999999@s.whatsapp.net' };

  assert.equal(shouldRunAutomaticAgent({ settings, session, message: { ...message, mentions: [] } }), false);
  assert.equal(shouldRunAutomaticAgent({ settings: { automaticAttendance: true }, session, message }), false);
  assert.equal(shouldRunAutomaticAgent({ settings, session, message }), true);
});

test('automatic agents in groups also run when replying to the configured instance message', () => {
  const message = createMessage({
    phone: `120364${Date.now()}@g.us`,
    name: 'Grupo Resposta Agente',
    isGroup: true,
    direction: 'inbound',
    type: 'text',
    body: 'teste',
    status: 'received',
    raw: {
      event: 'webhookReceived',
      isGroup: true,
      msgContent: {
        extendedTextMessage: {
          text: 'teste',
          contextInfo: {
            stanzaId: 'agent-message-1',
            participant: '173130433691721@lid',
            quotedMessage: {
              conversation: 'Mensagem enviada pelo agente'
            }
          }
        }
      }
    }
  });
  const session = getSupportSessionByIdForTest(message.sessionId);
  const settings = { automaticAttendance: true, instanceJid: '173130433691721@lid' };

  assert.equal(shouldRunAutomaticAgent({ settings, session, message }), true);
  assert.equal(shouldRunAutomaticAgent({
    settings: { automaticAttendance: true, instanceJid: '999999999999@lid' },
    session,
    message
  }), false);
});

test('agent decisions are parsed from Gemini JSON responses', () => {
  assert.deepEqual(parseAgentDecision('{"action":"reply","message":"Oi"}'), {
    action: 'reply',
    message: 'Oi',
    transferMode: 'none',
    transferUserId: '',
    transferSectorId: '',
    tags: []
  });
  assert.deepEqual(parseAgentDecision('```json\n{"action":"transfer","transferMode":"sector","transferSectorId":"abc","tags":["vip"]}\n```'), {
    action: 'transfer',
    message: '',
    transferMode: 'sector',
    transferUserId: '',
    transferSectorId: 'abc',
    tags: ['vip']
  });
});

test('agent prompt includes context, rules, behavior and available transfer targets', () => {
  const prompt = buildAgentPrompt({
    agent: {
      name: 'Recepcao',
      context: 'Atende leads',
      rules: 'Nunca prometer desconto',
      behavior: 'Objetivo',
      transferMode: 'sector'
    },
    users: [{ id: 'u1', name: 'Ana' }],
    sectors: [{ id: 's1', name: 'Financeiro' }],
    messages: [{ direction: 'inbound', body: 'Quero boleto' }]
  });

  assert.match(prompt, /Atende leads/);
  assert.match(prompt, /Nunca prometer desconto/);
  assert.match(prompt, /Financeiro/);
  assert.match(prompt, /Quero boleto/);
});

test('agent contents attach incoming image and audio media as Gemini inline data', async () => {
  const prompt = 'Analise a ultima mensagem do cliente.';
  const imageContent = await buildAgentContents({
    prompt,
    message: {
      type: 'image',
      raw: {
        msgContent: {
          imageMessage: {
            url: 'https://mmg.whatsapp.net/v/t62/image.enc',
            mimetype: 'image/jpeg',
            mediaKey: 'abc'
          }
        }
      }
    },
    loadMedia: async () => ({ mimetype: 'image/jpeg', buffer: Buffer.from('fake-image') })
  });
  const audioContent = await buildAgentContents({
    prompt,
    message: {
      type: 'audio',
      raw: {
        msgContent: {
          audioMessage: {
            url: 'https://mmg.whatsapp.net/v/t62/audio.enc',
            mimetype: 'audio/ogg',
            mediaKey: 'abc'
          }
        }
      }
    },
    loadMedia: async () => ({ mimetype: 'audio/ogg', buffer: Buffer.from('fake-audio') })
  });

  assert.equal(imageContent[0].role, 'user');
  assert.equal(imageContent[0].parts[0].text, prompt);
  assert.deepEqual(imageContent[0].parts.find((part) => part.inlineData)?.inlineData, {
    mimeType: 'image/jpeg',
    data: Buffer.from('fake-image').toString('base64')
  });
  assert.deepEqual(audioContent[0].parts.find((part) => part.inlineData)?.inlineData, {
    mimeType: 'audio/ogg',
    data: Buffer.from('fake-audio').toString('base64')
  });
});

test('automatic agent can reply and transfer a waiting attendance to a sector', async () => {
  const suffix = Date.now();
  const sector = createSector({ name: `Financeiro ${suffix}`, color: 'orange', active: true });
  createAiAgent({
    name: `Bot ${suffix}`,
    active: true,
    context: 'Triagem',
    rules: 'Responder curto',
    behavior: 'Educado',
    transferMode: 'sector',
    transferSectorId: sector.id
  });
  saveSettings({ automaticAttendance: true, geminiApiKey: 'test-key' });
  const inbound = createMessage({
    phone: `551181${suffix}`,
    name: 'Cliente Bot',
    direction: 'inbound',
    type: 'text',
    body: 'Quero segunda via',
    status: 'received'
  });

  const result = await runAutomaticAgentForMessage(inbound, {
    generateDecision: async () => ({
      action: 'reply',
      message: 'Vou encaminhar voce ao financeiro.',
      transferMode: 'sector',
      transferSectorId: sector.id,
      tags: []
    }),
    sendText: async () => ({ messageId: `agent-${suffix}` })
  });
  const session = getSupportSessionByIdForTest(inbound.sessionId);

  assert.equal(publicSettings().automaticAttendance, true);
  assert.equal(result?.reply?.body, 'Vou encaminhar voce ao financeiro.');
  assert.equal(session.sectorId, sector.id);
});
