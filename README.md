# SMC Analyzer v4.0.0

🚀 **Institutional Smart Money Concepts Analyzer** برای تحلیل لایو ارز دیجیتال

## 📊 ویژگی‌های اصلی

### Phase 1 - کیفیت ستاپ
- ✅ **Smart Limit Entry** - ورود دقیق بجای Market Entry
- ✅ **OB Detection** - شناسایی Order Block
- ✅ **Session Filter** - فیلتر بر اساس جلسه معاملات (London/NY Open)
- ✅ **ATR Volatility Filter** - فیلتر بر اساس نوسان‌پذیری
- ✅ **Trend Strength** - تشخیص قوت روند

### Phase 2 - Institutional Logic
- ✅ **OI (Open Interest)** - ردیابی موضع‌های باز
- ✅ **Funding Rate** - تشخیص زمان liquidation
- ✅ **CVD (Cumulative Volume Delta)** - تعادل خرید/فروش
- ✅ **Liquidation Heatmap** - نقشه liquidation
- ✅ **Binance Aggressive Orders** - سفارش‌های تهاجمی

### Phase 3 - Execution Engine
- ✅ **Auto Limit Orders** - سفارش‌های محدود خودکار
- ✅ **Partial TP** - خروج جزئی با سود
- ✅ **Break Even Logic** - منطق برابری ریسک
- ✅ **Trailing Stop** - توقف متحرک
- ✅ **Position Sizing** - محاسبه حجم موضع

### Phase 4 - AI Layer
- ✅ **یادگیری از ژورنال** - بهبود از تجربیات
- ✅ **Win Rate Tracking** - پیگیری نرخ موفقیت
- ✅ **Setup Pattern Recognition** - شناسایی الگوهای موفق

## 🛠 نصب و راه‌اندازی

```bash
npm install
npm start
```

سپس به `http://localhost:3000` برروید

## 📱 سازگاری

- ✅ iPad
- ✅ iPhone
- ✅ macOS
- ✅ Safari optimized

## 🔗 منابع داده

1. **CoinGlass** - سقف/کف، صرافی
2. **TradingView** - چارت و تحلیل
3. **CryptoQuant** - اسمارت پول
4. **Lookonchain** - تراکنش‌های بزرگ
5. **DexScreener** - Altcoin و DEX
6. **TokenUnlocks** - Unlock و Vesting
7. **DefiLlama** - TVL و Liquidity
8. **Santiment** - Social Sentiment
9. **Messari** - On-chain Metrics
10. **CMC/CoinGecko** - قیمت و Volume

## ⚙️ تنظیمات

### محدودیت‌های سیستم
- **سیگنال‌های خودکار**: فقط الارم (بدون اجرا)
- **لورج > 15**: نیاز به تایید دستی
- **لورج ≤ 15**: سیگنال خودکار

### فیلترهای کیفیت
- MIN_SCORE: 75 (درصد)
- MIN_DISPLACEMENT: 0.5% (تغییر قیمت)
- MIN_VOLUME: 1.5x (نسبت به میانگین)
- MIN_IMBALANCE: 60% (نسبت Delta)

## 📈 استراتژی تحلیل

### تحلیل چند تایم‌فریم
1. **4H** - روند اصلی و کانال‌ها
2. **1H** - حمایت/مقاومت ثانویه
3. **15M** - نقاط ورود دقیق

### شناسایی ساختار
- Break of Structure (BOS)
- Change of Character (CHoCH)
- Fair Value Gap (FVG)
- Order Block (OB)
- Liquidity Sweep

## 🎯 نحوه کار

```
مرحله 1: اسکن خودکار → BOS، CHoCH، FVG شناسایی
         ↓
مرحله 2: فیلتر کیفیت → Volume، Imbalance، ATR
         ↓
مرحله 3: شناسایی OB → Order Block Retest
         ↓
مرحله 4: Smart Entry → Limit Entry روی FVG/OB
         ↓
مرحله 5: TP/SL محاسبه → بر اساس Liquidity Pool
         ↓
مرحله 6: هشدار → الارم برای تایید دستی (Lev > 15)
         ↓
مرحله 7: اجرا → سفارش محدود خودکار
```

## 📊 نمایش سیگنال‌ها

- **LONG** 🟢 - سیگنال خریدی
- **SHORT** 🔴 - سیگنال فروشی
- **⚠️ PENDING** - منتظر تایید
- **✅ APPROVED** - تایید‌شده و اجرا‌شده

## 🔔 نوع هشدار‌ها

- 📢 **صوتی** - Beep برای هر سیگنال
- 🟢 **بصری** - نوتیفیکیشن در صفحه
- 📧 **ایمیل** - ارسال به ایمیل
- 💬 **تلگرام** - پیام به ربات تلگرام

## 📝 ژورنال

تمام سیگنال‌های تایید‌شده در ژورنال ثبت می‌شوند:
- Entry Price
- Exit Price
- Profit/Loss
- Percentage Return
- Time Open/Close

## 🚨 توجه مهم

⚠️ **این سیستم فقط برای تحلیل است**
- الارم دهد تا تایید دستی انجام دهید
- هرگز بدون بررسی سیگنال وارد نشوید
- ریسک خود را مدیریت کنید

---

**نسخه**: 4.0.0
**آپدیت شده**: 2026-05-24
**نویسنده**: SMC Analyzer Team