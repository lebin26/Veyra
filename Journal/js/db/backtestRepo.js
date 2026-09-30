/**
 * backtestRepo.js
 * 负责 BACKTEST 域的数据访问。
 * 绝对严禁访问 live_trades 或与 Live 数据混合。
 */

import { withStore } from './database.js';

export const BacktestRepo = {
  // ==========================================
  // Backtest Books
  // ==========================================
  async getAllBooks() {
    return withStore('backtest_books', 'readonly', (store) => {
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

  async getBookById(id) {
    return withStore('backtest_books', 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
      });
    });
  },

  async saveBook(bookData) {
    return withStore('backtest_books', 'readwrite', (store) => {
      const now = new Date().toISOString();
      const id = bookData.id || `bt_book_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const record = {
        ...bookData,
        id,
        initial_balance: Number(bookData.initial_balance) || 10000,
        created_at: bookData.created_at || now,
        updated_at: now
      };
      store.put(record);
      return record;
    });
  },

  async deleteBook(id) {
    // 级联清理属于该 book 的所有 trades 与截图
    const trades = await this.getTradesByBookId(id);
    for (const trade of trades) {
      await this.deleteTrade(trade.id);
    }

    return withStore('backtest_books', 'readwrite', (store) => {
      store.delete(id);
      return true;
    });
  },

  // ==========================================
  // Backtest Trades (属于特定 Book)
  // ==========================================
  async getTradesByBookId(bookId) {
    return withStore('backtest_trades', 'readonly', (store) => {
      return new Promise((resolve) => {
        const index = store.index('book_id');
        const req = index.getAll(bookId);
        req.onsuccess = () => resolve(req.result || []);
      });
    });
  },

  async getAllBacktestTrades() {
    // 仅查询全部 backtest trades，绝不掺杂 live 交易
    return withStore('backtest_trades', 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
      });
    });
  },

  async getTradeById(id) {
    return withStore('backtest_trades', 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
      });
    });
  },

  async saveTrade(tradeData) {
    if (!tradeData.book_id) {
      throw new Error('A backtest trade must belong to a backtest_book_id');
    }

    return withStore('backtest_trades', 'readwrite', (store) => {
      const now = new Date().toISOString();
      const id = tradeData.id || `bt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
    // 清理该回测交易关联截图
    await withStore('backtest_trade_screenshots', 'readwrite', (screenStore) => {
      const index = screenStore.index('trade_id');
      const req = index.getAll(id);
      req.onsuccess = () => {
        const list = req.result || [];
        for (const item of list) {
          screenStore.delete(item.id);
        }
      };
    });

    return withStore('backtest_trades', 'readwrite', (store) => {
      store.delete(id);
      return true;
    });
  },

  // ==========================================
  // Backtest Screenshots
  // ==========================================
  async getScreenshotsByTradeId(tradeId) {
    return withStore('backtest_trade_screenshots', 'readonly', (store) => {
      return new Promise((resolve) => {
        const index = store.index('trade_id');
        const req = index.getAll(tradeId);
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
          resolve(list);
        };
      });
    });
  },

  async saveScreenshot(screenshotData) {
    return withStore('backtest_trade_screenshots', 'readwrite', (store) => {
      const id = screenshotData.id || `bt_img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
    return withStore('backtest_trade_screenshots', 'readwrite', (store) => {
      store.delete(id);
      return true;
    });
  }
};
