# Listen Downloader

Listen Downloader is a beautiful, modern desktop application that allows you to discover, stream, and download music from YouTube Music directly to your local machine. It combines a sleek web-based UI with a powerful Python backend to deliver a seamless listening and offline management experience.

## ✨ Features

- **Search & Discover**: Find any track, artist, or album using the YouTube Music library.
- **For You Recommendations**: Get personalized track recommendations based on your downloaded library.
- **High-Quality Streaming**: Listen to any track instantly without downloading it first.
- **Offline Downloads**: Download your favorite tracks (as MP3s along with album art and metadata) securely to your local `Music/ListenDownloader` folder.
- **My Library & Playlists**: Organize your downloaded music into custom playlists. Rename or delete playlists effortlessly.
- **Modern Audio Player**: 
  - Media Session API support (Use your keyboard's hardware media keys: Play/Pause/Next/Prev).
  - Loop and Shuffle functionalities.
  - State persistence (remembers your volume across sessions).
- **Responsive Glassmorphism UI**: A custom, dark-themed UI built with HTML/CSS/JS that feels native and responsive.

## 🛠 Tech Stack

- **Backend**: Python, FastAPI, Uvicorn 
- **Core APIs**: `ytmusicapi` (Searching/Recommendations), `yt-dlp` (Streaming/Downloading)
- **Desktop Window**: PyWebView
- **Frontend**: Vanilla HTML5, CSS3, JavaScript
- **Icons**: Phosphor Icons

## 🚀 Installation & Setup

### Prerequisites
- Python 3.10+ installed on your system.
- `ffmpeg` installed and added to your system PATH (required by `yt-dlp` for extracting audio).

### Running from Source
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/listen-downloader.git
   cd listen-downloader
   ```
2. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the application:
   ```bash
   python main.py
   ```

## 📦 Building the Executable (Windows)

You can compile the application into a standalone `.exe` using PyInstaller. A `.spec` file is already configured.

1. Install PyInstaller:
   ```bash
   pip install pyinstaller
   ```
2. Build the project:
   ```bash
   python -m PyInstaller -y ListenDownloader.spec
   ```
3. Find your built executable at:
   `dist/Listen Downloader/Listen Downloader.exe`
