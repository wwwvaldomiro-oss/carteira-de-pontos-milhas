import { useCallback, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { auth, googleProvider, testFirestoreConnection } from '../firebase';
import {
  createAccountDoc,
  createFlightAlertDoc,
  createHolderDoc,
  createSaleOrderBatch,
  deleteAccountDoc,
  deleteFlightAlertDoc,
  deleteHolderDoc,
  ensureUserInitialized,
  executeBonusTransferBatch,
  recordAccountTransaction,
  seedUserPortfolio,
  subscribePortfolio,
  toggleFlightAlertStatus,
  updateAccountDoc,
  updateSaleStatusDoc,
} from '../services/firestoreService';
import { buildInitialSeedPortfolio } from '../data/seedData';
import {
  FamilyHolder,
  FlightAlert,
  LoyaltyAccount,
  PointTransaction,
  SaleQuote,
  SaleStatus,
  UserProfile,
} from '../types';
import { getTodayISO } from '../utils/formatters';

export type AuthMode = 'loading' | 'unauthenticated' | 'firebase' | 'demo';

export function usePortfolio() {
  const [authMode, setAuthMode] = useState<AuthMode>('loading');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [holders, setHolders] = useState<FamilyHolder[]>([]);
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [flightAlerts, setFlightAlerts] = useState<FlightAlert[]>([]);
  const [sales, setSales] = useState<SaleQuote[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    testFirestoreConnection();
    let unsubFirestore: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      if (!user) {
        setFirebaseUser(null);
        setAuthMode((prev) => (prev === 'demo' ? 'demo' : 'unauthenticated'));
        return;
      }

      setFirebaseUser(user);
      setDataLoading(true);
      setErrorMsg(null);
      try {
        const userProfile = await ensureUserInitialized(user);
        setProfile(userProfile);
        setAuthMode('firebase');
        unsubFirestore = subscribePortfolio(user.uid, {
          onHolders: setHolders,
          onAccounts: setAccounts,
          onTransactions: setTransactions,
          onAlerts: setFlightAlerts,
          onSales: setSales,
          onError: (err) => {
            setErrorMsg(err.message);
          },
        });
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar carteira.');
      } finally {
        setDataLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  const signInGoogle = useCallback(async () => {
    setErrorMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na autenticação Google.';
      setErrorMsg(msg);
      throw err;
    }
  }, []);

  const enterDemoMode = useCallback(() => {
    const demoSeed = buildInitialSeedPortfolio('demo_user', 'Carlos Eduardo');
    setProfile({
      uid: 'demo_user',
      displayName: 'Carlos Eduardo',
      email: 'modo.demonstracao@pontoplus.app',
      defaultValuationCpm: 20,
    });
    setHolders(demoSeed.holders);
    setAccounts(demoSeed.accounts);
    setTransactions(demoSeed.transactions);
    setFlightAlerts(demoSeed.flightAlerts);
    setSales(demoSeed.sales);
    setAuthMode('demo');
    setErrorMsg(null);
  }, []);

  const logout = useCallback(async () => {
    if (authMode === 'firebase') {
      await signOut(auth);
    }
    setHolders([]);
    setAccounts([]);
    setTransactions([]);
    setFlightAlerts([]);
    setSales([]);
    setProfile(null);
    setAuthMode('unauthenticated');
  }, [authMode]);

  const addHolder = useCallback(
    async (input: Omit<FamilyHolder, 'id' | 'ownerId'>) => {
      if (authMode === 'firebase' && firebaseUser) {
        await createHolderDoc(firebaseUser.uid, input);
      } else if (authMode === 'demo') {
        const id = `holder_${Date.now()}`;
        setHolders((prev) => [...prev, { id, ownerId: 'demo_user', ...input }]);
      }
    },
    [authMode, firebaseUser]
  );

  const removeHolder = useCallback(
    async (holderId: string) => {
      if (authMode === 'firebase' && firebaseUser) {
        await deleteHolderDoc(firebaseUser.uid, holderId);
      } else if (authMode === 'demo') {
        setHolders((prev) => prev.filter((h) => h.id !== holderId));
      }
    },
    [authMode, firebaseUser]
  );

  const addAccount = useCallback(
    async (input: Omit<LoyaltyAccount, 'id' | 'ownerId'>) => {
      const today = getTodayISO();
      if (authMode === 'firebase' && firebaseUser) {
        await createAccountDoc(firebaseUser.uid, input, today);
      } else if (authMode === 'demo') {
        const id = `acc_${Date.now()}`;
        setAccounts((prev) => [...prev, { id, ownerId: 'demo_user', ...input }]);
        if (input.balance > 0) {
          setTransactions((prev) => [
            {
              id: `tx_${Date.now()}`,
              ownerId: 'demo_user',
              accountId: id,
              programName: input.programName,
              holderName: input.holderName,
              type: 'acumulo',
              points: input.balance,
              description: 'Saldo inicial importado ao conectar programa',
              date: today,
              cpm: input.avgCpm,
              totalBrl: Number(((input.balance / 1000) * input.avgCpm).toFixed(2)),
            },
            ...prev,
          ]);
        }
      }
    },
    [authMode, firebaseUser]
  );

  const editAccount = useCallback(
    async (
      accountId: string,
      patch: Pick<
        LoyaltyAccount,
        | 'accountNumber'
        | 'tier'
        | 'cpfLimit'
        | 'cpfsUsed'
        | 'expiringPoints'
        | 'expirationDate'
        | 'avgCpm'
        | 'balance'
        | 'holderId'
        | 'holderName'
      >
    ) => {
      if (authMode === 'firebase' && firebaseUser) {
        await updateAccountDoc(firebaseUser.uid, accountId, patch);
      } else if (authMode === 'demo') {
        setAccounts((prev) =>
          prev.map((a) => (a.id === accountId ? { ...a, ...patch } : a))
        );
      }
    },
    [authMode, firebaseUser]
  );

  const removeAccount = useCallback(
    async (accountId: string) => {
      if (authMode === 'firebase' && firebaseUser) {
        await deleteAccountDoc(firebaseUser.uid, accountId);
      } else if (authMode === 'demo') {
        setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      }
    },
    [authMode, firebaseUser]
  );

  const addTransaction = useCallback(
    async (
      account: LoyaltyAccount,
      txInput: Omit<PointTransaction, 'id' | 'ownerId' | 'accountId' | 'programName' | 'holderName'>,
      incrementCpfs: number = 0
    ) => {
      const nextBalance = Math.max(0, account.balance + Math.round(txInput.points));
      let nextCpm = account.avgCpm;
      if (txInput.points > 0 && txInput.cpm > 0) {
        const oldCost = (account.balance / 1000) * account.avgCpm;
        const addedCost = (txInput.points / 1000) * txInput.cpm;
        nextCpm = nextBalance > 0 ? (oldCost + addedCost) / (nextBalance / 1000) : account.avgCpm;
      }

      if (authMode === 'firebase' && firebaseUser) {
        await recordAccountTransaction(
          firebaseUser.uid,
          account,
          txInput,
          nextBalance,
          nextCpm,
          incrementCpfs
        );
      } else if (authMode === 'demo') {
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === account.id
              ? {
                  ...a,
                  balance: nextBalance,
                  expiringPoints:
                    txInput.points < 0
                      ? Math.max(0, a.expiringPoints + Math.round(txInput.points))
                      : a.expiringPoints,
                  avgCpm: Number(nextCpm.toFixed(2)),
                  cpfsUsed: Math.min(50, a.cpfsUsed + incrementCpfs),
                }
              : a
          )
        );
        setTransactions((prev) => [
          {
            id: `tx_${Date.now()}`,
            ownerId: 'demo_user',
            accountId: account.id,
            programName: account.programName,
            holderName: account.holderName,
            ...txInput,
          },
          ...prev,
        ]);
      }
    },
    [authMode, firebaseUser]
  );

  const executeTransfer = useCallback(
    async (params: {
      source: LoyaltyAccount;
      target: LoyaltyAccount;
      sourcePoints: number;
      bonusPercent: number;
    }) => {
      const { source, target, sourcePoints, bonusPercent } = params;
      const credited = Math.round(sourcePoints * (1 + bonusPercent / 100));
      const transferCostBrl = (sourcePoints / 1000) * source.avgCpm;
      const existingTargetCostBrl = (target.balance / 1000) * target.avgCpm;
      const newTotalMiles = target.balance + credited;
      const targetNewCpm =
        newTotalMiles > 0
          ? (existingTargetCostBrl + transferCostBrl) / (newTotalMiles / 1000)
          : target.avgCpm;
      const today = getTodayISO();

      if (authMode === 'firebase' && firebaseUser) {
        await executeBonusTransferBatch({
          uid: firebaseUser.uid,
          source,
          target,
          sourcePoints,
          bonusPercent,
          date: today,
          targetNewCpm,
        });
      } else if (authMode === 'demo') {
        setAccounts((prev) =>
          prev.map((a) => {
            if (a.id === source.id) {
              return {
                ...a,
                balance: Math.max(0, a.balance - sourcePoints),
                expiringPoints: Math.max(0, a.expiringPoints - sourcePoints),
              };
            }
            if (a.id === target.id) {
              return {
                ...a,
                balance: newTotalMiles,
                avgCpm: Number(targetNewCpm.toFixed(2)),
              };
            }
            return a;
          })
        );
        setTransactions((prev) => [
          {
            id: `tx_in_${Date.now()}`,
            ownerId: 'demo_user',
            accountId: target.id,
            programName: target.programName,
            holderName: target.holderName,
            type: 'transferencia_entrada',
            points: credited,
            description: `Crédito de ${source.programName} (+${bonusPercent}% bônus)`,
            date: today,
            cpm: Number(targetNewCpm.toFixed(2)),
            totalBrl: Number(transferCostBrl.toFixed(2)),
          },
          {
            id: `tx_out_${Date.now() + 1}`,
            ownerId: 'demo_user',
            accountId: source.id,
            programName: source.programName,
            holderName: source.holderName,
            type: 'transferencia_saida',
            points: -sourcePoints,
            description: `Transferência para ${target.programName} (+${bonusPercent}% bônus)`,
            date: today,
            cpm: source.avgCpm,
            totalBrl: Number(transferCostBrl.toFixed(2)),
          },
          ...prev,
        ]);
      }
    },
    [authMode, firebaseUser]
  );

  const addFlightAlert = useCallback(
    async (input: Omit<FlightAlert, 'id' | 'ownerId'>) => {
      if (authMode === 'firebase' && firebaseUser) {
        await createFlightAlertDoc(firebaseUser.uid, input);
      } else if (authMode === 'demo') {
        setFlightAlerts((prev) => [
          { id: `alert_${Date.now()}`, ownerId: 'demo_user', ...input },
          ...prev,
        ]);
      }
    },
    [authMode, firebaseUser]
  );

  const toggleAlert = useCallback(
    async (alert: FlightAlert) => {
      if (authMode === 'firebase' && firebaseUser) {
        await toggleFlightAlertStatus(firebaseUser.uid, alert);
      } else if (authMode === 'demo') {
        setFlightAlerts((prev) =>
          prev.map((a) =>
            a.id === alert.id
              ? { ...a, status: a.status === 'pausado' ? 'ativo' : 'pausado' }
              : a
          )
        );
      }
    },
    [authMode, firebaseUser]
  );

  const removeAlert = useCallback(
    async (alertId: string) => {
      if (authMode === 'firebase' && firebaseUser) {
        await deleteFlightAlertDoc(firebaseUser.uid, alertId);
      } else if (authMode === 'demo') {
        setFlightAlerts((prev) => prev.filter((a) => a.id !== alertId));
      }
    },
    [authMode, firebaseUser]
  );

  const createSale = useCallback(
    async (
      account: LoyaltyAccount,
      saleInput: Omit<SaleQuote, 'id' | 'ownerId' | 'accountId' | 'programName' | 'holderName' | 'status'>
    ) => {
      const today = getTodayISO();
      if (authMode === 'firebase' && firebaseUser) {
        await createSaleOrderBatch(firebaseUser.uid, account, saleInput, today);
      } else if (authMode === 'demo') {
        setSales((prev) => [
          {
            id: `sale_${Date.now()}`,
            ownerId: 'demo_user',
            accountId: account.id,
            programName: account.programName,
            holderName: account.holderName,
            status: 'em_analise',
            ...saleInput,
          },
          ...prev,
        ]);
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === account.id
              ? {
                  ...a,
                  balance: Math.max(0, a.balance - saleInput.milesAmount),
                  expiringPoints: Math.max(0, a.expiringPoints - saleInput.milesAmount),
                  cpfsUsed: Math.min(50, a.cpfsUsed + 1),
                }
              : a
          )
        );
        setTransactions((prev) => [
          {
            id: `txsale_${Date.now()}`,
            ownerId: 'demo_user',
            accountId: account.id,
            programName: account.programName,
            holderName: account.holderName,
            type: 'venda',
            points: -saleInput.milesAmount,
            description: `Venda para ${saleInput.partnerName}`,
            date: today,
            cpm: saleInput.ratePerThousand,
            totalBrl: saleInput.totalBrl,
          },
          ...prev,
        ]);
      }
    },
    [authMode, firebaseUser]
  );

  const updateSaleStatus = useCallback(
    async (saleId: string, nextStatus: SaleStatus) => {
      if (authMode === 'firebase' && firebaseUser) {
        await updateSaleStatusDoc(firebaseUser.uid, saleId, nextStatus);
      } else if (authMode === 'demo') {
        setSales((prev) =>
          prev.map((s) => (s.id === saleId ? { ...s, status: nextStatus } : s))
        );
      }
    },
    [authMode, firebaseUser]
  );

  const restoreSampleData = useCallback(async () => {
    if (authMode === 'firebase' && firebaseUser) {
      await seedUserPortfolio(
        firebaseUser.uid,
        profile?.displayName || firebaseUser.displayName || 'Titular Principal'
      );
    } else if (authMode === 'demo') {
      enterDemoMode();
    }
  }, [authMode, firebaseUser, profile, enterDemoMode]);

  return {
    authMode,
    profile,
    holders,
    accounts,
    transactions,
    flightAlerts,
    sales,
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
    executeTransfer,
    addFlightAlert,
    toggleAlert,
    removeAlert,
    createSale,
    updateSaleStatus,
    restoreSampleData,
  };
}
