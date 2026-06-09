import os
import shutil
import time
import threading
import queue
import json
import webview
from pathlib import Path

# ==========================================
# 1. HTML / CSS / JS FRONTEND (The UI)
# ==========================================
HTML_CONTENT = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body, html {
    width: 100%; height: 100%;
    background-color: transparent !important;
    overflow: hidden;
    font-family: 'Syne', sans-serif;
  }

  /* The container fills whatever size the OS window is */
  #app-container {
    position: relative;
    width: 100%; height: 100%;
  }

  /* ── THE PULSING DOT ── */
  #dot {
    position: absolute;
    top: 10px; right: 10px; /* Anchored to top right */
    width: 60px; height: 60px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #ff6b6b 0%, #c0392b 45%, #5c0a0a 100%);
    box-shadow: 0 0 20px rgba(231,76,60,0.5);
    cursor: pointer;
    z-index: 100;
    animation: dot-breathe 2.5s ease-in-out infinite;
    -webkit-app-region: drag; /* Let user drag the app by the dot */
  }
  @keyframes dot-breathe {
    0%,100% { transform: scale(0.95); box-shadow: 0 0 15px rgba(231,76,60,0.4); }
    50%     { transform: scale(1.05); box-shadow: 0 0 30px rgba(231,76,60,0.8); }
  }

  /* ── THE EXPANDED PANEL ── */
  #panel {
    position: absolute;
    top: 10px; right: 10px;
    width: 60px; height: 60px; /* Starts dot-sized */
    border-radius: 15px;
    background: linear-gradient(160deg, rgba(20,5,5,0.98) 0%, rgba(10,2,2,0.99) 100%);
    border: 1px solid rgba(192,57,43,0.4);
    box-shadow: 0 20px 50px rgba(0,0,0,0.8);
    display: none; flex-direction: column;
    overflow: hidden;
    opacity: 0;
    z-index: 99;
  }

  .expand-anim {
    display: flex !important;
    animation: crack-open 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes crack-open {
    0%   { width: 60px; height: 60px; opacity: 1; border-radius: 50%; }
    40%  { width: calc(100% - 20px); height: 60px; opacity: 1; border-radius: 15px; } /* Cracks left */
    100% { width: calc(100% - 20px); height: calc(100% - 20px); opacity: 1; border-radius: 15px; } /* Drops down */
  }

  .collapse-anim {
    display: flex !important;
    animation: slurp-shut 0.5s cubic-bezier(0.7, 0, 0.84, 0) forwards;
  }
  @keyframes slurp-shut {
    0%   { width: calc(100% - 20px); height: calc(100% - 20px); opacity: 1; border-radius: 15px; }
    40%  { width: calc(100% - 20px); height: 60px; opacity: 1; border-radius: 15px; }
    99%  { width: 60px; height: 60px; opacity: 1; border-radius: 50%; }
    100% { width: 60px; height: 60px; opacity: 0; display: none !important; }
  }

  /* ── HEADER ── */
  #header {
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: space-between;
    padding: 15px 20px;
    border-bottom: 1px solid rgba(192,57,43,0.2);
    background: rgba(192,57,43,0.05);
    -webkit-app-region: drag; /* Draggable window header */
  }
  #title-text {
    font-weight: 800; font-size: 14px;
    letter-spacing: 0.15em; color: rgba(255,214,204,0.6);
  }
  #close-btn {
    width: 24px; height: 24px; border-radius: 50%;
    background: rgba(192,57,43,0.2); border: 1px solid rgba(192,57,43,0.5);
    color: #fff; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; transition: 0.2s;
    -webkit-app-region: no-drag;
  }
  #close-btn:hover { background: #e74c3c; box-shadow: 0 0 10px #e74c3c; }

  /* ── STATS BAR ── */
  #stats-bar {
    display: flex; border-bottom: 1px solid rgba(192,57,43,0.1);
  }
  .stat { flex: 1; text-align: center; padding: 10px 0; }
  .stat-val { font-family: 'Space Mono', monospace; font-size: 16px; font-weight: 700; color: #e74c3c; }
  .stat-lbl { font-size: 9px; letter-spacing: 0.1em; color: rgba(255,214,204,0.5); text-transform: uppercase; }

  /* ── LOGS ── */
  #log-wrapper { flex: 1; position: relative; overflow: hidden; }
  #logs {
    height: 100%; overflow-y: auto;
    padding: 15px 20px 80px; /* Padding at bottom for mist */
    display: flex; flex-direction: column; gap: 8px;
    scroll-behavior: smooth; z-index: 2; position: relative;
  }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(192,57,43,0.5); border-radius: 2px; }

  .log-entry {
    display: flex; gap: 10px; font-size: 12px; color: #ffd6cc;
    padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.02);
  }
  .log-time { font-family: 'Space Mono', monospace; font-size: 10px; color: #7b241c; min-width: 60px; }
  .log-msg b { color: #ff6b35; }

  /* ── THE MIST (Dimmed and Subtle) ── */
  #mist {
    position: absolute; bottom: 0; left: 0; right: 0; height: 100px;
    background: linear-gradient(0deg, rgba(80,0,140,0.15) 0%, rgba(40,0,80,0.05) 50%, transparent 100%);
    pointer-events: none; z-index: 1;
    animation: drift 8s alternate infinite ease-in-out;
  }
  @keyframes drift {
    0% { transform: translateY(10px) scaleX(1.05); }
    100% { transform: translateY(-5px) scaleX(1); }
  }
</style>
</head>
<body>

<div id="app-container">
  <div id="dot"></div>

  <div id="panel">
    <div id="header">
      <span id="title-text">INTELLIGENT SORTER</span>
      <div id="close-btn" title="Minimize">✕</div>
    </div>
    
    <div id="stats-bar">
      <div class="stat"><div class="stat-val" id="s-moved">0</div><div class="stat-lbl">Moved</div></div>
      <div class="stat"><div class="stat-val" id="s-folders">0</div><div class="stat-lbl">Folders</div></div>
      <div class="stat"><div class="stat-val" id="s-session">0</div><div class="stat-lbl">This Session</div></div>
    </div>

    <div id="log-wrapper">
      <div id="logs"></div>
      <div id="mist"></div>
    </div>
  </div>
</div>

<script>
const dot = document.getElementById('dot');
const panel = document.getElementById('panel');
const closeBtn = document.getElementById('close-btn');
const logDiv = document.getElementById('logs');
let isOpen = false;
let lastLog = '';

// EXPAND
dot.addEventListener('click', async () => {
  if (isOpen) return;
  isOpen = true;
  
  // 1. Tell Python to physically resize the invisible OS window FIRST
  if(window.pywebview) await pywebview.api.expand_window();
  
  // 2. Hide dot and play CSS animation to fill the new space
  dot.style.display = 'none';
  panel.classList.remove('collapse-anim');
  panel.classList.add('expand-anim');
});

// COLLAPSE
closeBtn.addEventListener('click', () => {
  if (!isOpen) return;
  isOpen = false;
  
  // 1. Play CSS animation shrinking it back to a dot
  panel.classList.remove('expand-anim');
  panel.classList.add('collapse-anim');
  
  // 2. Wait for animation to finish, then tell Python to shrink OS window
  setTimeout(async () => { 
    dot.style.display = 'block'; 
    if(window.pywebview) await pywebview.api.collapse_window();
  }, 500);
});

// Right Click to completely quit
document.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (confirm('Shut down the Sorter entirely?')) pywebview.api.close_app();
});

