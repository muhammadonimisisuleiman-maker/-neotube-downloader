/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Download, 
  Settings, 
  FolderOpen, 
  Cpu, 
  History, 
  Link as LinkIcon, 
  Music, 
  Video, 
  CheckCircle2, 
  Loader2, 
  ChevronRight,
  Terminal,
  Eraser,
  Copy,
  ChevronDown,
  Cookie,
  AlertCircle,
  Trash2,
  ExternalLink,
  X,
  Upload,
  Info,
  Pause,
  PlayCircle,
  Check,
  ClipboardList,
  Clipboard,
  ListVideo,
  Bug,
  User,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
type DownloadMode = 'video' | 'audio';
type Quality = '4k' | '2k' | '1080p' | '720p' | '480p' | '360p';
type AudioQuality = 'best' | '320kbps' | '256kbps' | '128kbps' | '64kbps';

const getThumbnailForUrl = (url: string) => {
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  }
  return undefined;
};

interface DownloadStatus {
  id: string;
  title: string;
  progress: number;
  speed: string;
  eta: string;
  size: string;
  status: 'extracting' | 'downloading' | 'merging' | 'completed' | 'error';
  isPaused: boolean;
}

interface HistoryItem {
  id: string;
  title: string;
  date: string;
  size: string;
  mode: DownloadMode;
  quality: Quality;
  url: string;
  thumbnail?: string;
}

interface QueueItem {
  id: string;
  url: string;
  mode: DownloadMode;
  quality: Quality;
  title: string;
  status: 'waiting' | 'extracting' | 'downloading' | 'merging' | 'completed' | 'error' | 'canceled';
  progress: number;
  loadedSize?: number;
  totalSize?: number;
  speed: string;
  eta: string;
  isPaused: boolean;
  thumbnail?: string;
}

// --- Magnetic Component ---
const Magnetic = ({ children, strength = 0.3 }: { children: React.ReactNode, strength?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const x = (clientX - centerX) * strength;
    const y = (clientY - centerY) * strength;
    setPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', damping: 15, stiffness: 150, mass: 0.1 }}
    >
      {children}
    </motion.div>
  );
};

// --- Glow Effect Component ---
const GlowCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const { left, top } = containerRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    
    containerRef.current.style.setProperty("--glow-x", `${x}px`);
    containerRef.current.style.setProperty("--glow-y", `${y}px`);
    containerRef.current.style.setProperty("--glow-opacity", "1");
  };

  const handleMouseLeave = () => {
    if (!containerRef.current) return;
    containerRef.current.style.setProperty("--glow-opacity", "0");
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`glow-card ${className}`}
    >
      <div className="glow-overlay" />
      {children}
    </div>
  );
};

