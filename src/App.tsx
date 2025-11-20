//20251118
// src/App.tsx
// 整個新聞儀表板的主組件

import { useEffect, useMemo, useState } from "react";

// ✅ 你的 GAS API：後端已經幫你把多家新聞來源爬好 + 標準化
const API_URL =
  "https://script.google.com/macros/s/AKfycbyN68pVGA7IVhWHLL2uCGLFeQskDidBvzsY227NxL25LC1Lf4c6-LtmQoYwY2_1zA0d6A/exec";

// 從後端回來的每一則新聞的資料型別
interface NewsItem {
  source: string; // 來源代碼，例如 ltn / udn / yahoo
  sourceName: string; // 顯示用的來源名稱，例如「自由財經」
  title: string; // 新聞標題
  link: string; // 新聞連結（有可能是相對路徑）
  timestamp: string; // 你抓取的時間字串
  rawTime?: string; // 原始新聞時間（如果有）
}

// 來源下拉選單要用的選項
const sourceOptions = [
  { value: "", label: "全部" },
  { value: "ltn", label: "自由財經" },
  { value: "udn", label: "聯合財經" },
  { value: "apple", label: "蘋果財經" },
  { value: "yahoo", label: "Yahoo 財經" },
  { value: "ettoday", label: "ETtoday 財經" },
  { value: "cna", label: "中央社財經" },
  { value: "pts", label: "公視財經" },
  { value: "udn_rss", label: "經濟日報 RSS" },
];

// 🔑 命中率統計用的 20 個常用關鍵字（版本：依 2025/11/18 抓回新聞微調）
const KEYWORDS = [
  "台積電", // 多家媒體都有（2 奈米機密、產業鏈）
  "台股", // 「台股重挫」「台股下殺」頻率很高
  "美股",
  "日股", // 自由財經這次就有「日股暴跌」
  "匯率",
  "新台幣", // 新台幣午盤、匯率聲明
  "利率",
  "升息",
  "降息",
  "通膨",
  "ETF", // 00878、0052 等
  "高股息", // 00878 這類標題常出現
  "債券",
  "殖利率",
  "AI", // AI 平台、AI 伺服器、AI 需求
  "半導體", // 晶片、封裝、台積電相關
  "房市", // 中國房市爆違約、社宅等
  "退休", // 勞保、退休金、下流老人
  "勞保", // 「勞保會不會被充公」這類標題很多
  "關稅", // 台美關稅磋商、關稅談判
];

// 🧩 事件聚合用的「主題關鍵字」
// 這些比單純前幾個字更有語意，可以把同一類事件聚在一起
const CLUSTER_KEYWORDS = [
  "台積電",
  "台股",
  "美股",
  "日股",
  "匯率",
  "新台幣",
  "利率",
  "升息",
  "降息",
  "通膨",
  "ETF",
  "高股息",
  "債券",
  "殖利率",
  "AI",
  "半導體",
  "房市",
  "勞保",
  "退休",
  "關稅",
];

// 把標題的「裝飾用前綴 / 後綴」拿掉，例如：
// 【快訊】、（影）、(影)、[影音]、後面「｜XXX」的媒體尾巴
function stripDecorations(title: string): string {
  let t = title;

  // 去掉 【...】 或 ［...］ 這類前綴
  t = t.replace(/【[^】]*】/g, "");
  t = t.replace(/［[^］]*］/g, "");
  t = t.replace(/\[[^\]]*]/g, "");

  // 去掉 （...） 或 (...) 這類註解
  t = t.replace(/（[^）]*）/g, "");
  t = t.replace(/\([^)]*\)/g, "");

  // 去掉媒體尾巴：「標題｜媒體名稱」
  t = t.replace(/｜.*$/, "");

  // 最後先 trim 一下
  return t.trim();
}

// ✅ 情緒判斷用的字詞（正向）
const POSITIVE_WORDS = [
  "大漲",
  "飆升",
  "勁揚",
  "走高",
  "走揚",
  "上攻",
  "收紅",
  "收高",
  "創高",
  "創新高",
  "創歷史新高",
  "利多",
  "成長",
  "激增",
  "回溫",
  "熱絡",
  "受惠",
  "看好",
  "樂觀",
  "好轉",
  "穩中有進",
  "加薪",
];

