import { useI18n } from "../lib/preferences";
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Camera, FileText, Heart, ImagePlus, Info, MessageCircle, Megaphone, MoreHorizontal, Paperclip, Pencil, Pin, Plus, Search, Send, Trash2, X } from 'lucide-react';
import { useApp } from '../lib/store';
import type { Category, Post } from '../lib/types';
import { categoryLabels, errorMessage, formatDate, memberName, relativeDate, uid } from '../lib/utils';
import { Avatar, Badge, Button, EmptyState, Field, IconButton, Modal, PageHeader, useToast } from '../components/ui';
import { attachmentSize, PostAttachments } from '../components/PostAttachments';
import { MAX_POST_FILES, validatePostFiles } from '../lib/attachments';
import './community.css';
const categoryIcons = { notice: Megaphone, chat: MessageCircle, info: Info, gallery: Camera };
const categories = Object.keys(categoryLabels) as Category[];
export function Board() {
    const { t } = useI18n();
    const app = useApp();
    const [params, setParams] = useSearchParams();
    const category = categories.includes(params.get('category') as Category) ? params.get('category') as Category : 'all';
    const [search, setSearch] = useState('');
    const [editor, setEditor] = useState<Post | 'new' | null>(null);
    useEffect(() => { if (!app.canParticipate)
        setEditor(null); }, [app.canParticipate]);
    const selectedPost = app.posts.find(post => post.id === params.get('post'));
    const filtered = app.posts.filter(post => (category === 'all' || post.category === category) && `${post.title} ${post.body} ${memberName(app.members, post.authorId)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
    function changeCategory(value: string) { setParams(value === 'all' ? {} : { category: value }); }
    function openPost(id: string) { const next = new URLSearchParams(params); next.set('post', id); setParams(next); }
    function closePost() { const next = new URLSearchParams(params); next.delete('post'); setParams(next); }
    return <div className="page board-page">
    <PageHeader title={t("게시판")} action={app.canParticipate ? <Button icon={Plus} onClick={() => setEditor('new')}>{t("글쓰기")}</Button> : undefined}/>
    <div className="board-toolbar">
      <div className="board-categories" aria-label={t("게시판 종류")}>
        <button className={`board-category ${category === 'all' ? 'active' : ''}`} onClick={() => changeCategory('all')}>{t("전체")}</button>
        {categories.map(key => { const Icon = categoryIcons[key]; return <button key={key} className={`board-category ${category === key ? 'active' : ''}`} onClick={() => changeCategory(key)}><Icon size={16}/>{t(categoryLabels[key])}</button>; })}
      </div>
      <label className="community-search"><Search size={18}/><input type="search" placeholder={t("게시글 검색")} aria-label={t("게시글 검색")} value={search} onChange={e => setSearch(e.target.value)}/></label>
    </div>
    {category === 'gallery' ? <div className="board-gallery">
      {filtered.map(post => <button className="board-gallery-card" key={post.id} onClick={() => openPost(post.id)}>
        <div className="board-gallery-photo">{post.images.length > 0 ? <img src={post.images[0]} alt={post.title} loading="lazy"/> : <Camera size={36}/>}{post.images.length > 1 && <span className="board-photo-count"><Camera size={13}/>{post.images.length}</span>}</div>
        <div className="board-gallery-info"><h3>{post.title}</h3><span>{memberName(app.members, post.authorId)}<i>·</i>{relativeDate(post.createdAt)}</span></div>
      </button>)}
    </div> : <div className="card board-list">
      <div className="board-list-head"><span>{t("이야기 {0}", {"0":filtered.length})}</span><span>{t("최신순")}</span></div>
      {filtered.map(post => {
                const author = app.members.find(member => member.id === post.authorId);
                const Icon = categoryIcons[post.category];
                return <button className="board-post-row" key={post.id} onClick={() => openPost(post.id)}>
        <div className={`board-post-icon ${post.category}`}><Icon size={21}/></div>
        <div className="board-post-content"><div className="board-post-top"><span>{t(categoryLabels[post.category])}</span>{post.pinned && <Badge tone="blue"><Pin size={11}/>{t("고정")}</Badge>}</div><h3>{post.title}</h3><p>{post.body}</p><div className="board-post-meta"><Avatar member={author} name={memberName(app.members, post.authorId)} size={20}/><span>{memberName(app.members, post.authorId)}</span><span>·</span><span>{relativeDate(post.createdAt)}</span></div></div>
        {post.images.length > 0 && <img className="board-row-thumb" src={post.images[0]} alt="" loading="lazy"/>}
        <div className="board-post-counts"><span><Heart size={15}/>{post.likedBy.length}</span><span><MessageCircle size={15}/>{app.comments.filter(comment => comment.postId === post.id).length}</span>{!!post.attachments?.length && <span aria-label={t('첨부 파일 {0}개', { '0': post.attachments.length })}><Paperclip size={15}/>{post.attachments.length}</span>}</div><ArrowRight className="board-row-arrow" size={17}/>
      </button>;
            })}
    </div>}
    {filtered.length === 0 && <EmptyState icon={category === 'gallery' ? Camera : MessageCircle} title={search ? t("검색 결과가 없어요") : t("게시글이 없어요")} description={search ? t("다른 검색어로 찾아보세요.") : undefined} action={!search && app.canParticipate ? <Button icon={Plus} onClick={() => setEditor('new')}>{t("글쓰기")}</Button> : undefined}/>}
    {selectedPost && !editor && <PostDetail post={selectedPost} onClose={closePost} onEdit={() => setEditor(selectedPost)}/>}
    {app.canParticipate && editor && <PostEditor post={editor === 'new' ? undefined : editor} initialCategory={category === 'all' ? 'chat' : category} onClose={() => setEditor(null)} onSaved={id => { setEditor(null); openPost(id); }}/>}
  </div>;
}
function PostEditor({ post, initialCategory, onClose, onSaved }: {
    post?: Post;
    initialCategory: Category;
    onClose: () => void;
    onSaved: (id: string) => void;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [category, setCategory] = useState<Category>(post?.category ?? (initialCategory === 'notice' && !app.isAdmin ? 'chat' : initialCategory));
    const [title, setTitle] = useState(post?.title ?? '');
    const [body, setBody] = useState(post?.body ?? '');
    const [images, setImages] = useState(post?.images ?? []);
    const [attachments, setAttachments] = useState(post?.attachments ?? []);
    const [newFiles, setNewFiles] = useState<{ id: string; file: File }[]>([]);
    const [pinned, setPinned] = useState(post?.pinned ?? false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    function selectFiles(files: FileList | null) {
        if (!files?.length || saving) return;
        const selected = Array.from(files);
        try {
            validatePostFiles(selected, attachments.length + newFiles.length);
            setNewFiles(current => [...current, ...selected.map(file => ({ id: uid(), file }))]);
        } catch (error) { toast(errorMessage(error), 'error'); }
        finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
    }
    async function upload(files: FileList | null) {
        if (!files || !files.length)
            return;
        const selected = Array.from(files);
        if (selected.length + images.length > 6) {
            toast('사진은 최대 6장까지 올릴 수 있어요.', 'error');
            return;
        }
        if (selected.some(file => !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type))) {
            toast('JPG, PNG, WEBP, GIF 사진을 선택해 주세요.', 'error');
            return;
        }
        if (selected.some(file => file.size > 5 * 1024 * 1024)) {
            toast('사진 한 장은 5MB 이하여야 해요.', 'error');
            return;
        }
        setUploading(true);
        try {
            const uploaded = await app.uploadImages(selected);
            setImages(current => [...current, ...uploaded]);
        }
        catch (error) {
            toast(errorMessage(error), 'error');
        }
        finally {
            setUploading(false);
            if (inputRef.current)
                inputRef.current.value = '';
        }
    }
    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (!app.user || !app.canParticipate)
            return;
        if (!title.trim() || !body.trim()) {
            toast('제목과 내용을 입력해 주세요.', 'error');
            return;
        }
        if (category === 'gallery' && images.length === 0) {
            toast('사진첩에는 사진을 한 장 이상 올려주세요.', 'error');
            return;
        }
        setSaving(true);
        const now = new Date().toISOString();
        const id = post?.id ?? uid();
        try {
            await app.savePost({ id, category, title: title.trim(), body: body.trim(), images, attachments, pinned: app.isAdmin ? pinned : post?.pinned ?? false, authorId: post?.authorId ?? app.user.id, createdAt: post?.createdAt ?? now, updatedAt: post?.updatedAt ?? now, likedBy: post?.likedBy ?? [] }, newFiles.map(item => item.file));
            toast(post ? '게시글을 수정했어요.' : '게시글을 올렸어요.');
            onSaved(id);
        }
        catch (error) {
            toast(errorMessage(error), 'error');
        }
        finally {
            setSaving(false);
        }
    }
    return <Modal title={post ? t("게시글 수정") : t("새 이야기")} onClose={() => { if (!saving && !uploading) onClose(); }} wide footer={<><Button variant="secondary" onClick={onClose} disabled={saving || uploading}>{t("취소")}</Button><Button form="post-form" type="submit" loading={saving} disabled={uploading}>{post ? t("수정 완료") : t("올리기")}</Button></>}>
    <form id="post-form" className="stack board-editor" onSubmit={save}>
      <Field label={t("게시판")}><select value={category} onChange={e => setCategory(e.target.value as Category)}>{categories.filter(key => key !== 'notice' || app.isAdmin || post?.category === 'notice').map(key => <option value={key} key={key}>{t(categoryLabels[key])}</option>)}</select></Field>
      <Field label={t("제목")} required><input value={title} onChange={e => setTitle(e.target.value)} placeholder={t("제목을 입력해 주세요")} maxLength={100} required/></Field>
      <Field label={t("내용")} required><textarea value={body} onChange={e => setBody(e.target.value)} placeholder={t("나누고 싶은 이야기를 적어주세요")} rows={7} maxLength={10000} required/></Field>
      <div className="board-upload-head"><span>{t("사진")}<span className="muted">{images.length}/6</span></span><Button variant="secondary" size="sm" icon={ImagePlus} loading={uploading} onClick={() => inputRef.current?.click()} disabled={images.length >= 6 || saving}>{t("사진 추가")}</Button><input ref={inputRef} type="file" aria-label={t('사진 첨부')} accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden disabled={saving || uploading} onChange={e => void upload(e.target.files)}/></div>
      {images.length > 0 && <div className="board-editor-images">{images.map((image, i) => <div key={`${image}-${i}`}><img src={image} alt={t("첨부 사진 {0}", { "0": i + 1 })}/><IconButton label={t("사진 {0} 삭제", { "0": i + 1 })} icon={X} onClick={() => setImages(current => current.filter((_, index) => index !== i))}/></div>)}</div>}
      <div className="board-file-upload"><div className="board-file-upload-head"><span>{t('파일')}<small>{attachments.length + newFiles.length}/{MAX_POST_FILES}</small></span><Button variant="secondary" size="sm" icon={Paperclip} onClick={() => fileInputRef.current?.click()} disabled={saving || attachments.length + newFiles.length >= MAX_POST_FILES}>{t('파일 추가')}</Button><input ref={fileInputRef} type="file" aria-label={t('파일 첨부')} multiple hidden disabled={saving} onChange={event => selectFiles(event.target.files)}/></div><p className="board-file-limit">{t('파일당 5MB · 최대 3개')}</p>
      {(attachments.length > 0 || newFiles.length > 0) && <div className="board-file-drafts">{[...attachments.map(file => ({ id: file.id, name: file.name, size: file.size, stored: true })), ...newFiles.map(item => ({ id: item.id, name: item.file.name, size: item.file.size, stored: false }))].map(file => <div key={file.id} className="board-file-draft"><span className="board-file-icon"><FileText size={20}/></span><span className="board-file-info"><strong title={file.name}>{file.name}</strong><small>{attachmentSize(file.size)}</small></span><IconButton icon={X} label={t('{0} 첨부 삭제', { '0': file.name })} disabled={saving} onClick={() => { if (file.stored) setAttachments(current => current.filter(item => item.id !== file.id)); else setNewFiles(current => current.filter(item => item.id !== file.id)); }}/></div>)}</div>}</div>
      {app.isAdmin && <label className="community-check"><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)}/><Pin size={16}/>{t("상단에 고정")}</label>}
    </form>
  </Modal>;
}
function PostDetail({ post, onClose, onEdit }: {
    post: Post;
    onClose: () => void;
    onEdit: () => void;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const [comment, setComment] = useState('');
    const [busy, setBusy] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const author = app.members.find(member => member.id === post.authorId);
    const canEdit = app.canParticipate && (app.isAdmin || app.user?.id === post.authorId);
    const comments = app.comments.filter(item => item.postId === post.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    useEffect(() => { setComment(''); setConfirmDelete(false); setMenuOpen(false); }, [post.id]);
    async function remove() { setBusy(true); try {
        await app.deletePost(post.id);
        toast('게시글을 삭제했어요.');
        onClose();
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setBusy(false);
    } }
    async function addComment(e: React.FormEvent) { e.preventDefault(); if (!comment.trim())
        return; setBusy(true); try {
        await app.addComment(post.id, comment.trim());
        setComment('');
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setBusy(false);
    } }
    async function like() { try {
        await app.toggleLike(post.id);
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    } }
    async function removeComment(id: string) { try {
        await app.deleteComment(id);
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    } }
    return <Modal title={t(categoryLabels[post.category])} onClose={onClose} wide>
    <article className="board-detail">
      <div className="board-detail-heading"><h2>{post.title}</h2>{canEdit && <div className="board-detail-menu"><IconButton label={t("게시글 관리")} icon={MoreHorizontal} onClick={() => setMenuOpen(!menuOpen)}/>{menuOpen && <div className="community-menu"><button onClick={onEdit}><Pencil size={15}/>{t("수정하기")}</button><button className="text-danger" onClick={() => { setConfirmDelete(true); setMenuOpen(false); }}><Trash2 size={15}/>{t("삭제하기")}</button></div>}</div>}</div>
      <div className="board-author"><Avatar member={author} name={memberName(app.members, post.authorId)} size={34}/><div><strong>{memberName(app.members, post.authorId)}</strong><span>{formatDate(post.createdAt, { year: 'numeric', month: 'long', day: 'numeric' })}{post.updatedAt !== post.createdAt && t(" · 수정됨")}</span></div>{post.pinned && <Badge tone="blue"><Pin size={12}/>{t("고정")}</Badge>}</div>
      {confirmDelete && <div className="community-confirm"><span>{t("게시글과 댓글을 삭제할까요?")}</span><Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>{t("취소")}</Button><Button variant="danger" size="sm" loading={busy} onClick={remove}>{t("삭제")}</Button></div>}
      <p className="board-detail-body">{post.body}</p>
      {post.images.length > 0 && <div className="board-detail-images">{post.images.map((image, i) => <a key={`${image}-${i}`} href={image} target="_blank" rel="noreferrer"><img src={image} alt={t("{0} 사진 {1}", { "0": post.title, "1": i + 1 })} loading="lazy"/></a>)}</div>}
      <PostAttachments post={post}/>
      <div className="board-detail-actions"><button className={`board-like ${post.likedBy.includes(app.user?.id ?? '') ? 'active' : ''}`} disabled={!app.canParticipate} onClick={like}><Heart size={18} fill={post.likedBy.includes(app.user?.id ?? '') ? 'currentColor' : 'none'}/>{t("좋아요 {0}", {"0":post.likedBy.length})}</button><span><MessageCircle size={17}/>{t("댓글 {0}", {"0":comments.length})}</span></div>
      <section className="board-comments" aria-label={t("댓글")}><h3>{t("댓글")}<span>{comments.length}</span></h3>
        {comments.map(item => <div className="board-comment" key={item.id}><Avatar member={app.members.find(member => member.id === item.authorId)} name={memberName(app.members, item.authorId)} size={32}/><div className="board-comment-content"><div><strong>{memberName(app.members, item.authorId)}</strong><span>{relativeDate(item.createdAt)}</span></div><p>{item.body}</p></div>{app.canParticipate && (app.isAdmin || app.user?.id === item.authorId) && <IconButton label={t("댓글 삭제")} icon={Trash2} onClick={() => void removeComment(item.id)}/>}</div>)}
        {comments.length === 0 && <p className="board-no-comments">{app.canParticipate ? t("첫 댓글을 남겨보세요.") : t("댓글이 없어요.")}</p>}
        {app.canParticipate && <form className="board-comment-form" onSubmit={addComment}><Avatar member={app.user ?? undefined} size={34}/><input aria-label={t("댓글 내용")} placeholder={t("댓글을 남겨주세요")} value={comment} onChange={e => setComment(e.target.value)} maxLength={1000}/><Button type="submit" icon={Send} loading={busy} disabled={!comment.trim()} size="sm">{t("등록")}</Button></form>}
      </section>
    </article>
  </Modal>;
}