// LOG PARSER
function renderLogs(rawHtml) {
  if (rawHtml === lastLog) return;
  lastLog = rawHtml;

  const entries = rawHtml.split('<br>').filter(Boolean);
  logDiv.innerHTML = '';
  entries.forEach(entry => {
    const parts = entry.split('||');
    const time = parts[0];
    let msg = parts.slice(1).join('||');
    
    // Highlight numbers
    msg = msg.replace(/\\b(\\d+)\\b/g, '<b>$1</b>');
    
    const el = document.createElement('div');
    el.className = 'log-entry';
    el.innerHTML = `<span class="log-time">${time}</span><span class="log-msg">${msg}</span>`;
    logDiv.appendChild(el);
  });
  logDiv.scrollTop = logDiv.scrollHeight;
}

// Polling for updates
setInterval(async () => {
  if (!window.pywebview?.api) return;
  const [logs, stats] = await Promise.all([
    pywebview.api.get_logs(),
    pywebview.api.get_stats()
  ]);
  renderLogs(logs);
  
  document.getElementById('s-moved').textContent = stats.total_moved || 0;
  document.getElementById('s-folders').textContent = stats.total_folders || 0;
  document.getElementById('s-session').textContent = stats.session_moved || 0;
}, 500);
</script>
</body>
</html>
"""

# ==========================================
# 2. BACKGROUND WORKER (Intelligent File Logic)
# ==========================================
class DesktopWorker(threading.Thread):
    def __init__(self, log_queue, log_file, stats):
        super().__init__(daemon=True)
        self.log_queue = log_queue
        self.log_file = log_file
        self.stats = stats
        self.desktop = Path.home() / 'Desktop'
        self.script_dir = Path(__file__).parent
        self.cats_file = self.script_dir / 'categories.json'
        
        # Files to completely ignore so we don't accidentally move our own script
        self.protected_files = [Path(__file__).name, 'categories.json', 'sorter_history.log', 'desktop.ini']
        self.CATS = {}

    def _load_cats(self):
        if not self.cats_file.exists():
            default = {
                "Audio": ["mp3", "m4a", "wav", "ogg", "flac", "aac"],
                "Pictures": ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "tiff"],
                "Videos": ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm"],
                "Apps": ["lnk", "url", "exe", "msi", "bat"],
                "Scripts": ["py", "html", "css", "json", "js", "ts", "cpp", "c", "java", "sh", "php", "rb"],
                "Documents": ["pdf", "doc", "docx", "txt", "rtf", "xlsx", "pptx", "csv"],
                "Archives": ["zip", "rar", "7z", "tar", "gz"]
            }
            with open(self.cats_file, 'w') as f:
                json.dump(default, f, indent=4)
            self.CATS = default
        else:
            try:
                with open(self.cats_file, 'r') as f:
                    fresh = json.load(f)
                if fresh != self.CATS and self.CATS:
                    self.log("Brain updated! I learned new file types.")
                self.CATS = fresh
            except Exception as e:
                self.log(f"Error reading categories.json: {e}")

    def run(self):
        self.log("Intelligent Sorter online. Watching Desktop...")
        while True:
            try:
                self._load_cats()
                self._scan()
            except Exception as e:
                self.log(f"System Error: {e}")
            time.sleep(5)

    def _get_category(self, ext):
        for cat, exts in self.CATS.items():
            if ext in exts:
                return cat
        return None

    def _scan(self):
        loose_files = [f for f in self.desktop.iterdir() 
                       if f.is_file() and not f.name.startswith('.') and f.name not in self.protected_files]

        moves_this_cycle = {}
        
        for file in loose_files:
            ext = file.suffix.lower().strip('.') or 'misc'
            cat = self._get_category(ext)
            
            # Determine nested structure
            if cat == 'Scripts':
                target_folder = self.desktop / 'Scripts' / ext
                log_label = f"Scripts/{ext}"
            elif cat:
                target_folder = self.desktop / cat
                log_label = cat
            else:
                target_folder = self.desktop / ext
                log_label = ext

            # Create folder if needed
            if not target_folder.exists():
                target_folder.mkdir(parents=True, exist_ok=True)
                self.log(f"Created new folder '{log_label}'")
                self.stats['total_folders'] += 1

            # Move file safely
            try:
                shutil.move(str(file), str(target_folder / file.name))
                moves_this_cycle[log_label] = moves_this_cycle.get(log_label, 0) + 1
            except PermissionError:
                pass # File is in use, skip for now

        # Aggregate and log what we did this cycle
        for label, count in moves_this_cycle.items():
            noun = "file" if count == 1 else "files"
            
            if '/' in label: # It's a nested script
                self.log(f"Moved {count} developer {noun} into '{label}'")
            elif label in self.CATS:
                self.log(f"I found {label.lower()} files and moved {count} into '{label}'")
            else:
                self.log(f"Moved {count} {noun} into '{label}'")
                
            self.stats['total_moved'] += count
            self.stats['session_moved'] += count

    def log(self, message):
        ts_full = time.strftime("%Y-%m-%d %H:%M:%S")
        ts_ui = time.strftime("%H:%M:%S")
        
        with open(self.log_file, 'a') as f:
            f.write(f"[{ts_full}] {message}\n")
            
        self.log_queue.put(f"{ts_ui}||{message}")


# ==========================================
# 3. PYTHON-JS API BRIDGE
# ==========================================
class Api:
    def __init__(self, log_queue, log_file, stats):
        # Using underscores tells pywebview to ignore these during serialization, 
        # preventing the infinite recursion crash.
        self._window = None
        self._log_queue = log_queue
        self._stats = stats
        self._logs = []

        # Load historical logs
        if log_file.exists():
            with open(log_file, 'r') as f:
                tail = f.readlines()[-30:]
            for line in tail:
                if not line.strip(): continue
                try:
                    ts = line[1:20]
                    msg = line[22:].strip()
                    time_part = ts.split(' ')[1]
                    self._logs.append(f"{time_part}||{msg}")
                except Exception:
                    self._logs.append(f"??:??:??||{line.strip()}")

    # --- OS Window Manipulation Functions ---
    def expand_window(self):
        if self._window:
            self._window.resize(450, 650)
            
    def collapse_window(self):
        if self._window:
            self._window.resize(80, 80)

    # --- Data Fetching ---
    def get_logs(self):
        try:
            while True:
                msg = self._log_queue.get_nowait()
                self._logs.append(msg)
                if len(self._logs) > 40:
                    self._logs.pop(0)
        except queue.Empty:
            pass
        return "<br>".join(self._logs)

    def get_stats(self):
        return self._stats

    def close_app(self):
        if self._window:
            self._window.destroy()


# ==========================================
# 4. BOOTSTRAP AND EXECUTION
# ==========================================
if __name__ == '__main__':
    log_queue = queue.Queue()
    log_file = Path(__file__).parent / 'sorter_history.log'
    stats = {'total_moved': 0, 'total_folders': 0, 'session_moved': 0}

    # Load persistent stats
    if log_file.exists():
        with open(log_file, 'r') as f:
            for line in f:
                if 'Moved' in line:
                    try:
                        n = int(line.split('Moved ')[1].split(' ')[0])
                        stats['total_moved'] += n
                    except Exception: pass
                if 'Created new folder' in line:
                    stats['total_folders'] += 1

    # Start the intelligent logic
    worker = DesktopWorker(log_queue, log_file, stats)
    worker.start()

    # Setup API
    api = Api(log_queue, log_file, stats)

    # Create the transparent OS Window
    window = webview.create_window(
        title='Intelligent Sorter',
        html=HTML_CONTENT,
        js_api=api,
        width=80,
        height=80,
        frameless=True,
        on_top=True,
        transparent=True,
        background_color='#000000' # Required for Edge WebView2 transparency handling
    )
    
    # Attach window to API using the safe private variable
    api._window = window

    # Launch UI
    webview.start()