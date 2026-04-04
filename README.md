# Listen Downloader

**Listen Downloader** is a modern, cross-platform desktop application for discovering, streaming, and downloading music from YouTube Music. It combines a sleek glassmorphism-inspired UI with a powerful Python/FastAPI backend to deliver a seamless music experience — entirely for personal, offline use.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-orange.svg)

---

## ✨ Features

### 🎵 Music Discovery
- **Smart Search** – Find any track, artist, or album from the YouTube Music library with instant results
- **Personalized Recommendations** – Get "For You" suggestions powered by your downloaded library using radio-style seed matching
- **Infinite Scroll** – Continuously load fresh recommendations as you browse

### ⬇️ Download & Offline Management
- **One-Click Downloads** – Download tracks as high-quality MP3s (192 kbps) with embedded metadata
- **Album Art Preservation** – Automatically fetches and saves cover art for each track
- **Smart Caching** – Detects already-downloaded tracks to avoid duplicates
- **Local Library** – All downloads stored in `~/Music/ListenDownloads/` for easy access

### 📚 Library & Playlists
- **My Library** – Browse all your downloaded tracks in one place
- **Custom Playlists** – Create, rename, and delete personal playlists
- **Playlist Management** – Add tracks to any playlist, reorganize your music collection

### 🎧 Audio Player
- **Full-Featured Controls** – Play, pause, skip forward/backward, seek, volume
- **Media Session API** – Use keyboard media keys (Play/Pause/Next/Prev) globally
- **Loop & Shuffle** – Repeat tracks or randomize playback order
- **State Persistence** – Remembers your volume level across sessions
- **Streaming** – Preview any track instantly without downloading

### 🎨 User Interface
- **Glassmorphism Design** – Beautiful frosted-glass aesthetic with dark theme
- **Responsive Layout** – Sidebar navigation with smooth view transitions
- **Toast Notifications** – Real-time feedback for all user actions
- **Loading Indicators** – Elegant spinners for async operations

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.10+, FastAPI, Uvicorn |
| **Music APIs** | `ytmusicapi` (search & recommendations), `yt-dlp` (stream & download) |
| **Desktop Shell** | PyWebView (native window wrapper) |
| **Frontend** | Vanilla HTML5, CSS3 (Glassmorphism), JavaScript (ES6+) |
| **Icons** | Phosphor Icons |
| **Fonts** | Outfit (Google Fonts) |
| **Audio Processing** | FFmpeg (via yt-dlp post-processor) |

---

## 📁 Project Structure

```
ytmusic_app/
├── main.py                 # FastAPI backend + PyWebView desktop window
├── requirements.txt        # Python dependencies
├── ListenDownloader.spec   # PyInstaller build configuration
├── icon.ico               # Application icon (Windows)
├── static/
│   ├── index.html         # Main HTML structure
│   ├── style.css          # Glassmorphism CSS styling
│   └── app.js             # Frontend JavaScript (API calls, player, UI)
├── build/                 # PyInstaller build artifacts
└── README.md
```

---

## 🚀 Installation & Setup

### Prerequisites

1. **Python 3.10 or higher** – [Download Python](https://www.python.org/downloads/)
2. **FFmpeg** – Required for audio extraction by yt-dlp
   - **Windows**: Download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/), extract, and add `bin/` to your PATH
   - **macOS**: `brew install ffmpeg`
   - **Linux**: `sudo apt install ffmpeg` (Debian/Ubuntu) or `sudo dnf install ffmpeg` (Fedora)

### Running from Source

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/listen-downloader.git
cd listen-downloader

# 2. Create a virtual environment (recommended)
python -m venv venv

# 3. Activate the virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Launch the application
python main.py
```

The application window will open automatically. The backend server runs on `http://127.0.0.1:8000`.

---

## 📦 Building a Standalone Executable

### Windows (.exe)

```bash
# Install PyInstaller
pip install pyinstaller

# Build using the provided .spec file
python -m PyInstaller -y ListenDownloader.spec
```

Your executable will be at: `dist/Listen Downloader/Listen Downloader.exe`

### macOS (.app) & Linux (binary)

```bash
# Install PyInstaller
pip install pyinstaller

# Build (adjust the .spec file for your platform if needed)
pyinstaller -y ListenDownloader.spec
```

> **Note**: The bundled executable includes the Python interpreter and all dependencies. FFmpeg must still be installed separately on the target machine.

---

## 🔌 API Reference

The backend exposes the following REST endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Serves the main HTML page |
| `GET` | `/api/search?q={query}` | Search YouTube Music for songs |
| `GET` | `/api/recommendations` | Get personalized track recommendations |
| `POST` | `/api/download` | Download a track (body: `{videoId, title, artists, thumbnail}`) |
| `DELETE` | `/api/library/{video_id}` | Delete a track from the library |
| `GET` | `/api/library` | Get all downloaded tracks with metadata |
| `GET` | `/api/stream?video_id={id}` | Get a streaming URL for preview |
| `GET` | `/api/playlists` | Get all user playlists |
| `POST` | `/api/playlists` | Create/update playlists (body: `{playlists: []}`) |
| `GET` | `/downloads/audio/{id}.mp3` | Serve downloaded audio file |
| `GET` | `/downloads/art/{id}.jpg` | Serve downloaded album art |

---

## 💾 Data Storage

All user data is stored locally in `~/Music/ListenDownloads/`:

```
~/Music/ListenDownloads/
├── audio/
│   ├── {videoId}.mp3      # Downloaded audio file
│   └── {videoId}.json     # Track metadata (title, artist, album, thumbnail)
├── art/
│   └── {videoId}.jpg      # Album cover art
└── playlists.json         # User-created playlists
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Play/Pause` | Toggle playback |
| `Next Track` | Skip to next song |
| `Previous Track` | Skip to previous song |

> Media keys work globally when the application window is focused.

---

## 🛡️ Legal & Ethical Notice

**Listen Downloader** is intended for **personal, educational, and non-commercial use only**. 

- Please respect YouTube Music's [Terms of Service](https://www.youtube.com/t/terms)
- Only download content you have the right to use
- Do not distribute downloaded content
- Support artists by purchasing their music when possible

This application does not host any content. All music is sourced directly from YouTube Music and remains the property of its respective copyright holders.

---

## 🐛 Troubleshooting

### FFmpeg not found
Ensure FFmpeg is installed and added to your system PATH. Run `ffmpeg -version` in a terminal to verify.

### Download fails
- Check your internet connection
- Some videos may be region-locked or private
- Update `yt-dlp`: `pip install --upgrade yt-dlp`

### Application won't start
- Ensure Python 3.10+ is installed
- Install all dependencies: `pip install -r requirements.txt`
- Check that port 8000 is not already in use

### Recommendations not loading
The recommendation system requires at least one downloaded track to generate personalized suggestions. Download a few songs first, then click "Refresh For You."

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [ytmusicapi](https://github.com/sigma67/ytmusicapi) – Unofficial YouTube Music API
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) – Feature-rich media downloader
- [PyWebView](https://github.com/r0x0r/pywebview) – Cross-platform webview framework
- [Phosphor Icons](https://phosphoricons.com/) – Beautiful, flexible icon family
- [FastAPI](https://fastapi.tiangolo.com/) – Modern, fast Python web framework

---

<div align="center">

**Made with ❤️ for music lovers**

If you enjoy this project, please ⭐ star the repository!

</div>