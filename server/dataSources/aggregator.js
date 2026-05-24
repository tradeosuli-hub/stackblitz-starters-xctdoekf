/**
 * SMC Analyzer v4.0.0 - Data Sources Integration
 * ادغام منابع داده لایو
 */

import axios from 'axios';

// ============================================
// 1. BINANCE FUTURES API
// ============================================

export class BinanceAPI {
  constructor(config = {}) {
    this.baseURL = 'https://fapi.binance.com';
    this.config = config;
  }

  async getKlines(symbol, interval = '15m', limit = 100) {
    try {
      const response = await axios.get(`${this.baseURL}/fapi/v1/klines`, {
        params: { symbol, interval, limit }
      });

      return response.data.map(candle => ({
        timestamp: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[7])
      }));
    } catch (error) {
      console.error(`خطا در دریافت کندل‌های ${symbol}:`, error.message);
      return [];
    }
  }

  async getOpenInterest(symbol) {
    try {
      const response = await axios.get(`${this.baseURL}/futures/data/openInterest`, {
        params: { symbol }
      });

      return {
        symbol: response.data.symbol,
        openInterest: parseFloat(response.data.openInterest),
        timestamp: response.data.time
      };
    } catch (error) {
      return null;
    }
  }

  async getFundingRate(symbol) {
    try {
      const response = await axios.get(`${this.baseURL}/fapi/v1/fundingRate`, {
        params: { symbol, limit: 1 }
      });

      if (response.data.length === 0) return null;

      const latest = response.data[0];
      return {
        symbol,
        fundingRate: parseFloat(latest.fundingRate),
        magnitude: Math.abs(parseFloat(latest.fundingRate)) * 100
      };
    } catch (error) {
      return null;
    }
  }

  async getPrice(symbol) {
    try {
      const response = await axios.get(`${this.baseURL}/fapi/v1/ticker/price`, {
        params: { symbol }
      });

      return {
        symbol: response.data.symbol,
        price: parseFloat(response.data.price)
      };
    } catch (error) {
      return null;
    }
  }
}

// ============================================
// 2. COINGLASS API
// ============================================

export class CoinGlassAPI {
  constructor(apiKey = '') {
    this.baseURL = 'https://open-api.coinglass.com/public/v2';
    this.apiKey = apiKey;
  }

  async getLongShortRatio(symbol) {
    try {
      const response = await axios.get(
        `${this.baseURL}/indicator/funding_rate/long_short_ratio`,
        { params: { symbol: symbol.replace('USDT', ''), exchange: 'binance' } }
      );

      const latest = response.data.data[0];
      return {
        symbol,
        longRatio: parseFloat(latest.longRatio),
        shortRatio: parseFloat(latest.shortRatio),
        bias: parseFloat(latest.longRatio) > 0.5 ? 'LONG_BIAS' : 'SHORT_BIAS'
      };
    } catch (error) {
      return null;
    }
  }
}

// ============================================
// 3. COINGECKO API
// ============================================

export class CoinGeckoAPI {
  constructor() {
    this.baseURL = 'https://api.coingecko.com/api/v3';
  }

  async getMarketData(coinId) {
    try {
      const response = await axios.get(`${this.baseURL}/coins/${coinId}`, {
        params: { localization: false, market_data: true }
      });

      const data = response.data;
      return {
        id: data.id,
        symbol: data.symbol.toUpperCase(),
        currentPrice: data.market_data?.current_price?.usd,
        marketCap: data.market_data?.market_cap?.usd,
        volume24h: data.market_data?.total_volume?.usd,
        priceChange24h: data.market_data?.price_change_percentage_24h
      };
    } catch (error) {
      return null;
    }
  }
}

// ============================================
// DATA AGGREGATOR
// ============================================

export class DataAggregator {
  constructor() {
    this.binance = new BinanceAPI();
    this.coinglass = new CoinGlassAPI();
    this.coingecko = new CoinGeckoAPI();
  }

  async getComprehensiveData(symbol) {
    try {
      const [klines, oi, fundingRate, lsRatio, marketData] = await Promise.all([
        this.binance.getKlines(symbol),
        this.binance.getOpenInterest(symbol),
        this.binance.getFundingRate(symbol),
        this.coinglass.getLongShortRatio(symbol),
        this.coingecko.getMarketData(symbol.replace('USDT', ''))
      ]);

      return {
        symbol,
        timestamp: new Date().toISOString(),
        candles: { klines, count: klines.length },
        onChain: { openInterest: oi, fundingRate, longShortRatio: lsRatio },
        market: marketData,
        quality: {
          hasFundingBias: fundingRate?.magnitude > 0.02,
          hasLongBias: lsRatio?.bias === 'LONG_BIAS'
        }
      };
    } catch (error) {
      console.error(`خطا در دریافت Data:`, error.message);
      return null;
    }
  }

  async identifyMoneyFlow(symbols) {
    try {
      const results = await Promise.all(
        symbols.map(async (symbol) => {
          const data = await this.getComprehensiveData(symbol);
          if (!data) return null;
          const score = this.calculateMoneyFlowScore(data);
          return { symbol, score, priority: score > 75 ? 'HIGH' : 'MEDIUM' };
        })
      );

      return results.filter(r => r !== null).sort((a, b) => b.score - a.score);
    } catch (error) {
      return [];
    }
  }

  calculateMoneyFlowScore(data) {
    let score = 0;
    if (data.onChain.fundingRate?.magnitude > 0.02) score += 30;
    if (data.onChain.longShortRatio?.bias === 'LONG_BIAS') score += 20;
    return Math.min(score, 100);
  }
}

export default {
  BinanceAPI,
  CoinGlassAPI,
  CoinGeckoAPI,
  DataAggregator
};
