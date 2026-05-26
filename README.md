# 🔍 SEO Word Tracker

An advanced, browser-based SEO content analyzer built with **React + Vite**. Paste any content and get instant analysis across 9 dimensions — no backend, no API keys, handles 50,000+ words in real time.

![SEO Word Tracker](https://img.shields.io/badge/React-18-61dafb?logo=react) ![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite) ![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

| Tab | What it does |
|-----|-------------|
| 📊 **Word Frequency** | Total & unique word count, keyword density table with color-coded overuse warnings |
| 🔗 **Long-tail Phrases** | 2–6 word ngram detection with custom length option, ranked by frequency |
| ❓ **WH Questions** | Extracts question-type phrases (what, how, why, where...) with SEO opportunity scoring |
| 🧠 **NLP & Entities** | Location, role, industry & brand extraction · topic clusters · LSI keyword suggestions |
| ⚡ **Optimization** | Flesch-Kincaid readability score · stuffing warnings (>5%) · overuse alerts (>3%) |
| 🆚 **Competitor Gap** | Paste competitor content → find missing keywords, phrases & WH questions |
| 🏗️ **SEO Structure** | H1/H2/H3 counts · internal/external links · image alt opportunities · paragraph analysis |
| 🎯 **Intent** | Informational / Commercial / Transactional / Navigational classification with signal breakdown |
| 💾 **Export** | Download as Keywords CSV · Full Report CSV · JSON |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/seo-word-tracker.git
cd seo-word-tracker

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
npm run build
npm run preview
```

---

## 🧠 How it works

All NLP processing runs **entirely in the browser** — no server, no API calls, no data leaves your machine.

- **Tokenization** — splits text into words, strips punctuation
- **Stop word filtering** — 200+ common English stop words removed
- **N-gram extraction** — sliding window algorithm for 2–6 word phrases
- **Entity detection** — regex-based location, role, industry & brand matching
- **Intent scoring** — pattern matching against transactional, commercial, navigational & informational signal words
- **Readability** — Flesch-Kincaid formula (industry standard)
- **LSI keywords** — co-occurrence window analysis (±5 words)

---

## 📁 Project Structure

```
seo-word-tracker/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx          # React entry point
│   └── SEOTracker.jsx    # Main app + all NLP logic
└── README.md
```

---

## 🛠️ Tech Stack

- **React 18** — UI framework
- **Vite 5** — build tool & dev server
- **Lodash** — utility functions
- **Google Sans / Roboto** — typography (Google Material Design 3)
- Zero backend dependencies

---

## 📊 Performance

| Content size | Analysis time |
|---|---|
| 1,000 words | < 50ms |
| 10,000 words | < 200ms |
| 50,000 words | < 800ms |

---

## 🤝 Contributing

Pull requests welcome. For major changes, please open an issue first.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT © 2026
