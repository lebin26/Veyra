/**
 * charts.js
 * 纯原生矢量 SVG 图表引擎（VEYRA 专业分析图表）：
 * 1. EquityCurveChart (净值曲线，支持 $ | R)
 * 2. DailyPnlChart (每日盈亏柱状图)
 * 3. RDistributionChart (VEYRA R-Multiple 分布直方图)
 */

import { formatCurrency, formatR, formatPercent } from '../core/formatters.js';

export class EquityCurveChart {
  constructor(options = {}) {
    this.container = options.container;
    this.curveData = options.curveData || [];
    this.unit = options.unit || '$';
    this.init();
  }

  update(curveData, unit = this.unit) {
    this.curveData = curveData;
    this.unit = unit;
    this.render();
  }

  init() {
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const data = this.curveData;
    const unit = this.unit;

    if (!data || data.length === 0) {
      this.container.innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); font-size: 11.5px;">
          No trades to render equity curve
        </div>
      `;
      return;
    }

    const points = [{ index: 0, val: 0, date: 'Start', time: '' }];
    data.forEach(d => {
      let val = d.pnl;
      if (unit === 'R') val = d.r;
      else if (unit === '%') val = d.returnPercent;
      points.push({ index: d.tradeIndex, val, date: d.date, time: d.time });
    });

    const vals = points.map(p => p.val);
    let minVal = Math.min(0, ...vals);
    let maxVal = Math.max(0, ...vals);
    if (minVal === maxVal) {
      minVal -= 10;
      maxVal += 10;
    }

    const padTop = 15;
    const padBottom = 25;
    const padLeft = 45;
    const padRight = 15;
    const width = 600;
    const height = 220;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const getX = (idx) => padLeft + (idx / (points.length - 1 || 1)) * chartW;
    const getY = (val) => padTop + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;
    const zeroY = getY(0);

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.index).toFixed(1)} ${getY(p.val).toFixed(1)}`).join(' ');

    const formatValLabel = (v) => {
      if (unit === 'R') return formatR(v);
      if (unit === '%') return formatPercent(v);
      return formatCurrency(v, false);
    };

    const svgHtml = `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <line x1="${padLeft}" y1="${padTop}" x2="${width - padRight}" y2="${padTop}" stroke="var(--border-subtle)" stroke-width="1" />
        <line x1="${padLeft}" y1="${padTop + chartH}" x2="${width - padRight}" y2="${padTop + chartH}" stroke="var(--border-subtle)" stroke-width="1" />
        <line x1="${padLeft}" y1="${zeroY}" x2="${width - padRight}" y2="${zeroY}" stroke="var(--border-strong)" stroke-dasharray="3,3" stroke-width="1" />
        
        <text x="${padLeft - 6}" y="${padTop + 4}" fill="var(--text-tertiary)" font-size="10" text-anchor="end" font-family="var(--font-mono)">${formatValLabel(maxVal)}</text>
        <text x="${padLeft - 6}" y="${zeroY + 3}" fill="var(--text-secondary)" font-size="10" text-anchor="end" font-family="var(--font-mono)">0</text>
        <text x="${padLeft - 6}" y="${padTop + chartH}" fill="var(--text-tertiary)" font-size="10" text-anchor="end" font-family="var(--font-mono)">${formatValLabel(minVal)}</text>

        <path d="${pathD}" fill="none" stroke="var(--text-main)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

        ${points.map((p) => `
          <circle cx="${getX(p.index)}" cy="${getY(p.val)}" r="3" fill="var(--surface)" stroke="var(--text-main)" stroke-width="1.8" class="chart-node" data-date="${p.date}" data-val="${p.val}" style="cursor: pointer;" />
        `).join('')}
      </svg>
      <div class="chart-tooltip"></div>
    `;

    this.container.innerHTML = svgHtml;

    const tooltip = this.container.querySelector('.chart-tooltip');
    const nodes = this.container.querySelectorAll('.chart-node');

