import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { KeyRound, Keyboard, RotateCcw, Save } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useSidebar } from '../hooks/useSidebar';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  formatShortcutCode,
  KEYBOARD_SHORTCUT_LABELS,
  normalizeKeyboardShortcuts,
} from '../lib/keyboardShortcuts';
import type { KeyboardShortcutAction, KeyboardShortcuts } from '../lib/types';
import { cn } from '../lib/utils';
import { API_BASE } from '../lib/api';

const ACTIONS = Object.keys(DEFAULT_KEYBOARD_SHORTCUTS) as KeyboardShortcutAction[];
const RESERVED_CODES = new Set(['Tab', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);

export default function SettingsPage() {
  const { isCollapsed } = useSidebar();
  const { scout, sessionToken, updateScoutSettings, logout } = useAuth();
  const [shortcuts, setShortcuts] = useState<KeyboardShortcuts>(() => normalizeKeyboardShortcuts(scout?.keyboard_shortcuts));
  const [capturing, setCapturing] = useState<KeyboardShortcutAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => setShortcuts(normalizeKeyboardShortcuts(scout?.keyboard_shortcuts)), [scout?.keyboard_shortcuts]);

  const duplicateCodes = useMemo(() => {
    const counts = Object.values(shortcuts).reduce<Record<string, number>>((acc, code) => {
      acc[code] = (acc[code] ?? 0) + 1;
      return acc;
    }, {});
    return new Set(Object.entries(counts).filter(([, count]) => count > 1).map(([code]) => code));
  }, [shortcuts]);

  const capture = (action: KeyboardShortcutAction, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (RESERVED_CODES.has(event.code) || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      setMessage('Escolha uma tecla simples, sem Ctrl, Alt, Shift ou Command.');
      return;
    }
    setShortcuts(current => ({ ...current, [action]: event.code }));
    setCapturing(null);
    setMessage(null);
  };

  const save = async () => {
    if (duplicateCodes.size > 0) {
      setMessage('Cada ação precisa usar uma tecla diferente.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateScoutSettings({ keyboard_shortcuts: shortcuts });
      setMessage('Atalhos salvos para esta conta.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar os atalhos.');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scout || !sessionToken) return;
    if (newPassword.length < 8) return setPasswordMessage('Use pelo menos 8 caracteres.');
    if (newPassword !== confirmPassword) return setPasswordMessage('A confirmação não é igual à nova senha.');
    setSavingPassword(true);
    setPasswordMessage(null);
    try {
      const response = await fetch(`${API_BASE}/scouts.php?id=${encodeURIComponent(scout.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Scout-Session': sessionToken },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar a senha.');
      logout();
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : 'Não foi possível salvar a senha.');
    } finally { setSavingPassword(false); }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className={cn('flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 transition-all duration-300', isCollapsed ? 'lg:ml-20' : 'lg:ml-64')}>
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 flex items-start gap-3">
            <Keyboard className="mt-1 h-8 w-8 text-orange-500" />
            <div>
              <h1 className="text-3xl font-bold text-white">Configurações</h1>
              <p className="mt-1 text-slate-400">Atalhos pessoais da conta {scout?.username}.</p>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-white">Atalhos do scout</h2>
            <p className="mt-1 text-sm text-slate-400">Clique em um atalho e pressione a nova tecla.</p>
            <div className="mt-6 space-y-3">
              {ACTIONS.map(action => {
                const code = shortcuts[action];
                const conflict = duplicateCodes.has(code);
                return (
                  <div key={action} className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-900/50 p-3">
                    <div>
                      <p className="font-medium text-white">{KEYBOARD_SHORTCUT_LABELS[action]}</p>
                      {conflict && <p className="mt-0.5 text-xs text-red-400">Esta tecla já está em uso.</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCapturing(action); setMessage(null); }}
                      onKeyDown={event => capturing === action && capture(action, event)}
                      className={cn('min-w-28 rounded-lg border px-4 py-2 font-mono text-sm font-bold transition-colors', capturing === action ? 'border-orange-400 bg-orange-500/20 text-orange-200' : conflict ? 'border-red-500 bg-red-500/10 text-red-300' : 'border-slate-600 bg-slate-700 text-slate-200 hover:border-slate-500')}
                    >
                      {capturing === action ? 'Pressione…' : formatShortcutCode(code)}
                    </button>
                  </div>
                );
              })}
            </div>

            {message && <p className={cn('mt-4 text-sm', message.includes('salvos') ? 'text-green-400' : 'text-amber-300')}>{message}</p>}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setShortcuts({ ...DEFAULT_KEYBOARD_SHORTCUTS }); setCapturing(null); setMessage(null); }} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 font-semibold text-slate-300 hover:bg-slate-700">
                <RotateCcw className="h-4 w-4" /> Restaurar padrões
              </button>
              <button type="button" disabled={saving || duplicateCodes.size > 0} onClick={save} className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 font-bold text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50">
                <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar atalhos'}
              </button>
            </div>
          </section>

          {scout?.username.toLowerCase() === 'wanderson' && (
            <form onSubmit={savePassword} className="mt-6 rounded-2xl border border-orange-500/35 bg-slate-800/60 p-5 sm:p-6">
              <div className="flex items-start gap-3"><KeyRound className="mt-0.5 h-6 w-6 text-orange-400" /><div><h2 className="text-lg font-bold text-white">Senha do administrador</h2><p className="mt-1 text-sm text-slate-400">Protege o perfil {scout.username}. Na primeira configuração, deixe “senha atual” em branco.</p></div></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2 text-sm text-slate-300">Senha atual<input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white outline-none focus:border-orange-400" /></label>
                <label className="text-sm text-slate-300">Nova senha<input required type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white outline-none focus:border-orange-400" /></label>
                <label className="text-sm text-slate-300">Confirmar nova senha<input required type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white outline-none focus:border-orange-400" /></label>
              </div>
              {passwordMessage && <p className={cn('mt-3 text-sm', passwordMessage.includes('salva') ? 'text-emerald-400' : 'text-amber-300')}>{passwordMessage}</p>}
              <div className="mt-5 flex justify-end"><button disabled={savingPassword} className="rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-white hover:bg-orange-400 disabled:opacity-50">{savingPassword ? 'Salvando…' : 'Salvar senha'}</button></div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
