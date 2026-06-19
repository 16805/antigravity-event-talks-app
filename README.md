# BigQuery Release Notes Hub & Twitter Share

A modern web application built using Python Flask and plain vanilla HTML, JavaScript, and CSS that fetches Google Cloud BigQuery release notes and provides an interactive panel to preview, filter, and easily share updates on X (formerly Twitter).

---

## ✨ Features

- **Chronological Feed Aggregation**: Automatically fetches the official Google BigQuery Release Notes feed (`https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`) and displays logs in a clean timeline grouped by date.
- **Smart Update Parsing**: Google's feed packs multiple release notes under a single date. The frontend JavaScript automatically parses the daily log's HTML, separating individual features, announcements, and deprecations into dedicated cards.
- **Category Badge Filters & Search**: Search updates in real-time by keywords, or quickly filter by tags:
  - 🟢 **Features**
  - 🔵 **Announcements**
  - 🟡 **Deprecations**
  - 🟣 **Others**
- **Simulated Twitter Composer**: Click any card to load it in the composer workspace. It pre-populates a drafted tweet with the release date, text description (automatically truncated to fit the limit), and a link to the original release post.
- **SVG Circular Progress Ring**: An interactive character progress ring counts down from 280. The counter changes dynamically to orange (warning) or red (exceeded limit, disabling the tweet button) as you edit.
- **Cache TTL System**: Features a built-in 5-minute memory caching mechanism to prevent excessive API requests. You can click the **Refresh** button to bypass the cache and fetch fresh notes.

---

## 🛠️ Technology Stack

- **Backend**: Python, Flask (lightweight web server), Requests (feed fetching), ElementTree (XML parsing)
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (custom responsive grid, transitions, animations), Vanilla JavaScript (DOM manipulation, XML-HTML text extractor, Twitter Intents)
- **Icons**: FontAwesome 6

---

## 🚀 Getting Started

### Prerequisites

Make sure you have Python 3 installed on your machine.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/16805/antigravity-event-talks-app.git
   cd antigravity-event-talks-app
   ```

2. **Set up a Virtual Environment (Optional but Recommended):**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Application:**
   ```bash
   python app.py
   ```

5. **Open in Browser:**
   Open your browser and navigate to `http://127.0.0.1:5000/`.

---

## 📁 File Structure

```
├── app.py                   # Flask server logic & feed API endpoint
├── requirements.txt         # Application dependencies
├── README.md                # Project documentation
├── .gitignore               # Ignored files for git version control
├── templates/
│   └── index.html           # Main dashboard structure
└── static/
    ├── css/
    │   └── style.css        # Responsive layouts, variables & animations
    └── js/
        └── app.js           # Fetch logic, search filters & composer handles
```

---

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).
