/**
 * tradeModal.js
 * QUICK TRADE 极速减负录入组件（10-20秒完成记录）：
 * 只需输入：Symbol, Side (一键切换), Entry, Exit, Size, SL, 截图, Strategy (可选)。
 * 系统自动在下方秒算 P&L, R, RR, Win/Loss，点击 [SAVE TRADE] 立即保存！
 */

import { validateTradeInput } from '../core/validator.js';
import { autoCalculateTrade } from '../core/calculations.js';
import { ScreenshotUploader } from './screenshotUploader.js';
import { formatCurrency, formatR, formatRR } from '../core/formatters.js';
import { StrategyRepo } from '../db/strategyRepo.js';

export class TradeModal {
  constructor(options = {}) {
    this.onSave = options.onSave || (async () => {});
    this.mode = options.mode || 'LIVE';
    this.trade = options.trade || null;
    this.initialScreenshots = options.screenshots || [];
    this.bookId = options.bookId || null;
    this.accountBalance = options.accountBalance || 10000;
    this.pendingScreenshots = [...this.initialScreenshots];
    const t = this.trade || {};
    this.currentExitType = t.exit_type || (t.exit_price !== undefined && t.exit_price !== null && String(t.exit_price).trim() !== '' ? 'TP' : '');
    this.currentEarlyCloseReason = t.early_close_reason || '';
    this.init();
  }

  async init() {
    this.strategies = await StrategyRepo.getAllStrategies();
    this.render();
  }

  render() {
    const isEdit = Boolean(this.trade);
    const t = this.trade || {};
    
    const now = new Date();
    const defaultDate = t.date || now.toISOString().split('T')[0];
    const defaultTime = t.time || now.toTimeString().substring(0, 5);
    const defaultDir = t.direction || 'LONG';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-content" style="width: 500px; max-width: 95vw;">
        <div class="modal-header" style="padding: 12px 18px;">
          <div class="modal-title" style="font-size: 14px; font-weight: 700; letter-spacing: -0.2px;">
            ${isEdit ? 'Edit Trade' : (this.mode === 'BACKTEST' ? 'Log Backtest Trade' : 'Log New Order (下单开仓)')}
          </div>
          <button class="modal-close-btn">&times;</button>
        </div>

        <div class="modal-body" style="padding: 14px 18px; gap: 12px;">
          <div id="modal-warnings-container"></div>

          <!-- 1. Symbol -->
          <div class="form-group">
            <label class="form-label" style="font-weight: 600;">Symbol *</label>
            <input type="text" class="form-input" id="trade-symbol" placeholder="e.g. XAUUSD" value="${t.symbol || 'XAUUSD'}" style="font-weight: 700; font-size: 14px;">
          </div>

          <!-- 2. Direction Toggle (Big Clickable Buttons) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button type="button" class="btn dir-toggle-btn ${defaultDir === 'LONG' ? 'active-long' : ''}" id="btn-dir-long" style="padding: 8px; font-weight: 700; font-size: 13px; border-radius: var(--radius-sm);">
              ▲ LONG (Buy)
            </button>
            <button type="button" class="btn dir-toggle-btn ${defaultDir === 'SHORT' ? 'active-short' : ''}" id="btn-dir-short" style="padding: 8px; font-weight: 700; font-size: 13px; border-radius: var(--radius-sm);">
              ▼ SHORT (Sell)
            </button>
            <input type="hidden" id="trade-direction" value="${defaultDir}">
          </div>

          <!-- 3. Core Numbers: Entry, Exit, Size, SL -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" style="font-weight: 600;">Entry Price *</label>
              <input type="number" step="any" class="form-input font-mono" id="trade-entry" placeholder="2650.00" value="${t.entry_price !== undefined && t.entry_price !== null ? t.entry_price : ''}" style="font-size: 13px; font-weight: 600;">
            </div>
            <div class="form-group">
              <label class="form-label" style="display:flex; justify-content:space-between;">
                <span>Exit Price</span>
                <span style="font-size:10.5px; color:var(--text-tertiary); font-weight:normal;">(出场平仓时再填)</span>
              </label>
              <input type="number" step="any" class="form-input font-mono" id="trade-exit" placeholder="留空为持仓中..." value="${t.exit_price !== undefined && t.exit_price !== null ? t.exit_price : ''}" style="font-size: 13px; font-weight: 600;">
            </div>
          </div>

          <!-- 出场结果选择：TP / BE / SL / 提早关闭 (盈利) / 提早关闭 (亏损) -->
          <div id="modal-exit-outcome-section" style="${t.exit_price !== undefined && t.exit_price !== null && String(t.exit_price).trim() !== '' ? '' : 'display: none;'} background: var(--surface-alt); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); padding: 10px 12px;">
            <div style="font-size: 11px; font-weight: 700; color: #1E3A8A; margin-bottom: 6px;">
              出场结果类型 (Exit Outcome)
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(85px, 1fr)); gap: 6px;" id="modal-exit-type-group">
              <button type="button" class="btn btn-sm btn-modal-exit-type ${this.currentExitType === 'TP' ? 'btn-primary' : ''}" data-type="TP" style="font-weight: 600; font-size: 11px; padding: 4px 6px;">🎯 Take Profit</button>
              <button type="button" class="btn btn-sm btn-modal-exit-type ${this.currentExitType === 'BE' ? 'btn-primary' : ''}" data-type="BE" style="font-weight: 600; font-size: 11px; padding: 4px 6px;">⚖️ Break Even</button>
              <button type="button" class="btn btn-sm btn-modal-exit-type ${this.currentExitType === 'SL' ? 'btn-primary' : ''}" data-type="SL" style="font-weight: 600; font-size: 11px; padding: 4px 6px;">🛑 Stop Loss</button>
              <button type="button" class="btn btn-sm btn-modal-exit-type ${this.currentExitType === 'EARLY_PROFIT' ? 'btn-primary' : ''}" data-type="EARLY_PROFIT" style="font-weight: 600; font-size: 11px; padding: 4px 6px; color:#047857;">⚡ 提早(盈利)</button>
              <button type="button" class="btn btn-sm btn-modal-exit-type ${this.currentExitType === 'EARLY_LOSS' ? 'btn-primary' : ''}" data-type="EARLY_LOSS" style="font-weight: 600; font-size: 11px; padding: 4px 6px; color:#B91C1C;">⚡ 提早(亏损)</button>
            </div>

