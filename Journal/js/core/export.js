/**
 * export.js
 * 负责数据导出与备份下载：
 * 1. exportToCSV(trades, filename)
 * 2. exportFullBackupJSON()
 * 3. importFullBackupJSON()
 */

import { LiveRepo } from '../db/liveRepo.js';
import { BacktestRepo } from '../db/backtestRepo.js';
import { deriveTradeMetrics } from './calculations.js';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportTradesToCSV(trades, filename, accountBalance = 10000) {
  const headers = [
    'Date', 'Time', 'Symbol', 'Market', 'Direction', 'Setup', 'Session',
    'Entry Price', 'Exit Price', 'Stop Loss', 'Take Profit', 'Position Size',
    'Initial Risk $', 'Net P&L $', 'Fees', 'R', 'Planned RR', 'Result',
    'Entry Reason', 'Exit Reason', 'Mistake', 'Emotion', 'Notes'
  ];

  const escapeCSV = (str) => {
    if (str === null || str === undefined) return '';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = trades.map(t => {
    const d = deriveTradeMetrics(t, accountBalance).derived;
    return [
      escapeCSV(t.date),
      escapeCSV(t.time),
      escapeCSV(t.symbol),
      escapeCSV(t.market),
      escapeCSV(t.direction),
      escapeCSV(t.setup),
      escapeCSV(t.session),
      escapeCSV(t.entry_price),
      escapeCSV(t.exit_price),
      escapeCSV(t.stop_loss),
      escapeCSV(t.take_profit),
      escapeCSV(t.position_size),
      escapeCSV(t.initial_risk_amount),
      escapeCSV(t.net_pnl),
      escapeCSV(t.fees),
      escapeCSV(d.r !== null ? d.r.toFixed(2) : ''),
      escapeCSV(d.plannedRR !== null ? d.plannedRR.toFixed(2) : ''),
      escapeCSV(d.result),
      escapeCSV(t.entry_reason),
      escapeCSV(t.exit_reason),
      escapeCSV(t.mistake),
      escapeCSV(t.emotion),
      escapeCSV(t.notes)
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

export async function createFullBackupJSON() {
  const account = await LiveRepo.getAccount();
  const liveTrades = await LiveRepo.getAllTrades();
  const backtestBooks = await BacktestRepo.getAllBooks();
  const backtestTrades = await BacktestRepo.getAllBacktestTrades();

  const backupData = {
    version: '1.0',
    export_time: new Date().toISOString(),
    account,
    live_trades: liveTrades,
    backtest_books: backtestBooks,
    backtest_trades: backtestTrades
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const dateStr = new Date().toISOString().split('T')[0];
  downloadBlob(blob, `Trading_Journal_Backup_${dateStr}.json`);
}

export async function restoreFromBackupJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || !data.version) {
          throw new Error('Invalid backup file format');
        }

        if (data.account) {
          await LiveRepo.saveAccount(data.account);
        }

        if (Array.isArray(data.live_trades)) {
          for (const t of data.live_trades) {
            await LiveRepo.saveTrade(t);
          }
        }

        if (Array.isArray(data.backtest_books)) {
          for (const b of data.backtest_books) {
            await BacktestRepo.saveBook(b);
          }
        }

        if (Array.isArray(data.backtest_trades)) {
          for (const bt of data.backtest_trades) {
            await BacktestRepo.saveTrade(bt);
          }
        }

        resolve(true);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
