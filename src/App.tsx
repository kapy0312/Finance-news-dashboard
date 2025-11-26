import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, BarChart3, Newspaper, AlertCircle, Info, ExternalLink } from 'lucide-react';

// --- Type 定義區 (TypeScript 專用) ---
interface NewsItem {
  id: number;
  source: string;
  sourceName: string;
  title: string;
  link: string;
  timestamp: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number;
  keywords: string[];
}

interface SentimentResult {
  score: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  keywords: string[];
}

interface RawNewsItem {
  source: string;
  sourceName?: string;
  title: string;
  link: string;
  timestamp: string;
}

// --- 設定區 ---
const API_URL = "https://script.google.com/macros/s/AKfycbwl67_kmGSwBLy3pRqK2W0DZwLgN3Q7cNCDqPr1sucWvUPEr08lFV6IdGazexDmM6ZEXg/exec";

// --- 演算法關鍵字字典 ---
const BULLISH_KEYWORDS = [
  // 原始提供的關鍵字
  { word: "創新高", score: 3 }, { word: "優於預期", score: 2 }, { word: "大漲", score: 2 },
  { word: "漲停", score: 3 }, { word: "買進", score: 2 }, { word: "擴產", score: 1 },
  { word: "殖利率", score: 1 }, { word: "旺季", score: 1 }, { word: "外資喊進", score: 3 },
  { word: "反彈", score: 1 }, { word: "強勁", score: 2 }, { word: "供不應求", score: 2 },
  { word: "上修", score: 2 }, { word: "調高", score: 2 }, { word: "加薪", score: 1 },
  { word: "獲利", score: 1 }, { word: "打入", score: 2 }, { word: "供應鏈", score: 1 },
  { word: "做多", score: 2 }, { word: "按讚", score: 1 }, { word: "噴出", score: 2 },
  
  // 新增的看漲關鍵字 (更新內容)
  { word: "樂觀", score: 1 }, { word: "動能", score: 2 }, { word: "成長", score: 1 },
  { word: "看好", score: 2 }, { word: "創紀錄", score: 3 }, { word: "回升", score: 1 }
];

/**
 * BEARISH_KEYWORDS (看跌/負面關鍵字)
 * 包含利空消息或股價下跌相關的詞彙及分數。
 * Score: 負數，絕對值越大，情緒強度越大。
 */
const BEARISH_KEYWORDS = [
  // 原始提供的關鍵字
  { word: "創新低", score: -3 }, { word: "不如預期", score: -2 }, { word: "重挫", score: -2 },
  { word: "賣出", score: -2 }, { word: "裁員", score: -2 }, { word: "升息", score: -2 },
  { word: "通膨", score: -1 }, { word: "庫存過高", score: -2 }, { word: "下修", score: -3 },
  { word: "跌停", score: -3 }, { word: "虧損", score: -2 }, { word: "保守", score: -1 },
  { word: "衰退", score: -2 }, { word: "缺工", score: -1 }, { word: "戰爭", score: -2 },
  { word: "利空", score: -2 }, { word: "賣壓", score: -2 }, { word: "示警", score: -1 },
  
  // 新增的看跌關鍵字 (更新內容)
  { word: "疑慮", score: -1 }, { word: "不確定性", score: -2 }, { word: "逆風", score: -2 },
  { word: "壓力", score: -1 }, { word: "警惕", score: -1 }, { word: "低迷", score: -2 }
];

