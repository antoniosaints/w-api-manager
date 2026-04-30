import test from 'node:test';
import assert from 'node:assert/strict';
import { isGroupPayload, isReactionPayload, normalizeIncomingMessage } from '../server/normalize.js';

test('normalizes W-API received text payload into an inbound chat message', () => {
  const message = normalizeIncomingMessage({
    event: 'webhookReceived',
    instanceId: 'instance-1',
    isGroup: false,
    messageId: 'msg-1',
    fromMe: false,
    chat: {
      id: '5511999999999@s.whatsapp.net',
      profilePicture: 'https://cdn.example.com/avatar.jpg'
    },
    sender: {
      id: '5511888888888@s.whatsapp.net',
      pushName: 'Cliente Teste'
    },
    moment: 1777377522,
    msgContent: {
      conversation: 'Ola, preciso de ajuda'
    }
  });

  assert.equal(message.phone, '5511999999999');
  assert.equal(message.name, 'Cliente Teste');
  assert.equal(message.avatarUrl, 'https://cdn.example.com/avatar.jpg');
  assert.equal(message.externalId, 'msg-1');
  assert.equal(message.type, 'text');
  assert.equal(message.body, 'Ola, preciso de ajuda');
  assert.equal(message.createdAt, '2026-04-28T11:58:42.000Z');
});

test('normalizes W-API received image payload with renderable media source', () => {
  const message = normalizeIncomingMessage({
    event: 'webhookReceived',
    messageId: 'img-1',
    chat: {
      id: '5511999999999@s.whatsapp.net',
      profilePicture: 'https://cdn.example.com/chat-avatar.jpg'
    },
    sender: {
      pushName: 'Cliente Teste'
    },
    moment: 1777377530,
    msgContent: {
      imageMessage: {
        url: 'https://cdn.example.com/image.jpg',
        caption: 'Foto do comprovante',
        mimetype: 'image/jpeg'
      }
    }
  });

  assert.equal(message.avatarUrl, 'https://cdn.example.com/chat-avatar.jpg');
  assert.equal(message.type, 'image');
  assert.equal(message.mediaPath, 'https://cdn.example.com/image.jpg');
  assert.equal(message.body, 'Foto do comprovante');
});

test('normalizes W-API associated child image payload using thumbnail preview', () => {
  const message = normalizeIncomingMessage({
    event: 'webhookReceived',
    messageId: 'img-2',
    chat: {
      id: '559984140666',
      profilePicture: 'https://cdn.example.com/avatar.jpg'
    },
    sender: {
      pushName: 'Antonio'
    },
    moment: 1777378172,
    msgContent: {
      associatedChildMessage: {
        message: {
          imageMessage: {
            url: 'https://mmg.whatsapp.net/o1/v/t24/f2/image',
            mimetype: 'image/jpeg',
            jpegThumbnail: '/9j/abc123'
          }
        }
      }
    }
  });

  assert.equal(message.type, 'image');
  assert.equal(message.mediaPath, 'data:image/jpeg;base64,/9j/abc123');
  assert.equal(message.body, '[received]');
});

test('normalizes W-API received sticker payload as visual media', () => {
  const message = normalizeIncomingMessage({
    event: 'webhookReceived',
    messageId: 'sticker-1',
    chat: {
      id: '559984140666',
      profilePicture: 'https://cdn.example.com/avatar.jpg'
    },
    sender: {
      pushName: 'Antonio'
    },
    moment: 1777379160,
    msgContent: {
      stickerMessage: {
        url: 'https://mmg.whatsapp.net/v/t62.15575-24/sticker.enc',
        mimetype: 'image/webp',
        mediaKey: 'abc',
        isAnimated: false
      }
    }
  });

  assert.equal(message.phone, '559984140666');
  assert.equal(message.name, 'Antonio');
  assert.equal(message.type, 'sticker');
  assert.equal(message.mediaPath, 'https://mmg.whatsapp.net/v/t62.15575-24/sticker.enc');
  assert.equal(message.body, '[received]');
});

