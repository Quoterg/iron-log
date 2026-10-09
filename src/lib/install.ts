// "Install app" prompt (Android Chrome). Captured at startup, shown in Settings → Dina data.
import { signal } from '@preact/signals';

export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

export const installPrompt = signal<InstallPromptEvent | null>(null);

export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt.value = e as InstallPromptEvent;
  });
}