            <!-- 提早关闭原因 (必须写原因) -->
            <div id="modal-early-reason-box" style="${(this.currentExitType === 'EARLY_PROFIT' || this.currentExitType === 'EARLY_LOSS') ? '' : 'display: none;'} margin-top: 8px; background: #FFF5F5; border: 1px dashed #FEB2B2; border-radius: var(--radius-xs); padding: 8px 10px;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                <label class="form-label" style="font-weight: 700; color: #C53030; margin-bottom: 0; font-size: 11px;">提早关闭原因 * (必填)</label>
                <span style="font-size: 10px; color: #E53E3E;">不可留空</span>
              </div>
              <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px;">
                <button type="button" class="btn btn-sm btn-modal-reason-chip" data-text="盘口结构转变 (Structure Shift)" style="padding: 1px 6px; font-size: 10px;">结构转变</button>
                <button type="button" class="btn btn-sm btn-modal-reason-chip" data-text="动能衰竭/背离 (Loss of Momentum)" style="padding: 1px 6px; font-size: 10px;">动能衰竭</button>
                <button type="button" class="btn btn-sm btn-modal-reason-chip" data-text="重要数据公布避险 (News Event)" style="padding: 1px 6px; font-size: 10px;">数据公布</button>
                <button type="button" class="btn btn-sm btn-modal-reason-chip" data-text="恐慌/心态不稳提前平仓 (Panic / Emotion)" style="padding: 1px 6px; font-size: 10px;">恐慌提前平</button>
                <button type="button" class="btn btn-sm btn-modal-reason-chip" data-text="收盘/周末避险 (Session Close)" style="padding: 1px 6px; font-size: 10px;">收盘避险</button>
              </div>
              <input type="text" class="form-input" id="modal-early-reason-input" placeholder="输入具体的提早平仓原因..." value="${this.currentEarlyCloseReason}" style="font-size: 12px; border-color: #FEB2B2; background: #FFFFFF;">
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" style="font-weight: 600;">Position Size (Lots/Qty) *</label>
              <input type="number" step="any" class="form-input font-mono" id="trade-size" placeholder="1.0" value="${t.position_size !== undefined && t.position_size !== null ? t.position_size : '1'}" style="font-size: 13px; font-weight: 600;">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 600;">Stop Loss *</label>
              <input type="number" step="any" class="form-input font-mono" id="trade-sl" placeholder="2645.00" value="${t.stop_loss !== undefined && t.stop_loss !== null ? t.stop_loss : ''}" style="font-size: 13px; font-weight: 600;">
            </div>
          </div>

