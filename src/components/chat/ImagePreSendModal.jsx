import React, { useEffect, useMemo, useState } from 'react';
import { Crop, ImageIcon, Loader2, Scissors, X } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';
import { formatBytes } from '../../media-config.js';
import {
  buildEditedImageFile,
  describeOutputDimensions,
  IMAGE_CROP_PRESETS,
  IMAGE_MAX_SIDE_PRESETS,
  loadImageDescriptor
} from './image-editing.js';

export function ImagePreSendModal({ file, sourceLabel = 'selecionada', onCancel, onConfirm }) {
  const [cropPreset, setCropPreset] = useState('original');
  const [maxSide, setMaxSide] = useState('original');
  const [descriptor, setDescriptor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    let previewUrl = '';
    setLoading(true);
    setDescriptor(null);
    loadImageDescriptor(file)
      .then((next) => {
        previewUrl = next.previewUrl;
        if (!active) {
          URL.revokeObjectURL(next.previewUrl);
          return;
        }
        setDescriptor(next);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [file]);

  const output = useMemo(() => {
    if (!descriptor) return null;
    return describeOutputDimensions(descriptor.width, descriptor.height, cropPreset, maxSide);
  }, [cropPreset, descriptor, maxSide]);

  async function confirm() {
    setSubmitting(true);
    try {
      const editedFile = await buildEditedImageFile(file, { cropPreset, maxSide });
      await onConfirm?.(editedFile, { cropPreset, maxSide });
    } finally {
      setSubmitting(false);
    }
  }

  const cropPreviewClassName = `image-pre-send-frame${cropPreset === 'original' ? '' : ` crop-${cropPreset}`}`;

  return (
    <Modal
      title="Preparo da imagem"
      description="Ajuste o recorte central e o tamanho final antes de anexar no atendimento."
      onClose={submitting ? undefined : onCancel}
      footer={(
        <>
          <Button type="button" onClick={onCancel} disabled={submitting}>
            <X size={16} />
            Cancelar
          </Button>
          <Button type="button" variant="primary" onClick={confirm} disabled={loading || !descriptor || submitting}>
            {submitting ? <Loader2 className="spin" size={16} /> : <Scissors size={16} />}
            Anexar imagem
          </Button>
        </>
      )}
    >
      <div className="image-pre-send-layout">
        <div className="image-pre-send-stage">
          {loading || !descriptor ? (
            <div className="image-pre-send-loading">
              <Loader2 className="spin" size={20} />
              <span>Carregando imagem</span>
            </div>
          ) : (
            <div className={cropPreviewClassName}>
              <img src={descriptor.previewUrl} alt="Pre-visualizacao da imagem" />
              {cropPreset !== 'original' && <div className="image-pre-send-overlay"><Crop size={15} />Recorte central aplicado</div>}
            </div>
          )}
        </div>

        <div className="image-pre-send-sidebar">
          <div className="image-pre-send-group">
            <span className="image-pre-send-label"><Crop size={15} />Recorte</span>
            <div className="image-pre-send-options">
              {IMAGE_CROP_PRESETS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cropPreset === option.value ? 'image-pre-send-chip active' : 'image-pre-send-chip'}
                  onClick={() => setCropPreset(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="image-pre-send-group">
            <span className="image-pre-send-label"><ImageIcon size={15} />Redimensionamento</span>
            <div className="image-pre-send-options">
              {IMAGE_MAX_SIDE_PRESETS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={maxSide === option.value ? 'image-pre-send-chip active' : 'image-pre-send-chip'}
                  onClick={() => setMaxSide(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="image-pre-send-summary">
            <span><strong>Origem</strong>{sourceLabel === 'colada' ? 'Colada do clipboard' : 'Selecionada do disco'}</span>
            <span><strong>Arquivo</strong>{file.name || 'imagem'}</span>
            <span><strong>Peso atual</strong>{formatBytes(file.size) || '—'}</span>
            <span><strong>Resolucao original</strong>{descriptor ? `${descriptor.width} × ${descriptor.height}` : '—'}</span>
            <span><strong>Saida prevista</strong>{output ? `${output.width} × ${output.height}` : '—'}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