// ✅ 情緒判斷用的字詞（負向）
const NEGATIVE_WORDS = [
  "暴跌",
  "崩跌",
  "崩盤",
  "重挫",
  "重跌",
  "大跌",
  "慘跌",
  "下殺",
  "下挫",
  "摜破",
  "失守",
  "利空",
  "下滑",
  "衰退",
  "走跌",
  "走弱",
  "拉回",
  "修正",
  "回檔",
  "爆雷",
  "違約",
  "爛帳",
  "風險升高",
  "悲觀",
  "哭哭",
];

// ====== 型別定義區 ======
type Sentiment = "positive" | "negative" | "neutral"; // 單則新聞的情緒
type ViewMode = "list" | "cluster" | "keyword"; // 畫面顯示模式
type SentimentFilter = "all" | "positive" | "negative" | "neutral"; // 篩選用情緒條件

// 聚合（事件）後的資料型別
interface Cluster {
  id: string; // 這一群事件的 key（由標題算出來）
  title: string; // 代表標題（通常是最新那一則）
  sourceName: string; // 顯示用來源名稱（取最新那則）
  latestTimestamp: string; // 這群事件裡最晚的時間
  count: number; // 這個事件群組內有幾則新聞
  items: NewsItem[]; // 群內所有新聞
  sentiment: Sentiment; // 這個事件總體情緒（取最新那則）
}

// 關鍵字統計用
interface KeywordStat {
  keyword: string; // 關鍵字名稱
  hits: number; // 命中新聞數
  hitRate: number; // 命中率（0~1）
}

// ====== 工具函式區 ======

// 讓相對路徑的連結變成完整網址
function fixLink(item: NewsItem): string {
  let link = item.link;
  if (link && link.startsWith("/")) {
    // Yahoo 財經的相對路徑
    if (item.source === "yahoo") {
      link = "https://tw.stock.yahoo.com" + link;
    }
    // UDN 的相對路徑
    else if (item.source === "udn") {
      link = "https://udn.com" + link;
    }
  }
  return link;
}

// 🧩 新版：多階段事件 key
// 1️⃣ 優先看「4 碼股票代碼」 → stock:2330
// 2️⃣ 再看「主題關鍵字」       → topic:台股 / topic:房市
// 3️⃣ 最後才用「清理後標題前幾個字」 → title:景氣對策信號連三藍
function buildClusterKey(title: string): string {
  const raw = title.trim();

  // 1️⃣ 股票代碼（例如 2330, 2317, 0050）
  const stockMatch = raw.match(/\b\d{4}\b/);
  if (stockMatch) {
    return `stock:${stockMatch[0]}`;
  }

  // 2️⃣ 主題關鍵字（台積電、台股、美股、房市、勞保...）
  for (const kw of CLUSTER_KEYWORDS) {
    if (raw.includes(kw)) {
      return `topic:${kw}`;
    }
  }

  // 3️⃣ 清理掉裝飾用字串（【快訊】、（影）、｜XXX）
  const cleaned = stripDecorations(raw);

  // 4️⃣ 去掉標點與空白，取前 18 個字
  const base = cleaned.replace(/[：:；;，,。.!！?？\-_\s]/g, "").toLowerCase();

  if (!base) return ""; // 萬一真的空掉，直接回傳空字串讓上游忽略

  return `title:${base.slice(0, 18)}`;
}

// ========= 事件分群用：標題指紋 & 相似度 =========

// 標題的「指紋」：拿來比較兩則新聞是否為同一事件
interface TitleFingerprint {
  stockCode?: string; // 4 碼股票代碼（如果有）
  topicKeywords: string[]; // 命中的主題關鍵字（台股、房市、ETF…）
  base: string; // 清理後標題
  bigrams: Set<string>; // 兩個字一組的片段，用來算文字相似度
}

