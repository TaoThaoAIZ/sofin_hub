import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { formatRelative } from '../../../lib/datetime';
import { ActionDialog, useDialogSlot, useTableState } from '../components/Batch2Parts';
import { EmailPreview, VariableChips, renderTemplate, useInsertable } from '../components/Batch3Parts';
import { DataTable, MainCell, MutedCell, Segment, TextCell, type Column, type RowAction } from '../components/DataTable';
import { FieldLabel, InputField, OptionChips, useToast } from '../components/overlay';
import { PageHeader } from '../components/PageHeader';
import { AdminButton, Card, ErrorBlock, LoadingBlock, MONO_FONT, StatusBadge, errMessage } from '../components/ui';
import { useAdminAction, useAdminData } from '../queries.batch2';
import { TEMPLATE_STATUS, type EmailTemplate, type EmailTemplateDetail, type EmailTemplateStatus, type TemplatePreview } from '../types.batch3';

const langLabel = (t: TFunction): Record<string, string> => ({ en: t('emailTemplates.lang.en'), vi: t('emailTemplates.lang.vi') });
const statusOpts = () => (Object.keys(TEMPLATE_STATUS) as EmailTemplateStatus[]).map((k) => ({ value: k, label: TEMPLATE_STATUS[k].label }));

/** Dữ liệu mẫu cho xem trước tại chỗ; biến chưa biết hiện `[tên]`. */
const sampleDefault = (t: TFunction): Record<string, string> => ({
  name: t('emailTemplates.sample.name'),
  community: 'Growth Hackers VN',
  id: '10234',
  amount: '$120.00',
  link: 'https://sofinhub.com/…',
  reason: t('emailTemplates.sample.reason'),
});

const VAR_RE = /^[A-Za-z][\w.]*$/;

/* ============================== Trình soạn ============================== */

function TemplateEditor({ tkey, onBack }: { tkey: string | 'new'; onBack: () => void }) {
  const isNew = tkey === 'new';
  const q = useAdminData<EmailTemplateDetail>('system', `/system/email-templates/${tkey}`, undefined, !isNew);
  const act = useAdminAction();
  const toast = useToast();

  if (!isNew && q.isPending) return <LoadingBlock />;
  if (!isNew && q.isError) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;
  return <EditorForm key={q.data?.updatedAt ?? 'new'} initial={q.data} act={act} toast={toast} onBack={onBack} />;
}

