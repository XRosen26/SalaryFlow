import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import {
  createTransaction,
  loadSnapshot,
  refundExpense,
  softDeleteTransaction,
  updateTransaction,
  toggleAccountHidden,
  updateSettings,
  type NewTransaction,
  type Snapshot,
  type UpdateTransactionInput,
} from './repository';

type FinanceContextValue = {
  snapshot: Snapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addTransaction: (input: NewTransaction) => Promise<string>;
  setAmountsVisible: (visible: boolean) => Promise<void>;
  setAccountHidden: (accountId: string) => Promise<void>;
  editTransaction: (input: UpdateTransactionInput) => Promise<void>;
  refundTransaction: (originalId: string, amountMinor: number, date: string, note?: string) => Promise<string>;
  deleteTransaction: (transactionId: string, reason?: string) => Promise<void>;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setSnapshot(await loadSnapshot(db));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '读取账本失败');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<FinanceContextValue>(() => ({
    snapshot,
    loading,
    error,
    refresh,
    addTransaction: async (input) => {
      const transactionId = await createTransaction(db, input);
      await refresh();
      return transactionId;
    },
    setAmountsVisible: async (visible) => {
      await updateSettings(db, { amountsVisible: visible });
      await refresh();
    },
    setAccountHidden: async (accountId) => {
      await toggleAccountHidden(db, accountId);
      await refresh();
    },
    editTransaction: async (input) => {
      await updateTransaction(db, input);
      await refresh();
    },
    refundTransaction: async (originalId, amountMinor, date, note) => {
      const transactionId = await refundExpense(db, originalId, amountMinor, date, note);
      await refresh();
      return transactionId;
    },
    deleteTransaction: async (transactionId, reason) => {
      await softDeleteTransaction(db, transactionId, reason);
      await refresh();
    },
  }), [db, error, loading, refresh, snapshot]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const value = useContext(FinanceContext);
  if (!value) throw new Error('useFinance 必须在 FinanceProvider 内使用');
  return value;
}
