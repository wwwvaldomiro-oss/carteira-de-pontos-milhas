import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  FamilyHolder,
  FlightAlert,
  LoyaltyAccount,
  PointTransaction,
  SaleQuote,
  SaleStatus,
  UserProfile,
} from '../types';
import { buildInitialSeedPortfolio } from '../data/seedData';
import { sanitizeId } from '../utils/formatters';

function createUniqueId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return sanitizeId(`${prefix}_${Date.now()}_${rand}`);
}

export async function ensureUserInitialized(user: User): Promise<UserProfile> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: String(data.uid || user.uid),
        displayName: String(data.displayName || user.displayName || 'Usuário'),
        email: String(data.email || user.email || ''),
        defaultValuationCpm: Number(data.defaultValuationCpm || 20),
      };
    }

    const displayName = (user.displayName || user.email?.split('@')[0] || 'Titular Principal').slice(0, 100);
    const email = (user.email || 'usuario@pontoplus.app').slice(0, 160);

    await setDoc(userRef, {
      uid: user.uid,
      displayName,
      email,
      defaultValuationCpm: 20,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Check if holders already exist before seeding
    const holdersQuery = query(
      collection(db, 'users', user.uid, 'holders'),
      where('ownerId', '==', user.uid)
    );
    const holdersSnap = await getDocs(holdersQuery);
    if (holdersSnap.empty) {
      await seedUserPortfolio(user.uid, displayName);
    }

    return {
      uid: user.uid,
      displayName,
      email,
      defaultValuationCpm: 20,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }
}

export async function seedUserPortfolio(uid: string, displayName: string): Promise<void> {
  const seed = buildInitialSeedPortfolio(uid, displayName);
  const batch = writeBatch(db);

  for (const h of seed.holders) {
    batch.set(doc(db, 'users', uid, 'holders', h.id), {
      ownerId: uid,
      name: h.name.slice(0, 80),
      relationship: h.relationship,
      cpfMasked: h.cpfMasked.slice(0, 20),
      notes: h.notes.slice(0, 200),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const a of seed.accounts) {
    batch.set(doc(db, 'users', uid, 'accounts', a.id), {
      ownerId: uid,
      holderId: a.holderId,
      holderName: a.holderName.slice(0, 80),
      programId: a.programId.slice(0, 40),
      programName: a.programName.slice(0, 60),
      category: a.category,
      accountNumber: a.accountNumber.slice(0, 40),
      tier: a.tier.slice(0, 40),
      balance: Math.max(0, Math.round(a.balance)),
      expiringPoints: Math.max(0, Math.round(a.expiringPoints)),
      expirationDate: a.expirationDate.slice(0, 20),
      avgCpm: Math.max(0, Number(a.avgCpm.toFixed(2))),
      cpfsUsed: Math.max(0, Math.round(a.cpfsUsed)),
      cpfLimit: Math.max(0, Math.round(a.cpfLimit)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const t of seed.transactions) {
    batch.set(doc(db, 'users', uid, 'transactions', t.id), {
      ownerId: uid,
      accountId: t.accountId,
      programName: t.programName.slice(0, 60),
      holderName: t.holderName.slice(0, 80),
      type: t.type,
      points: Math.round(t.points) || 1,
      description: t.description.slice(0, 140),
      date: t.date.slice(0, 20),
      cpm: Math.max(0, Number(t.cpm.toFixed(2))),
      totalBrl: Math.max(0, Number(t.totalBrl.toFixed(2))),
      createdAt: serverTimestamp(),
    });
  }

  for (const al of seed.flightAlerts) {
    batch.set(doc(db, 'users', uid, 'flightAlerts', al.id), {
      ownerId: uid,
      origin: al.origin.slice(0, 5),
      destination: al.destination.slice(0, 5),
      departureDate: al.departureDate.slice(0, 20),
      returnDate: al.returnDate.slice(0, 20),
      cabin: al.cabin,
      maxMiles: Math.max(1000, Math.round(al.maxMiles)),
      maxCashBrl: Math.max(50, Number(al.maxCashBrl.toFixed(2))),
      preferredProgram: al.preferredProgram.slice(0, 40),
      status: al.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const s of seed.sales) {
    batch.set(doc(db, 'users', uid, 'sales', s.id), {
      ownerId: uid,
      accountId: s.accountId,
      programName: s.programName.slice(0, 60),
      holderName: s.holderName.slice(0, 80),
      milesAmount: Math.max(1000, Math.round(s.milesAmount)),
      ratePerThousand: Math.max(1, Number(s.ratePerThousand.toFixed(2))),
      totalBrl: Math.max(1, Number(s.totalBrl.toFixed(2))),
      payoutSpeed: s.payoutSpeed,
      partnerName: s.partnerName.slice(0, 60),
      status: 'aprovada',
      payoutDate: s.payoutDate.slice(0, 20),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/seed`);
  }
}

export function subscribePortfolio(
  uid: string,
  callbacks: {
    onHolders: (items: FamilyHolder[]) => void;
    onAccounts: (items: LoyaltyAccount[]) => void;
    onTransactions: (items: PointTransaction[]) => void;
    onAlerts: (items: FlightAlert[]) => void;
    onSales: (items: SaleQuote[]) => void;
    onError: (err: Error) => void;
  }
): () => void {
  const holdersQ = query(collection(db, 'users', uid, 'holders'), where('ownerId', '==', uid));
  const accountsQ = query(collection(db, 'users', uid, 'accounts'), where('ownerId', '==', uid));
  const txQ = query(collection(db, 'users', uid, 'transactions'), where('ownerId', '==', uid));
  const alertsQ = query(collection(db, 'users', uid, 'flightAlerts'), where('ownerId', '==', uid));
  const salesQ = query(collection(db, 'users', uid, 'sales'), where('ownerId', '==', uid));

  const unsub1 = onSnapshot(
    holdersQ,
    (snap) => {
      callbacks.onHolders(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FamilyHolder, 'id'>) }))
      );
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, `users/${uid}/holders`);
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const unsub2 = onSnapshot(
    accountsQ,
    (snap) => {
      callbacks.onAccounts(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LoyaltyAccount, 'id'>) }))
      );
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, `users/${uid}/accounts`);
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const unsub3 = onSnapshot(
    txQ,
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PointTransaction, 'id'>),
      }));
      items.sort((a, b) => b.date.localeCompare(a.date));
      callbacks.onTransactions(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, `users/${uid}/transactions`);
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const unsub4 = onSnapshot(
    alertsQ,
    (snap) => {
      callbacks.onAlerts(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FlightAlert, 'id'>) }))
      );
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, `users/${uid}/flightAlerts`);
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const unsub5 = onSnapshot(
    salesQ,
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SaleQuote, 'id'>),
      }));
      items.sort((a, b) => b.payoutDate.localeCompare(a.payoutDate));
      callbacks.onSales(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, `users/${uid}/sales`);
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  return () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
    unsub5();
  };
}

export async function createHolderDoc(
  uid: string,
  input: Omit<FamilyHolder, 'id' | 'ownerId'>
): Promise<FamilyHolder> {
  const id = createUniqueId('holder');
  const path = `users/${uid}/holders/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'holders', id), {
      ownerId: uid,
      name: input.name.trim().slice(0, 80),
      relationship: input.relationship,
      cpfMasked: input.cpfMasked.replace(/[^0-9.*-]/g, '').slice(0, 20) || '***.000.000-**',
      notes: input.notes.trim().slice(0, 200),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id, ownerId: uid, ...input };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteHolderDoc(uid: string, holderId: string): Promise<void> {
  const path = `users/${uid}/holders/${holderId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'holders', holderId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function createAccountDoc(
  uid: string,
  input: Omit<LoyaltyAccount, 'id' | 'ownerId'>,
  initialDate: string
): Promise<LoyaltyAccount> {
  const id = createUniqueId('acc');
  const batch = writeBatch(db);
  const accRef = doc(db, 'users', uid, 'accounts', id);

  const sanitizedBalance = Math.max(0, Math.round(input.balance));
  const sanitizedCpm = Math.max(0, Number(input.avgCpm.toFixed(2)));

  batch.set(accRef, {
    ownerId: uid,
    holderId: input.holderId,
    holderName: input.holderName.trim().slice(0, 80),
    programId: input.programId.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40),
    programName: input.programName.trim().slice(0, 60),
    category: input.category,
    accountNumber: input.accountNumber.trim().slice(0, 40),
    tier: input.tier.trim().slice(0, 40),
    balance: sanitizedBalance,
    expiringPoints: Math.max(0, Math.round(input.expiringPoints)),
    expirationDate: input.expirationDate.slice(0, 20),
    avgCpm: sanitizedCpm,
    cpfsUsed: Math.max(0, Math.min(50, Math.round(input.cpfsUsed))),
    cpfLimit: Math.max(0, Math.min(50, Math.round(input.cpfLimit))),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (sanitizedBalance > 0) {
    const txId = createUniqueId('tx');
    batch.set(doc(db, 'users', uid, 'transactions', txId), {
      ownerId: uid,
      accountId: id,
      programName: input.programName.trim().slice(0, 60),
      holderName: input.holderName.trim().slice(0, 80),
      type: 'acumulo',
      points: sanitizedBalance,
      description: 'Saldo inicial importado ao conectar programa',
      date: initialDate.slice(0, 20),
      cpm: sanitizedCpm,
      totalBrl: Number(((sanitizedBalance / 1000) * sanitizedCpm).toFixed(2)),
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return { id, ownerId: uid, ...input };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `users/${uid}/accounts/${id}`);
  }
}

export async function updateAccountDoc(
  uid: string,
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
): Promise<void> {
  const path = `users/${uid}/accounts/${accountId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'accounts', accountId), {
      accountNumber: patch.accountNumber.trim().slice(0, 40),
      tier: patch.tier.trim().slice(0, 40),
      cpfLimit: Math.max(0, Math.min(50, Math.round(patch.cpfLimit))),
      cpfsUsed: Math.max(0, Math.min(50, Math.round(patch.cpfsUsed))),
      expiringPoints: Math.max(0, Math.round(patch.expiringPoints)),
      expirationDate: patch.expirationDate.slice(0, 20),
      avgCpm: Math.max(0, Number(patch.avgCpm.toFixed(2))),
      balance: Math.max(0, Math.round(patch.balance)),
      holderId: patch.holderId,
      holderName: patch.holderName.trim().slice(0, 80),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteAccountDoc(uid: string, accountId: string): Promise<void> {
  const path = `users/${uid}/accounts/${accountId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'accounts', accountId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function recordAccountTransaction(
  uid: string,
  account: LoyaltyAccount,
  txInput: Omit<PointTransaction, 'id' | 'ownerId' | 'accountId' | 'programName' | 'holderName'>,
  newBalance: number,
  newAvgCpm: number,
  incrementCpfs: number = 0
): Promise<void> {
  const txId = createUniqueId('tx');
  const batch = writeBatch(db);

  batch.set(doc(db, 'users', uid, 'transactions', txId), {
    ownerId: uid,
    accountId: account.id,
    programName: account.programName.slice(0, 60),
    holderName: account.holderName.slice(0, 80),
    type: txInput.type,
    points: Math.round(txInput.points),
    description: txInput.description.trim().slice(0, 140),
    date: txInput.date.slice(0, 20),
    cpm: Math.max(0, Number(txInput.cpm.toFixed(2))),
    totalBrl: Math.max(0, Number(txInput.totalBrl.toFixed(2))),
    createdAt: serverTimestamp(),
  });

  batch.update(doc(db, 'users', uid, 'accounts', account.id), {
    balance: Math.max(0, Math.round(newBalance)),
    expiringPoints:
      txInput.points < 0
        ? Math.max(0, account.expiringPoints + Math.round(txInput.points))
        : account.expiringPoints,
    expirationDate: account.expirationDate,
    avgCpm: Math.max(0, Number(newAvgCpm.toFixed(2))),
    cpfsUsed: Math.min(50, Math.max(0, account.cpfsUsed + incrementCpfs)),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/transactions/${txId}`);
  }
}

export async function executeBonusTransferBatch(params: {
  uid: string;
  source: LoyaltyAccount;
  target: LoyaltyAccount;
  sourcePoints: number;
  bonusPercent: number;
  date: string;
  targetNewCpm: number;
}): Promise<void> {
  const { uid, source, target, sourcePoints, bonusPercent, date, targetNewCpm } = params;
  const creditedMiles = Math.round(sourcePoints * (1 + bonusPercent / 100));
  const batch = writeBatch(db);

  const txOutId = createUniqueId('txout');
  const txInId = createUniqueId('txin');

  batch.update(doc(db, 'users', uid, 'accounts', source.id), {
    balance: Math.max(0, source.balance - sourcePoints),
    expiringPoints: Math.max(0, source.expiringPoints - sourcePoints),
    expirationDate: source.expirationDate,
    avgCpm: source.avgCpm,
    cpfsUsed: source.cpfsUsed,
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'users', uid, 'accounts', target.id), {
    balance: target.balance + creditedMiles,
    expiringPoints: target.expiringPoints,
    expirationDate: target.expirationDate,
    avgCpm: Math.max(0, Number(targetNewCpm.toFixed(2))),
    cpfsUsed: target.cpfsUsed,
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'users', uid, 'transactions', txOutId), {
    ownerId: uid,
    accountId: source.id,
    programName: source.programName.slice(0, 60),
    holderName: source.holderName.slice(0, 80),
    type: 'transferencia_saida',
    points: -Math.abs(sourcePoints),
    description: `Transferência para ${target.programName} (+${bonusPercent}% bônus)`.slice(0, 140),
    date,
    cpm: source.avgCpm,
    totalBrl: Number(((sourcePoints / 1000) * source.avgCpm).toFixed(2)),
    createdAt: serverTimestamp(),
  });

  batch.set(doc(db, 'users', uid, 'transactions', txInId), {
    ownerId: uid,
    accountId: target.id,
    programName: target.programName.slice(0, 60),
    holderName: target.holderName.slice(0, 80),
    type: 'transferencia_entrada',
    points: creditedMiles,
    description: `Crédito de ${source.programName} (+${bonusPercent}% bônus)`.slice(0, 140),
    date,
    cpm: Number(targetNewCpm.toFixed(2)),
    totalBrl: Number(((sourcePoints / 1000) * source.avgCpm).toFixed(2)),
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/transfers`);
  }
}

export async function createFlightAlertDoc(
  uid: string,
  input: Omit<FlightAlert, 'id' | 'ownerId'>
): Promise<void> {
  const id = createUniqueId('alert');
  try {
    await setDoc(doc(db, 'users', uid, 'flightAlerts', id), {
      ownerId: uid,
      origin: input.origin.slice(0, 5),
      destination: input.destination.slice(0, 5),
      departureDate: input.departureDate.slice(0, 20),
      returnDate: input.returnDate.slice(0, 20),
      cabin: input.cabin,
      maxMiles: Math.max(1000, Math.round(input.maxMiles)),
      maxCashBrl: Math.max(50, Number(input.maxCashBrl.toFixed(2))),
      preferredProgram: input.preferredProgram.slice(0, 40),
      status: input.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `users/${uid}/flightAlerts/${id}`);
  }
}

export async function toggleFlightAlertStatus(
  uid: string,
  alert: FlightAlert
): Promise<void> {
  const nextStatus = alert.status === 'pausado' ? 'ativo' : 'pausado';
  try {
    await updateDoc(doc(db, 'users', uid, 'flightAlerts', alert.id), {
      status: nextStatus,
      maxMiles: alert.maxMiles,
      maxCashBrl: alert.maxCashBrl,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/flightAlerts/${alert.id}`);
  }
}

export async function deleteFlightAlertDoc(uid: string, alertId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid, 'flightAlerts', alertId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}/flightAlerts/${alertId}`);
  }
}

export async function createSaleOrderBatch(
  uid: string,
  account: LoyaltyAccount,
  saleInput: Omit<SaleQuote, 'id' | 'ownerId' | 'accountId' | 'programName' | 'holderName' | 'status'>,
  todayDate: string
): Promise<void> {
  const saleId = createUniqueId('sale');
  const txId = createUniqueId('txsale');
  const batch = writeBatch(db);

  batch.set(doc(db, 'users', uid, 'sales', saleId), {
    ownerId: uid,
    accountId: account.id,
    programName: account.programName.slice(0, 60),
    holderName: account.holderName.slice(0, 80),
    milesAmount: Math.max(1000, Math.round(saleInput.milesAmount)),
    ratePerThousand: Math.max(1, Number(saleInput.ratePerThousand.toFixed(2))),
    totalBrl: Math.max(1, Number(saleInput.totalBrl.toFixed(2))),
    payoutSpeed: saleInput.payoutSpeed,
    partnerName: saleInput.partnerName.slice(0, 60),
    status: 'em_analise',
    payoutDate: saleInput.payoutDate.slice(0, 20),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'users', uid, 'accounts', account.id), {
    balance: Math.max(0, account.balance - saleInput.milesAmount),
    expiringPoints: Math.max(0, account.expiringPoints - saleInput.milesAmount),
    expirationDate: account.expirationDate,
    avgCpm: account.avgCpm,
    cpfsUsed: Math.min(50, account.cpfsUsed + 1),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'users', uid, 'transactions', txId), {
    ownerId: uid,
    accountId: account.id,
    programName: account.programName.slice(0, 60),
    holderName: account.holderName.slice(0, 80),
    type: 'venda',
    points: -Math.abs(saleInput.milesAmount),
    description: `Venda para ${saleInput.partnerName} (${saleInput.payoutSpeed === 'expresso_1d' ? 'Expresso' : 'Programado 30d'})`.slice(0, 140),
    date: todayDate,
    cpm: Number(saleInput.ratePerThousand.toFixed(2)),
    totalBrl: Number(saleInput.totalBrl.toFixed(2)),
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/sales/${saleId}`);
  }
}

export async function updateSaleStatusDoc(
  uid: string,
  saleId: string,
  nextStatus: SaleStatus
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid, 'sales', saleId), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/sales/${saleId}`);
  }
}
