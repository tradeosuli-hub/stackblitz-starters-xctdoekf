/**
 * SMC Analyzer v4.0.0 - Execution Engine
 * فاز 3: موتور اجرا
 */

// ============================================
// 1. POSITION SIZING ENGINE
// ============================================

export class PositionSizingEngine {
  /**
   * محاسبه سایز براساس ریسک
   * سایز = (Account Size × Risk Percent) / (Entry - SL)
   */
  calculateRiskBasedSize(accountSize, riskPercent, entry, stopLoss) {
    const riskAmount = accountSize * (riskPercent / 100);
    const riskPerUnit = Math.abs(entry - stopLoss);

    if (riskPerUnit === 0) return 0;

    return riskAmount / riskPerUnit;
  }

  /**
   * محاسبه سایز براساس ATR
   * سایز = Account Size / (ATR × 2)
   */
  calculateATRBasedSize(accountSize, atr, leverage = 1) {
    const positionValue = accountSize / (atr * 2) / 100;
    return positionValue * leverage;
  }

  /**
   * محاسبه سایز با در نظرگرفتن Volatility
   */
  calculateVolatilityAdjustedSize(baseSize, atrPercent, maxAtrPercent = 2) {
    const volatilityRatio = atrPercent / maxAtrPercent;
    const adjustedSize = baseSize / (1 + volatilityRatio);

    return {
      baseSize,
      volatilityRatio,
      adjustedSize: Math.round(adjustedSize * 100) / 100,
      recommendation: volatilityRatio > 1.5 ? 'کاهش سایز' : volatilityRatio > 1 ? 'سایز معمولی' : 'سایز بیشتر'
    };
  }

  /**
   * محاسبه Kelly Criterion
   * Kelly % = (Win Rate × Avg Win - Loss Rate × Avg Loss) / Avg Win
   */
  calculateKellyCriterion(winRate, avgWin, avgLoss) {
    const lossRate = 1 - winRate;
    const kelly = (winRate * avgWin - lossRate * avgLoss) / avgWin;

    return {
      kellyCriterion: Math.max(kelly, 0),
      recommendedSize: Math.max(kelly * 0.25, 0), // 25% برای کاهش ریسک
      fractionalKelly: kelly * 0.5 // Fractional Kelly
    };
  }

  /**
   * محاسبه سایز برای Scale In
   */
  calculateScaleInSizes(totalSize, levels = 3) {
    const sizes = [];
    const perLevel = totalSize / levels;

    for (let i = 0; i < levels; i++) {
      sizes.push({
        level: i + 1,
        size: perLevel,
        percentage: (perLevel / totalSize) * 100
      });
    }

    return sizes;
  }
}

// ============================================
// 2. LIMIT ORDER ENGINE
// ============================================

export class LimitOrderEngine {
  /**
   * محاسبه Limit Price براساس FVG
   */
  calculateFVGLimitPrice(fvg, slippage = 0.001) {
    return {
      fvgMidpoint: fvg.midpoint,
      limitPrice: fvg.midpoint * (1 - slippage),
      maxDeviation: fvg.midpoint * 0.005,
      timeLimit: 300000 // 5 دقیقه
    };
  }

  /**
   * محاسبه Limit Price براساس OB Retest
   */
  calculateOBLimitPrice(orderBlock, direction, slippage = 0.001) {
    if (direction === 'LONG') {
      return {
        obLevel: orderBlock.obLow,
        limitPrice: orderBlock.obLow * (1 - slippage),
        maxPrice: orderBlock.obLow * (1 + 0.005)
      };
    } else {
      return {
        obLevel: orderBlock.obHigh,
        limitPrice: orderBlock.obHigh * (1 + slippage),
        minPrice: orderBlock.obHigh * (1 - 0.005)
      };
    }
  }

  /**
   * تشخیص اگر Limit Order Fill شد
   */
  detectLimitFill(currentPrice, limitOrder, direction, tolerance = 0.002) {
    if (direction === 'LONG') {
      return currentPrice <= limitOrder.limitPrice * (1 + tolerance);
    } else {
      return currentPrice >= limitOrder.limitPrice * (1 - tolerance);
    }
  }

  /**
   * Partial Orders برای Scale In/Out
   */
  createPartialOrders(entry, tp, sl, levels = 3) {
    const orders = [];
    const profitRange = tp - entry;
    const lossRange = entry - sl;

    // Partial TPs
    for (let i = 1; i < levels; i++) {
      const tpLevel = entry + (profitRange * (i / levels));
      orders.push({
        type: 'TP',
        level: i,
        price: tpLevel,
        percentage: `${(i / levels) * 100}%`,
        size: `${(100 / levels).toFixed(0)}%`
      });
    }

    // Scale In SLs
    for (let i = 1; i < levels; i++) {
      const slLevel = entry - (lossRange * (i / levels));
      orders.push({
        type: 'SL',
        level: i,
        price: slLevel,
        size: `${(100 / levels).toFixed(0)}%`
      });
    }

    return orders;
  }
}

