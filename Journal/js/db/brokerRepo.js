/**
 * brokerRepo.js
 * Broker Connections & Synchronization Data Access Layer
 */
import { withStore } from './database.js';

export const BrokerRepo = {
  async getAllBrokers() {
    return withStore('broker_connections', 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
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
