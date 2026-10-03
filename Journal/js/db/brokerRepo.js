/**
 * brokerRepo.js
 * Broker Connections & Synchronization Data Access Layer
 */
import { withStore } from './database.js';

const DEFAULT_BROKERS = [
  {
    id: 'brk_01',
    broker: 'cTrader',
    account_name: 'cTrader 3784',
    account_number: '37849102',
    status: 'connected',
    last_sync: '2 hours ago',
    next_sync: '3 hours later',
    created_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'brk_02',
    broker: 'cTrader',
    account_name: 'cTrader 48374',
    account_number: '48374991',
    status: 'connected',
    last_sync: '3 months ago',
    next_sync: 'Manual only',
    created_at: '2024-10-15T00:00:00.000Z'
  },
  {
    id: 'brk_03',
    broker: 'MetaTrader 5',
    account_name: 'MT5 Live 10214',
    account_number: '10214820',
    status: 'connected',
    last_sync: '10 minutes ago',
    next_sync: '2 hours later',
    created_at: '2025-01-02T00:00:00.000Z'
  }
];

export const BrokerRepo = {
  async getAllBrokers() {
    return withStore('broker_connections', 'readwrite', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          let list = req.result || [];
          if (list.length === 0) {
            DEFAULT_BROKERS.forEach(b => store.put(b));
            list = [...DEFAULT_BROKERS];
          }
          resolve(list);
        };
      });
    });
  },

  async saveBroker(data) {
    return withStore('broker_connections', 'readwrite', (store) => {
      const now = new Date().toISOString();
      const id = data.id || `brk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const record = {
        ...data,
        id,
        created_at: data.created_at || now,
        updated_at: now
      };
      store.put(record);
      return record;
    });
  },

  async deleteBroker(id) {
    return withStore('broker_connections', 'readwrite', (store) => {
      store.delete(id);
      return true;
    });
  }
};
