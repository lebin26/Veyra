/**
 * database.js
 * 工业级 IndexedDB 本地数据库：
 * 物理隔离不同用户账户 (Multi-Tenant Local Partitioning)，
 * 物理隔离 Live 与 Backtest，并支持 Strategies (Playbooks) 与 Daily Journals 架构。
 */

const DB_VERSION = 3;

let activeUserId = null;
let dbInstance = null;

export function setActiveUser(userId) {
  const cleanId = userId ? String(userId).trim() : null;
  if (activeUserId !== cleanId) {
    if (dbInstance) {
      try { dbInstance.close(); } catch (_) {}
      dbInstance = null;
    }
    activeUserId = cleanId;
  }
}

export function getActiveUserId() {
  if (activeUserId) return activeUserId;
  try {
    return localStorage.getItem('veyra_active_user_id') || 'guest';
  } catch (_) {
    return 'guest';
  }
}

export function getDatabaseName(userId) {
  const uid = userId || getActiveUserId();
  const safeUid = (uid || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `VeyraJournalDB_${safeUid}`;
}

export function closeDatabase() {
  if (dbInstance) {
    try { dbInstance.close(); } catch (_) {}
    dbInstance = null;
  }
}

export function openDatabase(specifiedUserId) {
  if (specifiedUserId) {
    setActiveUser(specifiedUserId);
  }

  const currentDbName = getDatabaseName();

  if (dbInstance && dbInstance.name === currentDbName) {
    return Promise.resolve(dbInstance);
  }

  if (dbInstance) {
    try { dbInstance.close(); } catch (_) {}
    dbInstance = null;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(currentDbName, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. LIVE TRADING 存储域
      if (!db.objectStoreNames.contains('live_accounts')) {
        db.createObjectStore('live_accounts', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('live_trades')) {
        const liveStore = db.createObjectStore('live_trades', { keyPath: 'id' });
        liveStore.createIndex('date', 'date', { unique: false });
        liveStore.createIndex('symbol', 'symbol', { unique: false });
        liveStore.createIndex('strategy_id', 'strategy_id', { unique: false });
        liveStore.createIndex('setup', 'setup', { unique: false });
        liveStore.createIndex('direction', 'direction', { unique: false });
        liveStore.createIndex('created_at', 'created_at', { unique: false });
      }

      if (!db.objectStoreNames.contains('live_trade_screenshots')) {
        const liveScreenStore = db.createObjectStore('live_trade_screenshots', { keyPath: 'id' });
        liveScreenStore.createIndex('trade_id', 'trade_id', { unique: false });
      }

      // 2. BACKTEST 存储域
      if (!db.objectStoreNames.contains('backtest_books')) {
        const bookStore = db.createObjectStore('backtest_books', { keyPath: 'id' });
        bookStore.createIndex('name', 'name', { unique: false });
        bookStore.createIndex('created_at', 'created_at', { unique: false });
      }

      if (!db.objectStoreNames.contains('backtest_trades')) {
        const btTradeStore = db.createObjectStore('backtest_trades', { keyPath: 'id' });
        btTradeStore.createIndex('book_id', 'book_id', { unique: false });
        btTradeStore.createIndex('date', 'date', { unique: false });
        btTradeStore.createIndex('symbol', 'symbol', { unique: false });
        btTradeStore.createIndex('strategy_id', 'strategy_id', { unique: false });
        btTradeStore.createIndex('setup', 'setup', { unique: false });
        btTradeStore.createIndex('direction', 'direction', { unique: false });
        btTradeStore.createIndex('created_at', 'created_at', { unique: false });
      }

      if (!db.objectStoreNames.contains('backtest_trade_screenshots')) {
        const btScreenStore = db.createObjectStore('backtest_trade_screenshots', { keyPath: 'id' });
        btScreenStore.createIndex('trade_id', 'trade_id', { unique: false });
      }

      // 3. STRATEGIES / PLAYBOOKS 存储域
      if (!db.objectStoreNames.contains('strategies')) {
        const stratStore = db.createObjectStore('strategies', { keyPath: 'id' });
        stratStore.createIndex('name', 'name', { unique: false });
        stratStore.createIndex('created_at', 'created_at', { unique: false });
      }

      if (!db.objectStoreNames.contains('playbooks')) {
        const pbStore = db.createObjectStore('playbooks', { keyPath: 'id' });
        pbStore.createIndex('name', 'name', { unique: false });
        pbStore.createIndex('market', 'market', { unique: false });
        pbStore.createIndex('status', 'status', { unique: false });
        pbStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // 4. DAILY JOURNALS 存储域 (按日复盘，Pre-market / Post-market / 评分 / 心情 / 市场条件)
      if (!db.objectStoreNames.contains('daily_journals')) {
        const dailyStore = db.createObjectStore('daily_journals', { keyPath: 'date' });
        dailyStore.createIndex('date', 'date', { unique: true });
        dailyStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // 5. NOTEBOOK 存储域
      if (!db.objectStoreNames.contains('notebook_entries')) {
        const nbStore = db.createObjectStore('notebook_entries', { keyPath: 'id' });
        nbStore.createIndex('category', 'category', { unique: false });
        nbStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // 6. PROGRESS GOALS 存储域
      if (!db.objectStoreNames.contains('progress_goals')) {
        const goalStore = db.createObjectStore('progress_goals', { keyPath: 'id' });
        goalStore.createIndex('status', 'status', { unique: false });
        goalStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // 7. BROKER CONNECTIONS 存储域
      if (!db.objectStoreNames.contains('broker_connections')) {
        const brokerStore = db.createObjectStore('broker_connections', { keyPath: 'id' });
        brokerStore.createIndex('broker', 'broker', { unique: false });
        brokerStore.createIndex('status', 'status', { unique: false });
      }

      // 8. SETTINGS
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

export async function withStore(storeName, mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    result = callback(store, tx);
  });
}
