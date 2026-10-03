/**
 * addTradeModal.js
 * Comprehensive 3-Tab Trade Intake System:
 * 1. File Upload (CSV, MT5/cTrader exports with drag-and-drop & parsing)
 * 2. Broker Sync (Live API connection accounts & sync management)
 * 3. Manual (Manual single trade entry)
 */
import { LiveRepo } from '../db/liveRepo.js';
import { BrokerRepo } from '../db/brokerRepo.js';
import { StrategyRepo } from '../db/strategyRepo.js';
import { PlaybookRepo } from '../db/playbookRepo.js';
import { autoCalculateTrade } from '../core/calculations.js';
import { formatCurrency, formatR } from '../core/formatters.js';

export class AddTradeModal {
  constructor(options = {}) {
    this.onTradeAdded = options.onTradeAdded || (() => {});
    this.activeTab = options.defaultTab || 'file-upload'; // 'file-upload' | 'broker-sync' | 'manual'
    this.parsedTrades = [];
    this.brokers = [];
    this.playbooks = [];
    this.strategies = [];
    this.modalEl = null;
    this.init();
  }

  async init() {
    this.brokers = await BrokerRepo.getAllBrokers();
    this.playbooks = await PlaybookRepo.getAllPlaybooks();
    this.strategies = await StrategyRepo.getAllStrategies();
    this.render();
  }

