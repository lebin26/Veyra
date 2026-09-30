/**
 * calculations.js
 * 纯粹的 P&L 与 R 计算引擎（Zero Balance Dependency）：
 * 彻底不依赖 account balance，纯粹基于每笔交易的 Entry, Exit, Size, SL 自动计算盈亏数据。
 */

/**
 * 自动从原始交易执行参数计算全套盈亏与风险数据
 * 纯粹计算 P&L 与 R，不依赖任何账户基准
 */
export function autoCalculateTrade(input) {
  const dir = String(input.direction || 'LONG').toUpperCase();
  const entry = Number(input.entry_price) || 0;
  const size = Number(input.position_size) || 1;
  const sl = input.stop_loss !== undefined && input.stop_loss !== null && input.stop_loss !== '' ? Number(input.stop_loss) : null;
  const tp = input.take_profit !== undefined && input.take_profit !== null && input.take_profit !== '' ? Number(input.take_profit) : null;
  const fees = Number(input.fees) || 0;

  // 1. Initial Risk $ 计算
  let riskAmt = null;
  if (input.initial_risk_amount !== undefined && input.initial_risk_amount !== null && input.initial_risk_amount !== '') {
    riskAmt = Number(input.initial_risk_amount);
  } else if (sl !== null && !isNaN(sl)) {
    riskAmt = Math.abs(entry - sl) * size;
  }

  // 2. Planned RR 计算
  const plannedRR = calculatePlannedRR(dir, entry, sl, tp);

  // 3. 判断是否尚未平仓 (OPEN 状态：下单即记录，出场再平仓二次录入)
  const hasExit = input.exit_price !== undefined && input.exit_price !== null && String(input.exit_price).trim() !== '';
  if (!hasExit) {
    return {
      status: 'OPEN',
      grossPnl: null,
      netPnl: null,
      initialRiskAmount: riskAmt,
      r: null,
      realizedR: null,
      plannedRR,
      result: 'OPEN'
    };
  }

  // 4. 已平仓 (CLOSED 状态)：计算 Gross & Net P&L 及实操 R
  const exit = Number(input.exit_price) || 0;
  let grossPnl = 0;
  if (dir === 'LONG') {
    grossPnl = (exit - entry) * size;
  } else if (dir === 'SHORT') {
    grossPnl = (entry - exit) * size;
  }

  let netPnl = grossPnl - fees;
  if (input.net_pnl !== undefined && input.net_pnl !== null && input.net_pnl !== '') {
    netPnl = Number(input.net_pnl);
  }

  // 5. 计算实操 R
  let r = null;
  if (riskAmt && riskAmt > 0) {
    r = netPnl / riskAmt;
  }

  // 6. 出场结果与类型分类 (Take Profit, Break Even, Stop Loss, 提早关闭-盈利, 提早关闭-亏损)
  let exitType = input.exit_type || null;

  if (!exitType) {
    if (Math.abs(netPnl) <= 0.0001) {
      exitType = 'BE';
    } else if (netPnl > 0) {
      if (tp !== null && !isNaN(tp)) {
        if ((dir === 'LONG' && exit >= tp) || (dir === 'SHORT' && exit <= tp)) {
          exitType = 'TP';
        } else {
          exitType = 'EARLY_PROFIT';
        }
      } else {
        exitType = 'TP';
      }
    } else {
      if (sl !== null && !isNaN(sl)) {
        if ((dir === 'LONG' && exit <= sl) || (dir === 'SHORT' && exit >= sl)) {
          exitType = 'SL';
        } else {
          exitType = 'EARLY_LOSS';
        }
      } else {
        exitType = 'SL';
      }
    }
  }

  let result = exitType;
  if (result === 'WIN') result = 'TP';
  if (result === 'LOSS') result = 'SL';

  return {
    status: 'CLOSED',
    grossPnl,
    netPnl,
    initialRiskAmount: riskAmt,
    r,
    plannedRR,
    realizedR: r,
    exitType,
    earlyCloseReason: input.early_close_reason || '',
    result
  };
}

