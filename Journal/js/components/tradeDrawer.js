/**
 * tradeDrawer.js
 * 30 秒极速单笔复盘抽屉（Trade Review Drawer）：
 * 支持完整的「下单开仓 → 结果平仓二次录入 → 30秒复盘」闭环：
 * 
 * 出场结果分为 5 类：
 * 1. Take Profit (止盈出场 - TP)
 * 2. Break Even (保本出场 - BE)
 * 3. Stop Loss (止损出场 - SL)
 * 4. 提早关闭 (盈利地提早关闭 - Early Profit) - 必须写原因
 * 5. 提早关闭 (亏损地提早关闭 - Early Loss) - 必须写原因
 */

import { formatCurrency, formatR, formatRR, formatPrice } from '../core/formatters.js';
import { deriveTradeMetrics, autoCalculateTrade } from '../core/calculations.js';
import { ScreenshotUploader } from './screenshotUploader.js';
import { LiveRepo } from '../db/liveRepo.js';
import { BacktestRepo } from '../db/backtestRepo.js';

export class TradeDrawer {
  constructor(options = {}) {
    this.trade = options.trade;
    this.screenshots = options.screenshots || [];
    this.mode = options.mode || 'LIVE';
    this.focusClose = options.focusClose || false;
    this.onEdit = options.onEdit || (() => {});
    this.onDelete = options.onDelete || (async () => {});
    this.onUpdated = options.onUpdated || (() => {});
    this.onClose = options.onClose || (() => {});

    // 当前抽屉草稿状态
    this.currentFollowedPlan = this.trade.followed_plan !== false;
    this.currentRating = this.trade.rating || 'A';
    this.currentMistake = this.trade.mistake || 'None';
    this.currentEmotion = this.trade.emotion || 'Calm';

    // 出场结果类型与原因
    const d = deriveTradeMetrics(this.trade).derived;
    this.currentExitType = this.trade.exit_type || (d.result === 'WIN' ? 'TP' : (d.result === 'LOSS' ? 'SL' : (d.result === 'OPEN' ? 'TP' : 'BE')));
    this.currentEarlyCloseReason = this.trade.early_close_reason || '';

    this.init();
  }

  init() {
    this.render();
  }