// 備用資料
const FALLBACK_DATA: RawNewsItem[] = [
  {"source":"ltn","sourceName":"自由財經","title":"Costco神物清單曝光！7款買來「能用到天荒地老」會員激推","timestamp":"2025-11-25 11:15:28","link":"#"},
  {"source":"ltn","sourceName":"自由財經","title":"焦點股》精成科：打入Google TPU供應鏈 市場按讚","timestamp":"2025-11-25 11:15:28","link":"#"},
  {"source":"ltn","sourceName":"自由財經","title":"16歲拿700元創副業！現營收近4100萬 他親曝翻身心路","timestamp":"2025-11-25 11:15:28","link":"#"},
  {"source":"ltn","sourceName":"自由財經","title":"市值達4兆美元、蘋果卻「罕見」裁員 ! 分析師揭背後盤算","timestamp":"2025-11-25 11:15:28","link":"#"},
  {"source":"ltn","sourceName":"自由財經","title":"焦點股》台積電：先進製程 客戶需求強勁","timestamp":"2025-11-25 11:15:28","link":"#"},
  {"source":"ltn","sourceName":"自由財經","title":"川普啟動「創世紀任務」 攜手輝達、超微等巨頭加速聯邦AI研究","timestamp":"2025-11-25 11:15:28","link":"#"},
  {"source":"ltn","sourceName":"自由財經","title":"焦點股》信驊：外資上修目標價 噴出再創高","timestamp":"2025-11-25 11:15:28","link":"#"},
  {"source":"yahoo","sourceName":"Yahoo 財經","title":"不到一個月拉5次漲停！「這被動元件」股價4天飆35%登強勢股王","timestamp":"2025-11-25 11:15:30","link":"#"},
  {"source":"yahoo","sourceName":"Yahoo 財經","title":"瞄準記憶體巨頭砸錢！小兒捧逾31億強勢掃貨南亞科","timestamp":"2025-11-25 11:15:30","link":"#"},
  {"source":"ettoday","sourceName":"ETtoday 財經","title":"台積電漲50元至1425　台股勁揚613點站上2萬7","timestamp":"2025-11-25 11:15:31","link":"#"}
];

// --- 組件 Props 定義 ---
interface NewsCardProps {
  news: NewsItem;
}

const NewsCard = ({ news }: NewsCardProps) => {
  const sentimentColor = 
    news.sentiment === 'bullish' ? 'border-l-4 border-red-500 bg-red-50' :
    news.sentiment === 'bearish' ? 'border-l-4 border-green-500 bg-green-50' :
    'border-l-4 border-gray-400 bg-white';

  const sentimentText = 
    news.sentiment === 'bullish' ? 'text-red-600' :
    news.sentiment === 'bearish' ? 'text-green-600' :
    'text-gray-600';

  const Icon = 
    news.sentiment === 'bullish' ? TrendingUp :
    news.sentiment === 'bearish' ? TrendingDown :
    Minus;

  // 格式化時間，只取 HH:MM
  const formatTime = (ts: string) => {
    if (!ts) return "";
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      console.error(e); // 使用 e 避免 unused variable warning
      return "";
    }
  };

  return (
    <div className={`p-4 mb-3 rounded-lg shadow-sm hover:shadow-md transition-all ${sentimentColor}`}>
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 whitespace-nowrap">
              {news.sourceName || news.source}
            </span>
            <span className="text-xs text-gray-500">{formatTime(news.timestamp)}</span>
          </div>
          <a 
            href={news.link} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="group"
          >
            <h3 className="font-medium text-gray-800 text-lg leading-snug mb-2 group-hover:text-blue-600 group-hover:underline decoration-blue-300 underline-offset-4 transition-colors">
              {news.title} 
              <ExternalLink size={14} className="inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400"/>
            </h3>
          </a>
          
          <div className="flex gap-2 mt-2 flex-wrap">
             {news.keywords && news.keywords.length > 0 ? (
               news.keywords.map((k, i) => (
                 <span key={i} className={`text-xs px-1.5 py-0.5 rounded border ${
                   news.score > 0 ? 'bg-red-100 border-red-200 text-red-700' : 
                   news.score < 0 ? 'bg-green-100 border-green-200 text-green-700' : 
                   'bg-gray-100 text-gray-600'
                 }`}>
                   #{k}
                 </span>
               ))
             ) : (
               <span className="text-xs text-gray-400">#觀望中性</span>
             )}
          </div>
        </div>
        
        <div className={`flex flex-col items-center justify-center min-w-[60px] ${sentimentText}`}>
          <Icon size={28} />
          <span className="text-xs font-bold mt-1 whitespace-nowrap">
            {news.sentiment === 'bullish' ? '利多' : news.sentiment === 'bearish' ? '利空' : '中立'}
          </span>
          <span className="text-sm font-mono mt-1 opacity-80 bg-white/50 px-1 rounded">
            {news.score > 0 ? `+${news.score}` : news.score}
          </span>
        </div>
      </div>
    </div>
  );
};

