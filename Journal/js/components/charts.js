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

/**
 * Cumulative Net P&L Area Chart (with soft gradient fill, responsive scaling)
 */
export class CumulativeAreaChart {
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
          No trades to render cumulative chart
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
      minVal -= 100;
      maxVal += 100;
    }

    const padTop = 16;
    const padBottom = 26;
    const padLeft = 52;
    const padRight = 16;
    const width = 640;
    const height = 220;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const getX = (idx) => padLeft + (idx / (points.length - 1 || 1)) * chartW;
    const getY = (val) => padTop + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;
    const zeroY = getY(0);

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.index).toFixed(1)} ${getY(p.val).toFixed(1)}`).join(' ');
    const lastX = getX(points[points.length - 1].index).toFixed(1);
    const firstX = getX(points[0].index).toFixed(1);
    const areaPath = `${linePath} L ${lastX} ${zeroY.toFixed(1)} L ${firstX} ${zeroY.toFixed(1)} Z`;

    const formatValLabel = (v) => {
      if (unit === 'R') return formatR(v);
      if (unit === '%') return formatPercent(v);
      return formatCurrency(v, false);
    };

    const gradientId = `cum-grad-${Math.random().toString(36).substring(2, 7)}`;

    const svgHtml = `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#4FC3A1" stop-opacity="0.32" />
            <stop offset="100%" stop-color="#4FC3A1" stop-opacity="0.02" />
          </linearGradient>
        </defs>

        <line x1="${padLeft}" y1="${padTop}" x2="${width - padRight}" y2="${padTop}" stroke="var(--border-subtle)" stroke-width="1" />
        <line x1="${padLeft}" y1="${padTop + chartH}" x2="${width - padRight}" y2="${padTop + chartH}" stroke="var(--border-subtle)" stroke-width="1" />
        <line x1="${padLeft}" y1="${zeroY}" x2="${width - padRight}" y2="${zeroY}" stroke="var(--border-strong)" stroke-dasharray="3,3" stroke-width="1" />
        
        <text x="${padLeft - 6}" y="${padTop + 4}" fill="var(--text-tertiary)" font-size="10" text-anchor="end" font-family="var(--font-mono)">${formatValLabel(maxVal)}</text>
        <text x="${padLeft - 6}" y="${zeroY + 3}" fill="var(--text-secondary)" font-size="10" text-anchor="end" font-family="var(--font-mono)">0</text>
        <text x="${padLeft - 6}" y="${padTop + chartH}" fill="var(--text-tertiary)" font-size="10" text-anchor="end" font-family="var(--font-mono)">${formatValLabel(minVal)}</text>

        <path d="${areaPath}" fill="url(#${gradientId})" />
        <path d="${linePath}" fill="none" stroke="#4FC3A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

        ${points.map((p) => `
          <circle cx="${getX(p.index)}" cy="${getY(p.val)}" r="3" fill="var(--surface)" stroke="#4FC3A1" stroke-width="1.8" class="chart-node" data-date="${p.date}" data-val="${p.val}" style="cursor: pointer;" />
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

/**
 * Zella Score Spider / Radar Chart
 * Dimensions: Consistency, Win %, Profit Factor, Recovery, Max DD, Avg Win/Loss
 */
export class ZellaRadarChart {
  constructor(options = {}) {
    this.container = options.container;
    this.metrics = options.metrics || {};
    this.init();
  }

  update(metrics) {
    this.metrics = metrics;
    this.render();
  }

  init() {
    this.render();
  }

  calculateScores() {
    const m = this.metrics;
    
    // 1. Consistency: based on plan adherence or win streak stability (0 - 100)
    const consistency = Math.min(100, Math.max(20, m.planAdherenceRate || 75));
    
    // 2. Win %: normalized around 50% target (0 - 100)
    const winRate = Math.min(100, Math.max(10, ((m.winRate || 50) / 70) * 100));
    
    // 3. Profit Factor: normalized around 2.0 (0 - 100)
    const pfVal = m.profitFactor ? Number(m.profitFactor) : 1.2;
    const profitFactor = Math.min(100, Math.max(15, (pfVal / 2.5) * 100));
    
    // 4. Recovery Factor: Net P&L / abs(Max DD)
    const maxDD = Math.abs(m.maxDrawdownAmount || 1);
    const netPnl = Math.max(0, m.netPnl || 0);
    const recoveryRatio = maxDD > 0 ? netPnl / maxDD : 1;
    const recovery = Math.min(100, Math.max(20, Math.min(recoveryRatio * 25, 100)));
    
    // 5. Max Drawdown score (higher score = lower drawdown)
    const ddScore = Math.max(20, 100 - Math.min(80, (maxDD / (Math.max(1, netPnl + maxDD))) * 100));
    
    // 6. Avg Win / Loss ratio normalized (2.0 = 80)
    const avgWin = m.averageWin || 100;
    const avgLoss = Math.abs(m.averageLoss || 100);
    const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : 1;
    const avgWinLoss = Math.min(100, Math.max(15, (winLossRatio / 2.5) * 100));

    const overall = (consistency * 0.2 + winRate * 0.2 + profitFactor * 0.2 + recovery * 0.15 + ddScore * 0.15 + avgWinLoss * 0.1);

    return {
      scores: [
        { label: 'Consistency', value: Math.round(consistency) },
        { label: 'Profit Factor', value: Math.round(profitFactor) },
        { label: 'Recovery', value: Math.round(recovery) },
        { label: 'Avg Win/Loss', value: Math.round(avgWinLoss) },
        { label: 'Max DD', value: Math.round(ddScore) },
        { label: 'Win %', value: Math.round(winRate) }
      ],
      overallScore: Number(overall.toFixed(2))
    };
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const { scores, overallScore } = this.calculateScores();

    const width = 320;
    const height = 220;
    const centerX = 160;
    const centerY = 105;
    const radius = 75;
    const totalAxes = scores.length;
    const angleStep = (Math.PI * 2) / totalAxes;

    // Rings (20%, 40%, 60%, 80%, 100%)
    const levels = [0.2, 0.4, 0.6, 0.8, 1.0];
    const webPaths = levels.map(level => {
      const r = radius * level;
      const pts = [];
      for (let i = 0; i < totalAxes; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="none" stroke="var(--border-subtle)" stroke-width="1" />`;
    }).join('');

    // Axis lines & labels
    const axisSvg = scores.map((s, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const xEnd = centerX + radius * Math.cos(angle);
      const yEnd = centerY + radius * Math.sin(angle);

      // Label offset
      const xLabel = centerX + (radius + 18) * Math.cos(angle);
      const yLabel = centerY + (radius + 14) * Math.sin(angle);

      let textAnchor = 'middle';
      if (Math.abs(Math.cos(angle)) > 0.3) {
        textAnchor = Math.cos(angle) > 0 ? 'start' : 'end';
      }

      return `
        <line x1="${centerX}" y1="${centerY}" x2="${xEnd.toFixed(1)}" y2="${yEnd.toFixed(1)}" stroke="var(--border-subtle)" stroke-width="1" />
        <text x="${xLabel.toFixed(1)}" y="${yLabel.toFixed(1)}" fill="var(--text-tertiary)" font-size="9" text-anchor="${textAnchor}" font-weight="500">${s.label}</text>
      `;
    }).join('');

    // Data polygon
    const dataPoints = scores.map((s, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const r = radius * (Math.min(100, Math.max(10, s.value)) / 100);
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      return { x, y, val: s.value, label: s.label };
    });

    const polygonPts = dataPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const html = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; height: 100%;">
        <svg viewBox="0 0 ${width} ${height}" style="width: 100%; max-height: 180px; overflow: visible;">
          ${webPaths}
          ${axisSvg}
          <polygon points="${polygonPts}" fill="rgba(91, 85, 217, 0.22)" stroke="var(--accent)" stroke-width="2" class="radar-polygon" />
          ${dataPoints.map(p => `
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--surface)" stroke="var(--accent)" stroke-width="2" />
          `).join('')}
        </svg>

        <!-- Zella Score Progress Bar -->
        <div style="width: 100%; padding: 0 10px 4px 10px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
            <span style="font-size: 10.5px; font-weight: 700; color: var(--text-secondary); letter-spacing: 0.5px; text-transform: uppercase;">Zella Score</span>
            <span style="font-size: 15px; font-weight: 800; font-family: var(--font-mono); color: var(--text-main);">${overallScore}</span>
          </div>
          <div style="height: 6px; width: 100%; background: var(--surface-active); border-radius: 999px; overflow: hidden; position: relative;">
            <div class="score-progress-fill" style="position: absolute; left: 0; top: 0; bottom: 0; width: ${Math.min(100, overallScore)}%; background: linear-gradient(90deg, #F59E0B 0%, #10B981 100%); border-radius: 999px;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 8.5px; color: var(--text-tertiary); margin-top: 2px; font-family: var(--font-mono);">
            <span>0</span>
            <span>20</span>
            <span>40</span>
            <span>60</span>
            <span>80</span>
            <span>100</span>
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
  }
}

