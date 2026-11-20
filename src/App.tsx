import { useState } from 'react';
import { AccountModal } from './components/AccountModal';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { ExpirationToastStack } from './components/ExpirationToastStack';
import { LedgerView } from './components/LedgerView';
import { NotificationCenter } from './components/NotificationCenter';
import { ProgramsView } from './components/ProgramsView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TransactionModal } from './components/TransactionModal';
import { TransfersFamilyView } from './components/TransfersFamilyView';
import { useExpirationNotifications } from './hooks/useExpirationNotifications';
import { usePortfolio } from './hooks/usePortfolio';
import { AppSection, LoyaltyAccount } from './types';

export default function App() {
  const {
    authMode,
    profile,
    holders,
    accounts,
    transactions,
    dataLoading,
    errorMsg,
    signInGoogle,
    enterDemoMode,
    logout,
    addHolder,
    removeHolder,
    addAccount,
    editAccount,
    removeAccount,
    addTransaction,
  } = usePortfolio();

  const [activeSection, setActiveSection] = useState<AppSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<LoyaltyAccount | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txDefaultAccountId, setTxDefaultAccountId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const notificationsEnabled =
    (authMode === 'firebase' || authMode === 'demo') && !dataLoading;

  const {
    notifications,
    unreadCount,
    liveToasts,
    thresholdDays,
    dismissedCount,
    setThresholdDays,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    dismissToast,
    resetDismissed,
  } = useExpirationNotifications(
    profile?.uid || 'guest',
    accounts,
    notificationsEnabled
  );

  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  if (authMode === 'loading') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <p className="text-sm font-medium text-slate-600">Carregando PontoPlus...</p>
      </div>
    );
  }

  if (authMode === 'unauthenticated') {
    return (
      <AuthScreen
        onSignInGoogle={signInGoogle}
        onEnterDemo={enterDemoMode}
        errorMsg={errorMsg}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        profile={profile}
        authMode={authMode}
        onLogout={logout}
        onSignInGoogle={signInGoogle}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenNewAccount={() => {
            setEditingAccount(null);
            setAccountModalOpen(true);
          }}
          onOpenNewTransaction={() => {
            setTxDefaultAccountId(accounts[0]?.id || null);
            setTxModalOpen(true);
          }}
          notificationSlot={
            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              thresholdDays={thresholdDays}
              dismissedCount={dismissedCount}
              onChangeThreshold={setThresholdDays}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onDismiss={dismissNotification}
              onResetDismissed={resetDismissed}
              onViewPrograms={() => setActiveSection('programs')}
              onEditAccount={(acc) => {
                setEditingAccount(acc);
                setAccountModalOpen(true);
              }}
            />
          }
        />

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-7xl w-full mx-auto">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          {dataLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((k) => (
                  <div
                    key={k}
                    className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse"
                  />
                ))}
              </div>
              <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
            </div>
          ) : (
            <>
              {activeSection === 'dashboard' && (
                <DashboardView
                  accounts={accounts}
                  holders={holders}
                  transactions={transactions}
                  onNavigate={setActiveSection}
                  onOpenNewAccount={() => {
                    setEditingAccount(null);
                    setAccountModalOpen(true);
                  }}
                  onEditAccount={(acc) => {
                    setEditingAccount(acc);
                    setAccountModalOpen(true);
                  }}
                />
              )}

              {activeSection === 'programs' && (
                <ProgramsView
                  accounts={accounts}
                  holders={holders}
                  onOpenNewAccount={() => {
                    setEditingAccount(null);
                    setAccountModalOpen(true);
                  }}
                  onEditAccount={(acc) => {
                    setEditingAccount(acc);
                    setAccountModalOpen(true);
                  }}
                  onDeleteAccount={async (id) => {
                    await removeAccount(id);
                    notify('Conta removida da carteira.');
                  }}
                  onOpenNewTx={(accId) => {
                    setTxDefaultAccountId(accId);
                    setTxModalOpen(true);
                  }}
                />
              )}

              {activeSection === 'family' && (
                <TransfersFamilyView
                  accounts={accounts}
                  holders={holders}
                  onAddHolder={addHolder}
                  onDeleteHolder={removeHolder}
                  onNotify={notify}
                />
              )}

              {activeSection === 'ledger' && (
                <LedgerView
                  transactions={transactions}
                  accounts={accounts}
                  onNotify={notify}
                />
              )}
            </>
          )}
        </main>
      </div>

      <AccountModal
        open={accountModalOpen}
        editingAccount={editingAccount}
        holders={holders}
        onClose={() => {
          setAccountModalOpen(false);
          setEditingAccount(null);
        }}
        onSaveNew={async (input) => {
          await addAccount(input);
          notify(`${input.programName} conectado à sua carteira.`);
        }}
        onSaveEdit={async (id, patch) => {
          await editAccount(id, patch);
          notify('Dados da conta atualizados.');
        }}
      />

      <TransactionModal
        open={txModalOpen}
        accounts={accounts}
        defaultAccountId={txDefaultAccountId}
        onClose={() => setTxModalOpen(false)}
        onSave={async (acc, tx, cpfs) => {
          await addTransaction(acc, tx, cpfs);
          notify('Lançamento registrado no extrato.');
        }}
      />

      <ExpirationToastStack
        toasts={liveToasts}
        hasActionToast={Boolean(toastMsg)}
        onDismissToast={(sig) => {
          markAsRead(sig);
          dismissToast(sig);
        }}
        onInspectAccount={(acc, sig) => {
          markAsRead(sig);
          dismissToast(sig);
          setEditingAccount(acc);
          setAccountModalOpen(true);
        }}
      />

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white text-xs font-medium px-4 py-3 rounded-lg shadow-lg border border-slate-800"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