export function calculateR(netPnl, initialRiskAmount) {
  if (initialRiskAmount === undefined || initialRiskAmount === null) return null;
  const risk = Number(initialRiskAmount);
  if (isNaN(risk) || risk <= 0) return null;
  const pnl = Number(netPnl);
  if (isNaN(pnl)) return null;
  return pnl / risk;
}

export function calculatePlannedRR(direction, entry, sl, tp) {
  const e = Number(entry);
  const s = Number(sl);
  const t = Number(tp);
  if (isNaN(e) || isNaN(s) || isNaN(t)) return null;

  const dir = String(direction).toUpperCase();
  let riskDist = 0;
  let rewardDist = 0;

  if (dir === 'LONG') {
    riskDist = e - s;
    rewardDist = t - e;
  } else if (dir === 'SHORT') {
    riskDist = s - e;
    rewardDist = e - t;
  } else {
    return null;
  }

  if (riskDist <= 0 || rewardDist <= 0) return null;
  return rewardDist / riskDist;
}

export function deriveTradeMetrics(rawTrade) {
  const calculated = autoCalculateTrade(rawTrade);
  return {
    ...rawTrade,
    net_pnl: calculated.netPnl,
    initial_risk_amount: calculated.initialRiskAmount,
    derived: {
      ...calculated
    }
  };
}

export function computeRDistribution(trades) {
  const buckets = [
    { label: '< -2R', count: 0, min: -Infinity, max: -2 },
    { label: '-2R ~ -1R', count: 0, min: -2, max: -1 },
    { label: '-1R ~ -0.5R', count: 0, min: -1, max: -0.5 },
    { label: '-0.5R ~ 0R', count: 0, min: -0.5, max: 0 },
    { label: '0R ~ 0.5R', count: 0, min: 0, max: 0.5 },
    { label: '0.5R ~ 1R', count: 0, min: 0.5, max: 1 },
    { label: '1R ~ 2R', count: 0, min: 1, max: 2 },
    { label: '2R ~ 3R', count: 0, min: 2, max: 3 },
    { label: '> 3R', count: 0, min: 3, max: Infinity }
  ];

  let validRCount = 0;

  trades.forEach(t => {
    const derived = deriveTradeMetrics(t);
    const r = derived.derived.r;
    if (r === null) return;
    validRCount++;

    for (const b of buckets) {
      if (b.label === '< -2R' && r < -2) {
        b.count++;
        break;
      } else if (b.label === '> 3R' && r >= 3) {
        b.count++;
        break;
      } else if (r >= b.min && r < b.max) {
        b.count++;
        break;
      }
    }
  });

  return { buckets, validRCount };
}

/**
 * 汇总指标计算：
 * 纯粹计算 P&L 和 R 数据，完全不依赖账户余额基准
 */
