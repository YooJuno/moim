import { useEffect, useRef, useState } from 'react';
import { Download, FileText, LoaderCircle } from 'lucide-react';
import type { Post } from '../lib/types';
import { useApp } from '../lib/store';
import { getLocale } from '../lib/i18n';
import { useI18n } from '../lib/preferences';
import { errorMessage } from '../lib/utils';
import { useToast } from './ui';
import './post-attachments.css';

export function attachmentSize(size: number) {
  if (size < 1024) return `${size} B`;
  const value = size < 1024 * 1024 ? size / 1024 : size / (1024 * 1024);
  return `${new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(value)} ${size < 1024 * 1024 ? 'KB' : 'MB'}`;
}

export function PostAttachments({ post }: { post: Post }) {
  const { t } = useI18n();
  const app = useApp();
  const toast = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  useEffect(() => { generation.current++; busy.current = false; setDownloading(null); return () => { generation.current++; }; }, [post.id]);

  async function download(id: string, name: string) {
    if (busy.current) return;
    busy.current = true;
    const current = generation.current;
    setDownloading(id);
    try {
      const content = await app.getPostAttachment(post.id, id);
      if (current !== generation.current) return;
      const url = URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) {
      if (current === generation.current) toast(errorMessage(error), 'error');
    } finally {
      if (current === generation.current) { setDownloading(null); busy.current = false; }
    }
  }

  if (!post.attachments?.length) return null;
  return <section className="board-attachments" aria-label={t('첨부 파일')}>
    <h3>{t('첨부 파일')}<span>{post.attachments.length}</span></h3>
    {post.attachments.map(file => <button type="button" key={file.id} className="board-attachment-download" aria-label={t('{0} 다운로드', { '0': file.name })} disabled={downloading !== null} onClick={() => void download(file.id, file.name)}>
      <span className="board-file-icon"><FileText size={20}/></span>
      <span className="board-file-info"><strong title={file.name}>{file.name}</strong><small>{attachmentSize(file.size)}</small></span>
      {downloading === file.id ? <LoaderCircle className="spin" size={17}/> : <Download size={17}/>}
    </button>)}
  </section>;
}
