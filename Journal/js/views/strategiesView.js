/**
 * strategiesView.js
 * 策略 Playbook 与规则库视图（实现 VEYRA Strategy 深度管理）：
 * 包含：
 * 1. 策略列表卡片（显示 Strategy 属性、执行准则 Rules Checklist）
 * 2. 新建 / 编辑策略与 Rules 规则清单
 * 3. 每个 Strategy 专属全自动量化统计 (Trades, Win Rate, Net P&L, Total R, Avg R, Profit Factor, Expectancy)
 */

import { StrategyRepo } from '../db/strategyRepo.js';
import { LiveRepo } from '../db/liveRepo.js';
import { aggregateMetrics } from '../core/calculations.js';
import { formatCurrency, formatR, getMetricColorClass } from '../core/formatters.js';
import { trapFocus } from '../../../js/utils/focusTrap.js';

export class StrategiesView {
  constructor(options = {}) {
    this.container = options.container;
    this.strategies = [];
    this.liveTrades = [];
    this.account = null;
  }

  async render() {
    this.account = await LiveRepo.getAccount();
    this.liveTrades = await LiveRepo.getAllTrades();
    this.strategies = await StrategyRepo.getAllStrategies();

    this.container.innerHTML = `
      <div class="view-header">
        <div class="header-left">
          <div class="view-title">Strategy Playbooks & Rules</div>
        </div>
        <div class="header-right">
          <button class="btn btn-primary" id="btn-create-strategy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Strategy Playbook
          </button>
        </div>
      </div>

      <div class="view-content" id="strategies-content">
        <div id="strategies-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 16px;"></div>
      </div>
    `;

    this.container.querySelector('#btn-create-strategy').addEventListener('click', () => {
      this.openStrategyModal();
    });

    this.renderStrategyCards();
  }