/**
 * Render Circular / Donut Gauge SVG (for Win % or Profit Factor)
 */
export function renderCircularGauge(pct = 0, color = '#5B55D9', size = 54) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampPct = Math.min(100, Math.max(0, pct));
  const dashOffset = circumference - (clampPct / 100) * circumference;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(-90deg);" class="gauge-svg">
      <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="var(--border-subtle)" stroke-width="${strokeWidth}" />
      <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" stroke-linecap="round" class="gauge-circle-fill gauge-circle-anim" style="--gauge-dashoffset: ${dashOffset}; --gauge-circumference: ${circumference};" />
    </svg>
  `;
}

/**
 * Render Semi-Circle Gauge SVG (for Day Win %)
 */
export function renderSemiGauge(pct = 0, color = '#4FC3A1', width = 64, height = 36) {
  const strokeWidth = 6;
  const radius = width / 2 - strokeWidth;
  const cx = width / 2;
  const cy = height;
  const circumference = Math.PI * radius;
  const clampPct = Math.min(100, Math.max(0, pct));
  const dashOffset = circumference - (clampPct / 100) * circumference;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="gauge-semi-svg">
      <path d="M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}" fill="none" stroke="var(--border-subtle)" stroke-width="${strokeWidth}" stroke-linecap="round" />
      <path d="M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" stroke-linecap="round" class="gauge-arc-fill gauge-semi-anim" style="--gauge-semi-dashoffset: ${dashOffset}; --gauge-semi-circumference: ${circumference};" />
    </svg>
  `;
}