    nodes.forEach(node => {
      node.addEventListener('mouseenter', () => {
        const d = node.dataset.date;
        const v = Number(node.dataset.val);
        tooltip.innerHTML = `<span style="color:var(--text-tertiary);">${d}</span><br><strong>${formatValLabel(v)}</strong>`;
        tooltip.style.display = 'block';
        const rect = node.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        tooltip.style.left = `${rect.left - containerRect.left + 3}px`;
        tooltip.style.top = `${rect.top - containerRect.top}px`;
      });

      node.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    });
  }
}

export class DailyPnlChart {
  constructor(options = {}) {
    this.container = options.container;
    this.dailyDistribution = options.dailyDistribution || {};
    this.unit = options.unit || '$';
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

    const dist = this.dailyDistribution;
    const dates = Object.keys(dist).sort();

    if (dates.length === 0) {
      this.container.innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); font-size: 11.5px;">
          No daily records to display
        </div>
      `;
      return;
    }

    const unit = this.unit;
    const items = dates.map(d => {
      const item = dist[d];
      let val = item.pnl;
      if (unit === 'R') val = item.r;
      return {
        date: d,
        val,
        trades: item.trades,
        wins: item.wins,
        losses: item.losses
      };
    });

    const vals = items.map(i => i.val);
    let minVal = Math.min(0, ...vals);
    let maxVal = Math.max(0, ...vals);
    if (minVal === maxVal) {
      minVal -= 10;
      maxVal += 10;
    }

    const padTop = 15;
    const padBottom = 25;
    const padLeft = 45;
    const padRight = 15;
    const width = 450;
    const height = 220;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const zeroY = padTop + chartH - ((0 - minVal) / (maxVal - minVal)) * chartH;
    const barWidth = Math.max(4, Math.min(22, (chartW / items.length) * 0.7));
    const stepX = chartW / items.length;

    const formatValLabel = (v) => {
      if (unit === 'R') return formatR(v);
      return formatCurrency(v, false);
    };

    const barsHtml = items.map((item, idx) => {
      const x = padLeft + idx * stepX + (stepX - barWidth) / 2;
      const yVal = padTop + chartH - ((item.val - minVal) / (maxVal - minVal)) * chartH;
      
      const barY = Math.min(yVal, zeroY);
      const barHeight = Math.max(2, Math.abs(yVal - zeroY));
      const isProfit = item.val >= 0;
      const fillColor = isProfit ? 'var(--profit-color)' : 'var(--loss-color)';

      return `
        <rect x="${x}" y="${barY}" width="${barWidth}" height="${barHeight}" fill="${fillColor}" rx="1" class="pnl-bar" data-date="${item.date}" data-val="${item.val}" data-trades="${item.trades}" style="cursor: pointer; opacity: 0.85;" />
      `;
    }).join('');

    const svgHtml = `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <line x1="${padLeft}" y1="${zeroY}" x2="${width - padRight}" y2="${zeroY}" stroke="var(--border-strong)" stroke-dasharray="2,2" stroke-width="1" />
        
        <text x="${padLeft - 6}" y="${padTop + 4}" fill="var(--text-tertiary)" font-size="10" text-anchor="end" font-family="var(--font-mono)">${formatValLabel(maxVal)}</text>
        <text x="${padLeft - 6}" y="${zeroY + 3}" fill="var(--text-secondary)" font-size="10" text-anchor="end" font-family="var(--font-mono)">0</text>
        <text x="${padLeft - 6}" y="${padTop + chartH}" fill="var(--text-tertiary)" font-size="10" text-anchor="end" font-family="var(--font-mono)">${formatValLabel(minVal)}</text>

        ${barsHtml}
      </svg>
      <div class="chart-tooltip"></div>
    `;

    this.container.innerHTML = svgHtml;

    const tooltip = this.container.querySelector('.chart-tooltip');
    const bars = this.container.querySelectorAll('.pnl-bar');

    bars.forEach(bar => {
      bar.addEventListener('mouseenter', () => {
        bar.style.opacity = '1';
        const d = bar.dataset.date;
        const v = Number(bar.dataset.val);
        const t = bar.dataset.trades;
        tooltip.innerHTML = `<span style="color:var(--text-tertiary);">${d} (${t} trades)</span><br><strong>${formatValLabel(v)}</strong>`;
        tooltip.style.display = 'block';
        const rect = bar.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        tooltip.style.left = `${rect.left - containerRect.left + barWidth / 2}px`;
        tooltip.style.top = `${rect.top - containerRect.top}px`;
      });

      bar.addEventListener('mouseleave', () => {
        bar.style.opacity = '0.85';
        tooltip.style.display = 'none';
      });
    });
  }
}

/**
 * VEYRA 核心组件：R-Multiple Distribution 直方图
 */
export class RDistributionChart {
  constructor(options = {}) {
    this.container = options.container;
    this.rDistribution = options.rDistribution || { buckets: [], validRCount: 0 };
    this.init();
  }

  update(rDistribution) {
    this.rDistribution = rDistribution;
    this.render();
  }

  init() {
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const { buckets, validRCount } = this.rDistribution;

    if (!buckets || buckets.length === 0 || validRCount === 0) {
      this.container.innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); font-size: 11.5px;">
          Define Initial Risk to view R distribution
        </div>
      `;
      return;
    }

