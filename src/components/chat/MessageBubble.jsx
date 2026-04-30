import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import {
  AudioLines,
  CheckCheck,
  CornerUpLeft,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Pause,
  Play,
  X
} from 'lucide-react';
import { getMessageMedia } from '../../media.js';
import { formatBytes, formatDuration } from '../../media-config.js';
import { formatTime, isPlaceholderBody } from '../../shared/format.js';

export function MessageBubble({ message, onOpenMedia, onReply, canReply = false, showSenderName = false }) {
  if (message.direction === 'system') {
    return (
      <article className="system-event">
        <span>{message.body}</span>
        <small>{formatTime(message.createdAt)}</small>
      </article>
    );
  }

  const media = getMessageMedia(message);
  const imageSource = media && ['image', 'sticker'].includes(media.type) ? media.src : '';
  const hasText = Boolean(message.body && !isPlaceholderBody(message.body));
  const isSticker = media?.type === 'sticker' || isStickerMessage(message);
  const mediaLabel = getMessageMediaLabel(message, media);
  const imageAlt = hasText ? message.body : mediaLabel;
  const senderLabel = showSenderName && message.direction === 'inbound' && (message.senderName || message.senderPhone)
    ? message.senderName || message.senderPhone
    : '';

  return (
    <article className={`bubble ${message.direction} ${media ? 'with-media' : ''} ${isSticker ? 'is-sticker' : ''} ${media?.type ? `media-${media.type}` : ''}`}>
      {senderLabel && <span className="message-sender-label">{senderLabel}</span>}
      {message.replyPreview && (
        <div className="reply-context">
          <CornerUpLeft size={14} />
          <span>{message.replyPreview}</span>
        </div>
      )}
      {imageSource && (
        <button
          type="button"
          className="message-image-button"
          onClick={() => onOpenMedia?.({ src: imageSource, alt: imageAlt, caption: hasText ? message.body : '' })}
          title="Abrir imagem"
        >
          <img className="message-image" src={imageSource} alt={imageAlt} loading="lazy" />
        </button>
      )}
      {media?.type === 'audio' && (
        <div className="message-audio">
          <div className="message-media-heading">
            <AudioLines size={17} />
            <span>{media.fileName || 'Audio'}</span>
          </div>
          <WaveformAudioPlayer media={media} message={message} />
          <MediaMeta media={media} />
        </div>
      )}
      {media?.type === 'video' && (
        <div className="message-video">
          <video controls preload="metadata" src={media.src}>
            <a href={media.src}>Abrir video</a>
          </video>
          <MediaMeta media={media} />
        </div>
      )}
      {media?.type === 'document' && (
        <a className="message-document" href={media.src} target="_blank" rel="noreferrer" download={media.fileName || undefined}>
          <FileText size={22} />
          <span>
            <strong>{media.fileName || 'Documento'}</strong>
            <small>{[formatBytes(media.size), media.mimeType].filter(Boolean).join(' · ') || 'Abrir arquivo'}</small>
          </span>
          <Download size={17} />
        </a>
      )}
      {hasText && <p>{message.body}</p>}
      {!hasText && media && (
        <p className="media-caption">
          <MediaLabelIcon type={media.type} size={15} />
          {mediaLabel}
        </p>
      )}
      <footer>
        {canReply && (
          <button
            type="button"
            className="message-reply-action"
            onClick={() => onReply?.(message)}
            title="Responder esta mensagem"
          >
            <CornerUpLeft size={13} />
            Responder
          </button>
        )}
        <span>{formatTime(message.createdAt)}</span>
        {message.direction === 'outbound' && <CheckCheck size={14} />}
      </footer>
    </article>
  );
}

function WaveformAudioPlayer({ media, message }) {
  const waveRef = useRef(null);
  const playerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const mine = message.direction === 'outbound';

  useEffect(() => {
    if (!waveRef.current || !media.src) return undefined;
    const player = WaveSurfer.create({
      container: waveRef.current,
      waveColor: mine ? 'rgba(191, 219, 254, 0.45)' : 'rgba(100, 116, 139, 0.45)',
      progressColor: mine ? 'rgba(255, 255, 255, 0.95)' : 'rgba(37, 99, 235, 0.95)',
      cursorColor: mine ? 'rgba(255,255,255,0.9)' : 'rgba(59,130,246,0.9)',
      height: 36,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      dragToSeek: true,
      hideScrollbar: true,
      normalize: true
    });
    playerRef.current = player;
    player.load(media.src);
    player.on('play', () => setPlaying(true));
    player.on('pause', () => setPlaying(false));
    player.on('finish', () => setPlaying(false));
    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [media.src, mine]);

  return (
    <div className="message-audio-waveform">
      <button type="button" className="waveform-play" onClick={() => playerRef.current?.playPause()} title={playing ? 'Pausar audio' : 'Reproduzir audio'}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <div ref={waveRef} className="waveform-canvas" />
    </div>
  );
}

function MediaMeta({ media }) {
  const details = [formatDuration(media.duration), formatBytes(media.size)].filter(Boolean);
  if (!details.length) return null;
  return <small className="message-media-meta">{details.join(' · ')}</small>;
}

export function MediaLabelIcon({ type, size = 16 }) {
  if (type === 'audio') return <AudioLines size={size} />;
  if (type === 'video') return <Film size={size} />;
  if (type === 'document') return <FileText size={size} />;
  return <ImageIcon size={size} />;
}

export function getMessageMediaLabel(message, media = null) {
  if (media?.type === 'audio') return 'Audio recebido';
  if (media?.type === 'video') return 'Video recebido';
  if (media?.type === 'document') return media.fileName || 'Documento recebido';
  if (isStickerMessage(message) || media?.type === 'sticker') return 'Figurinha';
  return 'Imagem recebida';
}

function isStickerMessage(message) {
  return Boolean(
    message?.type === 'sticker'
      || message?.raw?.msgContent?.stickerMessage
      || message?.raw?.message?.stickerMessage
  );
}

export function MediaModal({ media, onClose }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="media-modal" role="dialog" aria-modal="true" aria-label="Imagem recebida" onClick={onClose}>
      <div className="media-modal-panel" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="media-modal-close" onClick={onClose} title="Fechar imagem">
          <X size={20} />
        </button>
        <img src={media.src} alt={media.alt || 'Imagem recebida'} />
        {media.caption && <p className="media-modal-caption">{media.caption}</p>}
      </div>
    </div>
  );
}
