// Saving files from the app (moved out of YourData for M69): the backup is also saved from the
// diary's reminder. Lazy — loaded with Settings or when the reminder's button is tapped.
import { makeBackup } from './backup';
import { exportAll, isoDate } from './db';

export function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Everything as a JSON backup file, named by today's date. */
export async function saveBackup(): Promise<void> {
  download(`iron-log-${isoDate(new Date())}.json`, JSON.stringify(makeBackup(await exportAll())), 'application/json');
}
