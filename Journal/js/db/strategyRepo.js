/**
 * strategyRepo.js
 * 负责 Strategies / Playbooks 及其 Rules 规则集的数据访问。
 */

import { withStore } from './database.js';

export const StrategyRepo = {
  async getAllStrategies() {
    return withStore('strategies', 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
          resolve(list);
        };
      });
    });
  },

  async getStrategyById(id) {
    return withStore('strategies', 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
      });
    });
  },

  async saveStrategy(strategyData) {
    return withStore('strategies', 'readwrite', (store) => {
      const now = new Date().toISOString();
      const id = strategyData.id || `strat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const record = {
        ...strategyData,
        id,
        rules: Array.isArray(strategyData.rules) ? strategyData.rules : [],
        created_at: strategyData.created_at || now,
        updated_at: now
      };
      store.put(record);
      return record;
    });
  },

  async deleteStrategy(id) {
    return withStore('strategies', 'readwrite', (store) => {
      store.delete(id);
      return true;
    });
  }
};
