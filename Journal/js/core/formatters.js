/**
 * formatters.js
 * 格式化数字、货币、R倍数、百分比、时间戳。
 * 遵循极简、扁平、清晰的专业金融规范。
 */

/**
 * 格式化金额 ($)
 * @param {number|null|undefined} amount 
 * @param {boolean} showPlus 是否强制显示正号
 * @returns {string}
 */
export function formatCurrency(amount, showPlus = true) {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0.00';
  const val = Number(amount);
  const sign = val > 0 && showPlus ? '+' : (val < 0 ? '-' : '');
  const absFormatted = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${sign}$${absFormatted}`;
}

/**
 * 格式化 R 倍数
 * @param {number|null|undefined} r 
 * @param {boolean} showPlus 
 * @returns {string}
 */
export function formatR(r, showPlus = true) {
  if (r === null || r === undefined || isNaN(r)) return 'N/A';
  const val = Number(r);
  const sign = val > 0 && showPlus ? '+' : (val < 0 ? '-' : '');
  const absFormatted = Math.abs(val).toFixed(2);
  return `${sign}${absFormatted}R`;
}

/**
 * 格式化百分比 (%)
 * @param {number|null|undefined} pct 
 * @param {boolean} showPlus 
 * @returns {string}
 */
export function formatPercent(pct, showPlus = true) {
  if (pct === null || pct === undefined || isNaN(pct)) return 'N/A';
  const val = Number(pct);
  const sign = val > 0 && showPlus ? '+' : (val < 0 ? '-' : '');
  const absFormatted = Math.abs(val).toFixed(2);
  return `${sign}${absFormatted}%`;
}

/**
 * 格式化 RR (例如 2.50R)
 */
export function formatRR(rr) {
  if (rr === null || rr === undefined || isNaN(rr)) return 'N/A';
  return `${Number(rr).toFixed(2)}R`;
}

/**
 * 根据度量单位（$ / R / %）综合格式化数值
 * @param {number|null} val 
 * @param {'$' | 'R' | '%'} unit 
 * @param {boolean} showPlus 
 */
export function formatByUnit(val, unit, showPlus = true) {
  if (unit === 'R') return formatR(val, showPlus);
  if (unit === '%') return formatPercent(val, showPlus);
  return formatCurrency(val, showPlus);
}

/**
 * 格式化价格（自动适应小数位，外汇可能 4~5 位，加密货币可能多位，股票/黄金通常 2 位）
 */
export function formatPrice(price) {
  if (price === null || price === undefined || isNaN(price)) return '-';
  const val = Number(price);
  if (val === 0) return '0.00';
  const abs = Math.abs(val);
  if (abs < 0.01) return val.toFixed(6);
  if (abs < 1) return val.toFixed(4);
  if (abs < 10) return val.toFixed(4);
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/**
 * 获取颜色 CSS Class (微绿 / 微红 / 中性)
 */
export function getMetricColorClass(val) {
  if (val === null || val === undefined || isNaN(val)) return 'text-neutral';
  const num = Number(val);
  if (num > 0.0001) return 'text-profit';
  if (num < -0.0001) return 'text-loss';
  return 'text-neutral';
}
