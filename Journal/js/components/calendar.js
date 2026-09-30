/**
 * calendar.js
 * 紧凑交易日历视图：
 * 按月展示交易日期、盈亏色块与交易笔数，支持快速按月前后翻阅
 */

import { formatCurrency, formatR } from '../core/formatters.js';

export class TradingCalendar {
  constructor(options = {}) {
    this.container = options.container;
    this.dailyDistribution = options.dailyDistribution || {};
    this.unit = options.unit || '$';
    this.currentDate = new Date();
    this.onSelectDate = options.onSelectDate || (() => {});
    this.init();
  }

  update(dailyDistribution, unit = this.unit) {
    this.dailyDistribution = dailyDistribution;
    this.unit = unit;
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

    // 头部月份选择
    card.innerHTML = `
      <div class="calendar-header">
        <div class="calendar-month-title">${currentMonthLabel}</div>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-sm" id="cal-prev-month">&lt;</button>
          <button class="btn btn-sm" id="cal-today">Today</button>
          <button class="btn btn-sm" id="cal-next-month">&gt;</button>
        </div>
      </div>
      <div class="calendar-grid">
        <div class="calendar-day-header">Sun</div>
        <div class="calendar-day-header">Mon</div>
        <div class="calendar-day-header">Tue</div>
        <div class="calendar-day-header">Wed</div>
        <div class="calendar-day-header">Thu</div>
        <div class="calendar-day-header">Fri</div>
        <div class="calendar-day-header">Sat</div>
      </div>
    `;

    const grid = card.querySelector('.calendar-grid');

    // 计算当月第一天星期与总天数
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 填充空白格子
    for (let i = 0; i < firstDayIndex; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'calendar-day-cell empty';
      grid.appendChild(emptyCell);
    }

    // 填充当月日期
    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${year}-${monthStr}-${dayStr}`;

      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell';

      const dayData = this.dailyDistribution[dateKey];
      let pnlHtml = '';
      let rHtml = '';

      if (dayData && dayData.trades > 0) {
        cell.classList.add('has-trades');
        if (dayData.pnl > 0.0001) {
          cell.classList.add('profit-day');
        } else if (dayData.pnl < -0.0001) {
          cell.classList.add('loss-day');
        }

        const pnlStr = this.unit === 'R' ? formatR(dayData.r) : formatCurrency(dayData.pnl);
        const pnlColorClass = dayData.pnl > 0 ? 'text-profit' : (dayData.pnl < 0 ? 'text-loss' : 'text-neutral');

        pnlHtml = `
          <div class="calendar-day-pnl ${pnlColorClass}">${pnlStr}</div>
          <div style="font-size: 9px; color: var(--text-tertiary); text-align: right;">${dayData.trades} trd</div>
        `;

        cell.addEventListener('click', () => {
          this.onSelectDate(dateKey);
        });
      }

      cell.innerHTML = `
        <div class="calendar-day-num">${day}</div>
        ${pnlHtml}
      `;

      grid.appendChild(cell);
    }

    // 翻月控制
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
