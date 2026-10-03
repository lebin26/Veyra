/**
 * playbookRepo.js
 * Playbooks (Trading Strategy Definition & Rules) Data Access Layer
 */
import { withStore } from './database.js';

const DEFAULT_PLAYBOOKS = [
  {
    id: 'pb_london_breakout',
    name: 'London Breakout',
    description: 'Capitalize on pre-market liquidity grabs and directional range expansion during the London Session open.',
    market: 'Forex (EURUSD, GBPUSD, GER40)',
    timeframe: '5M / 15M',
    direction: 'BOTH',
    risk_model: '1.0R (Max 1% account risk)',
    rules: [
      'Mark the Asian session high and low range between 00:00 - 07:00 UTC.',
      'Wait for initial 15M candle to fakeout one side of the Asian range.',
      'Enter on 5M market structure shift (MSS) back inside the range toward opposite liquidity.',
      'Stop loss placed 2 pips beyond the swing extreme.',
      'Take profit at 2R or the opposing Asian session liquidity pool.'
    ],
    status: 'active',
    is_shared: 1,
    created_at: '2025-01-01T08:00:00.000Z',
    updated_at: '2025-01-01T08:00:00.000Z'
  },
  {
    id: 'pb_liquidity_fvg',
    name: 'Liquidity Sweep & FVG',
    description: 'High-probability mean reversion after major session high/low sweep followed by displacement and Fair Value Gap retest.',
    market: 'Crypto & Gold (XAUUSD, BTCUSDT)',
    timeframe: '15M / 1H',
    direction: 'BOTH',
    risk_model: '1.5R (Trailing SL at 1R)',
    rules: [
      'Identify key daily or 4H liquidity level (Equal Highs / Equal Lows).',
      'Look for clear sweep on 15M with long wick rejection.',
      'Aggressive displacement candle creating an unmitigated FVG.',
      'Limit order on 50% equilibrium of the FVG.',
      'Stop loss strictly above the sweep high/low.'
    ],
    status: 'active',
    is_shared: 0,
    created_at: '2025-01-02T10:00:00.000Z',
    updated_at: '2025-01-02T10:00:00.000Z'
  }
];

export const PlaybookRepo = {
  async getAllPlaybooks() {
    return withStore('playbooks', 'readwrite', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          let list = req.result || [];
          if (list.length === 0) {
            // Seed defaults
            DEFAULT_PLAYBOOKS.forEach(pb => store.put(pb));
            list = [...DEFAULT_PLAYBOOKS];
          }
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