  renderStrategyCards() {
    const grid = this.container.querySelector('#strategies-grid');
    grid.innerHTML = '';

    if (this.strategies.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div style="font-size: 28px; opacity: 0.6;">📘</div>
          <div class="empty-state-title">No strategy playbooks yet</div>
          <div class="empty-state-desc">Define your trading strategies and execution rules checklist (e.g. XAUUSD NY Breakout, ICT FVG Model) to track your edge.</div>
          <button class="btn btn-primary" id="empty-add-strat">+ Add Strategy Playbook</button>
        </div>
      `;
      grid.querySelector('#empty-add-strat').addEventListener('click', () => this.openStrategyModal());
      return;
    }

    this.strategies.forEach(strat => {
      // 匹配绑定了该策略的交易（通过 strategy_id 或 setup 名称匹配）
      const matchedTrades = this.liveTrades.filter(t => t.strategy_id === strat.id || (t.setup && t.setup.toLowerCase() === strat.name.toLowerCase()));
      const m = aggregateMetrics(matchedTrades, this.account ? this.account.starting_balance : 10000);

      const card = document.createElement('div');
      card.className = 'chart-card';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-size: 15px; font-weight: 700; color: var(--text-main);">${strat.name}</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
              ${strat.market || 'Any Market'} • ${strat.session || 'Any Session'} • ${strat.timeframe || 'Any TF'} • ${strat.direction || 'Long/Short'}
            </div>
          </div>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-sm strat-edit-btn" data-id="${strat.id}">Edit</button>
            <button class="btn btn-sm btn-danger strat-delete-btn" data-id="${strat.id}">&times;</button>
          </div>
        </div>

        ${strat.description ? `<p style="font-size: 11.5px; color: var(--text-secondary); margin-top: 8px;">${strat.description}</p>` : ''}

        <!-- Rules Checklist -->
        <div style="background: var(--surface-alt); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); padding: 10px 12px; margin-top: 10px;">
          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 6px;">Execution Rules Checklist</div>
          ${strat.rules && strat.rules.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${strat.rules.map(rule => `
                <div style="font-size: 11.5px; display: flex; align-items: center; gap: 6px;">
                  <span style="color: var(--profit-color); font-weight: bold;">☑</span>
                  <span>${rule}</span>
                </div>
              `).join('')}
            </div>
          ` : '<div style="font-size: 11px; color: var(--text-tertiary);">No specific checklist rules defined.</div>'}
        </div>

        <!-- Strategy Statistics -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-subtle);">
          <div>
            <div class="kpi-label">Trades</div>
            <div class="kpi-value font-mono" style="font-size: 14px;">${matchedTrades.length}</div>
          </div>
          <div>
            <div class="kpi-label">Win Rate</div>
            <div class="kpi-value font-mono" style="font-size: 14px;">${m.winRate.toFixed(1)}%</div>
          </div>
          <div>
            <div class="kpi-label">Net P&L</div>
            <div class="kpi-value font-mono ${getMetricColorClass(m.netPnl)}" style="font-size: 14px;">${formatCurrency(m.netPnl)}</div>
          </div>
          <div>
            <div class="kpi-label">Total R</div>
            <div class="kpi-value font-mono ${getMetricColorClass(m.totalR)}" style="font-size: 14px;">${formatR(m.totalR)}</div>
          </div>
          <div>
            <div class="kpi-label">Avg R</div>
            <div class="kpi-value font-mono ${getMetricColorClass(m.averageR)}" style="font-size: 14px;">${m.averageR !== null ? formatR(m.averageR) : 'N/A'}</div>
          </div>
          <div>
            <div class="kpi-label">Profit Factor</div>
            <div class="kpi-value font-mono" style="font-size: 14px;">${m.profitFactor !== null ? m.profitFactor.toFixed(2) : 'N/A'}</div>
          </div>
        </div>
      `;

      card.querySelector('.strat-edit-btn').addEventListener('click', () => {
        this.openStrategyModal(strat);
      });

      card.querySelector('.strat-delete-btn').addEventListener('click', async () => {
        if (confirm(`Delete strategy playbook "${strat.name}"?`)) {
          await StrategyRepo.deleteStrategy(strat.id);
          this.strategies = await StrategyRepo.getAllStrategies();
          this.renderStrategyCards();
        }
      });

      grid.appendChild(card);
    });
  }

  openStrategyModal(existingStrat = null, opener = document.activeElement) {
    const s = existingStrat || {};
    const isEdit = Boolean(existingStrat);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', isEdit ? 'Edit Strategy Playbook' : 'Add Strategy Playbook');

    overlay.innerHTML = `
      <div class="modal-content" style="width: 540px;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? 'Edit Strategy Playbook' : 'Add Strategy Playbook'}</div>
          <button class="modal-close-btn" aria-label="Close strategy dialog">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Strategy Name *</label>
            <input type="text" class="form-input" id="strat-name" placeholder="e.g. XAUUSD NY Breakout, ICT FVG Model" value="${s.name || ''}">
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Market</label>
              <input type="text" class="form-input" id="strat-market" placeholder="e.g. Forex, Gold, Crypto" value="${s.market || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Session</label>
              <select class="form-select" id="strat-session">
                <option value="Any Session" ${s.session === 'Any Session' ? 'selected' : ''}>Any Session</option>
                <option value="London" ${s.session === 'London' ? 'selected' : ''}>London</option>
                <option value="New York" ${s.session === 'New York' ? 'selected' : ''}>New York</option>
                <option value="Asia" ${s.session === 'Asia' ? 'selected' : ''}>Asia</option>
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Timeframe</label>
              <input type="text" class="form-input" id="strat-tf" placeholder="e.g. 5m / 15m" value="${s.timeframe || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Direction</label>
              <select class="form-select" id="strat-dir">
                <option value="Long / Short" ${s.direction === 'Long / Short' ? 'selected' : ''}>Long / Short</option>
                <option value="Long Only" ${s.direction === 'Long Only' ? 'selected' : ''}>Long Only</option>
                <option value="Short Only" ${s.direction === 'Short Only' ? 'selected' : ''}>Short Only</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Description / Edge Thesis</label>
            <textarea class="form-textarea" id="strat-desc" placeholder="What is the core setup logic and catalyst?">${s.description || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Rules Checklist (One rule per line)</label>
            <textarea class="form-textarea" id="strat-rules" style="min-height: 80px;" placeholder="HTF bias confirmed&#10;Liquidity swept&#10;FVG formation confirmed&#10;Risk <= 1R">${s.rules ? s.rules.join('\n') : ''}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" id="strat-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="strat-save-btn">Save Playbook</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let untrap = null;
    const close = () => {
      if (untrap) untrap();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    overlay.querySelector('.modal-close-btn').addEventListener('click', close);
    overlay.querySelector('#strat-cancel-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    untrap = trapFocus(overlay.querySelector('.modal-content') || overlay, {
      returnFocusTo: opener,
      onEscape: () => close(),
      initialFocus: overlay.querySelector('#strat-name')
    });

    overlay.querySelector('#strat-save-btn').addEventListener('click', async () => {
      const nameInput = overlay.querySelector('#strat-name');
      const name = nameInput.value.trim();
      if (!name) {
        alert('Strategy name is required.');
        nameInput.focus();
        return;
      }

      const rulesLines = overlay.querySelector('#strat-rules').value
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      const payload = {
        name,
        market: overlay.querySelector('#strat-market').value.trim(),
        session: overlay.querySelector('#strat-session').value,
        timeframe: overlay.querySelector('#strat-tf').value.trim(),
        direction: overlay.querySelector('#strat-dir').value,
        description: overlay.querySelector('#strat-desc').value.trim(),
        rules: rulesLines
      };

      if (isEdit) payload.id = s.id;

      await StrategyRepo.saveStrategy(payload);
      close();
      this.strategies = await StrategyRepo.getAllStrategies();
      this.renderStrategyCards();
    });
  }
}