export default function App() {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<DownloadMode>(() => {
    return (localStorage.getItem('neotube_mode') as DownloadMode) || 'video';
  });
  const [quality, setQuality] = useState<Quality>(() => {
    return (localStorage.getItem('neotube_quality') as Quality) || '1080p';
  });
  const [audioQuality, setAudioQuality] = useState<AudioQuality>(() => {
    return (localStorage.getItem('neotube_audioQuality') as AudioQuality) || 'best';
  });
  useEffect(() => {
    localStorage.setItem('neotube_audioQuality', audioQuality);
  }, [audioQuality]);
  const [savePath, setSavePath] = useState(() => {
    return localStorage.getItem('neotube_savePath') || 'C:\\Users\\NeoTube\\Downloads';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRole, setFeedbackRole] = useState('YouTuber');
  const [feedbackType, setFeedbackType] = useState('Feature Request');
  const [feedbackText, setFeedbackText] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('neotube_darkMode');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [autoPaste, setAutoPaste] = useState(() => {
    const saved = localStorage.getItem('neotube_autoPaste');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [youtubeCookies, setYoutubeCookies] = useState(() => {
    return localStorage.getItem('neotube_cookies') || '';
  });

  // States
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    try {
      const saved = localStorage.getItem('neotube_queue');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Reset extracting/downloading/merging statuses to paused so they can be resumed/restarted
        return parsed.map((item: QueueItem) => {
          if (['extracting', 'downloading', 'merging'].includes(item.status)) {
            return { ...item, status: 'canceled', isPaused: true, speed: '0 KB/s', eta: '--:--' };
          }
          return item;
        });
      }
    } catch(e) {}
    return [];
  });
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('neotube_history');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return [];
  });
  
  // Playlist states
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [playlistEntries, setPlaylistEntries] = useState<any[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [isFetchingPlaylist, setIsFetchingPlaylist] = useState(false);
  const [playlistTitle, setPlaylistTitle] = useState("");


  useEffect(() => { localStorage.setItem('neotube_mode', mode); }, [mode]);
  useEffect(() => { localStorage.setItem('neotube_quality', quality); }, [quality]);
  useEffect(() => { localStorage.setItem('neotube_savePath', savePath); }, [savePath]);
  useEffect(() => { localStorage.setItem('neotube_darkMode', JSON.stringify(darkMode)); }, [darkMode]);
  useEffect(() => { localStorage.setItem('neotube_autoPaste', JSON.stringify(autoPaste)); }, [autoPaste]);
  useEffect(() => { localStorage.setItem('neotube_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('neotube_queue', JSON.stringify(queue)); }, [queue]);
  useEffect(() => { localStorage.setItem('neotube_cookies', youtubeCookies); }, [youtubeCookies]);

  const [logs, setLogs] = useState<string[]>([
    '[system] NeoTube Engine initialized v2.4.0',
    '[system] Ready for link input...',
  ]);
  const [rateLimitCooldown, setRateLimitCooldown] = useState<number>(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (rateLimitCooldown > 0) {
      timer = setTimeout(() => setRateLimitCooldown(prev => Math.max(0, prev - 1)), 1000);
    }
    return () => clearTimeout(timer);
  }, [rateLimitCooldown]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [showClipboardPrompt, setShowClipboardPrompt] = useState(false);
  const lastCheckedUrl = useRef<string | null>(null);

  const handleAddFromClipboard = () => {
    if (clipboardUrl) {
      setUrl(clipboardUrl);
      setShowClipboardPrompt(false);
      setLogs(prev => [...prev, `[system] URL captured from clipboard. Ready to add.`]);
    }
  };

  // Monitor Clipboard on Window Focus
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        if (!navigator.clipboard || !document.hasFocus() || showClipboardPrompt) return;
        
        try {
          const text = await navigator.clipboard.readText();
          if (!text) return;
          const trimmed = text.trim();
          const videoUrlRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch|fb\.com|instagram\.com|tiktok\.com|twitter\.com|x\.com|vimeo\.com|twitch\.tv)[^\s]*)/i;
          const match = trimmed.match(videoUrlRegex);
          const foundUrl = match ? match[0] : null;
          
          if (foundUrl && foundUrl !== lastCheckedUrl.current && foundUrl !== url) {
            const isDuplicate = queue.some(item => item.url === foundUrl) || history.some(item => item.url === foundUrl);
            if (!isDuplicate) {
              lastCheckedUrl.current = foundUrl;
              if (autoPaste) {
                 setUrl(foundUrl);
                 setClipboardUrl(foundUrl);
                 setShowClipboardPrompt(true);
                 setTimeout(() => setShowClipboardPrompt(false), 3000);
              } else {
                 setClipboardUrl(foundUrl);
                 setShowClipboardPrompt(true);
                 setTimeout(() => setShowClipboardPrompt(false), 10000);
              }
            }
          }
        } catch (err: any) {
          if (err.name !== 'NotAllowedError') {
             console.warn('Clipboard access issue', err);
          }
        }
      } catch (err) {
        console.warn('Clipboard access denied', err);
      }
    };

    const handleFocus = () => setTimeout(checkClipboard, 500);
    window.addEventListener('focus', handleFocus);
    checkClipboard();
    return () => window.removeEventListener('focus', handleFocus);
  }, [queue, history, showClipboardPrompt, url, autoPaste]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      setIsHovering(true);
    };
    const handleMouseLeave = () => setIsHovering(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Dark Mode Effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const abortControllers = useRef<{ [id: string]: AbortController }>({});

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Sequential Queue Processing
  useEffect(() => {
    // Look for items that should start downloading
    const waitingItem = queue.find(item => item.status === 'waiting');
    
    // Stop processing queue if rate limited
    if (rateLimitCooldown > 0) return;

    if (waitingItem && queue.filter(item => item.status === 'extracting' || item.status === 'downloading' || item.status === 'merging').length < 2) {
      startDownloadTask(waitingItem);
    }
  }, [queue, rateLimitCooldown]);

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec === 0) return '0 KB/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
    return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSize = (bytes: number | undefined) => {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const startDownloadTask = async (task: QueueItem) => {
    setQueue(prev => prev.map(item => 
      item.id === task.id ? { ...item, status: 'extracting' } : item
    ));

    setLogs(prev => [...prev, `[info] Fetching info for: ${task.url}`]);

    const controller = new AbortController();
    abortControllers.current[task.id] = controller;

    try {
      setLogs(prev => [...prev, `[info] Fetching metadata for ${task.url}...`]);

      const savedCookies = localStorage.getItem('neotube_cookies') || '';

      const infoRes = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: task.url, cookies: savedCookies }),
        signal: controller.signal
      });

      if (!infoRes.ok) {
        const errObj = await infoRes.json().catch(() => ({}));
        throw new Error(errObj.error || "Failed to fetch metadata from server");
      }

      const info = await infoRes.json();
      const realTitle = info.title || task.title !== "Extracting..." ? task.title : 'Downloaded_Media';

      setQueue(prevQueue => prevQueue.map(item => 
        item.id === task.id ? { ...item, title: realTitle, status: 'downloading' } : item
      ));

      setLogs(prev => [...prev, `[info] Starting streaming download: ${realTitle}`]);

      // Download via proxy stream to track progress
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: task.url, mode: task.mode, quality: task.quality, cookies: savedCookies }),
        signal: controller.signal
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Failed to start download stream");
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      let loaded = 0;
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];

      if (!reader) throw new Error("ReadableStream not supported");
      
      let lastTime = Date.now();
      let lastLoaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        if (value) {
          chunks.push(value);
          loaded += value.length;
          
          const now = Date.now();
          if (now - lastTime > 500) { // update progress every 500ms
            const speedBytes = (loaded - lastLoaded) / ((now - lastTime) / 1000);
            const speedStr = formatSpeed(speedBytes);
            // Indeterminate progress (no total), cap visual progress at 95% until done, or if total is known, show real progress
            const progress = total ? (loaded / total) * 100 : Math.min(95, (loaded / (50 * 1024 * 1024)) * 100);
            
            setQueue(prevQueue => prevQueue.map(item => {
              if (item.id === task.id && !item.isPaused) {
                return { 
                  ...item, 
                  progress: progress,
                  loadedSize: loaded,
                  totalSize: total,
                  status: 'downloading',
                  speed: speedStr,
                  eta: total ? `00:${Math.max(0, Math.floor((total - loaded) / Math.max(speedBytes, 1))).toString().padStart(2, '0')}` : '--:--'
                };
              }
              return item;
            }));
            
            lastTime = now;
            lastLoaded = loaded;
          }
        }
      }

      // Download completed
      if (loaded === 0) {
        throw new Error("Stream closed without sending any data. You might be blocked by a bot check, check the Settings and add your YouTube Cookies.");
      }

      const blob = new Blob(chunks, { type: task.mode === 'audio' ? 'audio/mpeg' : 'video/mp4' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${realTitle.replace(/[^\w\s]/gi, '_')}.${task.mode === 'audio' ? 'mp3' : 'mp4'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        title: realTitle,
        date: new Date().toLocaleString(),
        size: total ? `${(total / (1024 * 1024)).toFixed(1)} MB` : `${(loaded / (1024 * 1024)).toFixed(1)} MB`,
        mode: task.mode,
        quality: task.quality,
        url: task.url,
        thumbnail: task.thumbnail
      };
      
      setHistory(h => [newItem, ...h]);
      setLogs(l => [...l, `[success] "${realTitle}" downloaded perfectly!`]);
      
      setQueue(prevQueue => prevQueue.map(item => 
        item.id === task.id ? { ...item, progress: 100, status: 'completed', speed: '0 KB/s', eta: '00:00' } : item
      ));

    } catch (error: any) {
      if (error.name === 'AbortError') {
        setLogs(l => [...l, `[info] Download cancelled for ${task.url}`]);
      } else {
        const isRateLimit = error.message === 'COBALT_RATE_LIMIT' || error.message.includes('CORS') || error.message.includes('Failed to fetch') || error.message.includes('Too Many Requests');
        
        if (isRateLimit) {
           setRateLimitCooldown(60);
           setLogs(l => [...l, `[warning] ${task.url}: Cobalt API Rate Limit reached or CORS blocked due to excessive requests. Waiting 60s cooldown...`]);
           // Put back into waiting
           setQueue(prevQueue => prevQueue.map(item => 
             item.id === task.id ? { ...item, status: 'waiting', speed: '0 KB/s', eta: '--:--', progress: 0 } : item
           ));
        } else {
           console.error(error);
           setLogs(l => [...l, `[error] Download failed for ${task.url}: ${error.message || String(error)}`]);
           setQueue(prevQueue => prevQueue.map(item => 
             item.id === task.id && item.status !== 'completed' ? { ...item, status: 'error', speed: '0 KB/s', eta: '--:--', progress: 0 } : item
           ));
        }
      }
    } finally {
      delete abortControllers.current[task.id];
    }
  };

  const addUrlsToQueue = (inputUrl: string) => {
    if (!inputUrl.trim()) return;
    
    const urls = inputUrl.split(/[,\n\s]+/).filter(u => u.trim() !== '');
    
    const newItems: QueueItem[] = urls.map((targetUrl, idx) => ({
      id: (Date.now() + idx).toString(),
      url: targetUrl,
      mode: mode,
      quality: quality,
      title: targetUrl.split('/').pop()?.substring(0, 30) || `Resource ${idx + 1}`,
      status: 'waiting',
      progress: 0,
      loadedSize: 0,
      totalSize: 0,
      speed: '0 KB/s',
      eta: '--:--',
      isPaused: false,
      thumbnail: getThumbnailForUrl(targetUrl)
    }));

    setQueue(prev => [...prev, ...newItems]);
    setLogs(prev => [...prev, `[system] Success! Added ${newItems.length} items to batch queue.`]);
  };

  const handleAddToQueue = () => {
    if (url.includes('list=')) {
      handleFetchPlaylist();
      return;
    }
    addUrlsToQueue(url);
    setUrl('');
  };

  const handleFetchPlaylist = async () => {
    if (!url.trim()) return;
    setIsFetchingPlaylist(true);
    setShowPlaylistDialog(true);
    setPlaylistEntries([]);
    setSelectedEntries(new Set());
    setPlaylistTitle("Loading Playlist...");
    
    try {
      const res = await fetch('/api/playlist-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, cookies: youtubeCookies })
      });
      if (!res.ok) throw new Error("Failed to fetch playlist");
      const data = await res.json();
      setPlaylistTitle(data.title || "Unknown Playlist");
      setPlaylistEntries(data.entries || []);
      // Pre-select all by default
      setSelectedEntries(new Set((data.entries || []).map((e: any) => e.url)));
    } catch (e) {
      setPlaylistTitle("Failed to load playlist.");
      console.error(e);
    } finally {
      setIsFetchingPlaylist(false);
    }
  };

  const handleAddSelectedPlaylistItems = () => {
    const urls = playlistEntries
      .filter(e => selectedEntries.has(e.url))
      .map(e => e.url)
      .join('\\n');
    addUrlsToQueue(urls);
    setShowPlaylistDialog(false);
    setUrl('');
  };

  const togglePause = (id: string) => {
    setQueue(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      
      const newPaused = !item.isPaused;
      
      if (newPaused) {
        if (abortControllers.current[id]) {
          abortControllers.current[id].abort();
          delete abortControllers.current[id];
        }
        return prev.map(i => i.id === id ? { ...i, isPaused: true, status: 'canceled', speed: '0 KB/s', eta: '--:--' } : i);
      } else {
        return prev.map(i => i.id === id ? { ...i, isPaused: false, status: 'waiting', progress: 0 } : i);
      }
    });
    setLogs(prev => [...prev, `[system] Task ${id} pause manually toggled`]);
  };

  const removeFromQueue = (id: string) => {
    if (abortControllers.current[id]) {
      abortControllers.current[id].abort();
    }
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  // Hero animation variants
  const heroSection = {
    initial: { opacity: 0, y: 30, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { type: 'spring', damping: 15, stiffness: 100, mass: 1 }
  };

  const handleSubmitFeedback = () => {
    const subject = encodeURIComponent(`NeoTube ${feedbackType} from ${feedbackRole}`);
    const bodyText = `From: ${feedbackRole}\nType: ${feedbackType}\n\n${feedbackText}`;
    const body = encodeURIComponent(bodyText);
    
    try {
      window.location.href = `mailto:muhammadonimisisuleiman@gmail.com?subject=${subject}&body=${body}`;
      setLogs(prev => [...prev, `[system] Attempting to open mail client for feedback...`]);
      setShowFeedbackModal(false);
    } catch (err) {
      console.error('Mailto failed', err);
      navigator.clipboard.writeText(bodyText)
        .then(() => {
          setLogs(prev => [...prev, '[error] Could not open mail client. Feedback copied to clipboard. Paste it in your mail app.']);
          setShowFeedbackModal(false);
        })
        .catch(() => {
          setLogs(prev => [...prev, '[error] Could not open mail client and could not copy to clipboard.']);
        });
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-start overflow-x-hidden">
      {/* Liquid Light (Mouse Follower) - Ultra Fluid Background */}
      <motion.div 
        animate={{ 
          x: mousePos.x - 400, 
          y: mousePos.y - 400,
          opacity: isHovering ? (darkMode ? 0.05 : 0.08) : 0,
          scale: queue.some(i => i.status !== 'waiting' && i.status !== 'completed' && !i.isPaused) ? 1.1 : 1
        }}
        transition={{ type: 'spring', damping: 60, stiffness: 40, mass: 2 }}
        className="fixed w-[800px] h-[800px] bg-brand blur-[140px] rounded-full pointer-events-none z-0 mix-blend-soft-light"
      />

      {/* Background Glows (Static) */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand/[0.02] blur-[180px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand/[0.02] blur-[180px] rounded-full pointer-events-none" />

      {/* Clipboard Detector Notification */}
      <AnimatePresence>
        {showClipboardPrompt && clipboardUrl && (
          <motion.div
            initial={{ y: 100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-lg"
          >
            <GlowCard className="bg-white/80 dark:bg-zinc-900/90 backdrop-blur-2xl border-brand/20 shadow-2xl rounded-2xl p-4 flex items-center gap-4 overflow-hidden">
              <div className="w-12 h-12 bg-brand/10 text-brand rounded-xl flex items-center justify-center shrink-0">
                <ClipboardList size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand mb-1 text-left">
                  {autoPaste ? "Auto-Pasted!" : "Link Detected"}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate pr-4 text-left flex-1">
                    {clipboardUrl}
                  </p>
                </div>
              </div>
              {!autoPaste && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowClipboardPrompt(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    <X size={18} />
                  </button>
                  <button 
                    onClick={handleAddFromClipboard}
                    className="bg-brand text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-brand/20 hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
                  >
                    Capture
                  </button>
                </div>
              )}
              
              {/* Progress Line - indicating lifetime */}
              <motion.div 
                initial={{ width: '100%' }}
                animate={{ width: 0 }}
                transition={{ duration: autoPaste ? 3 : 10, ease: 'linear' }}
                className="absolute bottom-0 left-0 h-1 bg-brand/30"
              />
            </GlowCard>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="w-full max-w-5xl flex flex-col gap-6 relative z-10">
        
        {/* Header - Hero Entrance */}
        <motion.header 
          {...heroSection}
          transition={{ ...heroSection.transition, delay: 0.1 }}
          className="flex items-center justify-between px-2"
        >
          <div className="flex items-center gap-3 group cursor-default">
            <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 group-hover:scale-110 transition-transform">
              <Play className="text-white fill-white ml-0.5" size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-red-500 dark:text-red-500">NeoTube</h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 -mt-1 uppercase tracking-widest">Downloader</p>
            </div>
          </div>
          
              <div className="flex gap-4">
                <Magnetic strength={0.2}>
                  <button 
                    onClick={() => setShowHistory(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all text-sm font-medium"
                  >
                    <History size={16} />
                    <span className="hidden sm:inline">History</span>
                    {history.length > 0 && (
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand/10 text-brand text-[10px] font-black">
                        {history.length}
                      </span>
                    )}
                  </button>
                </Magnetic>
                <Magnetic strength={0.2}>
                  <button 
                    onClick={() => setShowFeedbackModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm font-medium text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm"
                  >
                    <Bug size={16} />
                    <span className="hidden sm:inline">Feedback</span>
                  </button>
                </Magnetic>
                <Magnetic strength={0.2}>
                  <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm font-medium ${
                      showSettings ? 'bg-brand text-white shadow-brand/20' : 'text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm'
                    }`}
                  >
                    <Settings size={16} />
                    <span className="hidden sm:inline">Settings</span>
                  </button>
                </Magnetic>
              </div>
        </motion.header>

        {/* Rate Limit Alert */}
        <AnimatePresence>
          {rateLimitCooldown > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="w-full flex"
            >
              <div className="w-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between shadow-inner backdrop-blur-md mb-2">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                    <AlertCircle size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm tracking-wide">Cobalt API Rate Limit Active</h4>
                    <p className="text-xs font-medium opacity-80 mt-0.5">To protect the free public API, requests are temporarily paused. Downloads will automatically resume.</p>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center shrink-0 bg-white/50 dark:bg-black/20 rounded-xl px-6 py-2 mt-4 sm:mt-0 shadow-sm border border-orange-500/10">
                  <span className="text-2xl font-black">{rateLimitCooldown}s</span>
                  <span className="text-[9px] uppercase font-bold tracking-widest opacity-70">Cooldown</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* URL Input Area - Hero Entrance */}
        <motion.section 
          {...heroSection}
          transition={{ ...heroSection.transition, delay: 0.2 }}
          className="w-full"
        >
          <GlowCard className="glass rounded-3xl p-7 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-brand font-semibold text-sm px-1 uppercase tracking-wider">
              <LinkIcon size={14} />
              <span>Target URLs (Batch Supported)</span>
            </div>
            <div className="relative group">
              <textarea 
                placeholder="Paste links and press Enter (Shift+Enter for multiple)..."
                className="w-full bg-white/50 dark:bg-black/40 border border-slate-200/60 dark:border-white/5 rounded-2xl p-6 outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-all text-slate-700 dark:text-slate-200 placeholder:text-slate-400 text-sm min-h-[120px] resize-none"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (url.trim()) {
                      handleAddToQueue();
                    }
                  }
                }}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-1">
              <button
                onClick={async () => {
                  if (url) {
                    setUrl('');
                  } else {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) {
                        const videoUrlRegex = /(https?:\/\/(?:www\.youtube\.com|youtu\.be|facebook\.com|fb\.watch|fb\.com|instagram\.com|tiktok\.com|twitter\.com|x\.com|vimeo\.com|twitch\.tv)[^\s]*)/gi;
                        const matches = text.match(videoUrlRegex);
                        if (matches && matches.length > 0) {
                          setUrl(matches.join('\n'));
                        } else {
                          setLogs(prev => [...prev, '[warning] No supported video URLs found in clipboard.']);
                        }
                      }
                    } catch (err: any) {
                      console.error('Failed to read clipboard', err);
                      setLogs(prev => [...prev, '[error] Clipboard blocked by browser. Please long-press the text box above and select "Paste".']);
                    }
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/10 dark:bg-red-500/10 hover:bg-red-500/20 dark:hover:bg-red-500/20 text-red-500 dark:text-red-500 rounded-xl text-sm font-bold uppercase tracking-widest transition-all"
              >
                {url ? (
                  <>
                    <Eraser size={16} /> Clear Text
                  </>
                ) : (
                  <>
                    <Clipboard size={16} /> Paste from Clipboard
                  </>
                )}
              </button>
              
              <button 
                onClick={handleAddToQueue}
                disabled={!url}
                className="flex-[2] flex flex-row items-center justify-center gap-2 py-3 bg-brand text-white rounded-xl shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all text-sm font-bold uppercase tracking-widest"
              >
                <Download size={18} />
                Download
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
              {/* Mode Switcher */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-widest px-1">Download Mode</span>
                <div className="flex p-1 bg-slate-100/50 dark:bg-black/40 rounded-2xl border border-slate-200/50 dark:border-white/5">
                  <button 
                    onClick={() => setMode('video')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${mode === 'video' ? 'bg-white dark:bg-slate-800 text-brand shadow-sm shadow-brand/5' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-black/50'}`}
                  >
                    <Video size={16} />
                    Video
                  </button>
                  <button 
                    onClick={() => setMode('audio')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${mode === 'audio' ? 'bg-white dark:bg-slate-800 text-brand shadow-sm shadow-brand/5' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-black/50'}`}
                  >
                    <Music size={16} />
                    Audio (MP3)
                  </button>
                </div>
              </div>

              {/* Quality Selector */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-widest px-1">Quality Preferred</span>
                <div className={`grid gap-1.5 p-1 bg-slate-100/50 dark:bg-black/40 rounded-2xl border border-slate-200/50 dark:border-white/5 ${mode === 'video' ? 'grid-cols-6' : 'grid-cols-5'}`}>
                  {mode === 'video' ? (
                     (['4k', '2k', '1080p', '720p', '480p', '360p'] as Quality[]).map((q) => (
                      <button 
                        key={q}
                        onClick={() => setQuality(q)}
                        className={`text-[10px] font-bold py-3 rounded-xl transition-all ${quality === q ? 'bg-white dark:bg-slate-800 text-brand shadow-sm' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-black/50'}`}
                      >
                         {q.toUpperCase()}
                      </button>
                    ))
                  ) : (
                     (['best', '320kbps', '256kbps', '128kbps', '64kbps'] as AudioQuality[]).map((q) => (
                      <button 
                        key={q}
                        onClick={() => setAudioQuality(q)}
                        className={`text-[10px] font-bold py-3 rounded-xl transition-all ${audioQuality === q ? 'bg-white dark:bg-slate-800 text-brand shadow-sm' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-black/50'}`}
                      >
                         {q === 'best' ? 'BEST' : q.toUpperCase()}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </GlowCard>
        </motion.section>

        {/* Settings Container - Hero Entrance */}
        <AnimatePresence>
          {showSettings && (
            <motion.section 
              {...heroSection}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1, transition: { ...heroSection.transition } }}
              exit={{ height: 0, opacity: 0 }}
              className="w-full overflow-hidden"
            >
              <GlowCard className="glass rounded-3xl p-6 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Dark Mode Toggle */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest">
                        <Settings size={14} />
                        Appearance
                      </div>
                      <div className="flex p-1 bg-slate-100/50 dark:bg-slate-950/50 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                        <button 
                          onClick={() => setDarkMode(false)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${!darkMode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          Light
                        </button>
                        <button 
                          onClick={() => setDarkMode(true)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${darkMode ? 'bg-zinc-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Dark
                        </button>
                      </div>
                    </div>

                    {/* Auto Export Toggle */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest">
                        <ClipboardList size={14} />
                        Auto-Paste Copied Links
                      </div>
                      <div className="flex p-1 bg-slate-100/50 dark:bg-slate-950/50 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                        <button 
                          onClick={() => setAutoPaste(true)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${autoPaste ? (darkMode ? 'bg-zinc-900 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          On
                        </button>
                        <button 
                          onClick={() => setAutoPaste(false)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${!autoPaste ? (darkMode ? 'bg-zinc-900 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Off
                        </button>
                      </div>
                    </div>

                    {/* Additional Flags */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest">
                        <Info size={14} />
                        Engine CLI Arguments (Advanced)
                      </div>
                      <input 
                        type="text" 
                        placeholder="e.g. --embed-subs --proxy http://..."
                        className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-mono outline-none focus:border-brand/40 dark:text-slate-300 w-full shadow-inner"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-6 grid grid-cols-1">
                    {/* YouTube Cookies */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                          <Settings size={14} />
                          YouTube Netscape Cookies (Required to bypass age/bot restriction)
                        </div>
                      </div>
                      <textarea 
                        value={youtubeCookies}
                        onChange={(e) => setYoutubeCookies(e.target.value)}
                        placeholder="Paste your Netscape format YouTube cookies here..."
                        className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-mono outline-none focus:border-brand/40 dark:text-slate-300 w-full shadow-inner min-h-[100px] resize-y"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            localStorage.setItem('neotube_cookies', youtubeCookies);
                            setLogs(prev => [...prev, '[info] YouTube cookies saved successfully.']);
                          }}
                          className="bg-brand text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md shadow-brand/20 hover:scale-105 active:scale-95"
                        >
                          Submit Cookies
                        </button>
                      </div>
                    </div>
                  </div>
                </GlowCard>
              </motion.section>
            )}
          </AnimatePresence>

        {/* Download Manager - The Unified Hub */}
        <motion.section 
          {...heroSection}
          transition={{ ...heroSection.transition, delay: 0.4 }}
          className="w-full"
        >
          <GlowCard className="glass rounded-3xl p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand/10 rounded-lg flex items-center justify-center text-brand">
                  <Download size={16} />
                </div>
                <h2 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Download Manager</h2>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 text-[10px] font-bold uppercase">
                  {queue.filter(i => i.status !== 'waiting' && i.status !== 'completed').length} Processing
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <AnimatePresence mode="popLayout">

                {queue.map((item, idx) => (
                  <motion.div 
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`relative group border rounded-2xl p-5 overflow-hidden transition-all ${
                      item.status === 'completed' 
                        ? 'bg-emerald-500/[0.02] border-emerald-500/10' 
                        : item.status !== 'waiting'
                        ? 'ring-2 ring-brand/20 bg-brand/[0.02] dark:bg-brand/[0.05] border-brand/20'
                        : 'bg-slate-50/50 dark:bg-black/20 border-slate-100 dark:border-white/5'
                    }`}
                  >
                     {/* Background Pulse Effect for active items */}
                     {item.status !== 'waiting' && item.status !== 'completed' && !item.isPaused && (
                       <motion.div 
                         animate={{ opacity: [0.05, 0.1, 0.05] }}
                         transition={{ duration: 2, repeat: Infinity }}
                         className="absolute inset-0 bg-brand pointer-events-none"
                       />
                     )}

                     <div className="relative z-10 flex flex-col gap-4">
                       <div className="flex items-center justify-between gap-2 overflow-hidden">
                          <div className="flex items-center gap-3 min-w-0">
                             <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-colors relative overflow-hidden ${
                               item.status === 'completed'
                                 ? 'bg-emerald-500 text-white'
                                 : item.isPaused 
                                 ? 'bg-slate-500 text-white' 
                                 : item.status === 'waiting'
                                 ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                 : 'bg-brand text-white shadow-brand/20'
                             }`}>
                                {item.thumbnail && (
                                  <img 
                                    src={item.thumbnail} 
                                    alt="thumbnail" 
                                    className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
                                  />
                                )}
                                <div className="relative z-10 flex items-center justify-center">
                                  {item.status === 'completed' ? (
                                    <Check size={20} />
                                  ) : item.isPaused ? (
                                    <Pause size={20} />
                                  ) : item.status === 'waiting' ? (
                                    <span className="text-xs font-bold">{idx + 1}</span>
                                  ) : (
                                    <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                  )}
                                </div>
                             </div>
                             <div className="min-w-0">
                               <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                 {item.title}
                               </h4>
                               <div className="flex items-center flex-wrap gap-2 mt-1">
                                 {item.status !== 'waiting' && item.status !== 'completed' && (
                                   <>
                                     <span className="text-[10px] font-black text-brand uppercase tracking-tighter shrink-0">{item.speed}</span>
                                     {(item.totalSize || item.loadedSize) && (
                                       <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest shrink-0">
                                         {formatSize(item.loadedSize)} {item.totalSize ? `/ ${formatSize(item.totalSize)}` : ''}
                                       </span>
                                     )}
                                     <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest shrink-0">ETA {item.eta}</span>
                                   </>
                                 )}
                                 {item.status === 'waiting' && (
                                   <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Waiting • {item.quality}</span>
                                 )}
                                 {item.status === 'completed' && (
                                   <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1 shrink-0">
                                     <CheckCircle2 size={10} /> Finished {(item.totalSize || item.loadedSize) && `• ${formatSize(item.totalSize || item.loadedSize)}`}
                                   </span>
                                 )}
                               </div>
                             </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                             {item.status !== 'waiting' && item.status !== 'completed' && (
                               <Magnetic strength={0.2}>
                                 <button 
                                   onClick={() => togglePause(item.id)}
                                   className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:text-brand transition-colors"
                                 >
                                   {item.isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                                 </button>
                               </Magnetic>
                             )}
                             <Magnetic strength={0.2}>
                               <button 
                                 onClick={() => {
                                   removeFromQueue(item.id);
                                 }}
                                 className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 text-red-500 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 transition-colors"
                               >
                                 <X size={16} />
                               </button>
                             </Magnetic>
                          </div>
                       </div>

                       {(item.status !== 'waiting' || item.progress > 0) && (
                         <div className="space-y-2">
                            <div className="h-2 w-full bg-slate-100 dark:bg-black/50 rounded-full overflow-hidden border border-slate-200/50 dark:border-white/5">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${item.progress}%` }}
                                 className={`h-full rounded-full transition-colors duration-500 ${
                                   item.status === 'completed' 
                                     ? 'bg-emerald-500' 
                                     : item.isPaused 
                                     ? 'bg-slate-400' 
                                     : 'bg-brand'
                                 }`}
                               />
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">
                               <span>{item.totalSize ? `${Math.floor(item.progress)}% COMPLETE` : `${((item.loadedSize || 0) / (1024 * 1024)).toFixed(1)} MB DOWNLOADED`}</span>
                               <span>{item.status.toUpperCase()}</span>
                            </div>
                         </div>
                       )}
                     </div>
                  </motion.div>
                ))}

                {/* Empty State */}
                {queue.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400 gap-3 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl"
                  >
                    <Download className="text-slate-400 dark:text-slate-300 dark:opacity-20" size={48} />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 dark:opacity-40">No active or pending tasks</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Recently Completed (Quick History) */}
            {history.length > 0 && (
              <div className="flex flex-col gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Recent Success</span>
                  <button 
                    onClick={() => setShowHistory(true)}
                    className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline"
                  >
                    Full History
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {history.slice(0, 2).map((item) => (
                    <div key={item.id} className="p-3 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                          <Check size={14} strokeWidth={3} />
                        </div>
                        <div className="min-w-0">
                          <h6 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate">{item.title}</h6>
                          <p className="text-[9px] font-bold text-emerald-500/60 uppercase">{item.size} • {item.mode}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </GlowCard>
        </motion.section>

        {/* Live Logs - Hero Entrance */}
        <motion.section 
          {...heroSection}
          transition={{ ...heroSection.transition, delay: 0.5 }}
          className="glass rounded-3xl p-6 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-slate-500 font-bold text-sm uppercase tracking-wider">
              <Terminal size={14} />
              <span>Engine Status Log</span>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-500 text-[10px] font-black uppercase ring-1 ring-emerald-200/50 dark:ring-emerald-900/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </div>
              <button 
                onClick={() => setLogs([])}
                className="text-red-500 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 transition-colors"
                title="Clear Logs"
              >
                <Eraser size={14} />
              </button>
            </div>
          </div>

          <div ref={logContainerRef} className="bg-slate-900 dark:bg-black rounded-2xl p-4 font-mono text-xs leading-relaxed overflow-y-auto max-h-[180px] scroll-hide border border-slate-800 shadow-inner">
            {logs.length === 0 && <span className="text-slate-600 italic">Waiting for process start...</span>}
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3 mb-1">
                <span className="text-slate-600 shrink-0 select-none">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                <span className={`${
                  log.includes('[success]') ? 'text-emerald-400' :
                  log.includes('[error]') ? 'text-rose-400' :
                  log.includes('[info]') ? 'text-sky-400' : 'text-slate-300'
                }`}>
                  {log}
                </span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Footer */}
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-8 text-slate-500 dark:text-slate-600">
          <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-widest">
            <span>NeoTube Engine v2.4.0</span>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 hidden sm:block" />
            <span>Open-Source Core</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-700 uppercase tracking-tighter italic">Liquid Glass UI Kit</p>
        </footer>

        {/* Playlist Items Checkbox Modal */}
        <AnimatePresence>
          {showPlaylistDialog && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPlaylistDialog(false)}
                className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-[100]"
              />
              <motion.div 
                initial={{ x: '100%', opacity: 0.5 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0.5 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-[100dvh] w-full max-w-md bg-white dark:bg-zinc-950 shadow-2xl border-l border-slate-200 dark:border-white/10 z-[110] flex flex-col"
              >
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                      <ListVideo size={20} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest leading-none">Playlist Selection</h2>
                      <p className="text-xs font-medium text-slate-500 mt-1 truncate max-w-[200px]">{playlistTitle}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowPlaylistDialog(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative">
                  {isFetchingPlaylist ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                      <div className="w-8 h-8 rounded-full border-2 border-brand/20 border-t-brand animate-spin mb-4" />
                      <p className="text-xs font-bold uppercase tracking-widest">Parsing target playlist...</p>
                    </div>
                  ) : playlistEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center opacity-50 my-auto">
                      <ListVideo size={48} className="mb-4 text-slate-300 dark:text-slate-700" />
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No entries found</p>
                    </div>
                  ) : (
                    playlistEntries.map((entry, index) => (
                      <div key={entry.id || index} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent dark:hover:border-white/5 transition-colors cursor-pointer" onClick={() => {
                        const next = new Set(selectedEntries);
                        if (next.has(entry.url)) next.delete(entry.url);
                        else next.add(entry.url);
                        setSelectedEntries(next);
                      }}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                          selectedEntries.has(entry.url) 
                          ? 'bg-brand border-brand text-white' 
                          : 'bg-transparent border-slate-300 dark:border-slate-700'
                        }`}>
                          {selectedEntries.has(entry.url) && <Check size={12} strokeWidth={4} />}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                            {index + 1}. {entry.title}
                          </p>
                          <p className="text-[10px] font-medium text-slate-400 truncate">
                            {entry.duration ? `${entry.duration}s • ` : ''}{entry.url?.split('/').pop()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-4">
                    <button 
                      onClick={() => {
                        if (selectedEntries.size === playlistEntries.length) {
                          setSelectedEntries(new Set());
                        } else {
                          setSelectedEntries(new Set(playlistEntries.map(e => e.url)));
                        }
                      }}
                      className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      {selectedEntries.size === playlistEntries.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand">
                      {selectedEntries.size} / {playlistEntries.length} Items Selected
                    </span>
                  </div>
                  <button 
                    onClick={handleAddSelectedPlaylistItems}
                    disabled={isFetchingPlaylist || selectedEntries.size === 0}
                    className="w-full bg-brand text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none disabled:scale-100 flex items-center justify-center gap-2"
                  >
                    <Download size={18} />
                    Add Selection to Queue
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* History Slide-over */}
        <AnimatePresence>
          {showHistory && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowHistory(false)}
                className="fixed inset-0 bg-slate-900/20 dark:bg-black/60 backdrop-blur-sm z-[100]"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-950 shadow-2xl z-[101] flex flex-col"
              >
                <div className="p-6 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand/10 rounded-lg flex items-center justify-center text-brand">
                      <History size={18} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Recent Downloads</h2>
                  </div>
                  <button 
                    onClick={() => setShowHistory(false)}
                    className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 scroll-hide space-y-3">
                  {history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-4">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <History size={32} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">No History Yet</p>
                        <p className="text-sm text-slate-500 mt-1">Your past downloads will be archived here.</p>
                      </div>
                    </div>
                  ) : (
                    history.map((item) => (
                      <motion.div 
                        layout
                        key={item.id}
                        className="group relative p-4 rounded-2xl border border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 hover:border-brand/20 transition-all"
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            {item.thumbnail ? (
                              <div className="shrink-0 w-16 h-12 rounded-lg overflow-hidden relative shadow-sm border border-slate-200/50 dark:border-white/5">
                                <img src={item.thumbnail} alt="thumbnail" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-emerald-500/20 mix-blend-overlay" />
                                <div className="absolute bottom-1 right-1 bg-black/60 rounded-full p-0.5">
                                   <CheckCircle2 size={10} className="text-emerald-400" />
                                </div>
                              </div>
                            ) : (
                              <div className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-500">
                                <CheckCircle2 size={20} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate" title={item.title}>
                                {item.title}
                              </h3>
                              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{item.date} • {item.size}</p>
                            </div>
                            <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter ${
                              item.mode === 'audio' ? 'bg-amber-100 text-amber-600' : 'bg-brand/10 text-brand'
                            }`}>
                              {item.mode === 'audio' ? 'MP3' : item.quality}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                setUrl(item.url);
                                setShowHistory(false);
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:text-brand dark:hover:text-brand transition-all shadow-sm"
                            >
                              <ExternalLink size={12} />
                              Re-access
                            </button>
                            <button 
                              onClick={() => setHistory(prev => prev.filter(h => h.id !== item.id))}
                              className="w-10 flex items-center justify-center py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-rose-400 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-900/30">
                  <button 
                    onClick={() => {
                      setHistory([]);
                    }}
                    disabled={history.length === 0}
                    className="w-full py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-rose-400 hover:border-rose-200 disabled:opacity-50 transition-all font-mono"
                  >
                    Factory Reset History
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showFeedbackModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative shadow-black/50"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-white font-bold tracking-wide">Share Your Feedback</h3>
                  <button 
                    onClick={() => setShowFeedbackModal(false)}
                    className="text-red-500 hover:text-red-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                       <User size={14} /> Who are you?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['YouTuber', 'Editor', 'Designer', 'Developer', 'Hobbyist'].map((role) => (
                        <button
                          key={role}
                          onClick={() => setFeedbackRole(role)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            feedbackRole === role 
                              ? 'bg-brand text-white shadow-sm shadow-brand/20' 
                              : 'bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                       <Tag size={14} /> What's this about?
                    </label>
                    <select 
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-brand/50 w-full appearance-none"
                    >
                      <option className="bg-zinc-800 text-white" value="Feature Request">Feature Request</option>
                      <option className="bg-zinc-800 text-white" value="Bug Report">Bug Report</option>
                      <option className="bg-zinc-800 text-white" value="General Feedback">General Feedback</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                       <ClipboardList size={14} /> Your feedback
                    </label>
                    <textarea 
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Tell us what you think..."
                      className="bg-zinc-950 border border-brand rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-brand w-full min-h-[120px] resize-y placeholder:text-slate-600"
                    />
                  </div>

                  <div className="flex justify-end gap-3 mt-2">
                    <button 
                      onClick={() => setShowFeedbackModal(false)}
                      className="px-5 py-2.5 rounded-lg text-sm font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSubmitFeedback}
                      disabled={!feedbackText.trim()}
                      className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-brand shadow-sm shadow-brand/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
                    >
                      Submit Feedback
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
