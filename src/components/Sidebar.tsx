import {
  CreditCard,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Users,
  X,
} from 'lucide-react';
import { AppSection, UserProfile } from '../types';
import { AuthMode } from '../hooks/usePortfolio';

interface SidebarProps {
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
  profile: UserProfile | null;
  authMode: AuthMode;
  onLogout: () => void;
  onSignInGoogle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: AppSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'programs', label: 'Programas e Contas', icon: CreditCard },
  { id: 'family', label: 'Familiares e CPFs', icon: Users },
  { id: 'ledger', label: 'Extrato Unificado', icon: ListOrdered },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  profile,
  authMode,
  onLogout,
  onSignInGoogle,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const content = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
        <span className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
          PontoPlus
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Fechar menu"
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-teal-50 text-teal-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-teal-700' : 'text-slate-400'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-3">
        {authMode === 'demo' && (
          <button
            type="button"
            onClick={onSignInGoogle}
            className="w-full py-2 px-3 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap"
          >
            Salvar na Nuvem com Google
          </button>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {profile?.displayName || 'Usuário'}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {authMode === 'demo' ? 'Modo Demonstração' : profile?.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Sair"
            aria-label="Sair da conta"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{content}</div>
        </div>
      )}
    </>
  );
}
