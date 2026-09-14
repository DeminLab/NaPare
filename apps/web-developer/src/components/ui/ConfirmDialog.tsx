'use client';
import Modal from './Modal';
import Button from './Button';
interface ConfirmDialogProps { open: boolean; title: string; description: string; confirmLabel?: string; loading?: boolean; onConfirm: () => void; onClose: () => void; }
export function ConfirmDialog({ open, title, description, confirmLabel = 'Удалить', loading = false, onConfirm, onClose }: ConfirmDialogProps) { return <Modal open={open} onClose={onClose} title={title}><p className="text-sm leading-6 text-slate-300">{description}</p><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={loading}>Отмена</Button><Button variant="danger" onClick={onConfirm} disabled={loading}>{loading ? 'Удаляем…' : confirmLabel}</Button></div></Modal>; }