interface MarketScoreGaugeProps {
  score: number;
}

const MarketScoreGauge = ({ score }: MarketScoreGaugeProps) => {
  let status = "中立觀望";
  let colorClass = "text-gray-500";
  let bgClass = "bg-gray-100";
  let needleRotation = "rotate-0";

  if (score >= 65) {
    status = "市場樂觀";
    colorClass = "text-red-600";
    bgClass = "bg-red-50";
    needleRotation = "rotate-[45deg]";
  } else if (score >= 55) {
    status = "偏向多方";
    colorClass = "text-red-400";
    bgClass = "bg-red-50";
    needleRotation = "rotate-[20deg]";
  } else if (score <= 35) {
    status = "市場悲觀";
    colorClass = "text-green-600";
    bgClass = "bg-green-50";
    needleRotation = "rotate-[-45deg]";
  } else if (score <= 45) {
    status = "偏向空方";
    colorClass = "text-green-400";
    bgClass = "bg-green-50";
    needleRotation = "rotate-[-20deg]";
  }

  return (
    <div className={`flex flex-col items-center justify-center p-6 rounded-xl shadow-sm border border-gray-100 ${bgClass} transition-all duration-500`}>
      <h2 className="text-gray-500 font-medium mb-4 text-sm uppercase tracking-wider">AI 市場情緒指數</h2>
      
      <div className="relative w-48 h-24 overflow-hidden mb-2">
        <div className="absolute top-0 left-0 w-48 h-48 rounded-full border-[14px] border-slate-200 box-border"></div>
        <div className="absolute top-0 left-0 w-48 h-48 rounded-full border-[14px] border-transparent border-r-red-500 rotate-[-45deg] opacity-30"></div>
        <div className="absolute top-0 left-0 w-48 h-48 rounded-full border-[14px] border-transparent border-l-green-500 rotate-[45deg] opacity-30"></div>
        
        <div 
          className="absolute bottom-0 left-1/2 w-1.5 h-24 bg-slate-800 origin-bottom transition-transform duration-700 ease-out rounded-full shadow-lg"
          style={{ transform: `translateX(-50%) ${needleRotation}` }}
        ></div>
        <div className="absolute bottom-0 left-1/2 w-5 h-5 bg-slate-800 rounded-full transform -translate-x-1/2 translate-y-1/2 border-2 border-white"></div>
      </div>

      <div className={`text-6xl font-bold mb-1 ${colorClass} transition-colors duration-500`}>
        {score}
      </div>
      <div className={`text-lg font-bold ${colorClass}`}>
        {status}
      </div>
      <p className="text-xs text-gray-400 mt-2">資料來源：即時網路爬蟲</p>
    </div>
  );
};