/**
 * Render Win / Loss Comparison Dual Bars
 */
export function renderWinLossBar(avgWin = 0, avgLoss = 0, ratio = 1) {
  const total = Math.max(1, avgWin + Math.abs(avgLoss));
  const winPct = Math.round((avgWin / total) * 100);
  const lossPct = 100 - winPct;

  return `
    <div style="width: 100%; display: flex; flex-direction: column; gap: 3px;">
      <div style="display: flex; justify-content: space-between; font-size: 9.5px; font-family: var(--font-mono);">
        <span style="color: var(--profit-color);">$${(avgWin / 1000).toFixed(2)}k</span>
        <span style="color: var(--loss-color);">$${(Math.abs(avgLoss) / 1000).toFixed(2)}k</span>
      </div>
      <div style="display: flex; height: 5px; width: 100%; border-radius: 999px; overflow: hidden; background: var(--surface-active);">
        <div class="win-loss-split-win" style="width: ${winPct}%; background: var(--profit-color); transition: width 0.4s ease;"></div>
        <div class="win-loss-split-loss" style="width: ${lossPct}%; background: var(--loss-color); transition: width 0.4s ease;"></div>
      </div>
    </div>
  `;
}

/**
 * Horizontal Bar Chart for Reports (Days of week, Instruments, etc.)
 */
export class HorizontalBarChart {
  constructor(options = {}) {
    this.container = options.container;
    this.items = options.items || [];
    this.valueKey = options.valueKey || 'value';
    this.isCurrency = options.isCurrency || false;
    this.barColor = options.barColor || 'var(--accent)';
    this.init();
  }

  update(items) {
    this.items = items;
    this.render();
  }

  init() {
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const items = this.items;
    if (!items || items.length === 0) {
      this.container.innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); font-size: 11.5px;">
          No data available
        </div>
      `;
      return;
    }

    const maxVal = Math.max(1, ...items.map(i => Math.abs(i[this.valueKey] || 0)));

    const rowsHtml = items.map(item => {
      const val = item[this.valueKey] || 0;
      const pct = Math.min(100, (Math.abs(val) / maxVal) * 100);
      const isNegative = val < 0;
      const color = this.isCurrency ? (isNegative ? 'var(--loss-color)' : 'var(--profit-color)') : this.barColor;
      const formattedVal = this.isCurrency ? formatCurrency(val, false) : val;

      return `
        <div style="display: grid; grid-template-columns: 80px 1fr 65px; align-items: center; gap: 8px; font-size: 11px;">
          <div style="color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.label}</div>
          <div style="background: var(--surface-active); height: 8px; border-radius: 4px; overflow: hidden; display: flex;">
            <div class="horiz-bar-fill" style="width: ${pct}%; background: ${color}; height: 100%; border-radius: 4px;"></div>
          </div>
          <div style="font-family: var(--font-mono); text-align: right; font-weight: 600; color: ${this.isCurrency ? (isNegative ? 'var(--loss-color)' : 'var(--profit-color)') : 'var(--text-main)'};">
            ${formattedVal}
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; padding: 4px 0;">
        ${rowsHtml}
      </div>
    `;
  }
}
