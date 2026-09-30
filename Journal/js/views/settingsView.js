/**
 * settingsView.js
 * 系统设置与数据管理视图（去除了冗余的 balance 设定，纯粹聚焦货币、时区与备份导出）：
 * 1. 交易偏好 (Currency, Timezone)
 * 2. 导出 CSV (Live 专属 / Backtest 专属)
 * 3. 完整离线 JSON 备份与恢复
 */

import { LiveRepo } from '../db/liveRepo.js';
import { BacktestRepo } from '../db/backtestRepo.js';
import { exportTradesToCSV, createFullBackupJSON, restoreFromBackupJSON } from '../core/export.js';

export class SettingsView {
  constructor(options = {}) {
    this.container = options.container;
    this.account = null;
    this.onAccountUpdated = options.onAccountUpdated || (() => {});
  }

  async render() {
    this.account = await LiveRepo.getAccount();

    this.container.innerHTML = `
      <div class="view-header">
        <div class="header-left">
          <div class="view-title">Settings & Data Backup</div>
        </div>
      </div>

      <div class="view-content" style="max-width: 680px;">
        <!-- 1. Display Preferences (No Balance Needed) -->
        <div class="chart-card">
          <div class="chart-card-title">Display Preferences</div>
          <p style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
            Pure P&L and R calculations. No artificial account balance required.
          </p>
          <div class="form-grid-2" style="margin-top: 10px;">
            <div class="form-group">
              <label class="form-label">Currency Symbol / Code</label>
              <input type="text" class="form-input" id="cfg-currency" value="${this.account.currency || 'USD'}">
            </div>
            <div class="form-group">
              <label class="form-label">Default Timezone</label>
              <input type="text" class="form-input" id="cfg-timezone" value="${this.account.timezone || 'Asia/Kuala_Lumpur'}">
            </div>
          </div>
          <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
            <button class="btn btn-primary btn-sm" id="btn-save-settings">Save Preferences</button>
          </div>
        </div>

        <!-- 2. Export Section -->
        <div class="chart-card">
          <div class="chart-card-title">Data Export</div>
          <p style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;">
            Export raw execution records to standard CSV files. Live and Backtest data remain strictly partitioned.
          </p>

          <div style="display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap;">
            <button class="btn" id="btn-export-live-csv">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export Live Trades (CSV)
            </button>

            <button class="btn" id="btn-export-bt-csv">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export Backtest Trades (CSV)
            </button>
          </div>
        </div>

        <!-- 3. Full Database Backup & Restore -->
        <div class="chart-card">
          <div class="chart-card-title">Full Database Backup (JSON)</div>
          <p style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;">
            Download a complete offline copy of your entire private trading journal, including all Live trades, Backtest books, strategies, and notes.
          </p>

          <div style="display: flex; gap: 10px; margin-top: 12px; align-items: center;">
            <button class="btn btn-primary" id="btn-export-full-json">
              Download Full Backup (JSON)
            </button>

            <label class="btn" style="cursor: pointer;">
              Restore from Backup (JSON)
              <input type="file" accept=".json" id="input-restore-file" style="display: none;">
            </label>
          </div>
        </div>

        <!-- 4. Security & Privacy Notice -->
        <div style="padding: 12px 14px; background: var(--surface-alt); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); font-size: 11px; color: var(--text-tertiary);">
          <strong>Private Trading Journal Guarantee:</strong> All database records and chart screenshots are stored 100% locally in your device's browser sandbox database (IndexedDB). Zero telemetry, zero analytics tracking, and zero cloud API connections.
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btn-save-settings').addEventListener('click', async () => {
      const currency = this.container.querySelector('#cfg-currency').value.trim() || 'USD';
      const timezone = this.container.querySelector('#cfg-timezone').value.trim() || 'Asia/Kuala_Lumpur';

      await LiveRepo.saveAccount({
        currency,
        timezone
      });

      alert('Preferences saved successfully.');
      this.onAccountUpdated();
    });

    this.container.querySelector('#btn-export-live-csv').addEventListener('click', async () => {
      const trades = await LiveRepo.getAllTrades();
      if (trades.length === 0) {
        alert('No live trades to export.');
        return;
      }
      const dateStr = new Date().toISOString().split('T')[0];
      exportTradesToCSV(trades, `Live_Trades_${dateStr}.csv`);
    });

    this.container.querySelector('#btn-export-bt-csv').addEventListener('click', async () => {
      const btTrades = await BacktestRepo.getAllBacktestTrades();
      if (btTrades.length === 0) {
        alert('No backtest trades to export.');
        return;
      }
      const dateStr = new Date().toISOString().split('T')[0];
      exportTradesToCSV(btTrades, `Backtest_Trades_${dateStr}.csv`);
    });

    this.container.querySelector('#btn-export-full-json').addEventListener('click', async () => {
      await createFullBackupJSON();
    });

    this.container.querySelector('#input-restore-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (confirm('Restore database from this backup? Existing records will be updated or preserved.')) {
        try {
          await restoreFromBackupJSON(file);
          alert('Database restored successfully.');
          window.location.reload();
        } catch (err) {
          alert('Failed to restore backup: ' + err.message);
        }
      }
      e.target.value = '';
    });
  }
}
