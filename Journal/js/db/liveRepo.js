/**
 * liveRepo.js
 * 负责 LIVE 域的数据访问。
 * 绝对严禁读取或写入 backtest 表。
 */

import { withStore } from './database.js';

export const LiveRepo = {
  // ==========================================
  // Live Account
  // ==========================================
  async getAccount() {
    return withStore('live_accounts', 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.get('main_live_account');
        req.onsuccess = () => {
          resolve(req.result || {
            id: 'main_live_account',
            name: 'Main Live Account',
            starting_balance: 10000,
            currency: 'USD',
            timezone: 'Asia/Kuala_Lumpur',
            updated_at: new Date().toISOString()
          });
        };
      });
    });
  },

  async saveAccount(accountData) {
    return withStore('live_accounts', 'readwrite', (store) => {
      const data = {
        ...accountData,
        id: 'main_live_account',
        updated_at: new Date().toISOString()
      };
      store.put(data);
      return data;
    });
  },

  // ==========================================
  // Live Trades (Raw Data CRUD)
  // ==========================================
  async getAllTrades() {
    return withStore('live_trades', 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
      });
    });
  },

  async getTradeById(id) {
    return withStore('live_trades', 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
      });
    });
  },

  async saveTrade(tradeData) {
    return withStore('live_trades', 'readwrite', (store) => {
      const now = new Date().toISOString();
      const id = tradeData.id || `live_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const record = {
        ...tradeData,
        id,
        created_at: tradeData.created_at || now,
        updated_at: now
      };

      store.put(record);
      return record;
    });
  },

  async deleteTrade(id) {
    // 物理删除交易并同步清理关联截图
    await withStore('live_trade_screenshots', 'readwrite', (screenStore) => {
      const index = screenStore.index('trade_id');
      const req = index.getAll(id);
      req.onsuccess = () => {
        const list = req.result || [];
        for (const item of list) {
          screenStore.delete(item.id);
        }
      };
    });

    return withStore('live_trades', 'readwrite', (store) => {
      store.delete(id);
      return true;
    });
  },

  // ==========================================
  // Live Screenshots
  // ==========================================
  async getScreenshotsByTradeId(tradeId) {
    return withStore('live_trade_screenshots', 'readonly', (store) => {
      return new Promise((resolve) => {
        const index = store.index('trade_id');
        const req = index.getAll(tradeId);
        req.onsuccess = () => {
          const list = req.result || [];
          // 按 display_order 排序
          list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
          resolve(list);
        };
      });
    });
  },

  async saveScreenshot(screenshotData) {
    return withStore('live_trade_screenshots', 'readwrite', (store) => {
      const id = screenshotData.id || `live_img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const record = {
        ...screenshotData,
        id,
        created_at: screenshotData.created_at || new Date().toISOString()
      };
      store.put(record);
      return record;
    });
  },

  async deleteScreenshot(id) {
    return withStore('live_trade_screenshots', 'readwrite', (store) => {
      store.delete(id);
      return true;
    });
  }
};