test('normalizes W-API received audio payload with playable media metadata', () => {
  const message = normalizeIncomingMessage({
    event: 'webhookReceived',
    messageId: 'audio-1',
    chat: {
      id: '5511999999999@s.whatsapp.net'
    },
    sender: {
      pushName: 'Cliente Teste'
    },
    moment: 1777377535,
    msgContent: {
      audioMessage: {
        url: 'https://mmg.whatsapp.net/v/t62/audio.enc',
        mimetype: 'audio/ogg; codecs=opus',
        mediaKey: 'abc',
        fileLength: '61234',
        seconds: 18
      }
    }
  });

  assert.equal(message.type, 'audio');
  assert.equal(message.mediaPath, 'https://mmg.whatsapp.net/v/t62/audio.enc');
  assert.equal(message.body, '[received]');
  assert.deepEqual(message.media, {
    type: 'audio',
    url: 'https://mmg.whatsapp.net/v/t62/audio.enc',
    mimetype: 'audio/ogg; codecs=opus',
    mediaKey: 'abc',
    fileName: '',
    size: 61234,
    duration: 18
  });
});

test('normalizes W-API fromMe media payload as an outbound echo', () => {
  const message = normalizeIncomingMessage({
    event: 'webhookDelivery',
    messageId: 'out-img-1',
    fromMe: true,
    chat: {
      id: '5511999999999@s.whatsapp.net'
    },
    sender: {
      pushName: 'Atendente'
    },
    msgContent: {
      imageMessage: {
        url: 'https://mmg.whatsapp.net/v/t62/image.enc',
        directPath: '/v/t62/image.enc?oh=token',
        mimetype: 'image/jpeg',
        mediaKey: 'abc',
        fileLength: '1200'
      }
    }
  });

  assert.equal(message.fromMe, true);
  assert.equal(message.type, 'image');
  assert.equal(message.mediaPath, 'https://mmg.whatsapp.net/v/t62/image.enc');
  assert.equal(message.media.directPath, '/v/t62/image.enc?oh=token');
});

test('normalizes W-API received video payload preserving caption', () => {
  const message = normalizeIncomingMessage({
    event: 'webhookReceived',
    messageId: 'video-1',
    chat: {
      id: '5511999999999@s.whatsapp.net'
    },
    sender: {
      pushName: 'Cliente Teste'
    },
    msgContent: {
      videoMessage: {
        url: 'https://cdn.example.com/video.mp4',
        mimetype: 'video/mp4',
        caption: 'Video do problema',
        fileLength: '1048576',
        seconds: 9
      }
    }
  });

  assert.equal(message.type, 'video');
  assert.equal(message.mediaPath, 'https://cdn.example.com/video.mp4');
  assert.equal(message.body, 'Video do problema');
  assert.equal(message.media.duration, 9);
  assert.equal(message.media.size, 1048576);
});

test('normalizes W-API received document payload preserving file name and caption', () => {
  const message = normalizeIncomingMessage({
    event: 'webhookReceived',
    messageId: 'doc-1',
    chat: {
      id: '5511999999999@s.whatsapp.net'
    },
    sender: {
      pushName: 'Cliente Teste'
    },
    msgContent: {
      documentMessage: {
        url: 'https://cdn.example.com/contrato.pdf',
        mimetype: 'application/pdf',
        fileName: 'contrato.pdf',
        caption: 'Contrato assinado',
        fileLength: '240000'
      }
    }
  });

  assert.equal(message.type, 'document');
  assert.equal(message.mediaPath, 'https://cdn.example.com/contrato.pdf');
  assert.equal(message.body, 'Contrato assinado');
  assert.equal(message.media.fileName, 'contrato.pdf');
  assert.equal(message.media.size, 240000);
});

