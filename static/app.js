document.addEventListener('contextmenu', event => event.preventDefault());

document.addEventListener('DOMContentLoaded', () => {
    // ==== Navigation ====
    const navLinks = document.querySelectorAll('.nav-links li');
    const views = document.querySelectorAll('.view');
    
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(l => l.classList.remove('active'));
            views.forEach(v => v.classList.remove('active-view'));
            
            link.classList.add('active');
            const target = link.getAttribute('data-target');
            document.getElementById(target).classList.add('active-view');
            
            if (target === 'library-view') {
                loadPlaylists();
                loadLibrary();
            } else if (target === 'search-view') {
                // When navigating to Discover, check if we need to load initial recommendations
                if(searchInput.value.trim() === '' && resultsGrid.children.length === 0) {
                     loadRecommendations();
                }
            }
        });
    });

    // Make sure we load the library first so we can check for downloaded tracks
    loadLibrary().then(() => {
         // Auto-load For You recommendations on initial app load
         loadRecommendations();
    });

    // ==== Discover / Search Logic ====
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const resultsGrid = document.getElementById('resultsGrid');
    const searchLoader = document.getElementById('searchLoader');
    const discoverTitleContainer = document.getElementById('discoverTitleContainer');
    const discoverTitle = document.getElementById('discoverTitle');

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // Clear search when input is empty to revert to recommendations
    searchInput.addEventListener('input', () => {
        if (searchInput.value.trim() === '') {
            discoverTitleContainer.style.display = 'flex';
            discoverTitle.textContent = "For You";
            resultsGrid.innerHTML = '';
            loadRecommendations();
        }
    });

    async function performSearch() {
        const query = searchInput.value.trim();
        if (!query) {
            discoverTitleContainer.style.display = 'flex';
            discoverTitle.textContent = "For You";
            resultsGrid.innerHTML = '';
            loadRecommendations();
            return;
        }

        discoverTitleContainer.style.display = 'flex';
        discoverTitle.textContent = `Search Results for "${query}"`;
        searchLoader.classList.remove('hidden');
        resultsGrid.innerHTML = '';
        
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            
            if (data.results && data.results.length > 0) {
                renderSearchResults(data.results, resultsGrid);
            } else {
                resultsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted)">No results found.</p>';
            }
        } catch (err) {
            showToast('Search failed.', 'error');
        } finally {
            searchLoader.classList.add('hidden');
        }
    }

    function renderSearchResults(results, container) {
        // Clear container if needed or append
        results.forEach((item, index) => {
            const isDownloaded = currentLibrary.some(t => t.videoId === item.videoId);
            
            const card = document.createElement('div');
            card.className = 'card';
            card.style.cursor = 'pointer'; 
            
            let btnHTML = '';
            if (isDownloaded) {
                btnHTML = `
                    <button class="btn-download" disabled style="background: #4caf50;" title="Already Downloaded">
                        <i class="ph-fill ph-check"></i>
                    </button>
                `;
            } else {
                btnHTML = `
                    <button class="btn-download" title="Download Offline">
                        <i class="ph-fill ph-download-simple"></i>
                    </button>
                `;
            }
            
            card.innerHTML = `
                <div class="card-image-wrap">
                    <img src="${item.thumbnail || 'https://via.placeholder.com/300x170?text=No+Cover'}" alt="Cover">
                    <span class="card-duration">${item.duration}</span>
                    <div class="card-play-overlay glass" style="display:none; position:absolute; inset:0; align-items:center; justify-content:center;">
                         <i class="ph-fill ph-play-circle" style="font-size: 3rem; color: white;"></i>
                    </div>
                </div>
                <div class="card-body">
                    <div class="card-title" title="${item.title}">${item.title}</div>
                    <div class="card-artist" title="${item.artists}">${item.artists}</div>
                    <div class="card-actions">
                        ${btnHTML}
                    </div>
                </div>
            `;
            
            // Hover effect on image wrap to show play overlay
            const wrap = card.querySelector('.card-image-wrap');
            const overlay = wrap.querySelector('.card-play-overlay');
            wrap.addEventListener('mouseenter', () => overlay.style.display = 'flex');
            wrap.addEventListener('mouseleave', () => overlay.style.display = 'none');
            
            // Click to stream
            card.addEventListener('click', (e) => {
                 // Prevent stream if they clicked download button directly
                 if (e.target.closest('.btn-download')) return;
                 streamTrack(item, Array.from(container.children).indexOf(card), Array.from(results));
            });
            
            const btn = card.querySelector('.btn-download');
            btn.addEventListener('click', (e) => {
                 e.stopPropagation();
                 downloadTrack(item, btn);
            });
            
            container.appendChild(card);
        });
    }

    // ==== Download Logic ====
    async function downloadTrack(item, btnElement) {
        btnElement.classList.add('downloading');
        btnElement.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
        btnElement.disabled = true;

        showToast(`Starting download for ${item.title}...`, 'info');

        try {
            const res = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            const data = await res.json();
            
            if (res.ok) {
                if (data.status === 'already_downloaded') {
                    showToast('Track already exists in Library!', 'info');
                } else {
                    showToast('Download complete.', 'success');
                    // Add directly to currentLibrary to immediately update UI state
                    currentLibrary.push(item);
                }
                btnElement.innerHTML = '<i class="ph-fill ph-check"></i>';
                btnElement.classList.remove('downloading');
                btnElement.style.background = '#4caf50';
                btnElement.title = "Already Downloaded";
                btnElement.disabled = true;
            } else {
                throw new Error(data.detail);
            }
        } catch (err) {
            console.error(err);
            showToast('Download failed.', 'error');
            btnElement.innerHTML = '<i class="ph-fill ph-download-simple"></i>';
            btnElement.classList.remove('downloading');
            btnElement.disabled = false;
        }
    }

    // ==== Recommendations Logic ====
    const recLoader = document.getElementById('recLoader');
    const refreshRecBtn = document.getElementById('refreshRecBtn');
    let isFetchingRecs = false;

    if(refreshRecBtn) {
        refreshRecBtn.addEventListener('click', () => {
             resultsGrid.innerHTML = '';
             loadRecommendations();
        });
    }

    async function loadRecommendations() {
        // Only load recommendations if we are actually showing them
        if (searchInput.value.trim() !== '') return;
        
        if(isFetchingRecs) return;
        isFetchingRecs = true;
        recLoader.classList.remove('hidden');
        
        try {
            const res = await fetch('/api/recommendations');
            const data = await res.json();
            
            if (data.recommendations && data.recommendations.length > 0) {
                renderSearchResults(data.recommendations, resultsGrid);
            } else if (resultsGrid.children.length === 0) {
                resultsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted)">Download some songs to get better recommendations.</p>';
            }
        } catch (err) {
            showToast('Failed to load recommendations.', 'error');
        } finally {
            recLoader.classList.add('hidden');
            isFetchingRecs = false;
        }
    }

    // Infinite Scroll Logic
    const contentArea = document.querySelector('.content-area');
    contentArea.addEventListener('scroll', () => {
        const activeView = document.querySelector('.active-view');
        if (activeView && activeView.id === 'search-view' && searchInput.value.trim() === '') {
            // Check if we are near the bottom of the scrollable area
            if (contentArea.scrollTop + contentArea.clientHeight >= contentArea.scrollHeight - 200) {
                loadRecommendations();
            }
        }
    });

    // ==== Library & Playlists Logic ====
    const libraryList = document.getElementById('libraryList');
    const refreshLibBtn = document.getElementById('refreshLibBtn');
    const libLoader = document.getElementById('libLoader');
    let currentLibrary = [];
    
    let currentPlaylists = [];
    let currentActivePlaylistId = null; 
   
    const createPlaylistBtn = document.getElementById('createPlaylistBtn');
    const playlistModal = document.getElementById('playlistModal');
    const closePlaylistModalBtn = document.getElementById('closePlaylistModal');
    const newPlaylistNameInput = document.getElementById('newPlaylistName');
    const createNewPlaylistBtn = document.getElementById('createNewPlaylistBtn');
    const modalPlaylistsList = document.getElementById('modalPlaylistsList');
    
    let trackToAdd = null;

    refreshLibBtn.addEventListener('click', () => {
        loadPlaylists();
        loadLibrary();
    });

    async function loadPlaylists() {
        try {
            const res = await fetch('/api/playlists');
            const data = await res.json();
            currentPlaylists = data.playlists || [];
            renderPlaylistsSidebar();
        } catch (err) {
            console.error("Failed to load playlists", err);
        }
    }
    
    async function savePlaylists() {
        try {
            await fetch('/api/playlists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playlists: currentPlaylists })
            });
        } catch (err) {
            console.error("Failed to save playlists", err);
        }
    }

    function renderPlaylistsSidebar() {
        const list = document.getElementById('playlistsList');
        if(!list) return;
        list.innerHTML = `
            <li class="${currentActivePlaylistId === null ? 'active' : ''}" data-id="all">All Tracks</li>
        `;
        
        currentPlaylists.forEach(pl => {
            const li = document.createElement('li');
            if (currentActivePlaylistId === pl.id) li.classList.add('active');
            
            li.innerHTML = `
                <span class="pl-name" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${pl.name}</span>
                <div class="pl-actions" style="display:flex; gap:5px;">
                    <button class="icon-btn edit-pl-btn" title="Rename"><i class="ph ph-pencil-simple"></i></button>
                    <button class="icon-btn delete-pl-btn" title="Delete"><i class="ph ph-trash"></i></button>
                </div>
            `;
            
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';

            // Edit logic
            const editBtn = li.querySelector('.edit-pl-btn');
            editBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const newName = prompt("Enter new playlist name:", pl.name);
                if (newName && newName.trim() !== '') {
                    pl.name = newName.trim();
                    await savePlaylists();
                    renderPlaylistsSidebar();
                    if(currentActivePlaylistId === pl.id) {
                        const sectionTitle = document.getElementById('librarySectionTitle');
                        if (sectionTitle) sectionTitle.textContent = pl.name;
                    }
                }
            });

            // Delete logic
            const deleteBtn = li.querySelector('.delete-pl-btn');
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if(confirm(`Are you sure you want to delete playlist "${pl.name}"?`)) {
                    currentPlaylists = currentPlaylists.filter(p => p.id !== pl.id);
                    await savePlaylists();
                    if (currentActivePlaylistId === pl.id) {
                        currentActivePlaylistId = null;
                        renderLibrary(currentLibrary);
                    }
                    renderPlaylistsSidebar();
                    showToast(`Deleted playlist "${pl.name}"`, 'info');
                }
            });

            li.addEventListener('click', () => {
                currentActivePlaylistId = pl.id;
                renderPlaylistsSidebar();
                renderLibrary(currentLibrary);
            });
            list.appendChild(li);
        });
        
        const allTracksLi = list.querySelector('[data-id="all"]');
        allTracksLi.addEventListener('click', () => {
            currentActivePlaylistId = null;
            renderPlaylistsSidebar();
            renderLibrary(currentLibrary);
        });
    }

    createPlaylistBtn.addEventListener('click', () => openPlaylistModal());
    
    function openPlaylistModal(track = null) {
        trackToAdd = track;
        playlistModal.classList.remove('hidden');
        renderModalPlaylists();
    }
    closePlaylistModalBtn.addEventListener('click', () => {
        playlistModal.classList.add('hidden');
    });

    createNewPlaylistBtn.addEventListener('click', async () => {
        const name = newPlaylistNameInput.value.trim();
        if (!name) return;
        
        const newPl = {
            id: 'pl_' + Date.now(),
            name: name,
            tracks: []
        };
        currentPlaylists.push(newPl);
        await savePlaylists();
        newPlaylistNameInput.value = '';
        renderModalPlaylists();
        renderPlaylistsSidebar();
        showToast(`Created playlist ${name}`, 'success');
    });
    
    function renderModalPlaylists() {
        modalPlaylistsList.innerHTML = '';
        currentPlaylists.forEach(pl => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${pl.name}</span>`;
            const btn = document.createElement('button');
            btn.className = 'add-to-playlist-btn';
            
            if (trackToAdd && pl.tracks.some(t => t.videoId === trackToAdd.videoId)) {
                btn.innerHTML = '<i class="ph-fill ph-check"></i>';
                btn.disabled = true;
            } else {
                btn.innerHTML = '<i class="ph ph-plus"></i>';
                btn.addEventListener('click', async () => {
                    if (trackToAdd) {
                        pl.tracks.push(trackToAdd);
                        await savePlaylists();
                        btn.innerHTML = '<i class="ph-fill ph-check"></i>';
                        btn.disabled = true;
                        showToast(`Added to ${pl.name}`, 'success');
                        if (currentActivePlaylistId === pl.id) {
                            renderLibrary(currentLibrary);
                        }
                    }
                });
            }
            li.appendChild(btn);
            modalPlaylistsList.appendChild(li);
        });
    }

    async function loadLibrary() {
        libLoader.classList.remove('hidden');
        libraryList.innerHTML = '';
        
        try {
            const res = await fetch('/api/library');
            const data = await res.json();
            currentLibrary = data.library || [];
            
            renderLibrary(currentLibrary);
        } catch (err) {
            showToast('Failed to load library.', 'error');
        } finally {
            libLoader.classList.add('hidden');
        }
    }

    function renderLibrary(library) {
        libraryList.innerHTML = '';
        let displayList = library;
        const sectionTitle = document.getElementById('librarySectionTitle');
        
        if (currentActivePlaylistId !== null) {
            const activePl = currentPlaylists.find(p => p.id === currentActivePlaylistId);
            if (activePl) {
                if(sectionTitle) sectionTitle.textContent = activePl.name;
                displayList = activePl.tracks.map(t => library.find(l => l.videoId === t.videoId)).filter(Boolean);
            }
        } else {
            if(sectionTitle) sectionTitle.textContent = "All Tracks";
        }
        
        if (displayList.length === 0) {
            libraryList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No tracks found here.</p>';
            return;
        }

        displayList.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'lib-item';
            el.innerHTML = `
                <img src="${item.thumbnail}" alt="Cover">
                <div class="lib-info">
                    <h4>${item.title}</h4>
                    <p>${item.artists}</p>
                </div>
                <div class="lib-actions">
                    <button class="lib-btn add-to-pl" title="Add to Playlist">
                        <i class="ph ph-list-plus"></i>
                    </button>
                    <button class="lib-btn remove-track-btn" style="color:var(--danger, #ff4d4d)" title="${currentActivePlaylistId !== null ? 'Remove from Playlist' : 'Delete from Library'}">
                        <i class="ph ph-trash"></i>
                    </button>
                    <button class="lib-play-btn"><i class="ph-fill ph-play"></i></button>
                </div>
            `;
            
            const playBtn = el.querySelector('.lib-play-btn');
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentLibraryContext = displayList; 
                playTrack(displayList.indexOf(item), currentLibraryContext);
            });
            
            const addPlBtn = el.querySelector('.add-to-pl');
            addPlBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openPlaylistModal(item);
            });
            
            const removeTrackBtn = el.querySelector('.remove-track-btn');
            removeTrackBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (currentActivePlaylistId !== null) {
                    // Remove from active playlist
                    const activePl = currentPlaylists.find(p => p.id === currentActivePlaylistId);
                    if (activePl) {
                        activePl.tracks = activePl.tracks.filter(t => t.videoId !== item.videoId);
                        await savePlaylists();
                        renderLibrary(currentLibrary);
                        showToast(`Removed from playlist`, 'info');
                    }
                } else {
                    // Delete completely from library
                    if (confirm(`Are you sure you want to completely delete "${item.title}"?`)) {
                        try {
                            const res = await fetch(`/api/library/${item.videoId}`, { method: 'DELETE' });
                            if (res.ok) {
                                // Remove from currentLibrary
                                currentLibrary = currentLibrary.filter(t => t.videoId !== item.videoId);
                                
                                // Remove from all playlists
                                currentPlaylists.forEach(pl => {
                                    pl.tracks = pl.tracks.filter(t => t.videoId !== item.videoId);
                                });
                                await savePlaylists();
                                
                                renderLibrary(currentLibrary);
                                showToast(`Deleted "${item.title}"`, 'success');
                                
                                // Refresh discover UI download statuses if needed
                                // Assuming performSearch/loadRecommendations isn't active right now
                            } else {
                                throw new Error('Delete failed');
                            }
                        } catch(err) {
                            console.error(err);
                            showToast('Failed to delete track.', 'error');
                        }
                    }
                }
            });

            el.addEventListener('click', () => {
                currentLibraryContext = displayList;
                playTrack(displayList.indexOf(item), currentLibraryContext);
            });
            
            libraryList.appendChild(el);
        });
    }

    // ==== Audio Player Logic ====
    const audio = document.getElementById('audioElement');
    const playerContainer = document.getElementById('player');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    const pTitle = document.getElementById('playerTitle');
    const pArtist = document.getElementById('playerArtist');
    const pCover = document.getElementById('playerCover');
    
    const progressBar = document.getElementById('progressBar');
    const currentTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');
    const volumeBar = document.getElementById('volumeBar');
    const muteIcon = document.getElementById('muteIcon');
    const shuffleBtn = document.getElementById('shuffleBtn');
    const loopBtn = document.getElementById('loopBtn');

    let currentTrackIndex = -1;
    let currentLibraryContext = [];
    let isShuffleEnabled = false;
    let isLoopEnabled = false;

    if(shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            isShuffleEnabled = !isShuffleEnabled;
            if(isShuffleEnabled) {
                shuffleBtn.classList.add('active');
                showToast('Shuffle Enabled', 'info');
            } else {
                shuffleBtn.classList.remove('active');
                showToast('Shuffle Disabled', 'info');
            }
        });
    }

    if(loopBtn) {
        loopBtn.addEventListener('click', () => {
            isLoopEnabled = !isLoopEnabled;
            if(isLoopEnabled) {
                loopBtn.classList.add('active');
                audio.loop = true;
                showToast('Loop Enabled', 'info');
            } else {
                loopBtn.classList.remove('active');
                audio.loop = false;
                showToast('Loop Disabled', 'info');
            }
        });
    }

    async function streamTrack(track, index, contextList) {
        showToast(`Loading stream for ${track.title}...`, 'info');
        try {
            // Fetch streaming URL from backend
            const res = await fetch(`/api/stream?video_id=${track.videoId}`);
            const data = await res.json();
            
            if (res.ok && data.url) {
                 const streamTrackObj = {
                      ...track,
                      audio: data.url // Replace local path with remote stream URL
                 };
                 // Inject into context so next/prev keeps working if stream succeeds
                 const newContextList = [...contextList];
                 newContextList[index] = streamTrackObj;
                 
                 playTrack(index, newContextList);
            } else {
                 throw new Error("Unable to fetch stream url");
            }
        } catch (err) {
             console.error(err);
             showToast('Failed to stream track.', 'error');
        }
    }

    function playTrack(index, contextList = currentLibraryContext) {
        if (!contextList || contextList.length === 0) return;
        if (index < 0 || index >= contextList.length) return;
        currentLibraryContext = contextList;
        currentTrackIndex = index;
        const track = contextList[index];
        
        // Ensure UI updates immediately even while audio is buffering
        pTitle.textContent = track.title;
        pArtist.textContent = track.artists;
        pCover.src = track.thumbnail || 'https://via.placeholder.com/60';
        playerContainer.classList.add('visible');
        
        audio.src = track.audio;
        audio.play().catch(e => {
            console.error("Autoplay prevented or stream died:", e);
            updatePlayPauseUI(false);
            // showToast("Playback failed.", "error"); // Disabled to avoid spam on quick nexts
        });
        updatePlayPauseUI(true);
        
        // Update Media Session API for hardware keys integration
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.artists,
                album: track.album || 'Playlists',
                artwork: [
                    { src: track.thumbnail || 'https://via.placeholder.com/512', sizes: '512x512', type: 'image/jpeg' }
                ]
            });
            
            navigator.mediaSession.setActionHandler('play', () => {
                audio.play();
                updatePlayPauseUI(true);
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                audio.pause();
                updatePlayPauseUI(false);
            });
            navigator.mediaSession.setActionHandler('previoustrack', () => {
                prevBtn.click();
            });
            navigator.mediaSession.setActionHandler('nexttrack', () => {
                nextBtn.click();
            });
        }
    }

    playPauseBtn.addEventListener('click', () => {
        if (!audio.src) return;
        if (audio.paused) {
            audio.play();
            updatePlayPauseUI(true);
        } else {
            audio.pause();
            updatePlayPauseUI(false);
        }
    });

    prevBtn.addEventListener('click', () => {
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
        } else {
            if (isShuffleEnabled && currentLibraryContext.length > 1) {
                playRandomTrack();
            } else {
                playTrack(currentTrackIndex > 0 ? currentTrackIndex - 1 : currentLibraryContext.length - 1);
            }
        }
    });

    nextBtn.addEventListener('click', () => {
        if (isShuffleEnabled && currentLibraryContext.length > 1) {
            playRandomTrack();
        } else {
            playTrack((currentTrackIndex + 1) % currentLibraryContext.length);
        }
    });

    audio.addEventListener('ended', () => {
        if (isShuffleEnabled && currentLibraryContext.length > 1) {
            playRandomTrack();
        } else {
            playTrack((currentTrackIndex + 1) % currentLibraryContext.length);
        }
    });

    function playRandomTrack() {
        let randomIndex = currentTrackIndex;
        while(randomIndex === currentTrackIndex) {
            randomIndex = Math.floor(Math.random() * currentLibraryContext.length);
        }
        playTrack(randomIndex);
    }

    function updatePlayPauseUI(isPlaying) {
        const icon = playPauseBtn.querySelector('i');
        if (isPlaying) {
            icon.classList.remove('ph-play');
            icon.classList.add('ph-pause');
        } else {
            icon.classList.remove('ph-pause');
            icon.classList.add('ph-play');
        }
    }

    // Progress Bar
    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            const progress = (audio.currentTime / audio.duration) * 100;
            progressBar.value = progress;
            currentTimeEl.textContent = formatTime(audio.currentTime);
        }
    });

    audio.addEventListener('loadedmetadata', () => {
        totalTimeEl.textContent = formatTime(audio.duration);
    });

    progressBar.addEventListener('input', (e) => {
        const time = (e.target.value / 100) * audio.duration;
        audio.currentTime = time;
    });

    // Volume Persistence
    const savedVolume = localStorage.getItem('resonance_volume');
    if (savedVolume !== null) {
        audio.volume = parseFloat(savedVolume);
        volumeBar.value = audio.volume * 100;
        updateVolumeIcon(audio.volume);
    }

    // Volume
    volumeBar.addEventListener('input', (e) => {
        audio.volume = e.target.value / 100;
        updateVolumeIcon(audio.volume);
        localStorage.setItem('resonance_volume', audio.volume);
    });

    function updateVolumeIcon(vol) {
        muteIcon.className = '';
        if (vol === 0) muteIcon.className = 'ph-fill ph-speaker-x';
        else if (vol < 0.5) muteIcon.className = 'ph-fill ph-speaker-low';
        else muteIcon.className = 'ph-fill ph-speaker-high';
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // ==== Toast Notifications ====
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ph-info';
        if (type === 'success') icon = 'ph-check-circle';
        if (type === 'error') icon = 'ph-warning-circle';

        toast.innerHTML = `<i class="ph-fill ${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    }
});