function EditorForm({ initial, act, toast, onBack }: { initial?: EmailTemplateDetail; act: ReturnType<typeof useAdminAction>; toast: ReturnType<typeof useToast>; onBack: () => void }) {
  const { t } = useTranslation('admin-pages2');
  const LANG_LABEL = langLabel(t);
  const STATUS_OPTS = statusOpts();
  const isNew = !initial;
  const [key, setKey] = useState(initial?.key ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<string>(initial?.status ?? 'draft');
  const [vars, setVars] = useState<string[]>(initial?.variables ?? []);
  const [newVar, setNewVar] = useState('');
  const langs = initial?.languages?.length ? initial.languages : ['en', 'vi'];
  const [lang, setLang] = useState(langs[0] ?? 'en');
  const [subject, setSubject] = useState<Record<string, string>>({ en: '', vi: '', ...(initial?.subject ?? {}) });
  const [body, setBody] = useState<Record<string, string>>({ en: '', vi: '', ...(initial?.body ?? {}) });
  const [sample, setSample] = useState<Record<string, string>>(() => sampleDefault(t));
  const [pending, setPending] = useState(false);
  const [server, setServer] = useState<TemplatePreview | null>(null);

  const subj = useInsertable(subject[lang] ?? '', (v) => setSubject((s) => ({ ...s, [lang]: v })));
  const bod = useInsertable(body[lang] ?? '', (v) => setBody((s) => ({ ...s, [lang]: v })));
  const [target, setTarget] = useState<'subject' | 'body'>('body');

  const valid = (isNew ? /^[a-z0-9_]+$/.test(key) : true) && !!name.trim() && !!subject.en?.trim() && !!body.en?.trim();
  useEffect(() => setServer(null), [lang, subject, body]);

  const save = async () => {
    setPending(true);
    const payload = {
      name: name.trim(),
      description: desc.trim() || undefined,
      variables: vars,
      subject: { en: subject.en!.trim(), ...(subject.vi?.trim() ? { vi: subject.vi.trim() } : {}) },
      body: { en: body.en!, ...(body.vi?.trim() ? { vi: body.vi } : {}) },
      status,
    };
    try {
      if (isNew) await act.mutateAsync({ path: '/system/email-templates', body: { key, ...payload } });
      else await act.mutateAsync({ method: 'PATCH', path: `/system/email-templates/${initial.key}`, body: payload });
      toast.success(isNew ? t('emailTemplates.toast.created') : t('emailTemplates.toast.saved'));
      onBack();
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setPending(false);
    }
  };

  const serverPreview = async () => {
    if (!initial) return;
    try {
      const r = (await act.mutateAsync({ path: `/system/email-templates/${initial.key}/preview`, body: { language: lang, variables: sample } })) as TemplatePreview | undefined;
      setServer(r ?? null);
      const missing = [...new Set([...(r?.missing ?? []), ...(r?.missingVariables ?? [])])];
      if (missing.length) toast.error(t('emailTemplates.toast.missingVars', { vars: missing.join(', ') }));
    } catch (e) {
      toast.error(errMessage(e));
    }
  };

  const testSend = async () => {
    if (!initial) return;
    try {
      const r = (await act.mutateAsync({ path: `/system/email-templates/${initial.key}/test-send`, body: { language: lang, variables: sample } })) as { to: string } | undefined;
      toast.success(t('emailTemplates.toast.testSent', { to: r?.to ?? t('emailTemplates.yourEmail') }));
    } catch (e) {
      toast.error(errMessage(e));
    }
  };

  const addVar = () => {
    const v = newVar.trim();
    if (!VAR_RE.test(v)) return toast.error(t('emailTemplates.varNameInvalid'));
    if (!vars.includes(v)) setVars([...vars, v]);
    setNewVar('');
  };
  const insert = (text: string) => (target === 'subject' ? subj.insert(text) : bod.insert(text));
  const used = (text: string) => Array.from(text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g), (m) => m[1]!);
  const undeclared = Array.from(new Set([...used(subject[lang] ?? ''), ...used(body[lang] ?? '')])).filter((v) => !vars.includes(v));
  const inputCls = 'w-full rounded-xl border-[1.5px] border-[#e7e0da] px-[13px] text-[13.5px] font-medium outline-0 focus:border-brand';

  return (
    <>
      <PageHeader
        title={isNew ? t('emailTemplates.editor.createTitle') : t('emailTemplates.editor.editTitle', { name: initial.name })}
        subtitle={t('emailTemplates.editor.subtitle', { example: `{{${t('emailTemplates.editor.varName')}}}` })}
        trail={[{ label: t('emailTemplates.title') }, { label: isNew ? t('emailTemplates.createShort') : initial.name }]}
        actions={
          <>
            <AdminButton disabled={pending} onClick={onBack}>
              {t('emailTemplates.editor.back')}
            </AdminButton>
            <AdminButton kind="primary" icon="save" disabled={!valid || pending} onClick={() => void save()}>
              {pending ? t('emailTemplates.editor.saving') : t('emailTemplates.editor.save')}
            </AdminButton>
          </>
        }
      />
      <div className="grid items-start gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>
        <Card title={t('emailTemplates.editor.contentTitle')} sub={t('emailTemplates.editor.contentSub')}>
          {isNew && <InputField label={t('emailTemplates.editor.keyLabel')} value={key} onChange={(v) => setKey(v.toLowerCase())} placeholder={t('emailTemplates.editor.keyPlaceholder')} mono maxLength={60} />}
          <InputField label={t('emailTemplates.editor.nameLabel')} value={name} onChange={setName} maxLength={80} />
          <InputField label={t('emailTemplates.editor.descLabel')} value={desc} onChange={setDesc} maxLength={200} />
          <OptionChips label={t('emailTemplates.editor.statusLabel')} options={STATUS_OPTS} value={status} onChange={(v) => setStatus(v as string)} />
          <Segment label={t('emailTemplates.editor.languageLabel')} value={lang} onChange={setLang} options={['en', 'vi'].map((l) => ({ value: l, label: LANG_LABEL[l] ?? l }))} />
          <div className="flex flex-col gap-2">
            <FieldLabel>{t('emailTemplates.editor.subjectLabel', { lang: LANG_LABEL[lang] })}</FieldLabel>
            <input
              ref={subj.ref as React.RefObject<HTMLInputElement>}
              value={subject[lang] ?? ''}
              onChange={(e) => setSubject((s) => ({ ...s, [lang]: e.target.value }))}
              onFocus={() => setTarget('subject')}
              aria-label={t('emailTemplates.editor.subjectAria')}
              maxLength={200}
              className={`${inputCls} h-11`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel>{t('emailTemplates.editor.bodyLabel', { lang: LANG_LABEL[lang] })}</FieldLabel>
            <textarea
              ref={bod.ref as React.RefObject<HTMLTextAreaElement>}
              value={body[lang] ?? ''}
              onChange={(e) => setBody((s) => ({ ...s, [lang]: e.target.value }))}
              onFocus={() => setTarget('body')}
              aria-label={t('emailTemplates.editor.bodyAria')}
              className={`${inputCls} min-h-[220px] resize-y py-2.5 leading-relaxed`}
            />
          </div>
          <VariableChips variables={vars} onInsert={insert} />
          {undeclared.length > 0 && <div className="rounded-xl bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">{t('emailTemplates.editor.undeclared', { vars: undeclared.map((v) => `{{${v}}}`).join(', ') })}</div>}
          <div className="flex flex-col gap-2">
            <FieldLabel>{t('emailTemplates.editor.declareVars')}</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {vars.map((v) => (
                <span key={v} className="flex h-7 items-center gap-1.5 rounded-lg bg-[#f5f1ed] pr-1 pl-2.5 text-xs font-semibold" style={{ fontFamily: MONO_FONT }}>
                  {v}
                  <button type="button" aria-label={t('emailTemplates.editor.removeVar', { name: v })} className="grid size-5 place-items-center rounded-md border-0 bg-transparent text-stone-400 hover:text-[#dc2626]" onClick={() => setVars(vars.filter((x) => x !== v))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newVar} onChange={(e) => setNewVar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addVar()} placeholder={t('emailTemplates.editor.varPlaceholder')} aria-label={t('emailTemplates.editor.addVarAria')} className={`${inputCls} h-10 flex-1`} style={{ fontFamily: MONO_FONT }} />
              <AdminButton onClick={addVar} disabled={!newVar.trim()}>
                {t('emailTemplates.editor.addVar')}
              </AdminButton>
            </div>
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card title={t('emailTemplates.editor.previewTitle')} sub={t('emailTemplates.editor.previewSub')}>
            <EmailPreview subject={renderTemplate(subject[lang] ?? '', sample)} body={renderTemplate(body[lang] ?? '', sample)} />
            {server && (
              <div className="flex flex-col gap-2">
                <div className="text-[11.5px] font-bold tracking-[.06em] text-stone-400 uppercase">{t('emailTemplates.editor.serverRender')}</div>
                <EmailPreview subject={server.subject} body={server.text} />
              </div>
            )}
            {!isNew && (
              <div className="flex flex-wrap gap-2">
                <AdminButton icon="visibility" onClick={() => void serverPreview()}>
                  {t('emailTemplates.editor.serverPreview')}
                </AdminButton>
                <AdminButton icon="send" onClick={() => void testSend()}>
                  {t('emailTemplates.editor.testSend')}
                </AdminButton>
              </div>
            )}
            {!isNew && <div className="text-xs text-stone-400">{t('emailTemplates.editor.savedNote')}</div>}
          </Card>
          {vars.length > 0 && (
            <Card title={t('emailTemplates.editor.sampleTitle')} sub={t('emailTemplates.editor.sampleSub')}>
              <div className="grid grid-cols-2 gap-3">
                {vars.map((v) => (
                  <InputField key={v} label={`{{${v}}}`} value={sample[v] ?? ''} onChange={(x) => setSample((s) => ({ ...s, [v]: x }))} placeholder={`[${v}]`} />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/* ============================== Danh sách ============================== */

export function EmailTemplatesView() {
  const { t } = useTranslation('admin-pages2');
  const STATUS_OPTS = statusOpts();
  const ts = useTableState({ status: '' });
  const slot = useDialogSlot();
  const toast = useToast();
  const act = useAdminAction();
  const [editing, setEditing] = useState<string | null>(null);
  const q = useAdminData<EmailTemplate[]>('system', '/system/email-templates', { q: ts.q || undefined, status: ts.f.status || undefined });

  if (editing) return <TemplateEditor tkey={editing} onBack={() => setEditing(null)} />;

  const setStatus = (e: EmailTemplate, status: EmailTemplateStatus) =>
    act.mutateAsync({ method: 'PATCH', path: `/system/email-templates/${e.key}`, body: { status } }).then(
      () => toast.success(status === 'active' ? t('emailTemplates.toast.enabled', { name: e.name }) : t('emailTemplates.toast.disabled', { name: e.name })),
      (err) => toast.error(errMessage(err)),
    );

  const columns: Column<EmailTemplate>[] = [
    { key: 't', label: t('emailTemplates.col.template'), w: 1.8, render: (e) => <MainCell name={e.name} sub={e.key} icon="mail" /> },
    { key: 's', label: t('emailTemplates.col.subject'), w: 2, render: (e) => <TextCell>{e.subject.vi || e.subject.en || '—'}</TextCell> },
    { key: 'l', label: t('emailTemplates.col.language'), w: 0.9, render: (e) => <TextCell>{e.languages.map((l) => l.toUpperCase()).join(' · ')}</TextCell> },
    { key: 'u', label: t('emailTemplates.col.updated'), render: (e) => <MutedCell>{formatRelative(e.updatedAt)}</MutedCell> },
    { key: 'st', label: t('emailTemplates.col.status'), render: (e) => <StatusBadge tone={TEMPLATE_STATUS[e.status]?.tone ?? 'x'}>{TEMPLATE_STATUS[e.status]?.label ?? e.status}</StatusBadge> },
  ];

  const actions = (e: EmailTemplate): RowAction[] => {
    const list: RowAction[] = [
      { label: t('emailTemplates.action.edit'), icon: 'edit', onClick: () => setEditing(e.key) },
      e.status === 'active' ? { label: t('emailTemplates.action.disable'), icon: 'block', onClick: () => void setStatus(e, 'disabled') } : { label: t('emailTemplates.action.enable'), icon: 'check_circle', onClick: () => void setStatus(e, 'active') },
    ];
    if (!e.isSystem)
      list.push({
        label: t('emailTemplates.action.delete'),
        icon: 'delete',
        danger: true,
        onClick: () =>
          slot.show((close) => (
            <ActionDialog icon="delete" danger title={t('emailTemplates.delete.title', { name: e.name })} body={t('emailTemplates.delete.body')} cta={t('emailTemplates.delete.cta')} successMessage={t('emailTemplates.delete.success')} run={() => act.mutateAsync({ method: 'DELETE', path: `/system/email-templates/${e.key}` })} onClose={close} />
          )),
      });
    return list;
  };

  return (
    <>
      <PageHeader
        title={t('emailTemplates.title')}
        subtitle={t('emailTemplates.subtitle')}
        actions={
          <AdminButton kind="primary" icon="add" onClick={() => setEditing('new')}>
            {t('emailTemplates.createShort')}
          </AdminButton>
        }
      />
      <DataTable<EmailTemplate>
        columns={columns}
        rows={q.data ?? []}
        rowKey={(e) => e.key}
        onRow={(e) => setEditing(e.key)}
        actions={actions}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('emailTemplates.searchPlaceholder') }}
        filters={[{ key: 'status', label: t('emailTemplates.col.status'), value: ts.f.status, options: STATUS_OPTS, onChange: ts.setFilter('status') }]}
        onClearFilters={ts.clear}
        loading={q.isPending}
        error={q.isError ? q.error : null}
        onRetry={() => void q.refetch()}
        emptyText={t('emailTemplates.empty')}
      />
      {slot.el}
    </>
  );
}