// ============================================
// 3. STOP LOSS & TAKE PROFIT ENGINE
// ============================================

export class TPSLEngine {
  /**
   * محاسبه TP/SL براساس Liquidity Pool
   */
  calculateTPSLFromLiquidity(entry, direction, liquidityPool, riskReward = 1.5) {
    if (direction === 'LONG') {
      const sl = liquidityPool.supportLevel;
      const tp = entry + (entry - sl) * riskReward;

      return {
        entry,
        sl,
        tp,
        riskReward,
        risk: entry - sl,
        reward: tp - entry
      };
    } else {
      const sl = liquidityPool.resistanceLevel;
      const tp = entry - (sl - entry) * riskReward;

      return {
        entry,
        sl,
        tp,
        riskReward,
        risk: sl - entry,
        reward: entry - tp
      };
    }
  }

  /**
   * Break Even Logic
   * اگر قیمت به یک نقطه آمد، SL را به Break Even حرکت بده
   */
  calculateBreakEvenLevel(entry, currentPrice, direction, profitLevel = 0.5) {
    if (direction === 'LONG') {
      if (currentPrice > entry * (1 + profitLevel / 100)) {
        return entry; // Move SL to entry
      }
    } else {
      if (currentPrice < entry * (1 - profitLevel / 100)) {
        return entry; // Move SL to entry
      }
    }

    return null;
  }

  /**
   * Trailing Stop Logic
   */
  calculateTrailingStop(entry, currentPrice, direction, trailAmount) {
    if (direction === 'LONG') {
      const trailingStop = currentPrice - trailAmount;
      return Math.max(trailingStop, entry); // حداقل به entry
    } else {
      const trailingStop = currentPrice + trailAmount;
      return Math.min(trailingStop, entry); // حداقل به entry
    }
  }

  /**
   * Pyramid Exit Strategy
   * خروج تدریجی با افزایش قیمت
   */
  createPyramidExit(entry, tp, levels = 5) {
    const exitLevels = [];
    const profitRange = tp - entry;

    for (let i = 1; i <= levels; i++) {
      const exitPrice = entry + (profitRange * (i / levels));
      const positionPercent = 100 / levels;
      
      exitLevels.push({
        level: i,
        price: exitPrice,
        profitPercent: ((exitPrice - entry) / entry) * 100,
        exitSize: positionPercent,
        cumulativeExit: i * positionPercent
      });
    }

    return exitLevels;
  }
}

// ============================================
// 4. LEVERAGE CALCULATOR
// ============================================

export class LeverageCalculator {
  /**
   * محاسبه Leverage براساس Funding Rate
   * اگر Funding منفی = امن‌تر
   * اگر Funding مثبت = خطرناک‌تر
   */
  calculateLeverageFromFunding(baseLeverage, fundingRate) {
    const fundingPercent = Math.abs(fundingRate) * 100;

    if (fundingRate > 0.05) {
      // Funding خیلی بالا = leverage کم
      return Math.max(1, baseLeverage * 0.5);
    } else if (fundingRate > 0.02) {
      return baseLeverage * 0.75;
    } else if (fundingRate < -0.05) {
      // Funding منفی = امن‌تر
      return baseLeverage;
    } else if (fundingRate < -0.02) {
      return baseLeverage * 0.9;
    }

    return baseLeverage;
  }

  /**
   * محاسبه Leverage براساس Volatility
   */
  calculateLeverageFromVolatility(baseLeverage, atrPercent) {
    if (atrPercent > 3) {
      return Math.max(1, baseLeverage * 0.5);
    } else if (atrPercent > 2) {
      return baseLeverage * 0.75;
    } else if (atrPercent < 0.5) {
      return baseLeverage * 1.2;
    } else if (atrPercent < 1) {
      return baseLeverage;
    }

    return baseLeverage;
  }

  /**
   * محاسبه Liquidation Price
   * LiqPrice = Entry - (Margin / Size)
   */
  calculateLiquidationPrice(entry, size, margin, direction) {
    const marginPerUnit = margin / size;

    if (direction === 'LONG') {
      return entry - marginPerUnit;
    } else {
      return entry + marginPerUnit;
    }
  }

