import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  CheckCircle2,
  CornerUpLeft,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Mic,
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
import { Button, Checkbox, Modal, Select } from '../ui/index.js';
import { ImagePreSendModal } from './ImagePreSendModal.jsx';
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
  onOpenContact,
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
  const [imagePreSendDraft, setImagePreSendDraft] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [transferTarget, setTransferTarget] = useState('');
  const [organizationOpen, setOrganizationOpen] = useState(false);
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
  const canDelete = currentUser?.role === 'admin';
  const canOpenContact = Boolean(selectedConversation?.contactId);
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
    setImagePreSendDraft(null);
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
    await processComposerFile(file, 'selecionada');
  }

  async function handleComposerPaste(event) {
    const files = extractClipboardFiles(event.clipboardData);
    if (!files.length) return;

    event.preventDefault();
    if (files.length > 1) {
      onError(new Error('Cole um arquivo por vez no chat.'));
      return;
    }

    await processComposerFile(files[0], 'colada');
  }

  async function processComposerFile(inputFile, sourceLabel = 'selecionada') {
    const file = normalizeComposerFile(inputFile);
    if (!file) return;

    try {
      const validation = validateMediaFile(file);
      if (!validation.valid) throw new Error(validation.message);
      if (validation.type === 'image') {
        setMediaDraft(null);
        setImagePreSendDraft({ file, sourceLabel });
        setMediaProgress(0);
        return;
      }
      await prepareAndAttachComposerFile(file, sourceLabel);
    } catch (error) {
      onError(error instanceof Error ? error : new Error(`Nao foi possivel preparar a midia ${sourceLabel}.`));
      setMediaProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function prepareAndAttachComposerFile(file, sourceLabel = 'selecionada') {
    setMediaDraft(null);
    setMediaProgress(4);
    const prepared = await prepareMediaFile(file, { onProgress: setMediaProgress });
    setMediaProgress(98);
    const uploaded = await uploadPreparedMedia(prepared);
    setMediaDraft({ ...uploaded, sourceLabel });
    setMediaProgress(0);
  }

  async function confirmImagePreSend(editedFile) {
    if (!editedFile) return;
    const sourceLabel = imagePreSendDraft?.sourceLabel || 'selecionada';
    setImagePreSendDraft(null);
    try {
      await prepareAndAttachComposerFile(editedFile, sourceLabel);
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Nao foi possivel preparar a imagem editada.'));
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
    setImagePreSendDraft(null);
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
          <button
            type="button"
            className="chat-title-copy chat-contact-trigger"
            onClick={() => onOpenContact?.(selectedConversation)}
            title={canOpenContact ? 'Editar contato' : 'Salvar contato'}
          >
            <strong>{selectedConversation?.name || selectedPhone}</strong>
            <ConversationTags conversation={selectedConversation} />
            <small>{selectedPhone} · {getConversationStatusLabel(chatStatus)}</small>
          </button>
        </div>
        <div className="chat-actions">
          <button type="button" className="secondary-action compact-action" onClick={() => setOrganizationOpen(true)}>
            <MoreHorizontal size={17} />
            Organizar
          </button>
          {chatStatus === 'waiting' && (
            <button type="button" className="secondary-action compact-action" onClick={() => onAttend(selectedSessionId)}>
              <UserCheck size={17} />
              Assumir
            </button>
          )}
          {chatStatus === 'finished' && (
            <button type="button" className="secondary-action compact-action" onClick={() => onReopen(selectedSessionId)}>
              <RotateCcw size={17} />
              Reabrir
            </button>
          )}
          {chatStatus === 'active' && (
            <button type="button" className="secondary-action compact-action" onClick={() => onFinish(selectedSessionId)}>
              <CheckCircle2 size={17} />
              Finalizar
            </button>
          )}
          {!selectedConversation?.contactId && (
            <button type="button" className="secondary-action compact-action" onClick={() => onSaveContact?.({
              phone: selectedPhone,
              name: selectedConversation?.name || '',
              avatarUrl: selectedConversation?.avatarUrl || '',
              isGroup: Boolean(selectedConversation?.isGroup),
              source: 'chat'
            })}>
              <UserPlus size={17} />
            </button>
          )}
          {canDelete && (
            <button type="button" className="secondary-action compact-action danger-action" onClick={() => onDelete(selectedSessionId)}>
              <Trash2 size={17} />
            </button>
          )}
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
                  {mediaDraft.sourceLabel === 'colada' ? ' · colada do clipboard' : ''}
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
            onPaste={handleComposerPaste}
            placeholder={canReply ? 'Digite uma mensagem' : 'Atenda o contato para responder'}
            disabled={!canReply || isRecording}
            rows={1}
          />
          <button className="send-button" disabled={sending || isRecording || isProcessingRecording || (!draft.trim() && !mediaDraft) || !canReply} title="Enviar resposta">
            {sending ? <Loader2 className="spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
      </form>

      {imagePreSendDraft && (
        <ImagePreSendModal
          file={imagePreSendDraft.file}
          sourceLabel={imagePreSendDraft.sourceLabel}
          onCancel={() => setImagePreSendDraft(null)}
          onConfirm={confirmImagePreSend}
        />
      )}
      {organizationOpen && (
        <SupportOrganizationModal
          conversation={selectedConversation}
          sessionId={selectedSessionId}
          currentTagIds={currentTagIds}
          supportTags={supportTags}
          sectors={sectors}
          transferUsers={transferUsers}
          transferTarget={transferTarget}
          setTransferTarget={setTransferTarget}
          onTagsChange={onTagsChange}
          onSectorChange={onSectorChange}
          onTransfer={onTransfer}
          onClose={() => setOrganizationOpen(false)}
        />
      )}
    </section>
  );
}

function SupportOrganizationModal({
  conversation,
  sessionId,
  currentTagIds,
  supportTags,
  sectors,
  transferUsers,
  transferTarget,
  setTransferTarget,
  onTagsChange,
  onSectorChange,
  onTransfer,
  onClose
}) {
  const activeTags = supportTags.filter((tag) => tag.active || currentTagIds.includes(tag.id));
  const activeSectors = sectors.filter((sector) => sector.active || sector.id === conversation?.sectorId);

  function addTag(tagId) {
    if (!tagId || currentTagIds.includes(tagId)) return;
    onTagsChange?.(sessionId, [...currentTagIds, tagId]);
  }

  function removeTag(tagId) {
    onTagsChange?.(sessionId, currentTagIds.filter((id) => id !== tagId));
  }

  return (
    <Modal
      title="Organizar atendimento"
      description="Tags, setor e transferencia do atendimento atual."
      onClose={onClose}
      footer={<><Button onClick={onClose}>Fechar</Button><Button variant="primary" disabled={!transferTarget} onClick={() => onTransfer?.(sessionId, transferTarget)}><MessageSquareShareIcon size={18} />Transferir</Button></>}
    >
      <div className="support-organization-modal">
        <section className="support-organization-section">
          <div className="support-organization-heading">
            <Tags size={17} />
            <strong>Tags</strong>
          </div>
          <div className="tag-chip-grid">
            {activeTags.map((tag) => (
              <Checkbox
                key={tag.id}
                label={tag.name}
                checked={currentTagIds.includes(tag.id)}
                onChange={(event) => {
                  if (event.target.checked) addTag(tag.id);
                  else removeTag(tag.id);
                }}
              />
            ))}
            {!activeTags.length && <p className="empty">Nenhuma tag ativa.</p>}
          </div>
        </section>

        <section className="support-organization-section">
          <div className="support-organization-heading">
            <MessageSquareShareIcon size={17} />
            <strong>Setor</strong>
          </div>
          <Select value={conversation?.sectorId || ''} onChange={(event) => onSectorChange?.(sessionId, event.target.value)}>
            <option value="">Sem setor</option>
            {activeSectors.map((sector) => (
              <option key={sector.id} value={sector.id}>{sector.name}</option>
            ))}
          </Select>
        </section>

        <section className="support-organization-section">
          <div className="support-organization-heading">
            <Users size={17} />
            <strong>Transferir</strong>
          </div>
          <Select value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)}>
            <option value="">Selecionar destino</option>
            {transferUsers.map((user) => (
              <option key={user.id} value={`user:${user.id}`}>{user.name}</option>
            ))}
            {sectors.filter((sector) => sector.active).map((sector) => (
              <option key={sector.id} value={`sector:${sector.id}`}>Setor: {sector.name}</option>
            ))}
          </Select>
        </section>
      </div>
    </Modal>
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

function extractClipboardFiles(clipboardData) {
  const items = Array.from(clipboardData?.items || []);
  const filesFromItems = items
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile?.())
    .filter((file) => file && file.size > 0);
  if (filesFromItems.length) return filesFromItems;
  return Array.from(clipboardData?.files || []).filter((file) => file && file.size > 0);
}

function normalizeComposerFile(file) {
  if (!file) return null;
  if (file.name) return file;
  const extension = inferFileExtension(file.type);
  const fileName = `arquivo-colado${extension ? `.${extension}` : ''}`;
  return new File([file], fileName, { type: file.type || 'application/octet-stream' });
}

function inferFileExtension(mimeType) {
  const mime = String(mimeType || '').split(';')[0].trim().toLowerCase();
  return {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/webm': 'webm',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'application/pdf': 'pdf',
    'text/plain': 'txt'
  }[mime] || '';
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
