import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../shadcn/dialog.jsx';

export function Modal({ title, description, children, footer, onClose }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="app-modal-panel shadcn-dialog-panel !grid !max-w-[min(680px,100%)] !grid-rows-[auto_minmax(0,1fr)_auto] !gap-0 !p-0">
        <DialogHeader className="app-modal-header">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="app-modal-body">{children}</div>
        {footer && <DialogFooter className="app-modal-footer">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
