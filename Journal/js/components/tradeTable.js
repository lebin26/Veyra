/**
 * tradeTable.js
 * 紧凑型数据表格组件（支持完整 Time Interval Filter 过滤）：
 * 支持快捷区间、Start Date → End Date 自由过滤、搜索、排序与分页。
 */

import { formatCurrency, formatR, formatPrice } from '../core/formatters.js';
import { deriveTradeMetrics } from '../core/calculations.js';

export class TradeTable {
  constructor(options = {}) {
    this.container = options.container;
    this.trades = options.trades || [];
    this.onRowClick = options.onRowClick || (() => {});
    this.screenshotsMap = options.screenshotsMap || {};

    this.sortField = 'date';
    this.sortAsc = false;
    this.searchQuery = '';
    this.filterDirection = 'ALL';
    this.filterResult = 'ALL';
    
    // Time Interval Filters
    this.startDate = '';
    this.endDate = '';

    this.currentPage = 1;
    this.pageSize = 15;

    this.init();
  }

  setTrades(trades, screenshotsMap = {}) {
    this.trades = trades;
    this.screenshotsMap = screenshotsMap;
    this.currentPage = 1;
    this.render();
  }

  init() {
    this.render();
  }

  getFilteredAndSortedTrades() {
    let result = this.trades.map(t => deriveTradeMetrics(t));

    // 1. Time Interval Filter
    if (this.startDate) {
      result = result.filter(t => t.date >= this.startDate);
    }
    if (this.endDate) {
      result = result.filter(t => t.date <= this.endDate);
    }

    // 2. 搜索过滤
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(t => 
        (t.symbol && t.symbol.toLowerCase().includes(q)) ||
        (t.setup && t.setup.toLowerCase().includes(q)) ||
        (t.session && t.session.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    // 3. 方向过滤
    if (this.filterDirection !== 'ALL') {
      result = result.filter(t => t.direction === this.filterDirection);
    }

    // 4. 结果过滤 (支持 TP, BE, SL, 提早关闭盈利, 提早关闭亏损)
    if (this.filterResult !== 'ALL') {
      if (this.filterResult === 'OPEN') {
        result = result.filter(t => t.derived.status === 'OPEN' || !t.exit_price);
      } else {
        result = result.filter(t => (t.exit_type === this.filterResult || t.derived.result === this.filterResult || t.derived.exitType === this.filterResult));
      }
    }

    // 5. 排序
    result.sort((a, b) => {
      let valA, valB;
      if (this.sortField === 'date') {
        valA = `${a.date || ''} ${a.time || ''}`;
        valB = `${b.date || ''} ${b.time || ''}`;
      } else if (this.sortField === 'symbol') {
        valA = a.symbol || '';
        valB = b.symbol || '';
      } else if (this.sortField === 'pnl') {
        valA = a.derived.netPnl;
        valB = b.derived.netPnl;
      } else if (this.sortField === 'r') {
        valA = a.derived.r !== null ? a.derived.r : -9999;
        valB = b.derived.r !== null ? b.derived.r : -9999;
      } else {
        valA = a[this.sortField] || '';
        valB = b[this.sortField] || '';
      }

      if (typeof valA === 'string') {
        return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return this.sortAsc ? valA - valB : valB - valA;
    });

    return result;
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const processedTrades = this.getFilteredAndSortedTrades();
    const totalCount = processedTrades.length;
    const totalPages = Math.ceil(totalCount / this.pageSize) || 1;
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const startIdx = (this.currentPage - 1) * this.pageSize;
    const currentTrades = processedTrades.slice(startIdx, startIdx + this.pageSize);

    // 顶栏工具条 (含 Time Interval Filter)
    const toolbar = document.createElement('div');
    toolbar.className = 'table-toolbar';
    toolbar.style.marginBottom = '10px';
    toolbar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <input type="text" class="table-search-input" placeholder="Search symbol, setup, notes..." value="${this.searchQuery}">
        
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="font-size: 11px; color: var(--text-tertiary);">Interval:</span>
          <input type="date" class="table-select" id="table-start-date" value="${this.startDate}" title="Start Date">
          <span style="color: var(--text-tertiary); font-size: 11px;">to</span>
          <input type="date" class="table-select" id="table-end-date" value="${this.endDate}" title="End Date">
        </div>

        <select class="table-select" id="filter-dir">
          <option value="ALL" ${this.filterDirection === 'ALL' ? 'selected' : ''}>All Sides</option>
          <option value="LONG" ${this.filterDirection === 'LONG' ? 'selected' : ''}>Long only</option>
          <option value="SHORT" ${this.filterDirection === 'SHORT' ? 'selected' : ''}>Short only</option>
        </select>
        
        <select class="table-select" id="filter-res">
          <option value="ALL" ${this.filterResult === 'ALL' ? 'selected' : ''}>All Results</option>
          <option value="OPEN" ${this.filterResult === 'OPEN' ? 'selected' : ''}>Open (持仓中)</option>
          <option value="TP" ${this.filterResult === 'TP' ? 'selected' : ''}>Take Profit (TP)</option>
          <option value="BE" ${this.filterResult === 'BE' ? 'selected' : ''}>Break Even (BE)</option>
          <option value="SL" ${this.filterResult === 'SL' ? 'selected' : ''}>Stop Loss (SL)</option>
          <option value="EARLY_PROFIT" ${this.filterResult === 'EARLY_PROFIT' ? 'selected' : ''}>Early Close (Profit)</option>
          <option value="EARLY_LOSS" ${this.filterResult === 'EARLY_LOSS' ? 'selected' : ''}>Early Close (Loss)</option>
        </select>
      </div>

      <div style="font-size: 11.5px; color: var(--text-tertiary);">
        Showing ${totalCount === 0 ? 0 : startIdx + 1}-${Math.min(startIdx + this.pageSize, totalCount)} of ${totalCount} trades
      </div>
    `;

    // 绑定事件
    const searchInput = toolbar.querySelector('.table-search-input');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.currentPage = 1;
      this.render();
    });

    toolbar.querySelector('#table-start-date').addEventListener('change', (e) => {
      this.startDate = e.target.value;
      this.currentPage = 1;
      this.render();
    });

    toolbar.querySelector('#table-end-date').addEventListener('change', (e) => {
      this.endDate = e.target.value;
      this.currentPage = 1;
      this.render();
    });

    toolbar.querySelector('#filter-dir').addEventListener('change', (e) => {
      this.filterDirection = e.target.value;
      this.currentPage = 1;
      this.render();
    });

    toolbar.querySelector('#filter-res').addEventListener('change', (e) => {
      this.filterResult = e.target.value;
      this.currentPage = 1;
      this.render();
    });

    this.container.appendChild(toolbar);

    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';

    if (totalCount === 0) {
      tableContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-tertiary); font-size: 12px;">
          No matching trades found in selected interval.
        </div>
      `;
      this.container.appendChild(tableContainer);
      return;
    }

    const table = document.createElement('table');
    table.className = 'data-table';

    const getSortArrow = (field) => {
      if (this.sortField !== field) return '';
      return this.sortAsc ? ' ↑' : ' ↓';
    };

    table.innerHTML = `
      <thead>
        <tr>
          <th class="sortable" data-field="date">Date / Time${getSortArrow('date')}</th>
          <th class="sortable" data-field="symbol">Symbol${getSortArrow('symbol')}</th>
          <th>Side</th>
          <th>Strategy</th>
          <th class="text-right">Entry</th>
          <th class="text-right">Exit</th>
          <th class="text-right">Size</th>
          <th class="text-right sortable" data-field="pnl">Net P&L${getSortArrow('pnl')}</th>
          <th class="text-right sortable" data-field="r">R${getSortArrow('r')}</th>
          <th class="text-center">Result</th>
          <th class="text-center">Rating</th>
          <th class="text-center">Screenshot</th>
          <th class="text-center">Action</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    table.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.dataset.field;
        if (this.sortField === field) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortField = field;
          this.sortAsc = false;
        }
        this.render();
      });
    });

    const tbody = table.querySelector('tbody');
    currentTrades.forEach(trade => {
      const tr = document.createElement('tr');
      const d = trade.derived;
      const isOpen = d.status === 'OPEN' || trade.exit_price === null || trade.exit_price === undefined || String(trade.exit_price).trim() === '';
      const pnlClass = d.netPnl > 0 ? 'text-profit' : (d.netPnl < 0 ? 'text-loss' : 'text-neutral');
      const badgeSide = trade.direction === 'LONG' ? 'badge-long' : 'badge-short';
      
      const renderBadgeRes = () => {
        if (isOpen) {
          return '<span class="badge" style="background:#EFF6FF; color:#1D4ED8; font-weight:700;">OPEN</span>';
        }
        const outcome = trade.exit_type || d.exitType || d.result;
        const reason = trade.early_close_reason ? ` (原因: ${trade.early_close_reason})` : '';

        if (outcome === 'TP' || outcome === 'TAKE_PROFIT') {
          return '<span class="badge badge-win" title="Take Profit (止盈)">TP</span>';
        }
        if (outcome === 'BE' || outcome === 'BREAK_EVEN') {
          return '<span class="badge badge-be" title="Break Even (保本)">BE</span>';
        }
        if (outcome === 'SL' || outcome === 'STOP_LOSS') {
          return '<span class="badge badge-loss" title="Stop Loss (止损)">SL</span>';
        }
        if (outcome === 'EARLY_PROFIT') {
          return `<span class="badge" style="background:#ECFDF5; color:#047857; border:1px solid #A7F3D0; font-weight:700;" title="提早关闭 (盈利)${reason}">Early (Win)</span>`;
        }
        if (outcome === 'EARLY_LOSS') {
          return `<span class="badge" style="background:#FEF2F2; color:#B91C1C; border:1px solid #FECACA; font-weight:700;" title="提早关闭 (亏损)${reason}">Early (Loss)</span>`;
        }
        return `<span class="badge ${d.result === 'WIN' ? 'badge-win' : (d.result === 'LOSS' ? 'badge-loss' : 'badge-be')}">${d.result}</span>`;
      };

      const screenshotCount = this.screenshotsMap[trade.id] || 0;

      tr.innerHTML = `
        <td>
          <div style="font-weight: 600;">${trade.date}</div>
          <div style="font-size: 10px; color: var(--text-tertiary);">${trade.time || '--:--'}</div>
        </td>
        <td>
          <div style="font-weight: 700;">${trade.symbol}</div>
        </td>
        <td><span class="badge ${badgeSide}">${trade.direction}</span></td>
        <td>${trade.setup || '<span style="color:var(--text-tertiary);">-</span>'}</td>
        <td class="text-right font-mono">${formatPrice(trade.entry_price)}</td>
        <td class="text-right font-mono">${isOpen ? '<span style="color:var(--text-tertiary); font-size:11px;">—</span>' : formatPrice(trade.exit_price)}</td>
        <td class="text-right font-mono">${trade.position_size || 1}</td>
        <td class="text-right font-mono ${pnlClass}">
          ${isOpen 
            ? `<span style="color:var(--text-tertiary); font-size:10.5px;">Risk -$${(d.initialRiskAmount || 0).toFixed(2)}</span>` 
            : formatCurrency(d.netPnl)}
        </td>
        <td class="text-right font-mono ${pnlClass}">${isOpen ? '<span style="color:var(--text-tertiary); font-size:11px;">—</span>' : formatR(d.r)}</td>
        <td class="text-center">
          ${renderBadgeRes()}
        </td>
        <td class="text-center"><span style="font-weight:700; font-size:11px;">${isOpen ? '-' : (trade.rating || 'A')}</span></td>
        <td class="text-center">
          ${screenshotCount > 0 ? `
            <span style="font-size: 11px; color: var(--text-secondary); background: var(--surface-alt); padding: 1px 6px; border-radius: 2px; border: 1px solid var(--border-subtle);">
              📷 ${screenshotCount}
            </span>` : '<span style="color: var(--text-tertiary);">-</span>'}
        </td>
        <td class="text-center">
          ${isOpen ? `
            <button class="btn btn-sm btn-primary btn-row-close" style="padding: 2px 8px; font-size: 10.5px; font-weight: 700;">
              Close
            </button>
          ` : `
            <button class="btn btn-sm btn-row-review" style="padding: 2px 8px; font-size: 10.5px; color: var(--text-secondary); background: transparent; border: 1px solid var(--border-subtle);">
              Review
            </button>
          `}
        </td>
      `;

      const closeBtn = tr.querySelector('.btn-row-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onRowClick(trade, { focusClose: true });
        });
      }

      tr.addEventListener('click', () => {
        this.onRowClick(trade, { focusClose: false });
      });

      tbody.appendChild(tr);
    });

    tableContainer.appendChild(table);
    this.container.appendChild(tableContainer);

    if (totalPages > 1) {
      const pagination = document.createElement('div');
      pagination.className = 'table-pagination';
      pagination.innerHTML = `
        <div>Page ${this.currentPage} of ${totalPages}</div>
        <div class="pagination-controls">
          <button class="btn btn-sm" id="page-prev" ${this.currentPage === 1 ? 'disabled' : ''}>Previous</button>
          <button class="btn btn-sm" id="page-next" ${this.currentPage === totalPages ? 'disabled' : ''}>Next</button>
        </div>
      `;

      pagination.querySelector('#page-prev').addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.render();
        }
      });

      pagination.querySelector('#page-next').addEventListener('click', () => {
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.render();
        }
      });

      this.container.appendChild(pagination);
    }
  }
}
