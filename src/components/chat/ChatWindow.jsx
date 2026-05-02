import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  CheckCircle2,
  CornerUpLeft,
  Loader2,
  MessageCircle,
  Mic,
  Navigation,
  Paperclip,
  RotateCcw,
  Send,
  Square,
  Tags,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  MessageSquareShareIcon
} from 'lucide-react';
import { API, api } from '../../shared/api.js';
import { formatTime, initials, isPlaceholderBody } from '../../shared/format.js';
import { getMessageMedia } from '../../media.js';
import { MEDIA_FILE_ACCEPT, formatBytes, formatDuration, prepareMediaFile, validateMediaFile } from '../../media-config.js';
import { MediaLabelIcon, MessageBubble, getMessageMediaLabel } from './MessageBubble.jsx';

export function ChatWindow({
  selectedConversation,
  messages,
  loadingMessages = false,
  onOpenMedia,
  onAttend,
  onReopen,
  onFinish,
  onDelete,
  onTransfer,
  onTagsChange,
  onSectorChange,
  onSaveContact,
  users = [],
  sectors = [],
  supportTags = [],
  currentUser,
  onSent,
  onError
}) {
  const [draft, setDraft] = useState('');
  const [mediaDraft, setMediaDraft] = useState(null);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [transferTarget, setTransferTarget] = useState('');
  const [sending, setSending] = useState(false);
  const [recordingState, setRecordingState] = useState('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const streamRef = useRef(null);
  const bottomRef = useRef(null);
  const lastScrolledSessionRef = useRef('');
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingCancelledRef = useRef(false);
  const chatStatus = selectedConversation?.chatStatus || 'waiting';
  const selectedSessionId = selectedConversation?.id || '';
  const selectedPhone = selectedConversation?.phone || '';
  const canReply = chatStatus === 'active';
  const transferUsers = users.filter((user) => user.active && user.id !== currentUser?.id);
  const currentTagIds = (selectedConversation?.tags || []).map((tag) => tag.id);
  const isRecording = recordingState === 'recording';
  const isProcessingRecording = recordingState === 'processing';

  useEffect(() => {
    if (!selectedSessionId || loadingMessages) return undefined;

    const isNewSession = lastScrolledSessionRef.current !== selectedSessionId;
    lastScrolledSessionRef.current = selectedSessionId;
    const behavior = isNewSession ? 'auto' : 'smooth';
    scrollToLatestMessage(behavior);

    const frame = window.requestAnimationFrame(() => scrollToLatestMessage('auto'));
    const timeout = window.setTimeout(() => scrollToLatestMessage('auto'), 90);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [loadingMessages, messages.length, selectedSessionId]);

  useEffect(() => {
    setDraft('');
    setMediaDraft(null);
    setMediaProgress(0);
    setReplyingTo(null);
    setTransferTarget('');
    cancelAudioRecording();
  }, [selectedSessionId]);

  useEffect(() => () => stopRecordingResources(), []);

  async function submit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!selectedPhone || (!text && !mediaDraft) || !canReply || isRecording || isProcessingRecording) return;
    setSending(true);
    try {
      const result = await api('/api/messages/send', {
        method: 'POST',
        body: {
          phone: selectedPhone,
          message: text,
          sessionId: selectedSessionId,
          media: mediaDraft ? {
            type: mediaDraft.type,
            uploadId: mediaDraft.uploadId,
            publicPath: mediaDraft.publicPath,
            name: mediaDraft.name,
            mimeType: mediaDraft.mimeType,
            size: mediaDraft.size,
            extension: mediaDraft.extension
          } : null,
          replyToMessageId: replyingTo?.id || '',
          replyToExternalId: replyingTo?.externalId || '',
          replyPreview: replyingTo ? buildReplyPreview(replyingTo) : ''
        }
      });
      clearComposer();
      onSent(result.message);
    } catch (error) {
      onError(error);
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      insertTextareaValue(event.currentTarget, '\n', setDraft);
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function handleMediaSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const validation = validateMediaFile(file);
      if (!validation.valid) throw new Error(validation.message);
      setMediaProgress(4);
      const prepared = await prepareMediaFile(file, { onProgress: setMediaProgress });
      setMediaProgress(98);
      const uploaded = await uploadPreparedMedia(prepared);
      setMediaDraft(uploaded);
      setMediaProgress(0);
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Nao foi possivel preparar a midia selecionada.'));
      setMediaProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function startAudioRecording() {
    if (!canReply || sending || isRecording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError(new Error('Gravacao de audio indisponivel neste navegador.'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingChunksRef.current = [];
      recordingCancelledRef.current = false;
      recordingStreamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => finalizeAudioRecording(mimeType || recorder.mimeType || 'audio/ogg');
      recorder.start();
      setMediaDraft(null);
      setMediaProgress(0);
      setRecordingSeconds(0);
      setRecordingState('recording');
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => current + 1);
      }, 1000);
    } catch {
      stopRecordingResources();
      setRecordingState('idle');
      onError(new Error('Nao foi possivel acessar o microfone.'));
    }
  }

  function stopAudioRecording() {
    if (recorderRef.current?.state === 'recording') {
      setRecordingState('processing');
      recorderRef.current.stop();
    }
  }

  function cancelAudioRecording() {
    recordingCancelledRef.current = true;
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    } else {
      stopRecordingResources();
      setRecordingState('idle');
      setRecordingSeconds(0);
    }
  }

  async function finalizeAudioRecording(mimeType) {
    const cancelled = recordingCancelledRef.current;
    const chunks = recordingChunksRef.current;
    stopRecordingResources();
    setRecordingSeconds(0);
    if (cancelled) {
      setRecordingState('idle');
      return;
    }
    if (!chunks.length) {
      setRecordingState('idle');
      onError(new Error('Nenhum audio foi gravado.'));
      return;
    }

    try {
      setRecordingState('processing');
      setMediaProgress(8);
      const extension = mimeToExtension(mimeType);
      const file = new File([new Blob(chunks, { type: mimeType })], `audio-gravado.${extension}`, { type: mimeType });
      const prepared = await prepareMediaFile(file, { onProgress: setMediaProgress });
      setMediaProgress(98);
      const uploaded = await uploadPreparedMedia({ ...prepared, type: 'audio', name: 'audio-gravado.' + extension, extension });
      setMediaDraft(uploaded);
      setMediaProgress(0);
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Nao foi possivel preparar o audio gravado.'));
      setMediaProgress(0);
    } finally {
      setRecordingState('idle');
    }
  }

  function stopRecordingResources() {
    window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    recorderRef.current = null;
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    recordingChunksRef.current = [];
  }

  function clearComposer() {
    setDraft('');
    setMediaDraft(null);
    setMediaProgress(0);
    setReplyingTo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function scrollToLatestMessage(behavior = 'smooth') {
    const stream = streamRef.current;
    if (stream) {
      if (typeof stream.scrollTo === 'function') {
        stream.scrollTo({ top: stream.scrollHeight, behavior });
      } else {
        stream.scrollTop = stream.scrollHeight;
      }
    } else {
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
    }
    setShowScrollToLatest(false);
  }

  function updateScrollToLatestVisibility() {
    const stream = streamRef.current;
    if (!stream) return;
    const distanceFromBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight;
    setShowScrollToLatest(distanceFromBottom > 180);
  }

  if (!selectedPhone) {
    return (
      <section className="chat-panel empty-state">
        <MessageCircle size={42} />
        <h1>Atendimento em tempo real</h1>
        <p>Quando a W-API chamar o webhook de recebimento, a conversa aparece aqui automaticamente.</p>
      </section>
    );
  }

  return (
    <section className="chat-panel">
      <div className="chat-header justify-between">
        <div className="flex items-center gap-2">
          <ContactAvatar contact={selectedConversation} fallback={selectedPhone} large />
          <div className="chat-title-copy">
            <strong>{selectedConversation?.name || selectedPhone}</strong>
            <ConversationTags conversation={selectedConversation} />
            <small>{selectedPhone} · {getConversationStatusLabel(chatStatus)}</small>
          </div>
        </div>
        <div className="chat-actions">
          <label className="transfer-control">
            <Tags size={16} />
            <select value="" onChange={(event) => {
              const tagId = event.target.value;
              if (tagId && !currentTagIds.includes(tagId)) onTagsChange?.(selectedSessionId, [...currentTagIds, tagId]);
            }} title="Adicionar tag">
              <option value="">Tag</option>
              {supportTags.filter((tag) => tag.active && !currentTagIds.includes(tag.id)).map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          </label>
          <label className="transfer-control">
            <Navigation size={16} />
            <select value={selectedConversation?.sectorId || ''} onChange={(event) => onSectorChange?.(selectedSessionId, event.target.value)} title="Setor do atendimento">
              <option value="">Setor</option>
              {sectors.filter((sector) => sector.active).map((sector) => (
                <option key={sector.id} value={sector.id}>{sector.name}</option>
              ))}
            </select>
          </label>
          {chatStatus === 'waiting' && (
            <button type="button" className="secondary-action compact-action" onClick={() => onAttend(selectedSessionId)}>
              <UserCheck size={17} />
              Atender
            </button>
          )}
          {chatStatus === 'finished' && (
            <button type="button" className="secondary-action compact-action" onClick={() => onReopen(selectedSessionId)}>
              <RotateCcw size={17} />
              Reabrir
            </button>
          )}
          {chatStatus === 'active' && (
            <>
              <label className="transfer-control">
                <Users size={16} />
                <select value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)} title="Transferir atendimento">
                  <option value="">Transferir</option>
                  {transferUsers.map((user) => (
                    <option key={user.id} value={`user:${user.id}`}>{user.name}</option>
                  ))}
                  {sectors.filter((sector) => sector.active).map((sector) => (
                    <option key={sector.id} value={`sector:${sector.id}`}>Setor: {sector.name}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="secondary-action compact-action" disabled={!transferTarget} onClick={() => onTransfer?.(selectedSessionId, transferTarget)}>
                <MessageSquareShareIcon size={17} />
              </button>
              <button type="button" className="secondary-action compact-action" onClick={() => onFinish(selectedSessionId)}>
                <CheckCircle2 size={17} />
                Finalizar
              </button>
            </>
          )}
          <button type="button" className="secondary-action compact-action" onClick={() => onSaveContact?.({
            phone: selectedPhone,
            name: selectedConversation?.name || '',
            avatarUrl: selectedConversation?.avatarUrl || '',
            isGroup: Boolean(selectedConversation?.isGroup),
            source: 'chat'
          })}>
            <UserPlus size={17} />
          </button>
          <button type="button" className="secondary-action compact-action danger-action" onClick={() => onDelete(selectedSessionId)}>
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      <div className="message-stream" ref={streamRef} onScroll={updateScrollToLatestVisibility}>
        {loadingMessages ? (
          <div className="chat-loading">
            <Loader2 className="spin" size={22} />
            <span>Carregando mensagens</span>
          </div>
        ) : messages.length ? messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onOpenMedia={onOpenMedia}
            onReply={setReplyingTo}
            canReply={canReply}
            showSenderName={Boolean(selectedConversation?.isGroup)}
          />
        )) : <p className="empty stream-empty">Nenhuma mensagem carregada para esta conversa.</p>}
        <div ref={bottomRef} />
      </div>

      {showScrollToLatest && !loadingMessages && (
        <button
          type="button"
          className="chat-scroll-bottom"
          onClick={() => scrollToLatestMessage()}
          title="Ir para a ultima mensagem"
          aria-label="Ir para a ultima mensagem"
        >
          <ArrowDown size={18} />
        </button>
      )}

      <form className="composer composer-shell" onSubmit={submit}>
        {(replyingTo || mediaDraft || mediaProgress > 0 || isRecording || isProcessingRecording) && (
          <div className="composer-preview">
            <div>
              {replyingTo && <span><CornerUpLeft size={15} />Respondendo: {buildReplyPreview(replyingTo)}</span>}
              {mediaDraft && (
                <span>
                  <MediaLabelIcon type={mediaDraft.type} size={15} />
                  {mediaDraft.name}
                  {mediaDraft.size ? ` · ${formatBytes(mediaDraft.size)}` : ''}
                  {mediaDraft.compressed ? ' · comprimida' : ''}
                </span>
              )}
              {!mediaDraft && mediaProgress > 0 && <span><Loader2 className="spin" size={15} />Preparando midia {mediaProgress}%</span>}
              {isRecording && <span className="recording-preview"><Mic size={15} />Gravando <strong className="recording-timer">{formatDuration(recordingSeconds) || '0:00'}</strong></span>}
              {isProcessingRecording && <span><Loader2 className="spin" size={15} />Preparando audio</span>}
            </div>
            <button type="button" onClick={() => {
              if (isRecording || isProcessingRecording) cancelAudioRecording();
              clearComposer();
            }} title="Limpar anexos">
              <X size={16} />
            </button>
          </div>
        )}
        <input ref={fileInputRef} className="sr-only" type="file" accept={MEDIA_FILE_ACCEPT} onChange={handleMediaSelection} disabled={!canReply || sending || isRecording} />
        <div className="composer-bar">
          <button type="button" className="attach-button" onClick={() => fileInputRef.current?.click()} disabled={!canReply || sending || isRecording} title="Anexar midia">
            <Paperclip size={21} />
          </button>
          <button
            type="button"
            className={isRecording ? 'record-button recording' : 'record-button'}
            onClick={isRecording ? stopAudioRecording : startAudioRecording}
            disabled={!canReply || sending || isProcessingRecording}
            title={isRecording ? 'Finalizar gravacao' : 'Gravar audio'}
          >
            {isRecording ? <Square size={18} /> : <Mic size={20} />}
          </button>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={canReply ? 'Digite uma mensagem' : 'Atenda o contato para responder'}
            disabled={!canReply || isRecording}
            rows={1}
          />
          <button className="send-button" disabled={sending || isRecording || isProcessingRecording || (!draft.trim() && !mediaDraft) || !canReply} title="Enviar resposta">
            {sending ? <Loader2 className="spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
      </form>
    </section>
  );
}

async function uploadPreparedMedia(prepared) {
  const blob = prepared.blob || dataUrlToBlob(prepared.dataUrl, prepared.mimeType);
  const response = await fetch(`${API}/api/messages/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': prepared.mimeType || blob.type || 'application/octet-stream',
      'X-WAPI-Media-Type': prepared.type,
      'X-WAPI-File-Name': encodeURIComponent(prepared.name || 'arquivo'),
      'X-WAPI-File-Extension': prepared.extension || '',
      'X-WAPI-File-Size': String(prepared.size || blob.size || 0)
    },
    body: blob
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.message || 'Falha no upload da midia.');
  }

  const media = payload.media || {};
  return {
    ...prepared,
    dataUrl: '',
    blob: null,
    uploadId: media.uploadId,
    publicPath: media.publicPath,
    name: media.fileName || media.name || prepared.name,
    mimeType: media.mimeType || prepared.mimeType,
    size: media.size || prepared.size,
    extension: media.extension || prepared.extension,
    uploaded: true
  };
}

function dataUrlToBlob(dataUrl, fallbackType = 'application/octet-stream') {
  const [meta = '', payload = ''] = String(dataUrl || '').split(',');
  const mimeType = meta.match(/^data:([^;,]+)/)?.[1] || fallbackType || 'application/octet-stream';
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function ContactAvatar({ contact, fallback = '', large = false }) {
  const label = contact?.name || fallback || contact?.phone || '?';
  const avatarUrl = contact?.avatarUrl;
  return (
    <span className={large ? 'avatar large' : 'avatar'} aria-label={label} title={label}>
      {avatarUrl ? <img src={avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : initials(label)}
    </span>
  );
}

function ConversationTags({ conversation }) {
  const tags = conversation?.tags || [];
  if (!conversation?.sectorName && !tags.length) return null;
  return (
    <span className="conversation-tags">
      {conversation.sectorName && <span className="tag-pill sector-tag" data-color={conversation.sectorColor || 'green'}>{conversation.sectorName}</span>}
      {tags.slice(0, 3).map((tag) => <span key={tag.id} className="tag-pill" data-color={tag.color}>{tag.name}</span>)}
    </span>
  );
}

function getConversationStatusLabel(status) {
  if (status === 'active') return 'Ativo';
  if (status === 'finished') return 'Finalizado';
  return 'Em espera';
}

function buildReplyPreview(message) {
  if (!message) return '';
  const text = !isPlaceholderBody(message.body) ? message.body : '';
  const media = getMessageMedia(message);
  const fallback = media ? getMessageMediaLabel(message, media).replace(' recebido', '') : 'Mensagem';
  return String(text || fallback).replace(/\s+/g, ' ').trim().slice(0, 140);
}

function insertTextareaValue(textarea, value, setValue) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const next = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
  setValue(next);
  requestAnimationFrame(() => {
    textarea.selectionStart = start + value.length;
    textarea.selectionEnd = start + value.length;
  });
}

function pickRecorderMimeType() {
  const options = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4'];
  return options.find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
}

function mimeToExtension(mimeType) {
  const mime = String(mimeType || '').split(';')[0].trim().toLowerCase();
  if (mime === 'audio/webm') return 'webm';
  if (mime === 'audio/mp4') return 'm4a';
  if (mime === 'audio/mpeg') return 'mp3';
  if (mime === 'audio/wav' || mime === 'audio/x-wav') return 'wav';
  return 'ogg';
}