// 把標題清理成「只剩中文 + 英數」的小寫字串
function normalizeTitle(title: string): string {
  const cleaned = stripDecorations(title);
  return cleaned
    .replace(/[^\w\u4e00-\u9fa5]/g, "") // 留下 英數字 + 常見中文字
    .toLowerCase()
    .trim();
}

// 取得標題中的第一個 4 碼股票代碼（如果有）
function extractStockCode(title: string): string | undefined {
  const m = title.match(/\b\d{4}\b/);
  return m ? m[0] : undefined;
}

// 取得標題中命中的主題關鍵字（CLUSTER_KEYWORDS 裡有的）
function extractTopicKeywords(title: string): string[] {
  const hits: string[] = [];
  for (const kw of CLUSTER_KEYWORDS) {
    if (title.includes(kw)) {
      hits.push(kw);
    }
  }
  return hits;
}

// 把字串切成「兩個字一組」的 bigram 集合
function buildBigrams(s: string): Set<string> {
  const set = new Set<string>();
  if (s.length <= 1) return set;
  for (let i = 0; i < s.length - 1; i++) {
    set.add(s.slice(i, i + 2));
  }
  return set;
}

// 產生一個標題的指紋
function makeFingerprint(title: string): TitleFingerprint {
  const raw = title.trim();
  const base = normalizeTitle(raw);
  const stockCode = extractStockCode(raw);
  const topicKeywords = extractTopicKeywords(raw);
  const bigrams = buildBigrams(base);

  return { stockCode, topicKeywords, base, bigrams };
}

// 計算兩個 bigram 集合的 Jaccard 相似度（0 ~ 1）
function bigramSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let inter = 0;
  let union = a.size;

  for (const x of b) {
    if (a.has(x)) inter++;
    else union++;
  }

  return inter / union;
}

// 綜合股票代碼 + 主題關鍵字 + bigram，算一個分數
function calcSimilarity(a: TitleFingerprint, b: TitleFingerprint): number {
  let score = 0;

  // 同一支股票 → 加很多分
  if (a.stockCode && b.stockCode && a.stockCode === b.stockCode) {
    score += 4;
  }

  // 有共同主題關鍵字（台股、房市、ETF…）
  const sharedTopics = a.topicKeywords.filter((kw) =>
    b.topicKeywords.includes(kw)
  );
  if (sharedTopics.length > 0) {
    score += 2;
  }

  // 標題文字本身的相似度（用 bigram）
  const sim = bigramSimilarity(a.bigrams, b.bigrams);
  if (sim >= 0.6) score += 3;
  else if (sim >= 0.4) score += 2;
  else if (sim >= 0.25) score += 1;

  return score;
}

// 用最簡單的「字典規則」判斷標題情緒：
// - 命中正向字＋1，負向字＋1
// - 正 > 負 → positive
// - 負 > 正 → negative
// - 都 0 或平手 → neutral
function getSentiment(title: string): Sentiment {
  const t = title.toLowerCase();

  let pos = 0;
  let neg = 0;

  for (const w of POSITIVE_WORDS) {
    if (t.includes(w.toLowerCase())) pos++;
  }
  for (const w of NEGATIVE_WORDS) {
    if (t.includes(w.toLowerCase())) neg++;
  }

  if (pos === 0 && neg === 0) return "neutral";
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral"; // 平手就當中性
}

// 把情緒 code 轉成畫面上要顯示的中文
function getSentimentLabel(s: Sentiment): string {
  if (s === "positive") return "偏正向";
  if (s === "negative") return "偏負向";
  return "中性";
}

