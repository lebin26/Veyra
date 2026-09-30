/**
 * unitTests.js
 * 纯函数计算、隔离断言与 VEYRA 极速减负逻辑测试套件 (Zero Balance Dependency)
 */

import { calculateR, calculatePlannedRR, aggregateMetrics, computeRDistribution, autoCalculateTrade } from '../js/core/calculations.js';
import { validateTradeInput } from '../js/core/validator.js';

export function runAllUnitTests() {
  const results = [];
  const assert = (name, condition, message) => {
    if (condition) {
      results.push({ name, pass: true });
    } else {
      results.push({ name, pass: false, error: message });
      console.error(`FAIL: ${name} - ${message}`);
    }
  };

  // 1. 测试下单即记录 (OPEN 仓位，无 exit_price)
  const openOrder = autoCalculateTrade({
    direction: 'LONG',
    entry_price: 2650,
    exit_price: null,
    position_size: 1,
    stop_loss: 2645,
    take_profit: 2670
  });

  assert('Open Order Status is OPEN', openOrder.status === 'OPEN', `Expected OPEN, got ${openOrder.status}`);
  assert('Open Order Result is OPEN', openOrder.result === 'OPEN', `Expected OPEN, got ${openOrder.result}`);
  assert('Open Order Net PnL is null', openOrder.netPnl === null, `Expected null, got ${openOrder.netPnl}`);
  assert('Open Order Risk is 5', openOrder.initialRiskAmount === 5, `Expected 5, got ${openOrder.initialRiskAmount}`);
  assert('Open Order Planned RR is 4.0', openOrder.plannedRR === 4.0, `Expected 4.0, got ${openOrder.plannedRR}`);

  // 1.1 校验器对 OPEN 单不强制要求 exit_price
  const openValidation = validateTradeInput({
    symbol: 'XAUUSD',
    direction: 'LONG',
    entry_price: 2650,
    exit_price: null,
    position_size: 1,
    stop_loss: 2645,
    date: '2026-09-29'
  });
  assert('Validator accepts Open Order without exit_price', openValidation.isValid === true, `Expected valid, got errors: ${openValidation.errors.join(', ')}`);

  // 2. 测试平仓出场二次录入 (autoCalculateTrade with exit_price)
  // XAUUSD Long, Entry 2650, Exit 2660, Size 1, SL 2645 -> PnL = +$10, Risk = $5, R = +2.0R
  const longCalc = autoCalculateTrade({
    direction: 'LONG',
    entry_price: 2650,
    exit_price: 2660,
    position_size: 1,
    stop_loss: 2645,
    take_profit: 2670
  });

  assert('Auto PnL Long is +10', longCalc.netPnl === 10, `Expected 10, got ${longCalc.netPnl}`);
  assert('Auto Risk Long is 5', longCalc.initialRiskAmount === 5, `Expected 5, got ${longCalc.initialRiskAmount}`);
  assert('Auto Result Long before TP is EARLY_PROFIT', longCalc.result === 'EARLY_PROFIT', `Expected EARLY_PROFIT, got ${longCalc.result}`);

  const fullTpCalc = autoCalculateTrade({
    direction: 'LONG',
    entry_price: 2650,
    exit_price: 2670,
    position_size: 1,
    stop_loss: 2645,
    take_profit: 2670
  });
  assert('Full Take Profit detection is TP', fullTpCalc.result === 'TP' && fullTpCalc.exitType === 'TP', `Expected TP, got ${fullTpCalc.result}`);

  // XAUUSD Short, Entry 2660, Exit 2650, Size 2, SL 2665 -> PnL = +$20, Risk = $10, R = +2.0R
  const shortCalc = autoCalculateTrade({
    direction: 'SHORT',
    entry_price: 2660,
    exit_price: 2650,
    position_size: 2,
    stop_loss: 2665
  });

  assert('Auto PnL Short is +20', shortCalc.netPnl === 20, `Expected 20, got ${shortCalc.netPnl}`);
  assert('Auto Risk Short is 10', shortCalc.initialRiskAmount === 10, `Expected 10, got ${shortCalc.initialRiskAmount}`);
  assert('Auto R Short is +2.0R', shortCalc.r === 2.0, `Expected 2.0, got ${shortCalc.r}`);

  // 2.1 测试 5 种出场结果类型 (Take Profit, Break Even, Stop Loss, 提早关闭-盈利, 提早关闭-亏损)
  const beCalc = autoCalculateTrade({
    direction: 'LONG',
    entry_price: 2650,
    exit_price: 2650,
    position_size: 1,
    stop_loss: 2645
  });
  assert('Break Even detection', beCalc.exitType === 'BE' && beCalc.netPnl === 0, `Expected BE, got ${beCalc.exitType}`);

  const slCalc = autoCalculateTrade({
    direction: 'LONG',
    entry_price: 2650,
    exit_price: 2645,
    position_size: 1,
    stop_loss: 2645
  });
  assert('Stop Loss detection', slCalc.exitType === 'SL' && slCalc.netPnl === -5, `Expected SL, got ${slCalc.exitType}`);

  const earlyWinCalc = autoCalculateTrade({
    direction: 'LONG',
    entry_price: 2650,
    exit_price: 2660,
    position_size: 1,
    stop_loss: 2645,
    take_profit: 2670,
    exit_type: 'EARLY_PROFIT',
    early_close_reason: '动能衰竭/背离'
  });
  assert('Early Profit exit type saved', earlyWinCalc.exitType === 'EARLY_PROFIT', `Expected EARLY_PROFIT, got ${earlyWinCalc.exitType}`);
  assert('Early Profit reason saved', earlyWinCalc.earlyCloseReason === '动能衰竭/背离', `Expected reason, got ${earlyWinCalc.earlyCloseReason}`);

  const earlyLossCalc = autoCalculateTrade({
    direction: 'LONG',
    entry_price: 2650,
    exit_price: 2648,
    position_size: 1,
    stop_loss: 2645,
    exit_type: 'EARLY_LOSS',
    early_close_reason: '盘面结构转变'
  });
  assert('Early Loss exit type saved', earlyLossCalc.exitType === 'EARLY_LOSS', `Expected EARLY_LOSS, got ${earlyLossCalc.exitType}`);
  assert('Early Loss reason saved', earlyLossCalc.earlyCloseReason === '盘面结构转变', `Expected reason, got ${earlyLossCalc.earlyCloseReason}`);

  // 2.2 测试提早关闭必须填写原因的校验逻辑 (Mandatory Early Close Reason)
  const missingReasonValidation1 = validateTradeInput({
    symbol: 'XAUUSD',
    direction: 'LONG',
    entry_price: 2650,
    exit_price: 2660,
    position_size: 1,
    stop_loss: 2645,
    date: '2026-09-29',
    exit_type: 'EARLY_PROFIT',
    early_close_reason: ''
  });
  assert('EARLY_PROFIT without reason fails validation', missingReasonValidation1.isValid === false, 'Should fail without reason');

  const withReasonValidation1 = validateTradeInput({
    symbol: 'XAUUSD',
    direction: 'LONG',
    entry_price: 2650,
    exit_price: 2660,
    position_size: 1,
    stop_loss: 2645,
    date: '2026-09-29',
    exit_type: 'EARLY_PROFIT',
    early_close_reason: '盘口出现空头大单阻截'
  });
  assert('EARLY_PROFIT with reason passes validation', withReasonValidation1.isValid === true, 'Should pass with reason');

  const missingReasonValidation2 = validateTradeInput({
    symbol: 'XAUUSD',
    direction: 'LONG',
    entry_price: 2650,
    exit_price: 2648,
    position_size: 1,
    stop_loss: 2645,
    date: '2026-09-29',
    exit_type: 'EARLY_LOSS',
    early_close_reason: ''
  });
  assert('EARLY_LOSS without reason fails validation', missingReasonValidation2.isValid === false, 'Should fail without reason');

  // 3. 基础 R 计算
  assert('R positive test', calculateR(400, 200) === 2.0, '400 / 200 should be +2R');
  assert('R negative test', calculateR(-100, 200) === -0.5, '-100 / 200 should be -0.5R');

  // 4. VEYRA 特色逻辑测试：混合已平仓与持仓中单，准确隔离已实现统计
  const testTrades = [
    { id: '1', date: '2026-09-01', entry_price: 100, exit_price: 102, position_size: 100, stop_loss: 99, direction: 'LONG', exit_type: 'TP', followed_plan: true, mistake: '' }, // +200, Risk=100 (+2R)
    { id: '2', date: '2026-09-02', entry_price: 100, exit_price: 99, position_size: 100, stop_loss: 99, direction: 'LONG', exit_type: 'SL', followed_plan: true, mistake: '' }, // -100, Risk=100 (-1R)
    { id: '3', date: '2026-09-03', entry_price: 100, exit_price: 98, position_size: 100, stop_loss: 99, direction: 'LONG', exit_type: 'SL', followed_plan: false, mistake: 'FOMO' }, // -200, Risk=100 (-2R, mistake)
    { id: '4', date: '2026-09-04', entry_price: 100, exit_price: 101, position_size: 100, stop_loss: 99, direction: 'LONG', exit_type: 'EARLY_PROFIT', early_close_reason: '动能衰竭', followed_plan: true, mistake: '' }, // +100, Risk=100 (+1R)
    { id: '5', date: '2026-09-05', entry_price: 100, exit_price: 100, position_size: 100, stop_loss: 99, direction: 'LONG', exit_type: 'BE', followed_plan: true, mistake: '' }, // $0 (BE)
    { id: '6', date: '2026-09-06', entry_price: 100, exit_price: null, position_size: 50, stop_loss: 99, direction: 'LONG' } // OPEN, Risk=50
  ];

  const m = aggregateMetrics(testTrades);
  assert('Total Closed Trades is 5', m.totalTrades === 5, `Expected 5, got ${m.totalTrades}`);
  assert('Open Trades Count is 1', m.openTradesCount === 1, `Expected 1, got ${m.openTradesCount}`);
  assert('Open Risk Total is 50', m.openRiskTotal === 50, `Expected 50, got ${m.openRiskTotal}`);
  assert('Net P&L of Closed is +0', m.netPnl === 0, `Expected 0, got ${m.netPnl}`);
  assert('TP Count is 1', m.tpCount === 1, `Expected 1, got ${m.tpCount}`);
  assert('BE Count is 1', m.beCount === 1, `Expected 1, got ${m.beCount}`);
  assert('SL Count is 2', m.slCount === 2, `Expected 2, got ${m.slCount}`);
  assert('Early Profit Count is 1', m.earlyProfitCount === 1, `Expected 1, got ${m.earlyProfitCount}`);
  assert('Early Trades Count is 1', m.earlyTradesCount === 1, `Expected 1, got ${m.earlyTradesCount}`);
  assert('Cost of Mistakes is 200', m.costOfMistakes === 200, `Expected 200, got ${m.costOfMistakes}`);
  assert('Plan Adherence Rate is 80%', m.planAdherenceRate === 80, `Expected 80%, got ${m.planAdherenceRate}%`);

  // 5. 数据隔离验证
  const mockLive = Array.from({ length: 10 }, (_, i) => ({
    id: `l_${i}`, entry_price: 100, exit_price: 101, position_size: 10, stop_loss: 99, direction: 'LONG', date: '2026-09-01'
  }));
  const mockBacktest = Array.from({ length: 20 }, (_, i) => ({
    id: `bt_${i}`, book_id: 'b1', entry_price: 100, exit_price: 102, position_size: 10, stop_loss: 99, direction: 'LONG', date: '2026-09-01'
  }));

  const liveM = aggregateMetrics(mockLive);
  const btM = aggregateMetrics(mockBacktest);
  assert('Live count is strictly 10', liveM.totalTrades === 10, 'Live should be 10');
  assert('Backtest count is strictly 20', btM.totalTrades === 20, 'Backtest should be 20');

  return results;
}