          <!-- 4. Optional Strategy & Target -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Strategy (Optional)</label>
              <select class="form-select" id="trade-strategy">
                <option value="">(None / Discretionary)</option>
                ${this.strategies.map(s => `
                  <option value="${s.id}" ${t.strategy_id === s.id || (t.setup && t.setup === s.name) ? 'selected' : ''}>${s.name}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Take Profit (Optional)</label>
              <input type="number" step="any" class="form-input font-mono" id="trade-tp" placeholder="Optional TP" value="${t.take_profit !== undefined && t.take_profit !== null ? t.take_profit : ''}">
            </div>
          </div>

          <!-- 5. Real-Time Auto-Calculation Preview Bar -->
          <div style="background: var(--surface-alt); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600;">Order Status & Risk</div>
              <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 2px;">
                <span id="preview-calc-pnl" class="font-mono" style="font-size: 15px; font-weight: 800;">$0.00</span>
                <span id="preview-calc-r" class="font-mono" style="font-size: 13px; font-weight: 700;">-</span>
                <span id="preview-calc-badge" class="badge" style="background:#EFF6FF; color:#1D4ED8;">OPEN</span>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 10px; color: var(--text-tertiary);">Planned RR</div>
              <div id="preview-calc-rr" class="font-mono" style="font-size: 12px; font-weight: 600;">-</div>
            </div>
          </div>

          <!-- 6. Screenshot Upload (Primary Proof) -->
          <div class="form-group">
            <label class="form-label" style="font-weight: 600;">📷 Entry Screenshot (Drag or Paste)</label>
            <div id="quick-screenshot-container"></div>
          </div>

          <!-- Optional Collapsible Timestamp -->
          <div style="display: flex; gap: 10px; font-size: 11px;">
            <div style="flex: 1;">
              <label class="form-label">Date</label>
              <input type="date" class="form-input" id="trade-date" value="${defaultDate}">
            </div>
            <div style="flex: 1;">
              <label class="form-label">Time</label>
              <input type="time" class="form-input" id="trade-time" value="${defaultTime}">
            </div>
          </div>
        </div>

        <div class="modal-footer" style="padding: 10px 18px;">
          <button class="btn" id="modal-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="modal-save-btn" style="padding: 7px 18px; font-size: 13px; font-weight: 700;">
            ✓ Save Order (开仓入场)
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // 绑定 Direction 切换
    const btnLong = overlay.querySelector('#btn-dir-long');
    const btnShort = overlay.querySelector('#btn-dir-short');
    const hiddenDir = overlay.querySelector('#trade-direction');

    const updateDirStyles = () => {
      if (hiddenDir.value === 'LONG') {
        btnLong.style.backgroundColor = 'var(--profit-bg)';
        btnLong.style.borderColor = 'var(--profit-color)';
        btnLong.style.color = 'var(--profit-color)';

        btnShort.style.backgroundColor = 'var(--surface)';
        btnShort.style.borderColor = 'var(--border-strong)';
        btnShort.style.color = 'var(--text-secondary)';
      } else {
        btnShort.style.backgroundColor = 'var(--loss-bg)';
        btnShort.style.borderColor = 'var(--loss-color)';
        btnShort.style.color = 'var(--loss-color)';

        btnLong.style.backgroundColor = 'var(--surface)';
        btnLong.style.borderColor = 'var(--border-strong)';
        btnLong.style.color = 'var(--text-secondary)';
      }
    };
    updateDirStyles();

    btnLong.addEventListener('click', () => {
      hiddenDir.value = 'LONG';
      updateDirStyles();
      updatePreview();
    });

    btnShort.addEventListener('click', () => {
      hiddenDir.value = 'SHORT';
      updateDirStyles();
      updatePreview();
    });

    // 绑定 Exit Type 切换按钮与原因框联动
    const outcomeSection = overlay.querySelector('#modal-exit-outcome-section');
    const exitTypeButtons = overlay.querySelectorAll('.btn-modal-exit-type');
    const reasonBox = overlay.querySelector('#modal-early-reason-box');
    const reasonInput = overlay.querySelector('#modal-early-reason-input');

    const updateExitTypeUI = (type) => {
      this.currentExitType = type;
      exitTypeButtons.forEach(b => {
        if (b.dataset.type === type) b.classList.add('btn-primary');
        else b.classList.remove('btn-primary');
      });

      if (reasonBox) {
        if (type === 'EARLY_PROFIT' || type === 'EARLY_LOSS') {
          reasonBox.style.display = 'block';
          if (reasonInput) reasonInput.focus();
        } else {
          reasonBox.style.display = 'none';
        }
      }
    };

    exitTypeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        updateExitTypeUI(btn.dataset.type);
        updatePreview();
      });
    });

    // 绑定提早关闭预设原因标签
    overlay.querySelectorAll('.btn-modal-reason-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (reasonInput) {
          reasonInput.value = chip.dataset.text;
          this.currentEarlyCloseReason = chip.dataset.text;
        }
      });
    });

    if (reasonInput) {
      reasonInput.addEventListener('input', () => {
        this.currentEarlyCloseReason = reasonInput.value;
      });
    }

    // 初始化截图组件
    const screenshotContainer = overlay.querySelector('#quick-screenshot-container');
    const uploader = new ScreenshotUploader({
      container: screenshotContainer,
      initialScreenshots: this.initialScreenshots,
      onChange: (newScreenshots) => {
        this.pendingScreenshots = newScreenshots;
      }
    });

    // 支持剪贴板粘贴截图 (Ctrl+V)
    overlay.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          uploader.handleFiles([blob]);
        }
      }
    });

    // 实时全自动计算逻辑
    const updatePreview = () => {
      const dir = hiddenDir.value;
      const entry = overlay.querySelector('#trade-entry').value;
      const exit = overlay.querySelector('#trade-exit').value.trim();
      const size = overlay.querySelector('#trade-size').value;
      const sl = overlay.querySelector('#trade-sl').value;
      const tp = overlay.querySelector('#trade-tp').value;

      const calc = autoCalculateTrade({
        direction: dir,
        entry_price: entry,
        exit_price: exit !== '' ? exit : null,
        position_size: size,
        stop_loss: sl,
        take_profit: tp,
        exit_type: this.currentExitType,
        early_close_reason: this.currentEarlyCloseReason
      });

      const pnlEl = overlay.querySelector('#preview-calc-pnl');
      const rEl = overlay.querySelector('#preview-calc-r');
      const badgeEl = overlay.querySelector('#preview-calc-badge');
      const rrEl = overlay.querySelector('#preview-calc-rr');
      const saveBtn = overlay.querySelector('#modal-save-btn');

      if (calc.status === 'OPEN') {
        if (outcomeSection) outcomeSection.style.display = 'none';
        pnlEl.textContent = calc.initialRiskAmount ? `Risk: -$${calc.initialRiskAmount.toFixed(2)}` : 'Risk: $0.00';
        pnlEl.className = 'font-mono text-neutral';
        rEl.textContent = '1.00R (Risk)';
        rEl.className = 'font-mono text-neutral';
        badgeEl.textContent = 'OPEN (持仓中)';
        badgeEl.className = 'badge';
        badgeEl.style.background = '#EFF6FF';
        badgeEl.style.color = '#1D4ED8';
        if (saveBtn) saveBtn.textContent = '✓ Save Order (开仓入场)';
      } else {
        if (outcomeSection) outcomeSection.style.display = 'block';
        if (!this.currentExitType && calc.exitType) {
          updateExitTypeUI(calc.exitType);
        }

        pnlEl.textContent = formatCurrency(calc.netPnl);
        pnlEl.className = `font-mono ${calc.netPnl > 0 ? 'text-profit' : (calc.netPnl < 0 ? 'text-loss' : 'text-neutral')}`;
        rEl.textContent = calc.r !== null ? formatR(calc.r) : '-';
        rEl.className = `font-mono ${calc.r > 0 ? 'text-profit' : (calc.r < 0 ? 'text-loss' : 'text-neutral')}`;
        
        let badgeText = calc.result;
        if (this.currentExitType === 'TP') badgeText = 'Take Profit';
        else if (this.currentExitType === 'BE') badgeText = 'Break Even';
        else if (this.currentExitType === 'SL') badgeText = 'Stop Loss';
        else if (this.currentExitType === 'EARLY_PROFIT') badgeText = 'Early (Win)';
        else if (this.currentExitType === 'EARLY_LOSS') badgeText = 'Early (Loss)';

        badgeEl.textContent = badgeText;
        badgeEl.className = `badge ${calc.netPnl > 0 ? 'badge-win' : (calc.netPnl < 0 ? 'badge-loss' : 'badge-be')}`;
        badgeEl.style.background = '';
        badgeEl.style.color = '';
        if (saveBtn) saveBtn.textContent = '✓ Save Closed Trade (已平仓)';
      }

      rrEl.textContent = calc.plannedRR !== null ? formatRR(calc.plannedRR) : '-';
    };

    ['trade-entry', 'trade-exit', 'trade-size', 'trade-sl', 'trade-tp'].forEach(id => {
      overlay.querySelector(`#${id}`).addEventListener('input', updatePreview);
    });

