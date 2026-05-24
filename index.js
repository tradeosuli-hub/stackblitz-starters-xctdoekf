import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { SmartEntryEngine, BOSDetector, FVGDetector, SessionFilter, ATRFilter, TrendStrengthAnalyzer } from './server/analyzers/smcCore.js';
import { DataAggregator } from './server/dataSources/aggregator.js';
import { InstitutionalLogicEngine } from './server/analyzers/institutionalLogic.js';
import { ExecutionManager } from './server/executors/executionEngine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Initialize engines
const smcCore = {
  smartEntry: new SmartEntryEngine(),
  bosDetector: new BOSDetector(),
  fvgDetector: new FVGDetector(),
  sessionFilter: new SessionFilter(),
  atrFilter: new ATRFilter(),
  trendAnalyzer: new TrendStrengthAnalyzer()
};

const dataAggregator = new DataAggregator();
const institutionalEngine = new InstitutionalLogicEngine();
const executionManager = new ExecutionManager();

// Store signals
const signals = [];
const journal = [];

// ============================================
// API Routes
// ============================================

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    version: 'v4.0.0',
    engines: {
      smcCore: 'enabled',
      dataAggregator: 'enabled',
      institutional: 'enabled',
      execution: 'enabled'
    },
    timestamp: new Date().toISOString() 
  });
});

/**
 * تحلیل یک سیکه
 */
app.post('/api/analyze', async (req, res) => {
  try {
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'نماد سیکه الزامی است' });
    }

    // دریافت داده‌های کامل
    const data = await dataAggregator.getComprehensiveData(symbol);

    if (!data || !data.candles.klines || data.candles.klines.length === 0) {
      return res.status(404).json({ error: 'داده یافت نشد' });
    }

    const candles = data.candles.klines;
    const currentPrice = candles[candles.length - 1].close;

    // تحلیل‌های متعدد
    const bosAnalysis = smcCore.bosDetector.detectBOS(candles, 'LONG');
    const fvgAnalysis = smcCore.fvgDetector.detectFVG(candles);
    const sessionBias = smcCore.sessionFilter.getSessionBias();
    const atr = smcCore.atrFilter.calculateATR(candles);
    const volatilityHealth = smcCore.atrFilter.isVolatilityHealthy(atr, currentPrice);
    const trendAnalysis = smcCore.trendAnalyzer.analyzeTrend(candles);
    const institutional = await institutionalEngine.analyzeInstitutionalFlow(symbol, data);

    // حساب‌کردن Score
    let score = 0;
    if (bosAnalysis) score += 25;
    if (fvgAnalysis.length > 0) score += 20;
    if (volatilityHealth) score += 15;
    if (trendAnalysis.strength > 70) score += 20;
    if (sessionBias.isLiquid) score += 10;
    if (institutional.bias === 'NORMAL') score += 10;

    const analysis = {
      symbol,
      timestamp: new Date().toISOString(),
      currentPrice: parseFloat(currentPrice.toFixed(4)),
      score: Math.min(score, 100),
      signals: {
        bos: bosAnalysis,
        fvg: fvgAnalysis.slice(0, 3),
        trend: trendAnalysis.direction,
        session: sessionBias.session,
        atr: {
          value: parseFloat(atr.toFixed(4)),
          healthy: volatilityHealth
        },
        institutional: institutional
      },
      recommendation: score > 75 ? 'STRONG_BUY' : score > 50 ? 'BUY' : 'CAUTION'
    };

    res.json(analysis);
  } catch (error) {
    console.error('خطا در تحلیل:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * تولید سیگنال
 */
app.post('/api/generate-signal', async (req, res) => {
  try {
    const { symbol, analysis } = req.body;

    if (!symbol || !analysis) {
      return res.status(400).json({ error: 'نماد و تحلیل الزامی است' });
    }

    const signal = {
      id: Date.now(),
      symbol,
      type: analysis.recommendation.includes('BUY') ? 'LONG' : 'SHORT',
      entry: analysis.currentPrice,
      sl: analysis.signals.fvg.length > 0 
        ? analysis.signals.fvg[0].bottom 
        : analysis.currentPrice * 0.97,
      tp: analysis.signals.fvg.length > 0 
        ? analysis.signals.fvg[0].top * 1.5 
        : analysis.currentPrice * 1.15,
      score: analysis.score,
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };

    signal.rr = Math.abs(signal.tp - signal.entry) / Math.abs(signal.entry - signal.sl);

    signals.push(signal);

    res.json({ success: true, signal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * دریافت سیگنال‌ها
 */
app.get('/api/signals', (req, res) => {
  const { status = 'PENDING' } = req.query;
  const filtered = status ? signals.filter(s => s.status === status) : signals;
  res.json({ count: filtered.length, signals: filtered });
});

/**
 * تایید سیگنال و اجرا
 */
app.post('/api/approve-signal', (req, res) => {
  try {
    const { id } = req.body;
    const signal = signals.find(s => s.id === id);

    if (!signal) {
      return res.status(404).json({ error: 'سیگنال یافت نشد' });
    }

    signal.status = 'APPROVED';
    journal.push({ ...signal, approvedAt: new Date().toISOString() });

    res.json({ success: true, signal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * دریافت ژورنال
 */
app.get('/api/journal', (req, res) => {
  res.json({ count: journal.length, journal });
});

/**
 * شناسایی فرصت‌های پول
 */
app.post('/api/money-flow', async (req, res) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: 'لیست نمادها الزامی است' });
    }

    const moneyFlow = await dataAggregator.identifyMoneyFlow(symbols);
    res.json({ count: moneyFlow.length, opportunities: moneyFlow });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * بازیابی اطلاعات بازار
 */
app.get('/api/market-data/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const data = await dataAggregator.getComprehensiveData(symbol);

    if (!data) {
      return res.status(404).json({ error: 'داده یافت نشد' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Error handling
 */
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 SMC Analyzer v4 running on http://localhost:${PORT}`)
  console.log(`📊 Engines:`)
  console.log(`   - Smart Money Concepts (SMC)`)
  console.log(`   - Data Aggregator (10 sources)`)
  console.log(`   - Institutional Logic`)
  console.log(`   - Execution Manager`);
});
