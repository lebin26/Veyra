/**
 * validator.js
 * 极速减负校验器：
 * 绝不强制要求填写过多字段。
 * 
 * Required (必填仅 7 项):
 * - Symbol
 * - Side (LONG / SHORT)
 * - Entry Price
 * - Exit Price
 * - Position Size
 * - Stop Loss
 * - Date
 * 
 * Optional (其余全部可选，绝不阻止保存):
 * - TP, Strategy, Setup, Screenshot, Emotion, Mistake, Rating, Notes
 */

export function validateTradeInput(formData) {
  const errors = [];
  const warnings = [];

  // 1. Required Validation (仅核心 7 项)
  if (!formData.date || String(formData.date).trim() === '') {
    errors.push('Date is required.');
  }

  if (!formData.symbol || String(formData.symbol).trim() === '') {
    errors.push('Symbol is required.');
  }

  if (!formData.direction || !['LONG', 'SHORT'].includes(String(formData.direction).toUpperCase())) {
    errors.push('Direction (LONG/SHORT) is required.');
  }

  if (formData.entry_price === undefined || formData.entry_price === null || String(formData.entry_price).trim() === '') {
    errors.push('Entry price is required.');
  } else if (isNaN(Number(formData.entry_price))) {
    errors.push('Entry price must be a valid number.');
  }

  // Exit price is OPTIONAL on initial order entry (provided upon exit/close)
  if (formData.exit_price !== undefined && formData.exit_price !== null && String(formData.exit_price).trim() !== '') {
    if (isNaN(Number(formData.exit_price))) {
      errors.push('Exit price must be a valid number.');
    }
  }

  if (formData.position_size === undefined || formData.position_size === null || String(formData.position_size).trim() === '') {
    errors.push('Position size is required.');
  } else if (isNaN(Number(formData.position_size)) || Number(formData.position_size) <= 0) {
    errors.push('Position size must be greater than 0.');
  }

  if (formData.stop_loss === undefined || formData.stop_loss === null || String(formData.stop_loss).trim() === '') {
    errors.push('Stop Loss is required for calculating Risk and R.');
  } else if (isNaN(Number(formData.stop_loss))) {
    errors.push('Stop Loss must be a valid number.');
  }

  // 提早关闭必须写原因 (分为盈利/亏损地提早关闭)
  const exitType = formData.exit_type || formData.result;
  if (exitType === 'EARLY_PROFIT' || exitType === 'EARLY_LOSS') {
    if (!formData.early_close_reason || String(formData.early_close_reason).trim() === '') {
      errors.push('提早关闭必须填写原因 (Reason for early close is required).');
    }
  }

  // 2. Soft Warnings (仅作为交易纪律友善提示，绝不阻止保存)
  const dir = String(formData.direction).toUpperCase();
  const entry = Number(formData.entry_price);
  const sl = Number(formData.stop_loss);

  if (!isNaN(entry) && !isNaN(sl)) {
    if (dir === 'LONG' && sl >= entry) {
      warnings.push('Reminder: For LONG trades, Stop Loss is typically below Entry.');
    } else if (dir === 'SHORT' && sl <= entry) {
      warnings.push('Reminder: For SHORT trades, Stop Loss is typically above Entry.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
