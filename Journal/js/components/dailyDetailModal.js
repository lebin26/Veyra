/**
 * dailyDetailModal.js
 * When clicking any trading day in the Calendar, displays:
 * - Date header & Net P&L
 * - Daily trade sequence / intraday P&L chart
 * - Daily key metrics (Total Trades, Winners, Losers, Winrate, Gross P&L, Commissions, Volume, Profit Factor)
 * - That day's trades execution table
 * - Add daily review note
 */
import { formatCurrency, formatR, formatPercent } from '../core/formatters.js';
import { DailyJournalRepo } from '../db/dailyJournalRepo.js';

export class DailyDetailModal {
  constructor(options = {}) {
    this.dateKey = options.dateKey; // 'YYYY-MM-DD'
    this.dayTrades = options.trades || [];
    this.onClose = options.onClose || (() => {});
    this.onViewTrades = options.onViewTrades || (() => {});
    this.journalEntry = null;
    this.modalEl = null;
    this.init();
  }

  async init() {
    this.journalEntry = await DailyJournalRepo.getJournalByDate(this.dateKey);
    this.render();
  }

  render() {
    const existing = document.getElementById('modal-daily-detail');
    if (existing) existing.remove();

    const d = new Date(this.dateKey + 'T00:00:00');
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDate = `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;

    // Compute day metrics
    const totalTrades = this.dayTrades.length;
    let netPnl = 0;
    let grossWin = 0;
    let grossLoss = 0;
    let winners = 0;
    let losers = 0;
    let volume = 0;
    let commissions = 0;

    this.dayTrades.forEach(t => {
      const p = Number(t.pnl) || 0;
      netPnl += p;
      if (p > 0) {
        grossWin += p;
        winners++;
      } else if (p < 0) {
        grossLoss += Math.abs(p);
        losers++;
      }
      volume += Number(t.lot_size) || 1;
      commissions += Number(t.commission) || 0;
    });

    const winrate = totalTrades > 0 ? (winners / totalTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? (grossWin / grossLoss) : (grossWin > 0 ? 99.9 : 0);
    const pnlColorClass = netPnl >= 0 ? 'color: var(--color-profit);' : 'color: var(--color-loss);';

    // Intraday sequence path
    let cur = 0;
    const sequencePoints = [{ x: 0, y: 0 }];
    this.dayTrades.forEach((t, i) => {
      cur += Number(t.pnl) || 0;
      sequencePoints.push({ x: i + 1, y: cur });
    });

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-daily-detail';

    overlay.innerHTML = `
      <div class="modal-content" style="width: 840px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column;">
        <!-- Header -->
        <div class="modal-header" style="padding: 16px 22px; border-bottom: 1px solid var(--border-default); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: baseline; gap: 14px;">
            <span style="font-size: 17px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em;">${formattedDate}</span>
            <span style="font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; ${pnlColorClass}">
              Net P&L ${formatCurrency(netPnl)}
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-daily-add-note">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              ${this.journalEntry ? 'Edit Note' : 'Add Note'}
            </button>
            <button type="button" class="modal-close-btn" id="btn-close-daily">&times;</button>
          </div>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding: 20px 22px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px;">
          <!-- 1. Intraday P&L Progression SVG Chart -->
          <div style="background: var(--fill-subtle); border: 1px solid var(--border-default); border-radius: var(--radius-panel); padding: 14px 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em;">
              <span>Intraday P&L Progression</span>
              <span class="tabular-nums">${totalTrades} Closed Executions</span>
            </div>
            <div style="height: 110px; width: 100%;">
              ${this.renderSequenceSvg(sequencePoints, netPnl)}
            </div>
          </div>

          <!-- 2. Daily Metrics Grid (8 Core Quantitative Metrics) -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            <div class="kpi-card" style="padding: 10px 14px;">
              <span class="kpi-label">Total Trades</span>
              <span class="kpi-value tabular-nums" style="font-size: 18px;">${totalTrades}</span>
            </div>
            <div class="kpi-card" style="padding: 10px 14px;">
              <span class="kpi-label">Winners</span>
              <span class="kpi-value tabular-nums" style="font-size: 18px; color: var(--color-profit);">${winners}</span>
            </div>
            <div class="kpi-card" style="padding: 10px 14px;">
              <span class="kpi-label">Gross P&L</span>
              <span class="kpi-value tabular-nums" style="font-size: 18px;">${formatCurrency(grossWin)}</span>
            </div>
            <div class="kpi-card" style="padding: 10px 14px;">
              <span class="kpi-label">Commissions</span>
              <span class="kpi-value tabular-nums" style="font-size: 18px;">${formatCurrency(commissions)}</span>
            </div>
            <div class="kpi-card" style="padding: 10px 14px;">
              <span class="kpi-label">Winrate</span>
              <span class="kpi-value tabular-nums" style="font-size: 18px;">${winrate.toFixed(2)}%</span>
            </div>
            <div class="kpi-card" style="padding: 10px 14px;">
              <span class="kpi-label">Losers</span>
              <span class="kpi-value tabular-nums" style="font-size: 18px; color: var(--color-loss);">${losers}</span>
            </div>
            <div class="kpi-card" style="padding: 10px 14px;">
              <span class="kpi-label">Volume</span>
              <span class="kpi-value tabular-nums" style="font-size: 18px;">${volume.toFixed(1)}</span>
            </div>
            <div class="kpi-card" style="padding: 10px 14px;">
              <span class="kpi-label">Profit Factor</span>
              <span class="kpi-value tabular-nums" style="font-size: 18px;">${profitFactor > 50 ? 'MAX' : profitFactor.toFixed(2)}</span>
            </div>
          </div>

          <!-- 3. Daily Trades Execution Table -->
          <div>
            <div style="font-size: 12px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">Executed Trades on this Day</div>
            <div class="table-container" style="max-height: 240px; overflow-y: auto;">
              <table class="table">
                <thead>
                  <tr class="table-header">
                    <th>Open Time</th>
                    <th>Ticker</th>
                    <th>Side</th>
                    <th>Instrument</th>
                    <th style="text-align: right;">Net P&L</th>
                    <th style="text-align: right;">Net ROI</th>
                    <th style="text-align: right;">R-Multiple</th>
                    <th>Playbook</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.renderTradesTableRows()}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 4. Note Review Area (Collapsible / Editable) -->
          <div id="daily-note-section" style="${this.journalEntry ? 'display: block;' : 'display: none;'} background: var(--fill-subtle); border: 1px solid var(--border-default); border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 6px;">Day Journal & Lessons</div>
            <textarea class="form-control" id="daily-note-textarea" rows="2" placeholder="Record what went well, mistakes made, or psychological state...">${this.journalEntry ? (this.journalEntry.post_market_notes || '') : ''}</textarea>
            <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-save-daily-note">Save Day Note</button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer" style="padding: 12px 22px; border-top: 1px solid var(--border-default); display: flex; justify-content: flex-end; gap: 10px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-daily">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-view-details-daily">View in Trades Table →</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.modalEl = overlay;
    this.bindEvents();
  }

  renderSequenceSvg(points, netPnl) {
    if (points.length <= 1) {
      return `<div style="height: 100%; display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--text-placeholder);">Single execution on this trading day</div>`;
    }

    const width = 760;
    const height = 100;
    const padX = 30;
    const padY = 16;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;

    const yVals = points.map(p => p.y);
    const minY = Math.min(0, ...yVals);
    const maxY = Math.max(0, ...yVals);
    const range = Math.max(1, maxY - minY);

    const getX = (idx) => padX + (idx / (points.length - 1)) * chartW;
    const getY = (val) => padY + chartH - ((val - minY) / range) * chartH;
    const zeroY = getY(0);

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.y).toFixed(1)}`).join(' ');
    const areaD = `${pathD} L ${getX(points.length - 1).toFixed(1)} ${zeroY.toFixed(1)} L ${getX(0).toFixed(1)} ${zeroY.toFixed(1)} Z`;
    const strokeColor = netPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)';

    return `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible;">
        <defs>
          <linearGradient id="dailySequenceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.25" />
            <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        <!-- Zero baseline -->
        <line x1="${padX}" y1="${zeroY}" x2="${width - padX}" y2="${zeroY}" stroke="var(--border-default)" stroke-dasharray="3,3" stroke-width="1" />
        <path d="${areaD}" fill="url(#dailySequenceGrad)" />
        <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        ${points.map((p, i) => `
          <circle cx="${getX(i)}" cy="${getY(p.y)}" r="3.5" fill="var(--bg-panel)" stroke="${strokeColor}" stroke-width="2" />
        `).join('')}
      </svg>
    `;
  }

  renderTradesTableRows() {
    if (!this.dayTrades.length) {
      return `<tr><td colspan="8" style="text-align: center; color: var(--text-placeholder); padding: 18px;">No trades recorded on this date</td></tr>`;
    }

    return this.dayTrades.map(t => {
      const pnl = Number(t.pnl) || 0;
      const pnlClass = pnl >= 0 ? 'color: var(--color-profit);' : 'color: var(--color-loss);';
      const sideClass = (t.direction || t.side || '').toUpperCase() === 'SHORT' ? 'tag-loss' : 'tag-profit';
      const roi = t.return_percent || (t.entry_price > 0 ? (pnl / (t.entry_price * (t.lot_size || 1))) * 100 : 0);

      return `
        <tr class="table-row">
          <td class="tabular-nums" style="font-size: 11px;">${t.time || '14:30'}</td>
          <td style="font-weight: 700;">${t.symbol || 'XAUUSD'}</td>
          <td><span class="status-tag ${sideClass}">${(t.direction || t.side || 'LONG').toUpperCase()}</span></td>
          <td style="color: var(--text-secondary);">${t.symbol || 'Forex'}</td>
          <td class="tabular-nums" style="text-align: right; font-weight: 700; ${pnlClass}">${formatCurrency(pnl)}</td>
          <td class="tabular-nums" style="text-align: right; font-size: 11.5px; ${pnlClass}">${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%</td>
          <td class="tabular-nums" style="text-align: right; font-size: 11.5px;">${t.pnl_r ? formatR(t.pnl_r) : '—'}</td>
          <td style="font-size: 11px; color: var(--text-secondary);">${t.playbook || t.setup || 'Discretionary'}</td>
        </tr>
      `;
    }).join('');
  }

  bindEvents() {
    const close = () => {
      if (this.modalEl) {
        this.modalEl.remove();
        this.modalEl = null;
      }
      this.onClose();
    };

    this.modalEl.querySelector('#btn-close-daily').addEventListener('click', close);
    this.modalEl.querySelector('#btn-cancel-daily').addEventListener('click', close);

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) close();
    });

    const btnNote = this.modalEl.querySelector('#btn-daily-add-note');
    const noteSection = this.modalEl.querySelector('#daily-note-section');
    btnNote.addEventListener('click', () => {
      noteSection.style.display = noteSection.style.display === 'none' ? 'block' : 'none';
    });

    const btnSaveNote = this.modalEl.querySelector('#btn-save-daily-note');
    if (btnSaveNote) {
      btnSaveNote.addEventListener('click', async () => {
        const text = this.modalEl.querySelector('#daily-note-textarea').value.trim();
        await DailyJournalRepo.saveJournal({
          date: this.dateKey,
          post_market_notes: text,
          daily_rating: 5
        });
        btnSaveNote.textContent = 'Saved!';
        setTimeout(() => btnSaveNote.textContent = 'Save Day Note', 1500);
      });
    }

    this.modalEl.querySelector('#btn-view-details-daily').addEventListener('click', () => {
      close();
      this.onViewTrades(this.dateKey);
    });
  }
}
