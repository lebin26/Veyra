/**
 * dailyJournalRepo.js
 * 负责每日复盘（Daily Journal: Pre-market, Post-market, Execution Rating）的数据持久化。
 */

import { withStore } from './database.js';

export const DailyJournalRepo = {
  async getJournalByDate(dateStr) {
    return withStore('daily_journals', 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.get(dateStr);
        req.onsuccess = () => resolve(req.result || null);
      });
    });
  },

  async getAllJournals() {
    return withStore('daily_journals', 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => b.date.localeCompare(a.date));
          resolve(list);
        };
      });
    });
  },

  async saveJournal(entryData) {
    if (!entryData.date) {
      throw new Error('Date is required for Daily Journal.');
    }

    return withStore('daily_journals', 'readwrite', (store) => {
      const now = new Date().toISOString();
      const record = {
        ...entryData,
        date: entryData.date,
        execution_rating: Number(entryData.execution_rating) || 5,
        created_at: entryData.created_at || now,
        updated_at: now
      };
      store.put(record);
      return record;
    });
  }
};
