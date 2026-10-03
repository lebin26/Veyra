/**
 * notebookRepo.js
 * Notebook (Trading Notes, Observations, Mistakes, Lessons, Psychology) Data Access Layer
 */
import { withStore } from './database.js';

const DEFAULT_NOTES = [
  {
    id: 'nb_01',
    title: 'Discipline Invariant: Stop Moving Stop Loss Further Away',
    category: 'mistakes',
    tags: ['Risk Management', 'Discipline', 'Psychology'],
    content: 'Observed a tendency to widen stop loss by 10 pips when trade gets close to invalidation. This violates the core 1R risk budget invariant. From now on: SL is placed once at entry and NEVER expanded.',
    is_pinned: 1,
    created_at: '2025-01-02T14:30:00.000Z',
    updated_at: '2025-01-02T14:30:00.000Z'
  },
  {
    id: 'nb_02',
    title: 'Gold (XAUUSD) Volatility During US Core CPI Releases',
    category: 'market',
    tags: ['Gold', 'Macro', 'Execution'],
    content: 'XAUUSD spreads widened to 45 points right before 13:30 UTC release. Avoid entering limit orders 5 minutes prior to high-tier US macroeconomic releases. Wait for the initial 15M candle to close first.',
    is_pinned: 0,
    created_at: '2025-01-03T18:15:00.000Z',
    updated_at: '2025-01-03T18:15:00.000Z'
  }
];

export const NotebookRepo = {
  async getAllNotes(categoryFilter = null) {
    return withStore('notebook_entries', 'readwrite', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          let list = req.result || [];
          if (list.length === 0) {
            DEFAULT_NOTES.forEach(n => store.put(n));
            list = [...DEFAULT_NOTES];
          }
          if (categoryFilter && categoryFilter !== 'all') {
            list = list.filter(n => n.category === categoryFilter);
          }
          // Pinned first, then newest first
          list.sort((a, b) => {
            if (b.is_pinned !== a.is_pinned) return (b.is_pinned || 0) - (a.is_pinned || 0);
            return (b.created_at || '').localeCompare(a.created_at || '');
          });
          resolve(list);
        };
      });
    });
  },

  async saveNote(data) {
    return withStore('notebook_entries', 'readwrite', (store) => {
      const now = new Date().toISOString();
      const id = data.id || `nb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const record = {
        ...data,
        id,
        category: data.category || 'general',
        tags: Array.isArray(data.tags) ? data.tags : (typeof data.tags === 'string' ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
        is_pinned: data.is_pinned ? 1 : 0,
        created_at: data.created_at || now,
        updated_at: now
      };
      store.put(record);
      return record;
    });
  },

  async deleteNote(id) {
    return withStore('notebook_entries', 'readwrite', (store) => {
      store.delete(id);
      return true;
    });
  }
};
