import os
import json
import asyncio
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ytmusicapi import YTMusic
import yt_dlp
import requests
import threading
import uvicorn
import webview
import sys
from collections import deque

app = FastAPI(title="Listen Downloader Backend")

# Cache to avoid recommending the same tracks repeatedly
RECENT_RECOMMENDATIONS = deque(maxlen=200)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- PyInstaller Path Resolution ---
def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# Resolve directories
STATIC_DIR = resource_path("static")
DOWNLOADS_DIR = os.path.join(os.path.expanduser("~"), "Music", "ListenDownloads")
DL_AUDIO_DIR = os.path.join(DOWNLOADS_DIR, "audio")
DL_ART_DIR = os.path.join(DOWNLOADS_DIR, "art")

# Ensure directories exist
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(DL_AUDIO_DIR, exist_ok=True)
os.makedirs(DL_ART_DIR, exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/downloads", StaticFiles(directory=DOWNLOADS_DIR), name="downloads")

ytmusic = YTMusic()

@app.get("/")
async def root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.get("/api/search")
async def search_music(q: str):
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
    try:
        results = ytmusic.search(q, filter="songs")
        # Format results
        formatted_results = []
        for res in results:
            if res['resultType'] == 'song':
                thumbnails = res.get('thumbnails', [])
                # Get highest quality thumbnail
                best_thumbnail = thumbnails[-1]['url'] if thumbnails else ""
                # YTMusic sometimes returns thumbnail URLs that need to be parsed (e.g., removing dimensions)
                if best_thumbnail and "=" in best_thumbnail:
                    best_thumbnail = best_thumbnail.split("=")[0]
                
                artists = ", ".join([a['name'] for a in res.get('artists', [])])
                
                formatted_results.append({
                    "videoId": res['videoId'],
                    "title": res['title'],
                    "artists": artists,
                    "album": res.get('album', {}).get('name', 'Single') if res.get('album') else 'Single',
                    "duration": res.get('duration', '0:00'),
                    "thumbnail": best_thumbnail
                })
        return {"results": formatted_results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DownloadItem(BaseModel):
    videoId: str
    title: str
    artists: str
    thumbnail: str | None = None
    audio: str | None = None # This will be set after download

@app.post("/api/download")
async def download_music(item: DownloadItem):
    if not item.videoId:
        raise HTTPException(status_code=400, detail="videoId is required")
    
    output_audio = os.path.join(DL_AUDIO_DIR, f"{item.videoId}.mp3")
    output_art = os.path.join(DL_ART_DIR, f"{item.videoId}.jpg")
    
    # Check if already downloaded
    if os.path.exists(output_audio):
        return {"status": "already_downloaded", "file": f"/downloads/audio/{item.videoId}.mp3"}
        
    # Download audio with yt-dlp
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(DL_AUDIO_DIR, f"{item.videoId}.%(ext)s"),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True
    }
    
    def download_task():
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([f"https://www.youtube.com/watch?v={item.videoId}"])
                
            # Download cover art
            if item.thumbnail:
                try:
                    img_data = requests.get(item.thumbnail).content
                    with open(output_art, 'wb') as handler:
                        handler.write(img_data)
                except Exception as e:
                    print(f"Error downloading art for {item.videoId}: {e}")
                    
            # Save metadata
            metadata_file = os.path.join(DL_AUDIO_DIR, f"{item.videoId}.json")
            item.audio = f"/downloads/audio/{item.videoId}.mp3" # Update item with local audio path
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(item.dict(), f, ensure_ascii=False, indent=4)
                
        except Exception as e:
            raise Exception(f"Download failed for {item.videoId}: {str(e)}")

    try:
        await asyncio.to_thread(download_task)
        return {"status": "success", "file": f"/downloads/audio/{item.videoId}.mp3"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/library/{video_id}")
async def delete_music(video_id: str):
    if not video_id:
        raise HTTPException(status_code=400, detail="video_id is required")

    output_audio = os.path.join(DL_AUDIO_DIR, f"{video_id}.mp3")
    output_json = os.path.join(DL_AUDIO_DIR, f"{video_id}.json")
    output_art = os.path.join(DL_ART_DIR, f"{video_id}.jpg")
    
    try:
        if os.path.exists(output_audio):
            os.remove(output_audio)
        if os.path.exists(output_json):
            os.remove(output_json)
        if os.path.exists(output_art):
            os.remove(output_art)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/library")
async def get_library():
    try:
        library = []
        if os.path.exists(DL_AUDIO_DIR):
            for filename in os.listdir(DL_AUDIO_DIR):
                if filename.endswith(".json"):
                    with open(os.path.join(DL_AUDIO_DIR, filename), 'r', encoding='utf-8') as f:
                        library.append(json.load(f))
        # Sort library by local addition theoretically, or just return
        return {"library": library}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/playlists")
async def get_playlists():
    try:
        playlists_file = os.path.join(DOWNLOADS_DIR, "playlists.json")
        if os.path.exists(playlists_file):
            with open(playlists_file, 'r', encoding='utf-8') as f:
                playlists = json.load(f)
        else:
            # Create a default "Favorites" playlist
            playlists = [{"id": "fav", "name": "Favorites", "tracks": []}]
            with open(playlists_file, 'w', encoding='utf-8') as f:
                json.dump(playlists, f, ensure_ascii=False, indent=4)
                
        return {"playlists": playlists}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/playlists")
async def update_playlists(request: Request):
    try:
        data = await request.json()
        playlists_file = os.path.join(DOWNLOADS_DIR, "playlists.json")
        with open(playlists_file, 'w', encoding='utf-8') as f:
            json.dump(data.get("playlists", []), f, ensure_ascii=False, indent=4)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/recommendations")
async def get_recommendations():
    """
    Generate recommendations by getting 'Radio' related tracks based on a random song from 
    the user's library. Caches recently recommended tracks to avoid duplicates.
    """
    import random
    global RECENT_RECOMMENDATIONS
    try:
        library = []
        if os.path.exists(DL_AUDIO_DIR):
            for filename in os.listdir(DL_AUDIO_DIR):
                if filename.endswith(".json"):
                    with open(os.path.join(DL_AUDIO_DIR, filename), 'r', encoding='utf-8') as f:
                        library.append(json.load(f))
                        
        existing_video_ids = set([item.get("videoId") for item in library if item.get("videoId")])
        
        results = []
        if not library:
            # If library is empty, return some generic popular stuff
            search_query = "Top Hits " + str(random.randint(2010, 2024))
            results = ytmusic.search(search_query, filter="songs", limit=40)
        else:
            # Pick a random downloaded song as a seed
            seed_song = random.choice(library)
            seed_id = seed_song.get("videoId")
            
            if seed_id:
                try:
                    # Use get_watch_playlist for "Radio" style recommendations
                    watch_playlist = ytmusic.get_watch_playlist(videoId=seed_id, limit=40)
                    results = watch_playlist.get("tracks", [])
                except Exception as e:
                    print(f"Watch playlist failed: {e}")
                    
            # Fallback to search if watch_playlist failed or seed_id missing
            if not results:
                seed_artist = seed_song.get("artists", "").split(",")[0].strip()
                modifiers = ["", "live", "acoustic", "remix", "songs", "lyrics", "audio"]
                search_query = f"{seed_artist} {random.choice(modifiers)}"
                results = ytmusic.search(search_query, filter="songs", limit=40)
        
        formatted_results = []
        # Randomize the returned results order
        random.shuffle(results)
        
        for res in results:
            vid = res.get('videoId')
            # Check if valid video id, not in library, and not recently recommended
            if vid and vid not in existing_video_ids and vid not in RECENT_RECOMMENDATIONS:
                # Discard non-song results if from search
                if res.get('resultType') and res.get('resultType') != 'song':
                    continue
                    
                thumbnails = res.get('thumbnails') or res.get('thumbnail') or []
                best_thumbnail = thumbnails[-1]['url'] if thumbnails else ""
                if best_thumbnail and "=" in best_thumbnail:
                    best_thumbnail = best_thumbnail.split("=")[0]
                
                artists_data = res.get('artists', [])
                artists = ""
                if isinstance(artists_data, list):
                    artists = ", ".join([a.get('name', '') for a in artists_data if isinstance(a, dict)])
                elif isinstance(artists_data, str):
                    artists = artists_data
                
                # Length comes from watch_playlist, duration comes from search
                duration = res.get('duration') or res.get('length') or '0:00'
                
                formatted_results.append({
                    "videoId": vid,
                    "title": res.get('title', 'Unknown Title'),
                    "artists": artists,
                    "album": res.get('album', {}).get('name', 'Single') if res.get('album') else 'Single',
                    "duration": duration,
                    "thumbnail": best_thumbnail
                })
                
                # Add to recent list
                RECENT_RECOMMENDATIONS.append(vid)
                
                if len(formatted_results) >= 12:  # 12 recommendations per fetch
                    break
                    
        return {"recommendations": formatted_results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stream")
async def stream_audio(video_id: str):
    if not video_id:
        raise HTTPException(status_code=400, detail="video_id is required")
        
    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'simulate': True, # Important: Don't download the file
        'geturl': True # Return the streaming URL
    }
    
    def get_stream_url():
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                return info.get('url')
        except Exception as e:
            raise Exception(str(e))
            
    try:
        url = await asyncio.to_thread(get_stream_url)
        if url:
             return {"url": url}
        else:
             raise HTTPException(status_code=404, detail="Stream URL not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def start_server():
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")

if __name__ == "__main__":
    # Start the FastAPI server in a separate daemon thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # Create the PyWebView window
    window = webview.create_window(
        "Listen Downloader", 
        "http://127.0.0.1:8000/", 
        width=1200, 
        height=800,
        min_size=(800, 600),
        background_color='#0f0f13'  # Match frontend dark theme
    )
    
    # Global Media Hotkeys Listener
    try:
        from pynput import keyboard
        def on_press(key):
            try:
                if key == keyboard.Key.media_play_pause:
                    window.evaluate_js("document.getElementById('playPauseBtn').click()")
                elif key == keyboard.Key.media_next:
                    window.evaluate_js("document.getElementById('nextBtn').click()")
                elif key == keyboard.Key.media_previous:
                    window.evaluate_js("document.getElementById('prevBtn').click()")
            except Exception:
                pass

        listener = keyboard.Listener(on_press=on_press)
        # We make it daemon so it exits when the main thread exits
        listener.daemon = True
        listener.start()
    except Exception as e:
        print(f"Hotkeys failed to initialize: {e}")
    
    # Block and run the webview loop
    webview.start(private_mode=False)
