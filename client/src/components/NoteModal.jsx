import { useState } from 'react';
import toast from 'react-hot-toast';

import ConfigModal from './ConfigModal';
import Textarea from './Textarea';

// Shared by every action that records a reason: approval reject/return
// (required — brief A3, "logged with user, timestamp, and reason") and
// quotation confirm/withdraw (optional — recording a customer decision).
const NoteModal = ({ title, required = false, onClose, onSubmit }) => {
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (required && !note.trim()) return toast.error('A reason is required');

    setIsSaving(true);
    try {
      await onSubmit(note.trim() || undefined);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ConfigModal title={title} onClose={onClose} onSubmit={submit} isSaving={isSaving}>
      <Textarea
        label={required ? 'Reason (required)' : 'Note (optional)'}
        name="note"
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        autoFocus
      />
    </ConfigModal>
  );
};

export default NoteModal;
