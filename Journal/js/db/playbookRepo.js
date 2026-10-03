/**
 * playbookRepo.js
 * Playbooks (Trading Strategy Definition & Rules) Data Access Layer
 */
import { withStore } from './database.js';

export const PlaybookRepo = {
  async getAllPlaybooks() {
    return withStore('playbooks', 'readonly', (store) => {
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

  async getPlaybookById(id) {
    return withStore('playbooks', 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
      });
    });
  },

  async savePlaybook(data) {
    return withStore('playbooks', 'readwrite', (store) => {
      const now = new Date().toISOString();
      const id = data.id || `pb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const record = {
        ...data,
        id,
        rules: Array.isArray(data.rules) ? data.rules : (typeof data.rules === 'string' ? data.rules.split('\n').filter(Boolean) : []),
        created_at: data.created_at || now,
        updated_at: now
      };
      store.put(record);
      return record;
    });
  },

  async deletePlaybook(id) {
    return withStore('playbooks', 'readwrite', (store) => {
      store.delete(id);
      return true;
    });
  }
};