  /**
   * چک Liquidation Distance
   */
  checkLiquidationDistance(entry, liquidationPrice, currentPrice, direction) {
    let distance;

    if (direction === 'LONG') {
      distance = ((currentPrice - liquidationPrice) / currentPrice) * 100;
    } else {
      distance = ((liquidationPrice - currentPrice) / currentPrice) * 100;
    }

    return {
      distance,
      status: distance < 5 ? 'CRITICAL' : distance < 10 ? 'HIGH' : distance < 20 ? 'MEDIUM' : 'LOW',
      recommendation: distance < 10 ? 'کاهش سایز' : 'امن'
    };
  }
}

// ============================================
// 5. EXECUTION MANAGER
// ============================================

export class ExecutionManager {
  constructor() {
    this.positionSizing = new PositionSizingEngine();
    this.limitOrders = new LimitOrderEngine();
    this.tpsl = new TPSLEngine();
    this.leverage = new LeverageCalculator();
    this.openPositions = [];
  }

  /**
   * ایجاد طرح تجارت کامل
   */
  createExecutionPlan(signal, marketData, accountSize) {
    const positionSize = this.positionSizing.calculateRiskBasedSize(
      accountSize,
      2, // 2% risk
      signal.entry,
      signal.sl
    );

    const limitOrder = this.limitOrders.calculateFVGLimitPrice(
      marketData.fvg
    );

    const tpsl = this.tpsl.calculateTPSLFromLiquidity(
      signal.entry,
      signal.type,
      marketData.liquidity,
      1.5
    );

    const adjustedLeverage = this.leverage.calculateLeverageFromFunding(
      3, // Base leverage
      marketData.fundingRate
    );

    const liqPrice = this.leverage.calculateLiquidationPrice(
      signal.entry,
      positionSize,
      accountSize * (adjustedLeverage - 1),
      signal.type
    );

    const partialOrders = this.limitOrders.createPartialOrders(
      signal.entry,
      tpsl.tp,
      tpsl.sl,
      3
    );

    return {
      signal: signal.symbol,
      direction: signal.type,
      planType: 'LIMIT_ENTRY',
      positionSize: Math.round(positionSize * 100) / 100,
      leverage: Math.round(adjustedLeverage * 100) / 100,
      entries: [
        {
          type: 'LIMIT',
          price: limitOrder.limitPrice,
          maxPrice: limitOrder.maxDeviation,
          timeLimit: limitOrder.timeLimit
        }
      ],
      tpsl: {
        entry: tpsl.entry,
        tp: Math.round(tpsl.tp * 1000) / 1000,
        sl: Math.round(tpsl.sl * 1000) / 1000,
        rr: tpsl.riskReward
      },
      liquidation: {
        price: Math.round(liqPrice * 1000) / 1000,
        distance: this.leverage.checkLiquidationDistance(
          signal.entry,
          liqPrice,
          marketData.currentPrice,
          signal.type
        ).distance.toFixed(2) + '%'
      },
      partialExits: partialOrders.filter(o => o.type === 'TP'),
      scaleSLs: partialOrders.filter(o => o.type === 'SL'),
      riskAmount: (accountSize * 0.02).toFixed(2),
      maxLoss: 'account_size_2_percent'
    };
  }

  /**
   * ثبت موضع
   */
  openPosition(execution, filledPrice) {
    const position = {
      id: Date.now(),
      symbol: execution.signal,
      direction: execution.direction,
      entry: filledPrice,
      size: execution.positionSize,
      leverage: execution.leverage,
      tp: execution.tpsl.tp,
      sl: execution.tpsl.sl,
      openTime: new Date().toISOString(),
      status: 'OPEN',
      unrealizedPnL: 0
    };

    this.openPositions.push(position);
    return position;
  }

  /**
   * بروزرسانی Trailing Stop
   */
  updateTrailingStops(currentPrice) {
    for (const position of this.openPositions) {
      const trailingStop = this.tpsl.calculateTrailingStop(
        position.entry,
        currentPrice,
        position.direction,
        (position.entry * 0.01) // 1% trail
      );

      if (trailingStop > position.sl) {
        position.sl = trailingStop;
      }
    }
  }

  /**
   * محاسبه Unrealized P&L
   */
  calculateUnrealizedPnL(currentPrice) {
    for (const position of this.openPositions) {
      if (position.direction === 'LONG') {
        position.unrealizedPnL = (currentPrice - position.entry) * position.size;
      } else {
        position.unrealizedPnL = (position.entry - currentPrice) * position.size;
      }
    }

    return this.openPositions;
  }
}

export default {
  PositionSizingEngine,
  LimitOrderEngine,
  TPSLEngine,
  LeverageCalculator,
  ExecutionManager
};
