import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button.jsx';

export function Pagination({ meta, onPage }) {
  const page = meta?.page || 1;
  const totalPages = meta?.totalPages || 1;
  const total = meta?.total || 0;
  return (
    <div className="pagination-bar">
      <span>{total} registros</span>
      <div>
        <Button compact disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /> Anterior</Button>
        <strong>{page} / {totalPages}</strong>
        <Button compact disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Proxima <ChevronRight size={16} /></Button>
      </div>
    </div>
  );
}
