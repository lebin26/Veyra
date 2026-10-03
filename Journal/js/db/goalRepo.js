/**
 * goalRepo.js
 * Progress Tracker (Performance Goals, Targets, Metrics & Status) Data Access Layer
 */
import { withStore } from './database.js';

const DEFAULT_GOALS = [
  {
    id: 'goal_01',
    title: 'Maintain Trade Win Rate Above 45%',
    metric_type: 'win_rate',
    target_value: 45.0,
    current_value: 48.2,
    unit: '%',
    deadline: '2025-06-30',
    status: 'achieved',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'goal_02',
    title: 'Maintain Profit Factor Above 1.80',
    metric_type: 'profit_factor',
    target_value: 1.80,
    current_value: 1.62,
    unit: '',
    deadline: '2025-12-31',
    status: 'in_progress',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'goal_03',
    title: 'Strict Drawdown Cap: Max Drawdown < 6.0%',
    metric_type: 'max_drawdown',
    target_value: 6.0,
    current_value: 3.4,
    unit: '%',
    deadline: '2025-12-31',
    status: 'achieved',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'goal_04',
    title: 'Log at least 20 Disciplined Trading Days This Month',
    metric_type: 'trading_days',
    target_value: 20,
    current_value: 16,
    unit: 'days',
    deadline: '2025-01-31',
    status: 'in_progress',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  }
];

export const GoalRepo = {
  async getAllGoals() {
    return withStore('progress_goals', 'readwrite', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          let list = req.result || [];
          if (list.length === 0) {
            DEFAULT_GOALS.forEach(g => store.put(g));
            list = [...DEFAULT_GOALS];
          }
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
