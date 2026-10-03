/**
 * notebookRepo.js
 * Notebook (Trading Notes, Observations, Mistakes, Lessons, Psychology) Data Access Layer
 */
import { withStore } from './database.js';

export const NotebookRepo = {
  async getAllNotes(categoryFilter = null) {
    return withStore('notebook_entries', 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          let list = req.result || [];
          if (categoryFilter && categoryFilter !== 'all' && categoryFilter !== 'ALL') {
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