test('normalizes W-API sticker payload using directPath when url is generic web WhatsApp', () => {
  const message = normalizeIncomingMessage({
    event: 'webhookReceived',
    isGroup: true,
    messageId: 'sticker-2',
    chat: {
      id: '120363287682702007@g.us',
      profilePicture: 'https://cdn.example.com/group.jpg'
    },
    sender: {
      id: '559984140666',
      pushName: 'Antonio'
    },
    moment: 1777397866,
    msgContent: {
      stickerMessage: {
        url: 'https://web.whatsapp.net',
        mimetype: 'image/webp',
        mediaKey: 'abc',
        directPath: '/v/t62.15575-24/sticker.enc?ccb=11-4&oh=token',
        isAnimated: true
      }
    }
  });

  assert.equal(message.type, 'sticker');
  assert.equal(message.mediaPath, 'https://mmg.whatsapp.net/v/t62.15575-24/sticker.enc?ccb=11-4&oh=token');
});

test('detects W-API reaction payloads so they are not stored as chat messages', () => {
  assert.equal(isReactionPayload({
    event: 'webhookReceived',
    isGroup: true,
    msgContent: {
      reactionMessage: {
        text: '😂'
      }
    }
  }), true);
});

test('normalizes W-API group payload using group chat and sender metadata', () => {
  const message = normalizeIncomingMessage({
    event: 'webhookReceived',
    isGroup: true,
    messageId: 'group-msg-1',
    chat: {
      id: '120363287682702007@g.us',
      name: 'Grupo Suporte',
      profilePicture: 'https://cdn.example.com/group.jpg'
    },
    sender: {
      id: '556194072732',
      pushName: 'Philipe'
    },
    moment: 1777390574,
    msgContent: {
      conversation: 'Mensagem do grupo'
    }
  });

  assert.equal(message.phone, '120363287682702007@g.us');
  assert.equal(message.name, 'Grupo Suporte');
  assert.equal(message.isGroup, true);
  assert.equal(message.senderName, 'Philipe');
  assert.equal(message.senderPhone, '556194072732');
  assert.equal(message.body, 'Mensagem do grupo');
});

test('normalizes group mentions from W-API context info', () => {
  const message = normalizeIncomingMessage({
    event: 'webhookReceived',
    isGroup: true,
    messageId: 'group-mention-1',
    chat: {
      id: '120363287682702007@g.us',
      name: 'Grupo Suporte'
    },
    sender: {
      id: '556194072732',
      pushName: 'Philipe'
    },
    msgContent: {
      extendedTextMessage: {
        text: '@Bot preciso de ajuda',
        contextInfo: {
          mentionedJid: ['5511999999999@s.whatsapp.net']
        }
      }
    }
  });

  assert.deepEqual(message.mentions, ['5511999999999@s.whatsapp.net']);
});

test('normalizes quoted group messages with participant context', () => {
  const message = normalizeIncomingMessage({
    event: 'webhookReceived',
    isGroup: true,
    messageId: 'group-quoted-1',
    chat: {
      id: '120363324769660152@g.us'
    },
    sender: {
      id: '559984140666',
      senderLid: '129089637736662@lid',
      pushName: 'Antonio'
    },
    msgContent: {
      extendedTextMessage: {
        text: 'teste',
        contextInfo: {
          stanzaId: 'KI3V90TFHONQPL6WNQPZ',
          participant: '173130433691721@lid',
          quotedMessage: {
            conversation: 'Mensagem do agente'
          }
        }
      }
    }
  });

  assert.equal(message.replyToExternalId, 'KI3V90TFHONQPL6WNQPZ');
  assert.equal(message.replyParticipant, '173130433691721@lid');
  assert.equal(message.replyPreview, 'Mensagem do agente');
});

test('detects group payloads even when W-API wraps the event in data', () => {
  assert.equal(isGroupPayload({
    data: {
      isGroup: true,
      chat: {
        id: '120363287682702007@g.us'
      }
    }
  }), true);
});