export default function TaiwanStockSentimentApp() {
  const [loading, setLoading] = useState(false);
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [marketScore, setMarketScore] = useState(50);
  const [analysisReport, setAnalysisReport] = useState({ bullish: 0, bearish: 0, neutral: 0 });
  const [dataSourceType, setDataSourceType] = useState(""); 
  const [lastUpdated, setLastUpdated] = useState("");

  // 演算法：分析單條新聞
  const analyzeNewsSentiment = (title: string): SentimentResult => {
    let score = 0;
    const details: string[] = [];

    BULLISH_KEYWORDS.forEach(k => {
      if (title.includes(k.word)) {
        score += k.score;
        details.push(k.word);
      }
    });

    BEARISH_KEYWORDS.forEach(k => {
      if (title.includes(k.word)) {
        score += k.score;
        details.push(k.word);
      }
    });

    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (score >= 2) sentiment = 'bullish';
    if (score <= -2) sentiment = 'bearish';

    return { score, sentiment, keywords: details };
  };

  // 處理並計算分數
  const processRawData = (rawData: RawNewsItem[]) => {
    if (!rawData || rawData.length === 0) return;

    let totalScore = 0;
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;

    const processedNews: NewsItem[] = rawData.map((item, index) => {
      const title = item.title || "";
      const analysis = analyzeNewsSentiment(title);
      
      if (analysis.sentiment === 'bullish') bullishCount++;
      else if (analysis.sentiment === 'bearish') bearishCount++;
      else neutralCount++;

      totalScore += analysis.score;

      return {
        id: index,
        source: item.source,
        sourceName: item.sourceName || item.source,
        title: title,
        link: item.link || "#",
        timestamp: item.timestamp,
        sentiment: analysis.sentiment,
        score: analysis.score,
        keywords: analysis.keywords
      };
    });

    let normalizedScore = 50 + (totalScore * 3); 
    normalizedScore = Math.min(100, Math.max(0, Math.round(normalizedScore)));

    setNewsData(processedNews);
    setMarketScore(normalizedScore);
    setAnalysisReport({ bullish: bullishCount, bearish: bearishCount, neutral: neutralCount });
    setLastUpdated(new Date().toLocaleTimeString('zh-TW'));
  };

  // 核心功能：抓取資料
  const fetchAndAnalyzeData = async () => {
    setLoading(true);
    setNewsData([]);

    try {
      console.log("Fetching from GAS API:", API_URL);
      const response = await fetch(API_URL);
      
      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();
      console.log("API Response:", data);

      if (data && data.news) {
        processRawData(data.news);
        setDataSourceType("LIVE API (即時資料)");
      } else {
        throw new Error('Invalid data format');
      }

    } catch (error) {
      console.error("Fetch failed, using fallback data:", error);
      processRawData(FALLBACK_DATA);
      setDataSourceType("備用資料 (API連線受阻)");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndAnalyzeData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-2.5 rounded-xl shadow-lg">
              <BarChart3 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">台股 AI 財經戰情室</h1>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className={`w-2 h-2 rounded-full ${dataSourceType.includes("LIVE") ? "bg-green-500 animate-pulse" : "bg-orange-400"}`}></span>
                資料來源：{dataSourceType}
                <span className="hidden md:inline">| 更新時間：{lastUpdated}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={fetchAndAnalyzeData}
            disabled={loading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all transform active:scale-95 ${
              loading 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-blue-200'
            }`}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            {loading ? '同步雲端資料中...' : '更新即時新聞'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-1 space-y-6">
          <div className="lg:sticky lg:top-24 space-y-6">
            <MarketScoreGauge score={marketScore} />

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                <Info size={18} />
                新聞情緒分布
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors">
                  <div className="text-red-700 font-bold text-xl">{analysisReport.bullish}</div>
                  <div className="text-xs text-red-600 mt-1 flex justify-center items-center gap-1"><TrendingUp size={12}/>利多</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-100 hover:bg-green-100 transition-colors">
                  <div className="text-green-700 font-bold text-xl">{analysisReport.bearish}</div>
                  <div className="text-xs text-green-600 mt-1 flex justify-center items-center gap-1"><TrendingDown size={12}/>利空</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                  <div className="text-gray-600 font-bold text-xl">{analysisReport.neutral}</div>
                  <div className="text-xs text-gray-500 mt-1 flex justify-center items-center gap-1"><Minus size={12}/>中立</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 text-slate-300 p-4 rounded-xl text-xs leading-relaxed opacity-90">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-blue-400" />
                <p>
                  <strong>系統說明：</strong><br/>
                  本儀表板透過 GAS 爬蟲即時蒐集「自由財經、聯合、Yahoo、ETtoday」等主流媒體。AI 根據標題關鍵字（如：漲停、創新高、裁員）自動判讀多空分數，僅供輔助參考，非投資建議。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="flex justify-between items-end mb-4 px-1">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Newspaper size={20} className="text-blue-600" />
              即時財經快訊
            </h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">共 {newsData.length} 則新聞</span>
          </div>

          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white p-4 rounded-lg shadow-sm h-28 animate-pulse border border-gray-100 flex flex-col justify-between">
                  <div className="flex gap-2">
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                    <div className="h-4 bg-gray-200 rounded w-12"></div>
                  </div>
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))
            ) : (
              newsData.length > 0 ? (
                newsData.map((news) => (
                  <NewsCard key={news.id} news={news} />
                ))
              ) : (
                <div className="text-center py-20 text-gray-400">
                  <Info size={48} className="mx-auto mb-4 opacity-20" />
                  <p>暫無新聞資料，請點擊上方更新按鈕</p>
                </div>
              )
            )}
          </div>
        </div>

      </main>
    </div>
  );
}