// ====== 主組件 App ======
function App() {
  // allNews：從後端拿到的完整新聞列表
  const [allNews, setAllNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false); // 是否正在載入
  const [errorMsg, setErrorMsg] = useState(""); // 錯誤訊息
  const [selectedSource, setSelectedSource] = useState(""); // 來源篩選
  const [keyword, setKeyword] = useState(""); // 標題關鍵字篩選
  const [viewMode, setViewMode] = useState<ViewMode>("list"); // 畫面模式
  const [sentimentFilter, setSentimentFilter] =
    useState<SentimentFilter>("all"); // 情緒篩選

  const totalCount = allNews.length; // 總新聞數（未篩選）

  // 從 GAS API 抓新聞資料
  async function fetchNews() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();

      const news: NewsItem[] = data.news || [];
      setAllNews(news);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("載入失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  // 組件第一次掛載時自動抓一次新聞
  useEffect(() => {
    fetchNews();
  }, []);

  // ====== 第一層：先做「來源 + 標題關鍵字 + 情緒」篩選 ======
  const filteredNews = useMemo(() => {
    return (
      allNews
        // 來源篩選：selectedSource 為空表示「全部」
        .filter((n) => (selectedSource ? n.source === selectedSource : true))
        // 標題關鍵字篩選：用 includes 做簡單比對
        .filter((n) =>
          keyword ? n.title.toLowerCase().includes(keyword.toLowerCase()) : true
        )
        // 情緒篩選：呼叫 getSentiment 判斷每則標題情緒
        .filter((n) => {
          if (sentimentFilter === "all") return true;
          const s = getSentiment(n.title);
          return s === sentimentFilter;
        })
    );
  }, [allNews, selectedSource, keyword, sentimentFilter]);

  // ====== 第二層：事件聚合（分群） ======
  // 依照 buildClusterKey(title) 把 filteredNews 聚成多個「事件群組」
  // ====== 第二層：事件聚合（分群，使用相似度演算法） ======
  const clusters: Cluster[] = useMemo(() => {
    // 在這裡加一個內部型別，讓每個群組裡多存一個「代表指紋」
    interface ClusterWithFp extends Cluster {
      fp: TitleFingerprint; // 代表這個事件的指紋（用最新那一則）
    }

    const result: ClusterWithFp[] = [];

    for (const item of filteredNews) {
      const fp = makeFingerprint(item.title);
      if (!fp.base) continue; // 標題太奇怪或空掉就跳過

      const s = getSentiment(item.title);

      // 1️⃣ 找出最像的現有群組
      let bestIndex = -1;
      let bestScore = 0;

      for (let i = 0; i < result.length; i++) {
        const cluster = result[i];
        const score = calcSimilarity(fp, cluster.fp);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }

      // 2️⃣ 如果相似度分數夠高 → 視為同一事件，塞進去
      //    門檻 3 分：例如 同一支股票(4分) / 主題+文字中度相似(2+1) …
      const THRESHOLD = 3;

      if (bestScore >= THRESHOLD && bestIndex >= 0) {
        const cluster = result[bestIndex];
        cluster.count += 1;
        cluster.items.push(item);

        // 如果這則新聞比較新，就更新代表標題 / 來源 / 情緒 / 指紋
        if (item.timestamp > cluster.latestTimestamp) {
          cluster.latestTimestamp = item.timestamp;
          cluster.title = item.title;
          cluster.sourceName = item.sourceName;
          cluster.sentiment = s;
          cluster.fp = fp;
        }
      } else {
        // 3️⃣ 否則就開一個新的事件群組
        result.push({
          id:
            (fp.stockCode
              ? `stock:${fp.stockCode}`
              : fp.topicKeywords[0]
              ? `topic:${fp.topicKeywords[0]}`
              : `title:${fp.base.slice(0, 10)}`) + `-${item.timestamp}`,
          title: item.title,
          sourceName: item.sourceName,
          latestTimestamp: item.timestamp,
          count: 1,
          items: [item],
          sentiment: s,
          fp,
        });
      }
    }

    // 最後：按時間排序，並把 fp 拿掉，轉回原本 Cluster 型別
    return result
      .sort((a, b) => b.latestTimestamp.localeCompare(a.latestTimestamp))
      .map(({ fp, ...cluster }) => cluster);
  }, [filteredNews]);

  // ====== 第三層：關鍵字命中率統計 ======
  // 基於目前 filteredNews，統計 KEYWORDS 的出現次數
  const keywordStats: KeywordStat[] = useMemo(() => {
    if (filteredNews.length === 0) return [];

    const titles = filteredNews.map((n) => n.title.toLowerCase());
    const stats: KeywordStat[] = [];

    for (const kw of KEYWORDS) {
      const kwLower = kw.toLowerCase();
      let hits = 0;
      for (const t of titles) {
        if (t.includes(kwLower)) {
          hits++;
        }
      }
      if (hits > 0) {
        stats.push({
          keyword: kw,
          hits,
          hitRate: hits / filteredNews.length,
        });
      }
    }

    // 依命中數排序：比較熱門的關鍵字排在前面
    stats.sort((a, b) => b.hits - a.hits);
    return stats;
  }, [filteredNews]);

  // 顯示在右上角 status 的「目前顯示數量」
  const displayCount =
    viewMode === "list"
      ? filteredNews.length
      : viewMode === "cluster"
      ? clusters.length
      : keywordStats.length;

  // ====== JSX 畫面 ======
  return (
    <div className={`page ${viewMode === "keyword" ? "keyword-mode" : ""}`}>
      <div className="page">
        {/* 頁面標題區 + 重新整理按鈕 */}
        <header className="page-header">
          <div>
            <h1>財經新聞整合儀表板</h1>
            <p className="subtitle">
              聚合多家財經媒體最新標題，搭配事件聚合、關鍵字命中率與情緒過濾。
            </p>
          </div>

          <button
            className="btn-primary"
            onClick={fetchNews}
            disabled={loading}
          >
            {loading ? "載入中..." : "重新整理"}
          </button>
        </header>

        {/* 篩選工具列：來源 + 標題關鍵字 + 情緒 + 視圖切換 */}
        <section className="toolbar">
          <div className="toolbar-left">
            {/* 來源篩選 */}
            <label className="field">
              <span>來源：</span>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
              >
                {sourceOptions.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {/* 標題關鍵字篩選 */}
            <label className="field">
              <span>標題關鍵字：</span>
              <input
                type="text"
                placeholder="例如：台積電、美元、利率..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </label>

            {/* ✅ 情緒過濾下拉 */}
            <label className="field">
              <span>情緒：</span>
              <select
                value={sentimentFilter}
                onChange={(e) =>
                  setSentimentFilter(e.target.value as SentimentFilter)
                }
              >
                <option value="all">全部</option>
                <option value="positive">偏正向</option>
                <option value="neutral">中性</option>
                <option value="negative">偏負向</option>
              </select>
            </label>
          </div>

          <div className="toolbar-right">
            {/* 目前顯示數量說明 */}
            <span className="status">
              共 {totalCount} 則｜目前顯示 {displayCount}{" "}
              {viewMode === "cluster"
                ? "群事件"
                : viewMode === "keyword"
                ? "個關鍵字"
                : "則新聞"}
            </span>

            {/* 視圖切換：列表 / 聚合 / 關鍵字 */}
            <div className="view-toggle">
              <button
                className={
                  "toggle-btn" +
                  (viewMode === "list" ? " toggle-btn-active" : "")
                }
                onClick={() => setViewMode("list")}
              >
                列表
              </button>
              <button
                className={
                  "toggle-btn" +
                  (viewMode === "cluster" ? " toggle-btn-active" : "")
                }
                onClick={() => setViewMode("cluster")}
              >
                聚合
              </button>
              <button
                className={
                  "toggle-btn" +
                  (viewMode === "keyword" ? " toggle-btn-active" : "")
                }
                onClick={() => setViewMode("keyword")}
              >
                關鍵字
              </button>
            </div>
          </div>
        </section>

        {/* 如果抓資料失敗，顯示錯誤訊息 */}
        {errorMsg && <div className="error-banner">{errorMsg}</div>}

        {/* 主內容區：依不同 viewMode 顯示不同內容 */}
        <main className="news-list">
          {/* 初次載入中的提示 */}
          {loading && allNews.length === 0 && (
            <div className="hint">正在載入新聞...</div>
          )}

          {/* 各模式的空資料提示 */}
          {!loading && viewMode === "list" && filteredNews.length === 0 && (
            <div className="hint">目前沒有符合條件的新聞</div>
          )}

          {!loading && viewMode === "cluster" && clusters.length === 0 && (
            <div className="hint">目前沒有可聚合的事件</div>
          )}

          {!loading && viewMode === "keyword" && keywordStats.length === 0 && (
            <div className="hint">
              目前沒有可統計的關鍵字命中率（可能是新聞數太少）。
            </div>
          )}

          {/* 📄 列表模式：一則新聞一張卡片 */}
          {viewMode === "list" &&
            filteredNews.map((item, idx) => {
              const s = getSentiment(item.title); // 每一則的情緒
              return (
                <article key={idx} className="news-card">
                  <div className="news-card-header">
                    <div>
                      <span className="source-tag">{item.sourceName}</span>
                      {/* 情緒標籤 */}
                      <span className={"sentiment-tag sentiment-" + s}>
                        {getSentimentLabel(s)}
                      </span>
                    </div>
                    <span className="news-time">
                      抓取：{item.timestamp}
                      {item.rawTime ? `｜原始：${item.rawTime}` : ""}
                    </span>
                  </div>

                  {/* 標題連結 */}
                  <a
                    href={fixLink(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="news-title"
                  >
                    {item.title}
                  </a>
                </article>
              );
            })}

          {/* 🧩 聚合模式：每個「事件群組」一張卡片 */}
          {viewMode === "cluster" &&
            clusters.map((cluster) => (
              <article key={cluster.id} className="news-card">
                <div className="news-card-header">
                  <div>
                    <span className="source-tag">{cluster.sourceName}</span>
                    {/* 群組的情緒（取最新那一則的情緒） */}
                    <span
                      className={"sentiment-tag sentiment-" + cluster.sentiment}
                    >
                      {getSentimentLabel(cluster.sentiment)}
                    </span>
                  </div>
                  <span className="news-time">
                    最新抓取：{cluster.latestTimestamp} ｜ 本事件共{" "}
                    {cluster.count} 則
                  </span>
                </div>

                {/* 代表標題：用最新一則新聞的標題 */}
                <div className="news-title">{cluster.title}</div>

                {/* 列出這個事件裡的前幾則標題 */}
                <ul className="cluster-list">
                  {cluster.items.slice(0, 10).map((item, idx) => (
                    <li key={idx}>
                      <a
                        href={fixLink(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.title}
                      </a>
                    </li>
                  ))}
                  {cluster.count > 3 && (
                    <li className="cluster-more">
                      （還有 {cluster.count - 3} 則相關新聞）
                    </li>
                  )}
                </ul>
              </article>
            ))}

          {/* 📊 關鍵字命中率視圖 */}
          {viewMode === "keyword" && keywordStats.length > 0 && (
            <section className="keyword-section">
              <div className="keyword-header">
                <h2>常用關鍵字命中率</h2>
                <p>
                  基於目前篩選後的 {filteredNews.length} 則新聞， 統計 20
                  個常用關鍵字的出現次數與命中率（已套用情緒過濾）。
                </p>
              </div>

              {/* 表格版：清楚看數字 */}
              <table className="keyword-table">
                <thead>
                  <tr>
                    <th>關鍵字</th>
                    <th>命中新聞數</th>
                    <th>命中率</th>
                  </tr>
                </thead>
                <tbody>
                  {keywordStats.map((stat) => (
                    <tr key={stat.keyword}>
                      <td>{stat.keyword}</td>
                      <td>{stat.hits}</td>
                      <td>{(stat.hitRate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 長條圖版：視覺化比較直覺 */}
              <div className="keyword-chart">
                <h3>命中率長條圖</h3>
                <div className="keyword-bars">
                  {keywordStats.map((stat) => (
                    <div key={stat.keyword} className="keyword-bar-row">
                      <span className="keyword-bar-label">{stat.keyword}</span>
                      <div className="keyword-bar-track">
                        <div
                          className="keyword-bar-fill"
                          style={{ width: `${stat.hitRate * 100}%` }}
                        />
                      </div>
                      <span className="keyword-bar-value">
                        {(stat.hitRate * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
