import { useEffect, useRef, useState } from 'preact/hooks';
import { BackupError, parseBackup, toCsv } from '../lib/backup';
import { clearAll, exportAll, importAll, isoDate } from '../lib/db';
import { download, saveBackup } from '../lib/export-backup';
import { backupState, markBackedUp, markRestored, setBackupReminder } from '../state';
import { getFoods } from '../lib/foods';
import { lang, nutrientName, t } from '../lib/i18n';
import { installPrompt } from '../lib/install';
import { GOAL_LABEL, te } from '../lib/strings-energy';
import { IronNotesError, isIronNotes, parseIronNotes, planBody } from '../lib/ironnotes';
import { bodyLog, importBody, loadBody, settings } from '../state';
import { changeGoal } from './ProfileForm';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator as { standalone?: boolean }).standalone;

export function YourData() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const stamp = isoDate(new Date());

  const exportJson = async () => {
    await saveBackup();
    markBackedUp();
  };

  const exportCsv = async () => {
    const { entries, customFoods } = await exportAll();
    const foods = await getFoods(entries.map((e) => e.foodRef));
    const supps = new Set(customFoods.filter((f) => f.supplement).map((f) => f.ref));
    const csv = toCsv(entries, foods, lang.value, (m) => t(m as 'breakfast'), supps, {
      date: t('date'),
      meal: t('meal'),
      food: t('food'),
      amount: `${t('amount')} (g)`,
      supplements: t('supplements'),
      nutrient: nutrientName,
    });
    download(`iron-log-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
  };

  /** An Iron Notes backup (M53): its body measurements, and its diet phase as the goal; asked first. */
  const importIronNotes = async (raw: unknown) => {
    const data = parseIronNotes(raw, isoDate(new Date()));
    await loadBody();
    const plan = planBody(data, bodyLog.value ?? [], Date.now());
    const goal = data.goal && data.goal !== (settings.value.goal ?? 'maintain') ? data.goal : undefined;
    if (!plan.write.length && !goal) return setMessage(t('ironNotesNothing'));
    let done = false;
    const c = plan.counts;
    if (plan.write.length && confirm(t('ironNotesConfirm').replace('{w}', String(c.weightKg)).replace('{f}', String(c.bodyFatPct)).replace('{m}', String(c.waistCm)))) {
      await importBody(plan.write);
      done = true;
    }
    if (goal && confirm(t('ironNotesGoal').replace('{goal}', te(GOAL_LABEL[goal])))) {
      await changeGoal(goal);
      done = true;
    }
    if (done) setMessage(t('ironNotesDone'));
  };

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        // not JSON: parseBackup says so below
      }
      if (isIronNotes(raw)) return await importIronNotes(raw);
      const data = parseBackup(text, raw); // parsed once (review #95)
      const q = t('importConfirm').replace('{n}', String(data.entries.length)).replace('{f}', String(data.customFoods.length));
      if (!confirm(q)) return;
      await importAll(data);
      markRestored(); // a restore counts as a backup (review #104); this device's reminder state stays
      setMessage(t('importDone'));
      location.reload();
    } catch (err) {
      if (!(err instanceof BackupError || err instanceof IronNotesError)) console.error(err);
      setMessage(t('importFailed'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const deleteAll = async () => {
    if (!confirm(t('deleteAllConfirm'))) return;
    await clearAll();
    location.reload();
  };

  return (
    <section class="card">
      <h2>{t('yourData')}</h2>
      {persisted !== null && (
        <p class={persisted ? 'muted small' : 'small warn'}>{persisted ? t('storagePersistent') : t('storageNotPersistent')}</p>
      )}
      {installPrompt.value && (
        <button
          class="btn wide primary"
          onClick={async () => {
            await installPrompt.value?.prompt();
            installPrompt.value = null;
          }}
        >
          {t('installApp')}
        </button>
      )}
      {!installPrompt.value && isIos() && <p class="muted small">{t('installIosHint')}</p>}
      <button class="btn wide" onClick={exportJson}>
        {t('exportBackup')}
      </button>
      <button class="btn wide" onClick={exportCsv}>
        {t('exportCsv')}
      </button>
      {/* The diary's quiet reminder (M69): about once a month of logging, on this device. */}
      <label class="check backup-check">
        <input
          type="checkbox"
          checked={!backupState.value.backupReminderOff}
          onChange={(e) => void setBackupReminder((e.currentTarget as HTMLInputElement).checked)}
        />
        {t('backupReminderSetting')}
      </label>
      <label class="btn wide file">
        {t('importBackup')}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const f = (e.currentTarget as HTMLInputElement).files?.[0];
            if (f) void importFile(f);
          }}
        />
      </label>
      {message && (
        <p class="small" role="status">
          {message}
        </p>
      )}
      <button class="btn wide danger" onClick={deleteAll}>
        {t('deleteAll')}
      </button>
    </section>
  );
}
