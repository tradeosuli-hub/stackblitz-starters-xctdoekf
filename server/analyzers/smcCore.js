/**
 * SMC Analyzer v4.0.0 - Core Engine
 * تحلیل‌گر ادغام شده Smart Money Concepts
 * فاز 1: کیفیت ستاپ
 */

// ============================================
// 1. SMART LIMIT ENTRY ENGINE
// ============================================

export class SmartEntryEngine {
  constructor(config = {}) {
    this.config = {
      minLimitOffset: config.minLimitOffset || 0.1, // 0.1% زیر/بالاتر از Retest
      maxWaitCandles: config.maxWaitCandles || 3,   // حداکثر 3 کندل منتظر
      retestTolerance: config.retestTolerance || 0.02, // 0.2% تفاوت برای Retest تایید
      ...config
    };
  }

  /**
   * تشخیص Retest بر روی OB
   * منطق:
   * - قیمت به OB رسیده اما شکست نخورده
   * - Body در داخل OB
   * - Close بالاتر از Open (برای Long)
   */
  detectOBRetest(currentCandle, orderBlock, direction) {
    const { high, low, close, open } = currentCandle;
    const { obHigh, obLow, obClose } = orderBlock;

    if (direction === 'LONG') {
      // برای Long: قیمت باید به سقف OB رسیده اما شکست نخورده
      const touchedOB = high >= obLow && low <= obLow;
      const closedInsideOB = close >= obLow && close <= obHigh;
      const bullishBody = close > open;
      
      return touchedOB && closedInsideOB && bullishBody;
    } else {
      // برای Short: قیمت باید به کف OB رسیده اما شکست نخورده
      const touchedOB = low <= obHigh && high >= obHigh;
      const closedInsideOB = close <= obHigh && close >= obLow;
      const bearishBody = close < open;
      
      return touchedOB && closedInsideOB && bearishBody;
    }
  }

  /**
   * محاسبه Limit Entry قیمت
   * بجای Market Entry روی آخرین قیمت
   */
  calculateLimitEntry(retest, fvgMidpoint, direction) {
    if (direction === 'LONG') {
      // برای Long: Limit در FVG Midpoint یا کمی بالاتر از Retest Low
      const limitFromRetest = retest * (1 - this.config.minLimitOffset / 100);
      const limitFromFVG = fvgMidpoint * (1 - this.config.minLimitOffset / 100);
      
      return Math.min(limitFromRetest, limitFromFVG);
    } else {
      // برای Short: Limit در FVG Midpoint یا کمی پایین‌تر از Retest High
      const limitFromRetest = retest * (1 + this.config.minLimitOffset / 100);
      const limitFromFVG = fvgMidpoint * (1 + this.config.minLimitOffset / 100);
      
      return Math.max(limitFromRetest, limitFromFVG);
    }
  }
}

// ============================================
// 2. ORDER BLOCK DETECTION
// ============================================

export class OrderBlockDetector {
  constructor(config = {}) {
    this.config = {
      minOBSize: config.minOBSize || 50,
      minBodyRatio: config.minBodyRatio || 0.6,
      ...config
    };
  }

  detectOrderBlock(candles, breakCandle, direction) {
    const obIndex = breakCandle;
    const obCandle = candles[obIndex];
    const bodySize = Math.abs(obCandle.close - obCandle.open);
    const totalSize = obCandle.high - obCandle.low;
    const bodyRatio = bodySize / totalSize;

    if (bodyRatio < this.config.minBodyRatio) {
      return null;
    }

    if (direction === 'LONG') {
      if (obCandle.close > obCandle.open) {
        return null;
      }
      
      return {
        type: 'BULLISH_OB',
        obHigh: obCandle.high,
        obLow: obCandle.low,
        obClose: obCandle.close,
        candle: obIndex,
        strength: bodyRatio
      };
    } else {
      if (obCandle.close < obCandle.open) {
        return null;
      }

      return {
        type: 'BEARISH_OB',
        obHigh: obCandle.high,
        obLow: obCandle.low,
        obClose: obCandle.close,
        candle: obIndex,
        strength: bodyRatio
      };
    }
  }
}

// ============================================
// 3. BREAK OF STRUCTURE (BOS) DETECTOR
// ============================================

export class BOSDetector {
  constructor(config = {}) {
    this.config = {
      minDisplacement: config.minDisplacement || 0.005,
      minBodyDominance: config.minBodyDominance || 0.65,
      ...config
    };
  }

  detectBOS(candles, direction) {
    const currentCandle = candles[candles.length - 1];
    const previousCandles = candles.slice(-10);
    
    const displacement = this.calculateDisplacement(previousCandles, direction);
    if (displacement < this.config.minDisplacement) {
      return null;
    }

    const bodySize = Math.abs(currentCandle.close - currentCandle.open);
    const totalSize = currentCandle.high - currentCandle.low;
    const bodyDominance = bodySize / totalSize;

    if (bodyDominance < this.config.minBodyDominance) {
      return null;
    }

    return {
      type: direction === 'LONG' ? 'BULLISH_BOS' : 'BEARISH_BOS',
      displacement: displacement,
      bodyDominance: bodyDominance,
      strength: (displacement * 100) + (bodyDominance * 100),
      candle: candles.length - 1
    };
  }