  render() {
    if (!this.trade) return;
    const derivedTrade = deriveTradeMetrics(this.trade);
    const d = derivedTrade.derived;
    const raw = this.trade;
    const isOpen = d.status === 'OPEN' || raw.exit_price === null || raw.exit_price === undefined || String(raw.exit_price).trim() === '';

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';

    const pnlClass = d.netPnl > 0 ? 'text-profit' : (d.netPnl < 0 ? 'text-loss' : 'text-neutral');
    const badgeSideClass = raw.direction === 'LONG' ? 'badge-long' : 'badge-short';

    const renderHeaderBadge = () => {
      if (isOpen) {
        return '<span class="badge" style="background:#EFF6FF; color:#1D4ED8; font-weight:700;">OPEN (持仓中)</span>';
      }
      const type = raw.exit_type || d.exitType || d.result;
      if (type === 'TP' || type === 'TAKE_PROFIT') {
        return '<span class="badge badge-win">Take Profit</span>';
      }
      if (type === 'BE' || type === 'BREAK_EVEN') {
        return '<span class="badge badge-be">Break Even</span>';
      }
      if (type === 'SL' || type === 'STOP_LOSS') {
        return '<span class="badge badge-loss">Stop Loss</span>';
      }
      if (type === 'EARLY_PROFIT') {
        return '<span class="badge" style="background:#ECFDF5; color:#047857; border:1px solid #A7F3D0; font-weight:700;">Early (Win)</span>';
      }
      if (type === 'EARLY_LOSS') {
        return '<span class="badge" style="background:#FEF2F2; color:#B91C1C; border:1px solid #FECACA; font-weight:700;">Early (Loss)</span>';
      }
      return `<span class="badge ${d.result === 'WIN' ? 'badge-win' : (d.result === 'LOSS' ? 'badge-loss' : 'badge-be')}">${d.result}</span>`;
    };

    overlay.innerHTML = `
      <div class="drawer-container" style="width: 580px;">
        <div class="drawer-header" style="padding: 12px 18px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge ${badgeSideClass}">${raw.direction}</span>
            <span id="drawer-header-badge-host">${renderHeaderBadge()}</span>
            <span style="font-weight: 700; font-size: 13px;">${raw.symbol}</span>
            <span style="font-size: 11px; color: var(--text-tertiary);">${raw.date} ${raw.time || ''}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button class="btn btn-sm btn-danger" id="drawer-delete-btn">Delete</button>
            <button class="modal-close-btn" style="margin-left: 8px;">&times;</button>
          </div>
        </div>

        <div class="drawer-body" style="padding: 16px; gap: 14px;">
          <!-- 1. Hero Summary Numbers -->
          <div class="drawer-trade-hero" style="padding: 10px 14px;">
            <div>
              <div style="font-size: 16px; font-weight: 800;">${raw.symbol}</div>
              <div style="font-size: 11px; color: var(--text-secondary);">${raw.setup || 'Discretionary'} • Size: ${raw.position_size || 1}</div>
            </div>
            <div style="text-align: right;">
              ${isOpen ? `
                <div class="hero-pnl-val text-neutral" style="font-size: 14px; font-weight: 700;">Risk: -$${(d.initialRiskAmount || 0).toFixed(2)}</div>
                <div class="hero-r-val text-neutral" style="font-size: 12px;">Planned RR: ${d.plannedRR !== null ? formatRR(d.plannedRR) : '-'}</div>
              ` : `
                <div class="hero-pnl-val ${pnlClass}">${formatCurrency(d.netPnl)}</div>
                <div class="hero-r-val ${pnlClass}" style="font-size: 13px; font-weight: 700;">${formatR(d.r)}</div>
              `}
            </div>
          </div>

          <!-- 2. 二次录入平仓出场模块 (针对持仓中的订单) -->
          ${isOpen ? `
            <div style="background: var(--surface); border: 2px solid #3B82F6; border-radius: var(--radius-sm); padding: 14px; margin-bottom: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="font-weight: 700; font-size: 13px; color: #1D4ED8; display: flex; align-items: center; gap: 6px;">
                  ⚡ 平仓二次录入 (Close Position)
                </div>
                <span style="font-size: 11px; color: var(--text-secondary);">输入出场价计算最终输赢</span>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                <div>
                  <label class="form-label" style="font-weight: 700; color: #1E3A8A;">Exit Price (平仓价格) *</label>
                  <input type="number" step="any" class="form-input font-mono" id="drawer-exit-input" placeholder="输入平仓成交价" style="font-weight: 700; font-size: 14px; border-color: #93C5FD;">
                </div>
                <div>
                  <label class="form-label">Exit Date</label>
                  <input type="date" class="form-input" id="drawer-exit-date" value="${new Date().toISOString().slice(0, 10)}" style="font-size: 12px;">
                </div>
              </div>

              <!-- 实时平仓计算预览条 -->
              <div style="background: var(--surface-alt); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                  <span style="font-size: 11px; color: var(--text-tertiary);">实时计算:</span>
                  <span id="drawer-live-pnl" class="font-mono" style="font-weight: 800; font-size: 14px; margin-left: 6px;">-</span>
                  <span id="drawer-live-r" class="font-mono" style="font-size: 12px; margin-left: 6px;">-</span>
                </div>
                <span id="drawer-live-badge" class="badge" style="background:var(--surface-active); color:var(--text-secondary);">-</span>
              </div>

              <!-- 出场结果选择：TP / BE / SL / 提早关闭 (盈利) / 提早关闭 (亏损) -->
              <div class="form-group" style="margin-bottom: 10px;">
                <label class="form-label" style="font-weight: 700; color: #1E3A8A;">出场结果类型</label>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 6px;" id="drawer-exit-type-group">
                  <button type="button" class="btn btn-sm btn-exit-type ${this.currentExitType === 'TP' ? 'btn-primary' : ''}" data-type="TP" style="font-weight: 600;">🎯 Take Profit</button>
                  <button type="button" class="btn btn-sm btn-exit-type ${this.currentExitType === 'BE' ? 'btn-primary' : ''}" data-type="BE" style="font-weight: 600;">⚖️ Break Even</button>
                  <button type="button" class="btn btn-sm btn-exit-type ${this.currentExitType === 'SL' ? 'btn-primary' : ''}" data-type="SL" style="font-weight: 600;">🛑 Stop Loss</button>
                  <button type="button" class="btn btn-sm btn-exit-type ${this.currentExitType === 'EARLY_PROFIT' ? 'btn-primary' : ''}" data-type="EARLY_PROFIT" style="font-weight: 600; color:#047857;">⚡ 提早(盈利)</button>
                  <button type="button" class="btn btn-sm btn-exit-type ${this.currentExitType === 'EARLY_LOSS' ? 'btn-primary' : ''}" data-type="EARLY_LOSS" style="font-weight: 600; color:#B91C1C;">⚡ 提早(亏损)</button>
                </div>
              </div>

              <!-- 提早关闭原因 (必须写原因) -->
              <div class="form-group" id="drawer-early-reason-box" style="${(this.currentExitType === 'EARLY_PROFIT' || this.currentExitType === 'EARLY_LOSS') ? '' : 'display: none;'} margin-bottom: 12px; background: #FFF5F5; border: 1px dashed #FEB2B2; border-radius: var(--radius-xs); padding: 8px 10px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                  <label class="form-label" style="font-weight: 700; color: #C53030; margin-bottom: 0;">提早关闭原因 * (必填)</label>
                  <span style="font-size: 10px; color: #E53E3E;">不可留空</span>
                </div>
                <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px;">
                  <button type="button" class="btn btn-sm btn-reason-chip" data-text="盘口结构转变 (Structure Shift)" style="padding: 1px 6px; font-size: 10px;">结构转变</button>
                  <button type="button" class="btn btn-sm btn-reason-chip" data-text="动能衰竭/背离 (Loss of Momentum)" style="padding: 1px 6px; font-size: 10px;">动能衰竭</button>
                  <button type="button" class="btn btn-sm btn-reason-chip" data-text="重要数据公布避险 (News Event)" style="padding: 1px 6px; font-size: 10px;">数据公布</button>
                  <button type="button" class="btn btn-sm btn-reason-chip" data-text="恐慌/心态不稳提前平仓 (Panic / Emotion)" style="padding: 1px 6px; font-size: 10px;">恐慌提前平</button>
                  <button type="button" class="btn btn-sm btn-reason-chip" data-text="收盘/周末避险 (Session Close)" style="padding: 1px 6px; font-size: 10px;">收盘避险</button>
                </div>
                <input type="text" class="form-input" id="drawer-early-reason-input" placeholder="输入具体的提早平仓原因..." value="${this.currentEarlyCloseReason}" style="font-size: 12px; border-color: #FEB2B2; background: #FFFFFF;">
              </div>

              <button class="btn btn-primary" id="btn-drawer-close-trade" style="width: 100%; padding: 8px; font-weight: 700; font-size: 13px;">
                ✓ 确认平仓出场并保存复盘 (Close & Save)
              </button>
            </div>
          ` : ''}

          <!-- 3. Trade Execution Numbers Table (Compact) -->
          <div class="detail-section">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div class="detail-section-title">Execution Raw Data</div>
              ${!isOpen ? `<span style="font-size: 11px; color: var(--text-tertiary);">Status: CLOSED</span>` : ''}
            </div>
            <div class="detail-grid" style="font-size: 11.5px;">
              <div class="detail-row"><span class="detail-row-label">Entry Price</span><span class="font-mono">${formatPrice(raw.entry_price)}</span></div>
              <div class="detail-row">
                <span class="detail-row-label">Exit Price</span>
                <span class="font-mono">${isOpen ? '<span style="color:var(--text-tertiary);">Pending</span>' : formatPrice(raw.exit_price)}</span>
              </div>
              <div class="detail-row"><span class="detail-row-label">Stop Loss</span><span class="font-mono">${formatPrice(raw.stop_loss)}</span></div>
              <div class="detail-row"><span class="detail-row-label">Planned RR</span><span class="font-mono">${d.plannedRR !== null ? formatRR(d.plannedRR) : '-'}</span></div>
              <div class="detail-row"><span class="detail-row-label">Risk $</span><span class="font-mono">${formatCurrency(d.initialRiskAmount, false)}</span></div>
              <div class="detail-row">
                <span class="detail-row-label">Net P&L</span>
                <span class="font-mono ${pnlClass}">${isOpen ? '-' : formatCurrency(d.netPnl)}</span>
              </div>
            </div>

            <!-- 若已平仓，允许修改出场类型与原因 -->
            ${!isOpen ? `
              <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-subtle);">
                <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">
                  出场结果类型:
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(95px, 1fr)); gap: 6px;" id="drawer-exit-type-group">
                  <button type="button" class="btn btn-sm btn-exit-type ${this.currentExitType === 'TP' ? 'btn-primary' : ''}" data-type="TP" style="font-weight: 600;">🎯 Take Profit</button>
                  <button type="button" class="btn btn-sm btn-exit-type ${this.currentExitType === 'BE' ? 'btn-primary' : ''}" data-type="BE" style="font-weight: 600;">⚖️ Break Even</button>
                  <button type="button" class="btn btn-sm btn-exit-type ${this.currentExitType === 'SL' ? 'btn-primary' : ''}" data-type="SL" style="font-weight: 600;">🛑 Stop Loss</button>
                  <button type="button" class="btn btn-sm btn-exit-type ${this.currentExitType === 'EARLY_PROFIT' ? 'btn-primary' : ''}" data-type="EARLY_PROFIT" style="font-weight: 600; color:#047857;">⚡ 提早(盈利)</button>
                  <button type="button" class="btn btn-sm btn-exit-type ${this.currentExitType === 'EARLY_LOSS' ? 'btn-primary' : ''}" data-type="EARLY_LOSS" style="font-weight: 600; color:#B91C1C;">⚡ 提早(亏损)</button>
                </div>

                <div class="form-group" id="drawer-early-reason-box" style="${(this.currentExitType === 'EARLY_PROFIT' || this.currentExitType === 'EARLY_LOSS') ? '' : 'display: none;'} margin-top: 8px; background: #FFF5F5; border: 1px dashed #FEB2B2; border-radius: var(--radius-xs); padding: 8px 10px;">
                  <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                    <label class="form-label" style="font-weight: 700; color: #C53030; margin-bottom: 0;">提早关闭原因 * (必填)</label>
                    <span style="font-size: 10px; color: #E53E3E;">不可留空</span>
                  </div>
                  <input type="text" class="form-input" id="drawer-early-reason-input" placeholder="输入具体的提早平仓原因..." value="${this.currentEarlyCloseReason}" style="font-size: 12px; border-color: #FEB2B2; background: #FFFFFF;">
                </div>
              </div>
            ` : ''}
          </div>

          <!-- 4. Visual First: Primary Screenshots Gallery -->
          <div class="detail-section">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div class="detail-section-title">📷 Chart Screenshots (Visual Proof)</div>
              <span style="font-size: 10.5px; color: var(--text-tertiary);">${this.screenshots.length} captured</span>
            </div>
            <div id="drawer-screenshots-container" style="margin-top: 4px;"></div>
          </div>

          <!-- 5. The 30-Second Fast Review Buttons Bar -->
          <div style="background: var(--surface-alt); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.3px;">
              ⚡ 30-Second Trade Review
            </div>

            <!-- Execution Discipline: Followed Plan vs Broke Plan -->
            <div class="form-group">
              <label class="form-label" style="font-weight: 600;">Plan Execution</label>
              <div style="display: flex; gap: 6px;">
                <button type="button" class="btn btn-sm btn-plan-toggle ${this.currentFollowedPlan ? 'btn-primary' : ''}" id="btn-plan-yes" style="flex: 1;">
                  ☑ Followed Plan
                </button>
                <button type="button" class="btn btn-sm btn-plan-toggle ${!this.currentFollowedPlan ? 'btn-danger' : ''}" id="btn-plan-no" style="flex: 1;">
                  ✗ Broke Plan
                </button>
              </div>
            </div>

            <!-- Grade Rating: A+ / A / B / C -->
            <div class="form-group">
              <label class="form-label" style="font-weight: 600;">Trade Rating (Execution quality ≠ Profit)</label>
              <div style="display: flex; gap: 6px;" id="rating-buttons-group">
                ${['A+', 'A', 'B', 'C'].map(r => `
                  <button type="button" class="btn btn-sm btn-rating-opt ${this.currentRating === r ? 'btn-primary' : ''}" data-val="${r}" style="flex: 1; font-weight: 700;">
                    ${r}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Mistakes Quick Tags -->
            <div class="form-group">
              <label class="form-label" style="font-weight: 600;">Mistake (if any)</label>
              <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="mistake-buttons-group">
                ${['None', 'FOMO', 'Early Entry', 'Late Entry', 'Moved SL', 'Oversized', 'Overtrade', 'Other'].map(m => `
                  <button type="button" class="btn btn-sm btn-mistake-opt ${this.currentMistake === m ? 'btn-primary' : ''}" data-val="${m}" style="padding: 2px 7px; font-size: 10.5px;">
                    ${m}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Emotion Quick Tags -->
            <div class="form-group">
              <label class="form-label" style="font-weight: 600;">Emotion State</label>
              <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="emotion-buttons-group">
                ${['Calm', 'Focused', 'FOMO', 'Fear', 'Greed', 'Revenge'].map(e => `
                  <button type="button" class="btn btn-sm btn-emotion-opt ${this.currentEmotion === e ? 'btn-primary' : ''}" data-val="${e}" style="padding: 2px 7px; font-size: 10.5px;">
                    ${e}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Optional Note -->
            <div class="form-group">
              <label class="form-label">Review Note (Optional - keep it short or leave blank)</label>
              <input type="text" class="form-input" id="drawer-quick-note" placeholder="Quick takeaway..." value="${raw.notes || ''}">
            </div>

            ${!isOpen ? `
              <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
                <button class="btn btn-primary btn-sm" id="btn-save-drawer-review" style="padding: 6px 14px; font-weight: 700;">
                  ✓ Save Review
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // 渲染截图
    const scContainer = overlay.querySelector('#drawer-screenshots-container');
    new ScreenshotUploader({
      container: scContainer,
      initialScreenshots: this.screenshots,
      readOnly: true
    });

    // 绑定 Exit Type 切换按钮与原因框联动
    const exitTypeButtons = overlay.querySelectorAll('.btn-exit-type');
    const reasonBox = overlay.querySelector('#drawer-early-reason-box');
    const reasonInput = overlay.querySelector('#drawer-early-reason-input');

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
      });
    });

    // 绑定提早关闭预设原因标签
    overlay.querySelectorAll('.btn-reason-chip').forEach(chip => {
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

    // 实时平仓计算预览与智能推断
    const exitInput = overlay.querySelector('#drawer-exit-input');
    if (exitInput) {
      exitInput.addEventListener('input', () => {
        const val = exitInput.value.trim();
        const pnlEl = overlay.querySelector('#drawer-live-pnl');
        const rEl = overlay.querySelector('#drawer-live-r');
        const badgeEl = overlay.querySelector('#drawer-live-badge');

        if (!val || isNaN(Number(val))) {
          pnlEl.textContent = '-';
          pnlEl.className = 'font-mono';
          rEl.textContent = '-';
          badgeEl.textContent = '-';
          badgeEl.className = 'badge';
          badgeEl.style.background = 'var(--surface-active)';
          badgeEl.style.color = 'var(--text-secondary)';
          return;
        }

        const calc = autoCalculateTrade({
          direction: raw.direction,
          entry_price: raw.entry_price,
          exit_price: Number(val),
          position_size: raw.position_size || 1,
          stop_loss: raw.stop_loss,
          take_profit: raw.take_profit
        });

        pnlEl.textContent = formatCurrency(calc.netPnl);
        pnlEl.className = `font-mono ${calc.netPnl > 0 ? 'text-profit' : (calc.netPnl < 0 ? 'text-loss' : 'text-neutral')}`;
        rEl.textContent = calc.r !== null ? formatR(calc.r) : '-';
        rEl.className = `font-mono ${calc.r > 0 ? 'text-profit' : (calc.r < 0 ? 'text-loss' : 'text-neutral')}`;

        badgeEl.textContent = calc.result;
        badgeEl.className = `badge ${calc.result === 'TP' || calc.result === 'EARLY_PROFIT' ? 'badge-win' : (calc.result === 'SL' || calc.result === 'EARLY_LOSS' ? 'badge-loss' : 'badge-be')}`;
        badgeEl.style.background = '';
        badgeEl.style.color = '';

        // 智能自动推荐 exitType (如果用户还未手动修改)
        if (calc.exitType) {
          updateExitTypeUI(calc.exitType);
        }
      });

      if (this.focusClose) {
        setTimeout(() => exitInput.focus(), 100);
      }
    }

    // 绑定 Plan Execution 按钮
    const btnPlanYes = overlay.querySelector('#btn-plan-yes');
    const btnPlanNo = overlay.querySelector('#btn-plan-no');

    btnPlanYes.addEventListener('click', () => {
      this.currentFollowedPlan = true;
      btnPlanYes.classList.add('btn-primary');
      btnPlanNo.classList.remove('btn-danger');
    });

    btnPlanNo.addEventListener('click', () => {
      this.currentFollowedPlan = false;
      btnPlanNo.classList.add('btn-danger');
      btnPlanYes.classList.remove('btn-primary');
    });

    // 绑定 Rating 按钮
    overlay.querySelectorAll('.btn-rating-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.btn-rating-opt').forEach(b => b.classList.remove('btn-primary'));
        btn.classList.add('btn-primary');
        this.currentRating = btn.dataset.val;
      });
    });

    // 绑定 Mistake 按钮
    overlay.querySelectorAll('.btn-mistake-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.btn-mistake-opt').forEach(b => b.classList.remove('btn-primary'));
        btn.classList.add('btn-primary');
        this.currentMistake = btn.dataset.val;
      });
    });

    // 绑定 Emotion 按钮
    overlay.querySelectorAll('.btn-emotion-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.btn-emotion-opt').forEach(b => b.classList.remove('btn-primary'));
        btn.classList.add('btn-primary');
        this.currentEmotion = btn.dataset.val;
      });
    });

    const close = () => {
      document.body.removeChild(overlay);
      this.onClose();
    };

    overlay.querySelector('.modal-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    // 确认平仓出场 (针对 OPEN 订单二次录入)
    const btnCloseTrade = overlay.querySelector('#btn-drawer-close-trade');
    if (btnCloseTrade) {
      btnCloseTrade.addEventListener('click', async () => {
        const exitVal = exitInput ? exitInput.value.trim() : '';
        if (!exitVal || isNaN(Number(exitVal))) {
          alert('Please enter a valid Exit Price to close this trade.');
          if (exitInput) exitInput.focus();
          return;
        }

        // 校验提早关闭原因
        const currentReason = reasonInput ? reasonInput.value.trim() : this.currentEarlyCloseReason;
        if (this.currentExitType === 'EARLY_PROFIT' || this.currentExitType === 'EARLY_LOSS') {
          if (!currentReason) {
            alert('提早关闭必须填写原因 (Reason for early close is required).');
            if (reasonInput) reasonInput.focus();
            return;
          }
        }

        const exitPrice = Number(exitVal);
        const exitDate = overlay.querySelector('#drawer-exit-date') ? overlay.querySelector('#drawer-exit-date').value : raw.date;

        const updatedRecord = {
          ...raw,
          exit_price: exitPrice,
          exit_date: exitDate,
          status: 'CLOSED',
          exit_type: this.currentExitType,
          early_close_reason: (this.currentExitType === 'EARLY_PROFIT' || this.currentExitType === 'EARLY_LOSS') ? currentReason : '',
          followed_plan: this.currentFollowedPlan,
          rating: this.currentRating,
          mistake: this.currentMistake === 'None' ? '' : this.currentMistake,
          emotion: this.currentEmotion,
          notes: overlay.querySelector('#drawer-quick-note') ? overlay.querySelector('#drawer-quick-note').value.trim() : (raw.notes || '')
        };

        if (this.mode === 'BACKTEST') {
          await BacktestRepo.saveTrade(updatedRecord);
        } else {
          await LiveRepo.saveTrade(updatedRecord);
        }

        this.onUpdated(updatedRecord);
        close();
      });
    }

    // 保存 30 秒补充结果 (针对已平仓订单)
    const btnSaveReview = overlay.querySelector('#btn-save-drawer-review');
    if (btnSaveReview) {
      btnSaveReview.addEventListener('click', async () => {
        // 校验提早关闭原因
        const currentReason = reasonInput ? reasonInput.value.trim() : this.currentEarlyCloseReason;
        if (this.currentExitType === 'EARLY_PROFIT' || this.currentExitType === 'EARLY_LOSS') {
          if (!currentReason) {
            alert('提早关闭必须填写原因 (Reason for early close is required).');
            if (reasonInput) reasonInput.focus();
            return;
          }
        }

        const updatedRecord = {
          ...raw,
          exit_type: this.currentExitType,
          early_close_reason: (this.currentExitType === 'EARLY_PROFIT' || this.currentExitType === 'EARLY_LOSS') ? currentReason : '',
          followed_plan: this.currentFollowedPlan,
          rating: this.currentRating,
          mistake: this.currentMistake === 'None' ? '' : this.currentMistake,
          emotion: this.currentEmotion,
          notes: overlay.querySelector('#drawer-quick-note').value.trim()
        };

        if (this.mode === 'BACKTEST') {
          await BacktestRepo.saveTrade(updatedRecord);
        } else {
          await LiveRepo.saveTrade(updatedRecord);
        }

        this.onUpdated(updatedRecord);
        close();
      });
    }

    // 删除
    overlay.querySelector('#drawer-delete-btn').addEventListener('click', async () => {
      if (confirm(`Delete Trade ${raw.symbol}?`)) {
        await this.onDelete(raw.id);
        close();
      }
    });
  }
}