export function aggregateMetrics(tradesList) {
  if (!tradesList || tradesList.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      beTrades: 0,
      winRate: 0,
      lossRate: 0,
      grossProfit: 0,
      grossLoss: 0,
      netPnl: 0,
      averageWin: 0,
      averageLoss: 0,
      payoffRatio: null,
      averageTrade: 0,
      averageR: null,
      totalR: 0,
      rCount: 0,
      expectancyAmount: 0,
      expectancyR: null,
      profitFactor: null,
      largestWin: 0,
      largestLoss: 0,
      winningStreak: 0,
      losingStreak: 0,
      maxDrawdownAmount: 0,
      maxDrawdownR: 0,
      cumulativeCurve: [],
      dailyDistribution: {},
      costOfMistakes: 0,
      mistakeTradesCount: 0,
      pnlWithoutMistakes: 0,
      planAdherenceRate: 100,
      followedPlanCount: 0,
      brokePlanCount: 0,
      rDistribution: { buckets: [], validRCount: 0 }
    };
  }

  const sorted = [...tradesList].sort((a, b) => {
    const timeA = `${a.date || ''} ${a.time || '00:00'}`;
    const timeB = `${b.date || ''} ${b.time || '00:00'}`;
    return timeA.localeCompare(timeB);
  });

  const openTrades = [];
  const closedTrades = [];

  sorted.forEach(rawTrade => {
    const hasExit = rawTrade.exit_price !== undefined && rawTrade.exit_price !== null && String(rawTrade.exit_price).trim() !== '';
    if (hasExit) {
      closedTrades.push(rawTrade);
    } else {
      openTrades.push(rawTrade);
    }
  });

  const openRiskTotal = openTrades.reduce((acc, t) => {
    const derived = deriveTradeMetrics(t).derived;
    return acc + (derived.initialRiskAmount || 0);
  }, 0);

  if (closedTrades.length === 0) {
    return {
      totalTrades: 0,
      openTradesCount: openTrades.length,
      openTrades,
      openRiskTotal,
      winningTrades: 0,
      losingTrades: 0,
      beTrades: 0,
      winRate: 0,
      lossRate: 0,
      grossProfit: 0,
      grossLoss: 0,
      netPnl: 0,
      averageWin: 0,
      averageLoss: 0,
      payoffRatio: null,
      averageTrade: 0,
      averageR: null,
      totalR: 0,
      rCount: 0,
      expectancyAmount: 0,
      expectancyR: null,
      profitFactor: null,
      largestWin: 0,
      largestLoss: 0,
      winningStreak: 0,
      losingStreak: 0,
      maxDrawdownAmount: 0,
      maxDrawdownR: 0,
      cumulativeCurve: [],
      dailyDistribution: {},
      costOfMistakes: 0,
      mistakeTradesCount: 0,
      pnlWithoutMistakes: 0,
      planAdherenceRate: 100,
      followedPlanCount: 0,
      brokePlanCount: 0,
      rDistribution: { buckets: [], validRCount: 0 }
    };
  }

  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let beTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let netPnl = 0;

  let totalR = 0;
  let rCount = 0;

  let largestWin = 0;
  let largestLoss = 0;

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  let runningPnl = 0;
  let runningR = 0;
  let peakPnl = 0;
  let peakR = 0;
  let maxDDAmt = 0;
  let maxDDR = 0;

  const cumulativeCurve = [];
  const dailyDistribution = {};

  let costOfMistakes = 0;
  let mistakeTradesCount = 0;
  let followedPlanCount = 0;
  let brokePlanCount = 0;

  let tpCount = 0;
  let beCount = 0;
  let slCount = 0;
  let earlyProfitCount = 0;
  let earlyLossCount = 0;

  closedTrades.forEach((rawTrade, index) => {
    totalTrades++;
    const derived = deriveTradeMetrics(rawTrade).derived;
    const pnl = derived.netPnl;
    netPnl += pnl;
    runningPnl += pnl;

    const outcome = rawTrade.exit_type || derived.exitType || derived.result;
    if (outcome === 'TP' || outcome === 'TAKE_PROFIT') tpCount++;
    else if (outcome === 'BE' || outcome === 'BREAK_EVEN') beCount++;
    else if (outcome === 'SL' || outcome === 'STOP_LOSS') slCount++;
    else if (outcome === 'EARLY_PROFIT') earlyProfitCount++;
    else if (outcome === 'EARLY_LOSS') earlyLossCount++;

    const r = derived.r;
    if (r !== null) {
      totalR += r;
      runningR += r;
      rCount++;
    }

    if (pnl > 0.0001) {
      winningTrades++;
      grossProfit += pnl;
      if (pnl > largestWin) largestWin = pnl;
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else if (pnl < -0.0001) {
      losingTrades++;
      grossLoss += Math.abs(pnl);
      if (pnl < largestLoss) largestLoss = pnl;
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    } else {
      beTrades++;
      currentWinStreak = 0;
      currentLossStreak = 0;
    }

    if (rawTrade.mistake && String(rawTrade.mistake).trim() !== '' && rawTrade.mistake !== 'None') {
      mistakeTradesCount++;
      if (pnl < 0) {
        costOfMistakes += Math.abs(pnl);
      }
    }

    if (rawTrade.followed_plan === false || rawTrade.followed_plan === 'false' || rawTrade.followed_plan === 'No') {
      brokePlanCount++;
    } else {
      followedPlanCount++;
    }

    if (runningPnl > peakPnl) peakPnl = runningPnl;
    const currentDDAmt = peakPnl - runningPnl;
    if (currentDDAmt > maxDDAmt) maxDDAmt = currentDDAmt;

    if (runningR > peakR) peakR = runningR;
    const currentDDR = peakR - runningR;
    if (currentDDR > maxDDR) maxDDR = currentDDR;

    cumulativeCurve.push({
      tradeIndex: index + 1,
      date: rawTrade.date,
      time: rawTrade.time,
      pnl: runningPnl,
      r: runningR,
      tradePnl: pnl,
      tradeR: r
    });

    const dateKey = rawTrade.date || 'Unknown';
    if (!dailyDistribution[dateKey]) {
      dailyDistribution[dateKey] = {
        date: dateKey,
        trades: 0,
        pnl: 0,
        r: 0,
        wins: 0,
        losses: 0
      };
    }
    dailyDistribution[dateKey].trades++;
    dailyDistribution[dateKey].pnl += pnl;
    if (r !== null) dailyDistribution[dateKey].r += r;
    if (pnl > 0.0001) dailyDistribution[dateKey].wins++;
    else if (pnl < -0.0001) dailyDistribution[dateKey].losses++;
  });

  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const lossRate = totalTrades > 0 ? (losingTrades / totalTrades) * 100 : 0;

  const averageWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
  const averageLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
  const averageTrade = totalTrades > 0 ? netPnl / totalTrades : 0;

  let payoffRatio = null;
  if (averageLoss > 0) {
    payoffRatio = averageWin / averageLoss;
  }

  const averageR = rCount > 0 ? totalR / rCount : null;
  const expectancyR = averageR;

  let profitFactor = null;
  if (grossLoss > 0) {
    profitFactor = grossProfit / grossLoss;
  }

  const pWin = winRate / 100;
  const pLoss = lossRate / 100;
  const expectancyAmount = (pWin * averageWin) - (pLoss * averageLoss);

  const pnlWithoutMistakes = netPnl + costOfMistakes;
  const planAuditedTotal = followedPlanCount + brokePlanCount;
  const planAdherenceRate = planAuditedTotal > 0 ? (followedPlanCount / planAuditedTotal) * 100 : 100;
  const rDistribution = computeRDistribution(closedTrades);

  return {
    totalTrades,
    openTradesCount: openTrades.length,
    openTrades,
    openRiskTotal,
    closedTradesCount: closedTrades.length,
    winningTrades,
    losingTrades,
    beTrades,
    winRate,
    lossRate,
    grossProfit,
    grossLoss,
    netPnl,
    averageWin,
    averageLoss,
    payoffRatio,
    averageTrade,
    averageR,
    totalR,
    rCount,
    expectancyAmount,
    expectancyR,
    profitFactor,
    largestWin,
    largestLoss,
    winningStreak: maxWinStreak,
    losingStreak: maxLossStreak,
    maxDrawdownAmount: maxDDAmt,
    maxDrawdownR: maxDDR,
    cumulativeCurve,
    dailyDistribution,
    costOfMistakes,
    mistakeTradesCount,
    pnlWithoutMistakes,
    planAdherenceRate,
    followedPlanCount,
    brokePlanCount,
    tpCount,
    beCount,
    slCount,
    earlyProfitCount,
    earlyLossCount,
    earlyTradesCount: earlyProfitCount + earlyLossCount,
    rDistribution
  };
}