  calculateDisplacement(candles, direction) {
    const closes = candles.map(c => c.close);
    const avgClose = closes.reduce((a, b) => a + b) / closes.length;
    const lastClose = closes[closes.length - 1];

    if (direction === 'LONG') {
      return (lastClose - avgClose) / avgClose;
    } else {
      return (avgClose - lastClose) / avgClose;
    }
  }
}

// ============================================
// 4. FAIR VALUE GAP (FVG) DETECTOR
// ============================================

export class FVGDetector {
  constructor(config = {}) {
    this.config = {
      minGapSize: config.minGapSize || 0.002,
      ...config
    };
  }

  detectFVG(candles) {
    const fvgs = [];

    for (let i = 2; i < candles.length; i++) {
      const candle1 = candles[i - 2];
      const candle2 = candles[i - 1];
      const candle3 = candles[i];

      if (candle3.low > candle1.high) {
        const gapSize = (candle3.low - candle1.high) / candle1.high;
        
        if (gapSize >= this.config.minGapSize) {
          const midpoint = (candle1.high + candle3.low) / 2;
          
          fvgs.push({
            type: 'BULLISH_FVG',
            top: candle3.low,
            bottom: candle1.high,
            midpoint: midpoint,
            gapSize: gapSize,
            candle: i,
            filled: false
          });
        }
      }

      if (candle3.high < candle1.low) {
        const gapSize = (candle1.low - candle3.high) / candle1.low;
        
        if (gapSize >= this.config.minGapSize) {
          const midpoint = (candle1.low + candle3.high) / 2;
          
          fvgs.push({
            type: 'BEARISH_FVG',
            top: candle1.low,
            bottom: candle3.high,
            midpoint: midpoint,
            gapSize: gapSize,
            candle: i,
            filled: false
          });
        }
      }
    }

    return fvgs;
  }
}

// ============================================
// 5. SESSION FILTER
// ============================================

export class SessionFilter {
  constructor() {
    this.sessions = {
      ASIA: { start: 0, end: 9 },
      LONDON: { start: 8, end: 17 },
      NY: { start: 13, end: 22 },
      SYDNEY: { start: 22, end: 6 }
    };
  }

  getCurrentSession() {
    const hours = new Date().getUTCHours();
    
    for (const [name, { start, end }] of Object.entries(this.sessions)) {
      if (start <= end) {
        if (hours >= start && hours < end) return name;
      } else {
        if (hours >= start || hours < end) return name;
      }
    }
    
    return 'ASIA';
  }

  isLiquidSession() {
    const session = this.getCurrentSession();
    return session === 'LONDON' || session === 'NY';
  }
}

// ============================================
// 6. ATR VOLATILITY FILTER
// ============================================

export class ATRFilter {
  constructor(period = 14) {
    this.period = period;
  }

  calculateATR(candles) {
    const tr = [];

    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;

      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);

      tr.push(Math.max(tr1, tr2, tr3));
    }

    const atr = tr.slice(-this.period).reduce((a, b) => a + b) / this.period;
    return atr;
  }

  isVolatilityHealthy(atr, lastClose) {
    const atrPercent = (atr / lastClose) * 100;
    return atrPercent >= 0.3 && atrPercent <= 2.5;
  }
}

// ============================================
// 7. TREND STRENGTH ANALYZER
// ============================================

export class TrendStrengthAnalyzer {
  constructor(periods = [20, 50, 200]) {
    this.periods = periods;
  }

  calculateEMA(candles, period) {
    const k = 2 / (period + 1);
    let ema = candles[0].close;

    for (let i = 1; i < candles.length; i++) {
      ema = candles[i].close * k + ema * (1 - k);
    }

    return ema;
  }

  analyzeTrend(candles) {
    const close = candles[candles.length - 1].close;
    const ema20 = this.calculateEMA(candles, 20);
    const ema50 = this.calculateEMA(candles, 50);
    const ema200 = this.calculateEMA(candles, 200);

    let trendStrength = 0;
    let direction = null;

    if (close > ema20 && ema20 > ema50 && ema50 > ema200) {
      direction = 'UPTREND';
      trendStrength = 100;
    }
    else if (close < ema20 && ema20 < ema50 && ema50 < ema200) {
      direction = 'DOWNTREND';
      trendStrength = 100;
    }
    else if (close > ema50 && ema50 > ema200) {
      direction = 'UPTREND_WEAK';
      trendStrength = 50;
    }
    else if (close < ema50 && ema50 < ema200) {
      direction = 'DOWNTREND_WEAK';
      trendStrength = 50;
    }
    else {
      direction = 'CONSOLIDATION';
      trendStrength = 0;
    }

    return {
      direction,
      strength: trendStrength,
      ema20,
      ema50,
      ema200,
      close
    };
  }
}

export default {
  SmartEntryEngine,
  OrderBlockDetector,
  BOSDetector,
  FVGDetector,
  SessionFilter,
  ATRFilter,
  TrendStrengthAnalyzer
};