    updatePreview();

    const close = () => document.body.removeChild(overlay);
    overlay.querySelector('.modal-close-btn').addEventListener('click', close);
    overlay.querySelector('#modal-cancel-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    overlay.querySelector('#modal-save-btn').addEventListener('click', async () => {
      const selectedStratId = overlay.querySelector('#trade-strategy').value;
      const selectedStratObj = this.strategies.find(s => s.id === selectedStratId);

      const exitRaw = overlay.querySelector('#trade-exit').value.trim();
      const exitPrice = exitRaw !== '' ? Number(exitRaw) : null;
      const status = exitPrice !== null ? 'CLOSED' : 'OPEN';

      const currentReason = reasonInput ? reasonInput.value.trim() : this.currentEarlyCloseReason;

      const rawPayload = {
        date: overlay.querySelector('#trade-date').value,
        time: overlay.querySelector('#trade-time').value,
        symbol: overlay.querySelector('#trade-symbol').value.toUpperCase().trim(),
        direction: hiddenDir.value,
        entry_price: Number(overlay.querySelector('#trade-entry').value),
        exit_price: exitPrice,
        status: status,
        exit_type: status === 'CLOSED' ? (this.currentExitType || 'TP') : null,
        early_close_reason: (status === 'CLOSED' && (this.currentExitType === 'EARLY_PROFIT' || this.currentExitType === 'EARLY_LOSS')) ? currentReason : '',
        position_size: Number(overlay.querySelector('#trade-size').value) || 1,
        stop_loss: Number(overlay.querySelector('#trade-sl').value),
        take_profit: overlay.querySelector('#trade-tp').value !== '' ? Number(overlay.querySelector('#trade-tp').value) : null,
        
        strategy_id: selectedStratId || '',
        setup: selectedStratObj ? selectedStratObj.name : (t.setup || ''),
        
        // 自动计算值补充
        fees: 0,
        followed_plan: t.followed_plan !== undefined ? t.followed_plan : true,
        rating: t.rating || 'A',
        mistake: t.mistake || '',
        emotion: t.emotion || 'Calm',
        notes: t.notes || ''
      };

      if (this.mode === 'BACKTEST') {
        rawPayload.book_id = this.bookId;
      }

      if (isEdit) {
        rawPayload.id = this.trade.id;
        rawPayload.created_at = this.trade.created_at;
      }

      const validation = validateTradeInput(rawPayload);
      const warningsBox = overlay.querySelector('#modal-warnings-container');

      if (!validation.isValid) {
        warningsBox.innerHTML = `
          <div class="form-warning-box" style="background:#FEF2F2;border-color:#FECACA;color:#B91C1C;padding:6px 10px;font-size:11px;">
            ${validation.errors.map(err => `<div>• ${err}</div>`).join('')}
          </div>
        `;
        if (warningsBox.scrollIntoView) warningsBox.scrollIntoView();
        return;
      }

      try {
        overlay.querySelector('#modal-save-btn').disabled = true;
        overlay.querySelector('#modal-save-btn').textContent = 'Saving...';
        await this.onSave(rawPayload, this.pendingScreenshots);
        close();
      } catch (err) {
        console.error('Save trade failed:', err);
        alert('Failed to save trade: ' + err.message);
        overlay.querySelector('#modal-save-btn').disabled = false;
        overlay.querySelector('#modal-save-btn').textContent = 'Save Trade';
      }
    });
  }
}
