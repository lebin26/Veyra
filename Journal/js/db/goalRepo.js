/**
 * goalRepo.js
 * Progress Tracker (Performance Goals, Targets, Metrics & Status) Data Access Layer
 */
import { withStore } from './database.js';

export const GoalRepo = {
  async getAllGoals() {
    return withStore('progress_goals', 'readonly', (store) => {
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

  async saveGoal(data) {
    return withStore('progress_goals', 'readwrite', (store) => {
      const now = new Date().toISOString();
      const id = data.id || `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const record = {
        ...data,
        id,
        target_value: Number(data.target_value) || 0,
        current_value: Number(data.current_value) || 0,
        status: data.status || 'in_progress',
        created_at: data.created_at || now,
        updated_at: now
      };
      store.put(record);
      return record;
    });
  },

  async deleteGoal(id) {
    return withStore('progress_goals', 'readwrite', (store) => {
      store.delete(id);
      return true;
    });
  }
};
