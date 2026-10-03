/**
 * calendar.js
 * Monthly Trading Heatmap Calendar with Weekly Summary:
 * - Heatmap day cards (Net P&L, trades count, winrate %)
 * - Right column: Weekly Performance Summary (Week 1, Week 2, Week 3, etc. with net P&L and days count)
 * - Click any trading day to open Daily Detail Modal
 */
import { formatCurrency, formatR } from '../core/formatters.js';

export class TradingCalendar {
  constructor(options = {}) {
    this.container = options.container;
    this.dailyDistribution = options.dailyDistribution || {};
    this.allTrades = options.allTrades || [];
    this.unit = options.unit || '$';
    this.currentDate = new Date();
    this.onSelectDate = options.onSelectDate || (() => {});
    this.init();
  }

  update(dailyDistribution, unit = this.unit, allTrades = this.allTrades) {
    this.dailyDistribution = dailyDistribution;
    this.unit = unit;
    this.allTrades = allTrades;
    this.render();
  }

  init() {
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth(); // 0-indexed

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonthLabel = `${monthNames[month]} ${year}`;

    const card = document.createElement('div');
    card.className = 'calendar-card';

    // Header controls
    card.innerHTML = `
      <div class="calendar-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border-default);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="calendar-month-title" style="font-size: 15px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em;">${currentMonthLabel}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="btn btn-secondary btn-sm" id="cal-prev-month" title="Previous Month">&lt;</button>
          <button type="button" class="btn btn-secondary btn-sm" id="cal-today">This month</button>
          <button type="button" class="btn btn-secondary btn-sm" id="cal-next-month" title="Next Month">&gt;</button>
        </div>
      </div>

      <!-- Main Layout: Grid on left, Weekly Summary on right -->
      <div style="display: grid; grid-template-columns: 1fr 140px; gap: 0;">
        <!-- Left: 7-Column Day Grid -->
        <div style="padding: 12px 14px; border-right: 1px solid var(--border-default);">
          <div class="calendar-grid-header" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; text-align: center; margin-bottom: 6px;">
            <span class="cal-col-header">Mon</span>
            <span class="cal-col-header">Tue</span>
            <span class="cal-col-header">Wed</span>
            <span class="cal-col-header">Thu</span>
            <span class="cal-col-header">Fri</span>
            <span class="cal-col-header">Sat</span>
            <span class="cal-col-header">Sun</span>
          </div>
          <div class="calendar-grid" id="cal-days-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;"></div>
        </div>

        <!-- Right: Weekly Performance Summary Column -->
        <div style="padding: 12px 14px; background: var(--fill-subtle); display: flex; flex-direction: column; gap: 8px;" id="cal-weekly-summary">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.04em; margin-bottom: 4px;">
            Weekly Stats
          </div>
          <div id="weekly-rows-container" style="display: flex; flex-direction: column; gap: 8px;"></div>
        </div>
      </div>
    `;

    const grid = card.querySelector('#cal-days-grid');
    const weeklyContainer = card.querySelector('#weekly-rows-container');

    const rawDay = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon...
    const firstDayIndex = (rawDay + 6) % 7; // Monday is 0, Sunday is 6
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Fill leading empty cells
    for (let i = 0; i < firstDayIndex; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'calendar-day-cell empty';
      emptyCell.style.minHeight = '64px';
      emptyCell.style.background = 'transparent';
      grid.appendChild(emptyCell);
    }

    // Weekly aggregator
    const weeklyData = {};

    // Fill days
    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${year}-${monthStr}-${dayStr}`;

      // Calculate week index of month (1-indexed)
      const dayOfWeek = (firstDayIndex + day - 1) % 7;
      const weekIndex = Math.floor((firstDayIndex + day - 1) / 7) + 1;
      if (!weeklyData[weekIndex]) {
        weeklyData[weekIndex] = { week: weekIndex, pnl: 0, r: 0, daysCount: 0 };
      }

      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell';
      cell.style.minHeight = '68px';
      cell.style.borderRadius = 'var(--radius-control)';
      cell.style.padding = '6px 8px';
      cell.style.display = 'flex';
      cell.style.flexDirection = 'column';
      cell.style.justifyContent = 'space-between';
      cell.style.border = '1px solid var(--border-default)';
      cell.style.transition = 'all 120ms ease';

      const dayData = this.dailyDistribution[dateKey];

      if (dayData && dayData.trades > 0) {
        cell.classList.add('has-trades');
        weeklyData[weekIndex].pnl += dayData.pnl;
        weeklyData[weekIndex].r += dayData.r;
        weeklyData[weekIndex].daysCount += 1;

        const isProfit = dayData.pnl >= 0.0001;
        const pnlColor = isProfit ? 'var(--color-profit)' : 'var(--color-loss)';
        const bgTint = isProfit ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)';
        const borderTint = isProfit ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)';

        cell.style.background = bgTint;
        cell.style.borderColor = borderTint;
        cell.style.cursor = 'pointer';

        const pnlStr = this.unit === 'R' ? formatR(dayData.r) : formatCurrency(dayData.pnl);
        const winrateStr = dayData.winrate !== undefined ? `${dayData.winrate.toFixed(0)}%` : `${((dayData.winners || 0) / dayData.trades * 100).toFixed(0)}%`;

        cell.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="calendar-day-num" style="font-size: 11px; font-weight: 700; color: var(--text-primary);">${day}</span>
            <span style="font-size: 9.5px; color: var(--text-secondary);">${dayData.trades} trd</span>
          </div>
          <div style="font-size: 12.5px; font-weight: 700; color: ${pnlColor}; font-variant-numeric: tabular-nums; margin: 3px 0;">
            ${pnlStr}
          </div>
          <div style="font-size: 9.5px; color: var(--text-secondary); display: flex; justify-content: space-between;">
            <span>Win %</span>
            <span class="tabular-nums" style="font-weight: 600;">${winrateStr}</span>
          </div>
        `;

        cell.addEventListener('mouseenter', () => {
          cell.style.transform = 'translateY(-2px)';
          cell.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        });
        cell.addEventListener('mouseleave', () => {
          cell.style.transform = 'none';
          cell.style.boxShadow = 'none';
        });

        cell.addEventListener('click', () => {
          this.onSelectDate(dateKey);
        });
      } else {
        cell.style.background = 'var(--bg-panel)';
        cell.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="calendar-day-num" style="font-size: 11px; font-weight: 600; color: var(--text-placeholder);">${day}</span>
          </div>
        `;
      }

      grid.appendChild(cell);
    }

    // Render Weekly Summary Rows
    Object.values(weeklyData).forEach(w => {
      const row = document.createElement('div');
      row.style.background = 'var(--bg-panel)';
      row.style.border = '1px solid var(--border-default)';
      row.style.borderRadius = 'var(--radius-control)';
      row.style.padding = '8px 10px';
      row.style.display = 'flex';
      row.style.flexDirection = 'column';
      row.style.gap = '2px';

      const pnlColor = w.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)';
      const pnlVal = this.unit === 'R' ? formatR(w.r) : formatCurrency(w.pnl);

      row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 600; color: var(--text-secondary);">
          <span>Week ${w.week}</span>
          <span>${w.daysCount} days</span>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: ${pnlColor}; font-variant-numeric: tabular-nums;">
          ${w.daysCount > 0 ? pnlVal : '—'}
        </div>
      `;
      weeklyContainer.appendChild(row);
    });

    // Month Navigation
    card.querySelector('#cal-prev-month').addEventListener('click', () => {
      this.currentDate = new Date(year, month - 1, 1);
      this.render();
    });

    card.querySelector('#cal-next-month').addEventListener('click', () => {
      this.currentDate = new Date(year, month + 1, 1);
      this.render();
    });

    card.querySelector('#cal-today').addEventListener('click', () => {
      this.currentDate = new Date();
      this.render();
    });

    this.container.appendChild(card);
  }
}
