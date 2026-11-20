import { ReactNode } from 'react';
import { Menu, Plus } from 'lucide-react';
import { AppSection } from '../types';

interface TopBarProps {
  activeSection: AppSection;
  onOpenMobileMenu: () => void;
  onOpenNewAccount: () => void;
  onOpenNewTransaction: () => void;
  notificationSlot?: ReactNode;
}

const SECTION_LABELS: Record<AppSection, string> = {
  dashboard: 'Visão Geral',
  programs: 'Programas e Contas',
  family: 'Familiares e CPFs',
  ledger: 'Extrato Unificado',
};

export function TopBar({
  activeSection,
  onOpenMobileMenu,
  onOpenNewAccount,
  onOpenNewTransaction,
  notificationSlot,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Abrir menu"
            className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-slate-400 hidden sm:inline whitespace-nowrap">Carteira</span>
            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
            <h1 className="font-display text-base sm:text-lg font-semibold text-slate-900 truncate">
              {SECTION_LABELS[activeSection]}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {notificationSlot}
          <button
            type="button"
            onClick={onOpenNewTransaction}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Lançamento</span>
          </button>
          <button
            type="button"
            onClick={onOpenNewAccount}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Conectar Programa</span>
          </button>
        </div>
      </div>
    </header>
  );
}
