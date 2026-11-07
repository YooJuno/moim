import { useState } from 'react';
import { LogOut, Pencil } from 'lucide-react';
import { useI18n } from '../lib/preferences';
import { Button, Modal } from './ui';

/** Confirm only a transition that would discard an actual edited draft. */
export function useDraftClose(dirty: boolean, busy: boolean, onClose: () => void) {
  const { t } = useI18n();
  const [pending, setPending] = useState<(() => void) | null>(null);
  const guard = (action: () => void) => {
    if (busy) return;
    if (dirty) setPending(() => action); else action();
  };
  return {
    close: () => guard(onClose), guard,
    confirmation: pending && <Modal title={t('저장하지 않고 닫을까요?')} onClose={() => setPending(null)} footer={<>
      <Button variant="secondary" icon={Pencil} onClick={() => setPending(null)}>{t('계속 편집')}</Button>
      <Button variant="danger" icon={LogOut} onClick={() => { setPending(null); pending(); }}>{t('나가기')}</Button>
    </>}/>,
  };
}