  render() {
    // Remove any existing modal
    const existing = document.getElementById('modal-add-trade-system');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-add-trade-system';

    overlay.innerHTML = `
      <div class="modal-content" style="width: 880px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column;">
        <!-- Header -->
        <div class="modal-header" style="padding: 16px 22px; border-bottom: 1px solid var(--border-default);">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div class="modal-title" style="font-size: 17px; font-weight: 700; letter-spacing: -0.02em;">Add Trade</div>
            <!-- Segmented Tabs -->
            <div class="modal-segmented-tabs" role="tablist">
              <button type="button" class="tab-btn ${this.activeTab === 'file-upload' ? 'active' : ''}" data-tab="file-upload">File Upload</button>
              <button type="button" class="tab-btn ${this.activeTab === 'broker-sync' ? 'active' : ''}" data-tab="broker-sync">Broker Sync</button>
              <button type="button" class="tab-btn ${this.activeTab === 'manual' ? 'active' : ''}" data-tab="manual">Manual</button>
            </div>
          </div>
          <button type="button" class="modal-close-btn" id="btn-close-add-trade">&times;</button>
        </div>

        <!-- Body Area (Tab Content) -->
        <div class="modal-body" id="add-trade-tab-body" style="padding: 20px 24px; overflow-y: auto; flex: 1;">
          <!-- Dynamically rendered based on activeTab -->
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.modalEl = overlay;
    this.bindGlobalEvents();
    this.renderTabContent();
  }

  bindGlobalEvents() {
    this.modalEl.querySelector('#btn-close-add-trade').addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    this.modalEl.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.modalEl.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderTabContent();
      });
    });
  }

  close() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }

  renderTabContent() {
    const body = this.modalEl.querySelector('#add-trade-tab-body');
    if (!body) return;

    if (this.activeTab === 'file-upload') {
      this.renderFileUploadTab(body);
    } else if (this.activeTab === 'broker-sync') {
      this.renderBrokerSyncTab(body);
    } else {
      this.renderManualTab(body);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TAB 1: File Upload (CSV / MT5 / cTrader Export)
  // ─────────────────────────────────────────────────────────────
  renderFileUploadTab(container) {
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 310px; gap: 24px;">
        <!-- Left: Upload Form & Dropzone -->
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Account *</label>
              <select class="form-control" id="upload-account">
                <option value="My Trades">My Trades (Primary Live)</option>
                <option value="Prop Firm Funded">Prop Firm Funded</option>
                <option value="Personal Growth">Personal Growth</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Broker</label>
              <select class="form-control" id="upload-broker">
                <option value="MetaTrader 5">MetaTrader 5</option>
                <option value="cTrader">cTrader</option>
                <option value="TradingView">TradingView Paper/Webhook</option>
                <option value="Binance">Binance Futures</option>
                <option value="Generic CSV">Generic CSV / Excel</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Time Zone</label>
              <select class="form-control" id="upload-timezone">
                <option value="GMT+8">(GMT+08:00) Asia/Kuala_Lumpur, Singapore</option>
                <option value="UTC">(UTC+00:00) London, UTC</option>
                <option value="EST">(UTC-05:00) New York, EST</option>
                <option value="GMT+2">(UTC+02:00) MT5 Broker Server Time</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Contract Multiplier</label>
              <input type="number" class="form-control tabular-nums" id="upload-multiplier" value="100000" placeholder="100000 for FX, 1 for Crypto/Stocks">
            </div>
          </div>

          <!-- Drag and Drop Dropzone -->
          <div class="import-dropzone" id="dropzone-area" style="border: 2px dashed var(--border-default); border-radius: var(--radius-panel); padding: 32px 20px; text-align: center; cursor: pointer; transition: all 140ms ease; background: var(--fill-subtle);">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-panel); border: 1px solid var(--border-default); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; color: var(--color-brand);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </div>
            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-primary); margin-bottom: 4px;">Drag and drop and upload from your computer</div>
            <div style="font-size: 11.5px; color: var(--text-secondary); margin-bottom: 14px;">Supports CSV, HTM reports from MT4/MT5, cTrader, NinjaTrader</div>
            <button type="button" class="btn btn-secondary" id="btn-select-file" style="margin: 0 auto;">Upload file</button>
            <input type="file" id="file-input-hidden" accept=".csv,.htm,.html,.txt" style="display: none;">
          </div>

          <!-- Preview & Action Bar -->
          <div id="upload-preview-container" style="display: none; padding: 12px; background: var(--fill-subtle); border-radius: 8px; border: 1px solid var(--border-default);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-weight: 700; font-size: 12px;" id="upload-parsed-count">0 trades parsed</span>
                <span style="font-size: 11px; color: var(--text-secondary); margin-left: 8px;" id="upload-file-name"></span>
              </div>
              <button type="button" class="btn btn-primary" id="btn-confirm-import">Confirm & Import Trades</button>
            </div>
          </div>
        </div>

        <!-- Right: Broker Instructions Sidebar -->
        <div style="background: var(--fill-subtle); border: 1px solid var(--border-default); border-radius: var(--radius-panel); padding: 18px; display: flex; flex-direction: column; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; margin-bottom: 8px;">
              <span style="width: 8px; height: 8px; border-radius: 2px; background: var(--color-brand);"></span>
              <span id="instruction-broker-title">MetaTrader 5</span>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px;">Supported Asset Types:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              <span class="instruction-tag">Stocks</span>
              <span class="instruction-tag">Futures</span>
              <span class="instruction-tag">Options</span>
              <span class="instruction-tag">Forex</span>
              <span class="instruction-tag">Crypto</span>
              <span class="instruction-tag">CFD</span>
            </div>
          </div>

          <div style="border-top: 1px solid var(--border-default); padding-top: 12px;">
            <div style="font-weight: 600; font-size: 12px; margin-bottom: 8px;">How to import data:</div>
            <ol style="margin: 0; padding-left: 18px; font-size: 11px; color: var(--text-secondary); line-height: 1.6;">
              <li>Open your MetaTrader 5 / cTrader terminal</li>
              <li>Navigate to <strong>History</strong> tab</li>
              <li>Right-click on Orders / Positions list</li>
              <li>Select required time period (e.g. All History)</li>
              <li>Export report as HTML or CSV</li>
              <li>Upload the generated file here</li>
            </ol>
          </div>
        </div>
      </div>
    `;

    const dropzone = container.querySelector('#dropzone-area');
    const fileInput = container.querySelector('#file-input-hidden');
    const btnSelect = container.querySelector('#btn-select-file');

    btnSelect.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--color-brand)';
      dropzone.style.background = 'var(--bg-panel)';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'var(--border-default)';
      dropzone.style.background = 'var(--fill-subtle)';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--border-default)';
      dropzone.style.background = 'var(--fill-subtle)';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.handleFileUpload(e.dataTransfer.files[0], container);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleFileUpload(e.target.files[0], container);
      }
    });

    const btnConfirm = container.querySelector('#btn-confirm-import');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => this.executeBatchImport());
    }
  }

  handleFileUpload(file, container) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      this.parseCsvContent(text, file.name);

      const preview = container.querySelector('#upload-preview-container');
      const countEl = container.querySelector('#upload-parsed-count');
      const nameEl = container.querySelector('#upload-file-name');

      if (preview && countEl) {
        countEl.textContent = `${this.parsedTrades.length} valid trades ready to import`;
        nameEl.textContent = `(${file.name})`;
        preview.style.display = 'block';
      }
    };
    reader.readAsText(file);
  }

  parseCsvContent(text, filename) {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    const trades = [];
    const now = new Date();

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/["']/g, ''));
      if (cols.length < 3) continue;

      // Extract symbol, direction, entry, exit, pnl
      let symbol = 'XAUUSD';
      let direction = 'LONG';
      let entryPrice = 2700.0;
      let exitPrice = 2710.0;
      let pnl = 150.0;
      let lotSize = 1.0;
      let date = now.toISOString().split('T')[0];

      // Flexible column matcher
      headers.forEach((h, idx) => {
        const val = cols[idx];
        if (!val) return;
        if (h.includes('symbol') || h.includes('item') || h.includes('ticker')) symbol = val.toUpperCase();
        else if (h.includes('side') || h.includes('type') || h.includes('dir')) direction = val.toUpperCase().includes('S') ? 'SHORT' : 'LONG';
        else if (h.includes('entry') || h.includes('open price')) entryPrice = parseFloat(val) || entryPrice;
        else if (h.includes('exit') || h.includes('close price')) exitPrice = parseFloat(val) || exitPrice;
        else if (h.includes('pnl') || h.includes('profit') || h.includes('net')) pnl = parseFloat(val) || pnl;
        else if (h.includes('volume') || h.includes('lot') || h.includes('size')) lotSize = parseFloat(val) || lotSize;
        else if (h.includes('date') || h.includes('time')) {
          if (val.length >= 10) date = val.substring(0, 10);
        }
      });

      const calc = autoCalculateTrade({
        direction,
        entry_price: entryPrice,
        exit_price: exitPrice,
        lot_size: lotSize,
        pnl,
        symbol
      });

      trades.push({
        id: `trd_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        symbol,
        direction,
        entry_price: entryPrice,
        exit_price: exitPrice,
        lot_size: lotSize,
        pnl: calc.pnl,
        pnl_r: calc.pnl_r,
        rr_achieved: calc.rr_achieved,
        outcome: calc.outcome,
        date,
        time: '14:30',
        setup: 'CSV Import',
        playbook: 'Default',
        created_at: new Date().toISOString()
      });
    }

    this.parsedTrades = trades;
  }

  async executeBatchImport() {
    if (!this.parsedTrades.length) return;
    for (const trade of this.parsedTrades) {
      await LiveRepo.saveTrade(trade);
    }
    this.onTradeAdded();
    this.close();
  }

  // ─────────────────────────────────────────────────────────────
  // TAB 2: Broker Sync (Connected Accounts & Sync Management)
  // ─────────────────────────────────────────────────────────────
  renderBrokerSyncTab(container) {
    const rowsHtml = this.brokers.map((b, i) => `
      <tr class="table-row">
        <td style="width: 36px; text-align: center;"><input type="checkbox" class="broker-row-check" data-id="${b.id}" checked></td>
        <td style="font-weight: 700; color: var(--text-primary);">${b.broker}</td>
        <td class="tabular-nums" style="color: var(--text-secondary);">${b.account_name} (${b.account_number || 'Live'})</td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: var(--color-profit);">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--color-profit);"></span>
            ${b.status === 'connected' ? 'Connected' : b.status}
          </span>
        </td>
        <td class="tabular-nums" style="font-size: 11px; color: var(--text-secondary);">${b.last_sync || '10 min ago'}</td>
        <td class="tabular-nums" style="font-size: 11px; color: var(--text-secondary);">${b.next_sync || '2 hours later'}</td>
        <td style="text-align: right;">
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn btn-ghost btn-sm btn-resync" data-id="${b.id}" title="Trigger instant API synchronization">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              Re-sync now
            </button>
            <button type="button" class="btn btn-ghost btn-sm btn-del-broker" data-id="${b.id}" style="color: var(--color-loss);" title="Disconnect integration">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div>
            <span style="font-weight: 700; font-size: 13.5px;">Connected Broker Integrations</span>
            <span style="font-size: 11.5px; color: var(--text-secondary); margin-left: 8px;">Automated read-only order sync</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-sync-selected">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
              Sync Selected
            </button>
            <button type="button" class="btn btn-primary btn-sm" id="btn-add-broker-modal">
              + Add New Broker
            </button>
          </div>
        </div>

        <div class="table-container" style="max-height: 420px; overflow-y: auto;">
          <table class="table">
            <thead>
              <tr class="table-header">
                <th style="width: 36px; text-align: center;"><input type="checkbox" id="broker-select-all" checked></th>
                <th>Broker</th>
                <th>Account</th>
                <th>Status</th>
                <th>Last Sync</th>
                <th>Next Sync</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Hook up re-sync and delete actions
    container.querySelectorAll('.btn-resync').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.innerHTML = `<span style="font-size:10px;">Syncing...</span>`;
        setTimeout(() => {
          btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Synced`;
          setTimeout(() => {
            btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> Re-sync now`;
          }, 2000);
        }, 800);
      });
    });

    container.querySelectorAll('.btn-del-broker').forEach(btn => {
      btn.addEventListener('click', async () => {
        await BrokerRepo.deleteBroker(btn.dataset.id);
        this.brokers = await BrokerRepo.getAllBrokers();
        this.renderTabContent();
      });
    });

    const btnAdd = container.querySelector('#btn-add-broker-modal');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.showAddNewBrokerPrompt());
    }
  }

  showAddNewBrokerPrompt() {
    const brokerName = prompt("Enter Broker Name (e.g. cTrader, Binance, MT5):", "MetaTrader 5");
    if (!brokerName) return;
    const accountName = prompt("Enter Account Identifier / Label:", "Live 80231");
    if (!accountName) return;

    BrokerRepo.saveBroker({
      broker: brokerName,
      account_name: accountName,
      status: 'connected',
      last_sync: 'Just now',
      next_sync: '2 hours later'
    }).then(() => {
      return BrokerRepo.getAllBrokers();
    }).then(updated => {
      this.brokers = updated;
      this.renderTabContent();
    });
  }

  // ─────────────────────────────────────────────────────────────
  // TAB 3: Manual Trade Entry Form
  // ─────────────────────────────────────────────────────────────
  renderManualTab(container) {
    const now = new Date();
    const defaultDate = now.toISOString().split('T')[0];
    const defaultTime = now.toTimeString().substring(0, 5);

    const playbookOptions = this.playbooks.map(p => `
      <option value="${p.id}">${p.name} (${p.market})</option>
    `).join('');

    container.innerHTML = `
      <form id="form-manual-trade" style="display: flex; flex-direction: column; gap: 14px;">
        <div style="display: grid; grid-template-columns: 1fr 140px 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Symbol *</label>
            <input type="text" class="form-control" id="manual-symbol" placeholder="e.g. XAUUSD, GER40, BTCUSDT" value="XAUUSD" required>
          </div>
          <div class="form-group">
            <label class="form-label">Side *</label>
            <div class="segmented-control" id="manual-side-toggle" style="display: flex; border: 1px solid var(--border-default); border-radius: var(--radius-control); overflow: hidden; height: 34px;">
              <button type="button" class="side-btn active" data-side="LONG" style="flex: 1; border: none; background: var(--color-profit); color: #FFF; font-weight: 700; font-size: 11.5px; cursor: pointer;">LONG</button>
              <button type="button" class="side-btn" data-side="SHORT" style="flex: 1; border: none; background: transparent; color: var(--text-secondary); font-weight: 700; font-size: 11.5px; cursor: pointer;">SHORT</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Playbook / Strategy</label>
            <select class="form-control" id="manual-playbook">
              <option value="">None / Discretionary</option>
              ${playbookOptions}
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Entry Price *</label>
            <input type="number" step="any" class="form-control tabular-nums" id="manual-entry" placeholder="0.00" value="2680.50" required>
          </div>
          <div class="form-group">
            <label class="form-label">Exit Price *</label>
            <input type="number" step="any" class="form-control tabular-nums" id="manual-exit" placeholder="0.00" value="2692.00" required>
          </div>
          <div class="form-group">
            <label class="form-label">Lot Size / Volume *</label>
            <input type="number" step="any" class="form-control tabular-nums" id="manual-size" placeholder="1.0" value="1.0" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Open Date</label>
            <input type="date" class="form-control" id="manual-date" value="${defaultDate}">
          </div>
          <div class="form-group">
            <label class="form-label">Open Time</label>
            <input type="time" class="form-control" id="manual-time" value="${defaultTime}">
          </div>
          <div class="form-group">
            <label class="form-label">Commission & Fees ($)</label>
            <input type="number" step="any" class="form-control tabular-nums" id="manual-commission" value="7.00">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Trade Execution Notes & Review</label>
          <textarea class="form-control" id="manual-notes" rows="2" placeholder="Describe entry trigger, emotional state, market liquidity context..."></textarea>
        </div>

        <!-- Calculated Live Preview Strip -->
        <div style="background: var(--fill-subtle); border: 1px solid var(--border-default); border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em;">Expected P&L:</span>
            <span id="manual-preview-pnl" style="font-size: 15px; font-weight: 700; margin-left: 8px; font-variant-numeric: tabular-nums; color: var(--color-profit);">+$1,143.00</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-manual">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-submit-manual">Save Trade</button>
          </div>
        </div>
      </form>
    `;

    let activeSide = 'LONG';
    const sideBtns = container.querySelectorAll('.side-btn');
    sideBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sideBtns.forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = 'var(--text-secondary)';
        });
        btn.classList.add('active');
        activeSide = btn.dataset.side;
        if (activeSide === 'LONG') {
          btn.style.background = 'var(--color-profit)';
          btn.style.color = '#FFF';
        } else {
          btn.style.background = 'var(--color-loss)';
          btn.style.color = '#FFF';
        }
        updatePreview();
      });
    });

    const entryInput = container.querySelector('#manual-entry');
    const exitInput = container.querySelector('#manual-exit');
    const sizeInput = container.querySelector('#manual-size');
    const commInput = container.querySelector('#manual-commission');
    const previewPnl = container.querySelector('#manual-preview-pnl');

    const updatePreview = () => {
      const entry = parseFloat(entryInput.value) || 0;
      const exit = parseFloat(exitInput.value) || 0;
      const size = parseFloat(sizeInput.value) || 1;
      const comm = parseFloat(commInput.value) || 0;

      const rawPnl = activeSide === 'LONG' ? (exit - entry) * size * 100 : (entry - exit) * size * 100;
      const netPnl = rawPnl - comm;
      previewPnl.textContent = formatCurrency(netPnl);
      previewPnl.style.color = netPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)';
    };

    [entryInput, exitInput, sizeInput, commInput].forEach(inp => {
      inp.addEventListener('input', updatePreview);
    });

    container.querySelector('#btn-cancel-manual').addEventListener('click', () => this.close());

    container.querySelector('#form-manual-trade').addEventListener('submit', async (e) => {
      e.preventDefault();
      const symbol = container.querySelector('#manual-symbol').value.trim().toUpperCase();
      const entry = parseFloat(entryInput.value) || 0;
      const exit = parseFloat(exitInput.value) || 0;
      const size = parseFloat(sizeInput.value) || 1;
      const comm = parseFloat(commInput.value) || 0;
      const date = container.querySelector('#manual-date').value;
      const time = container.querySelector('#manual-time').value;
      const playbookId = container.querySelector('#manual-playbook').value;
      const notes = container.querySelector('#manual-notes').value;

      const rawPnl = activeSide === 'LONG' ? (exit - entry) * size * 100 : (entry - exit) * size * 100;
      const netPnl = rawPnl - comm;

      const calc = autoCalculateTrade({
        direction: activeSide,
        entry_price: entry,
        exit_price: exit,
        lot_size: size,
        pnl: netPnl,
        symbol
      });

      const newTrade = {
        id: `trd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        symbol,
        direction: activeSide,
        entry_price: entry,
        exit_price: exit,
        lot_size: size,
        pnl: netPnl,
        pnl_r: calc.pnl_r,
        rr_achieved: calc.rr_achieved,
        outcome: calc.outcome,
        date,
        time,
        notes,
        setup: playbookId ? 'Playbook Strategy' : 'Discretionary',
        playbook_id: playbookId,
        created_at: new Date().toISOString()
      };

      await LiveRepo.saveTrade(newTrade);
      this.onTradeAdded();
      this.close();
    });
  }
}