    const maxCount = Math.max(1, ...buckets.map(b => b.count));

    const padTop = 15;
    const padBottom = 30;
    const padLeft = 35;
    const padRight = 15;
    const width = 600;
    const height = 200;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;
    const stepX = chartW / buckets.length;
    const barWidth = Math.max(12, stepX * 0.65);

    const barsHtml = buckets.map((b, idx) => {
      const x = padLeft + idx * stepX + (stepX - barWidth) / 2;
      const barHeight = Math.max(b.count > 0 ? 3 : 0, (b.count / maxCount) * chartH);
      const y = padTop + chartH - barHeight;

      // 判断正负桶颜色
      const isNegative = b.max <= 0;
      const fillColor = b.count === 0 ? 'var(--surface-active)' : (isNegative ? 'var(--loss-color)' : 'var(--profit-color)');

      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${fillColor}" rx="2" class="r-dist-bar" data-label="${b.label}" data-count="${b.count}" data-pct="${((b.count / validRCount) * 100).toFixed(1)}" style="cursor: pointer; opacity: ${b.count > 0 ? '0.85' : '0.3'};" />
        <text x="${x + barWidth / 2}" y="${padTop + chartH + 16}" fill="var(--text-secondary)" font-size="9.5" text-anchor="middle" font-family="var(--font-mono)">${b.label}</text>
      `;
    }).join('');

    const svgHtml = `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <line x1="${padLeft}" y1="${padTop + chartH}" x2="${width - padRight}" y2="${padTop + chartH}" stroke="var(--border-subtle)" stroke-width="1" />
        
        <text x="${padLeft - 6}" y="${padTop + 8}" fill="var(--text-tertiary)" font-size="10" text-anchor="end" font-family="var(--font-mono)">${maxCount}</text>
        <text x="${padLeft - 6}" y="${padTop + chartH}" fill="var(--text-tertiary)" font-size="10" text-anchor="end" font-family="var(--font-mono)">0</text>

        ${barsHtml}
      </svg>
      <div class="chart-tooltip"></div>
    `;

    this.container.innerHTML = svgHtml;

    const tooltip = this.container.querySelector('.chart-tooltip');
    const bars = this.container.querySelectorAll('.r-dist-bar');

    bars.forEach(bar => {
      bar.addEventListener('mouseenter', () => {
        bar.style.opacity = '1';
        const label = bar.dataset.label;
        const count = bar.dataset.count;
        const pct = bar.dataset.pct;
        tooltip.innerHTML = `<span style="color:var(--text-tertiary);">R Bucket: ${label}</span><br><strong>${count} trades (${pct}%)</strong>`;
        tooltip.style.display = 'block';
        const rect = bar.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        tooltip.style.left = `${rect.left - containerRect.left + barWidth / 2}px`;
        tooltip.style.top = `${rect.top - containerRect.top}px`;
      });

      bar.addEventListener('mouseleave', () => {
        bar.style.opacity = bar.dataset.count > 0 ? '0.85' : '0.3';
        tooltip.style.display = 'none';
      });
    });
  }
}
