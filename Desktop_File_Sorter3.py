import os
import shutil
import time
import threading
import queue
import json
import webview
from pathlib import Path

# ==========================================
# 1. HTML & CSS FRONTEND (Modern UI)
# ==========================================
HTML_CONTENT = """
<!DOCTYPE html>
<html>
<head>
    <style>
        /* Base Setup for Transparent Window */
        body, html {
            margin: 0; padding: 0; height: 100%; width: 100%;
            background-color: transparent !important;
            overflow: hidden;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex; justify-content: flex-end; align-items: flex-start;
        }

        /* The container holding our UI components */
        #app-container {
            position: relative;
            /* Allow the container to expand with the window */
            width: 100%;
            height: 100%;
            display: flex; justify-content: flex-end; align-items: flex-start;
            padding: 20px;
            box-sizing: border-box;
            background-color: transparent !important;
        }

        /* 1. The Red Dot (Default State) */
        #red-dot {
            width: 50px; height: 50px;
            background: radial-gradient(circle at 30% 30%, #ff4d4d, #8b0000);
            border-radius: 50%;
            box-shadow: 0 0 15px rgba(255, 0, 0, 0.6);
            cursor: pointer;
            animation: pulse 2s infinite ease-in-out;
            position: absolute;
            top: 20px; right: 20px;
            z-index: 10;
        }

        /* 2. The Expanded Panel */
        #panel {
            width: 0px; height: 50px; /* Starts as a line (cylinder crack) */
            background: linear-gradient(135deg, rgba(58,0,0,0.95) 0%, rgba(26,0,0,0.95) 100%);
            border: 1px solid #ff4d4d;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(255, 0, 0, 0.2);
            position: absolute;
            top: 20px; right: 20px;
            overflow: hidden;
            opacity: 0;
            display: flex; flex-direction: column;
            pointer-events: none; /* Disabled until expanded */
        }

        /* Minimize Button */
        #min-btn {
            width: 15px; height: 15px;
            background: #ff4d4d;
            border-radius: 50%;
            margin: 15px;
            cursor: pointer;
            box-shadow: 0 0 8px red;
            transition: transform 0.2s;
            flex-shrink: 0;
            z-index: 5;
        }
        #min-btn:hover { transform: scale(1.3); }

        /* Log Text Area */
        #logs {
            flex-grow: 1;
            padding: 0 20px 20px 20px;
            color: #ffb3b3;
            font-family: 'Consolas', monospace;
            font-size: 13px;
            overflow-y: auto;
            line-height: 1.5;
            z-index: 2;
        }
        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #8b0000; border-radius: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }

        /* The Purple Swirling Mist - Made significantly more subtle */
        #mist {
            position: absolute;
            bottom: 0; left: 0; width: 100%; height: 100px;
            /* Reduced opacity significantly (0.8 -> 0.3 and 0.4 -> 0.15) */
            background: linear-gradient(0deg, rgba(75,0,130,0.3) 0%, rgba(139,0,0,0.15) 50%, transparent 100%);
            background-size: 200% 200%;
            animation: swirl 6s ease infinite; /* Slowed down the animation */
            pointer-events: none;
            z-index: 1;
        }

        /* --- ANIMATIONS --- */
        @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 10px rgba(255,0,0,0.4); }
            50% { transform: scale(1.05); box-shadow: 0 0 25px rgba(255,0,0,0.8); }
            100% { transform: scale(0.95); box-shadow: 0 0 10px rgba(255,0,0,0.4); }
        }

        @keyframes swirl {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        /* Cylinder Crack -> Expand */
        .expand-anim {
            animation: crack-open 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            pointer-events: auto !important;
        }
        @keyframes crack-open {
            0% { width: 0px; height: 50px; opacity: 1; }
            40% { width: calc(100% - 40px); height: 50px; opacity: 1; } /* Expand width, respecting padding */
            100% { width: calc(100% - 40px); height: calc(100% - 40px); opacity: 1; } /* Drop vertically, respecting padding */
        }

        /* Blackhole Slurp -> Collapse */
        .collapse-anim {
            animation: slurp-shut 0.5s cubic-bezier(0.7, 0, 0.84, 0) forwards;
        }
        @keyframes slurp-shut {
            0% { width: calc(100% - 40px); height: calc(100% - 40px); opacity: 1; }
            40% { width: calc(100% - 40px); height: 50px; opacity: 1; }
            99% { width: 0px; height: 50px; opacity: 1; }
            100% { width: 0px; height: 50px; opacity: 0; pointer-events: none; }
        }

        .hidden { display: none !important; }
    </style>
</head>
<body>

<div id="app-container">
    <!-- Red Dot (Draggable) -->
    <div id="red-dot" class="pywebview-drag-region"></div>

    <!-- Expanded Panel (Draggable background) -->
    <div id="panel" class="pywebview-drag-region">
        <div id="min-btn"></div>
        <div id="logs">Loading logic...</div>
        <div id="mist"></div>
    </div>
</div>

<script>
    const dot = document.getElementById('red-dot');
    const panel = document.getElementById('panel');
    const minBtn = document.getElementById('min-btn');
    const logDiv = document.getElementById('logs');
    
    let isExpanded = false;

    // Double click to Expand
    dot.addEventListener('dblclick', () => {
        if(isExpanded) return;
        isExpanded = true;
        dot.style.display = 'none';
        panel.classList.remove('collapse-anim');
        panel.classList.add('expand-anim');
    });

    // Click to Minimize
    minBtn.addEventListener('click', () => {
        if(!isExpanded) return;
        isExpanded = false;
        panel.classList.remove('expand-anim');
        panel.classList.add('collapse-anim');
        setTimeout(() => { dot.style.display = 'block'; }, 400); // Show dot right as it collapses
    });

    // Right Click to Exit App
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (confirm('Shut down the Intelligent Desktop Sorter?')) {
            pywebview.api.close_app();
        }
    });

    // Poll Python for new logs every 500ms
    setInterval(async () => {
        if (window.pywebview && window.pywebview.api) {
            const newLogs = await pywebview.api.get_logs();
            if (newLogs !== logDiv.innerHTML) {
                logDiv.innerHTML = newLogs;
                logDiv.scrollTop = logDiv.scrollHeight; // Auto-scroll
            }
        }
    }, 500);
</script>

</body>
</html>
"""

# ==========================================
# 2. BACKGROUND WORKER & API (Python Backend)
# ==========================================

class DesktopWorker(threading.Thread):
    def __init__(self, log_queue, log_file):
        super().__init__(daemon=True)
        self.log_queue = log_queue
        self.desktop_path = Path.home() / 'Desktop'
        self.script_dir = Path(__file__).parent
        self.categories_file = self.script_dir / 'categories.json'
        self.log_file = log_file
        self.CATEGORIES = {}
        self._load_categories()

    def _load_categories(self):
        if not self.categories_file.exists():
            default_categories = {
                "Audio": ["mp3", "m4a", "wav", "ogg"],
                "Pictures": ["jpg", "jpeg", "png", "gif"],
                "Videos": ["mp4", "mkv", "avi"],
                "Apps": ["lnk", "url", "exe"],
                "Scripts": ["py", "html", "css", "js", "json"]
            }
            with open(self.categories_file, 'w') as f:
                json.dump(default_categories, f, indent=4)
            self.CATEGORIES = default_categories
        else:
            try:
                with open(self.categories_file, 'r') as f:
                    new_categories = json.load(f)
                    if new_categories != self.CATEGORIES and self.CATEGORIES:
                        self.log("Brain updated! I learned new file types.")
                    self.CATEGORIES = new_categories
            except Exception as e:
                self.log(f"Error reading categories.json: {e}")

    def run(self):
        self.log("Modern Intelligent Worker started...")
        while True:
            try:
                self._load_categories()
                self._organize_desktop()
            except Exception as e:
                self.log(f"Error: {e}")
            time.sleep(5)

    def _organize_desktop(self):
        loose_files = [f for f in self.desktop_path.iterdir() 
                       if f.is_file() and not f.name.startswith('.') and f.name != 'desktop.ini']
        
        moved_count = {}
        for file in loose_files:
            ext = file.suffix.lower().strip('.')
            if not ext: ext = 'misc'
            
            category = None
            for cat, exts in self.CATEGORIES.items():
                if ext in exts:
                    category = cat
                    break
            
            if category == 'Scripts':
                target_folder = self.desktop_path / 'Scripts' / ext
            elif category:
                target_folder = self.desktop_path / category
            else:
                target_folder = self.desktop_path / ext 
            
            if not target_folder.exists():
                target_folder.mkdir(parents=True, exist_ok=True) 
                if category == 'Scripts':
                    self.log(f"Created nested folder 'Scripts/{ext}'")
                elif category:
                    self.log(f"Created '{category}' folder")
                else:
                    self.log(f"Created folder '{ext}'")
            
            try:
                shutil.move(str(file), str(target_folder / file.name))
                log_key = f"Scripts/{ext}" if category == 'Scripts' else (category or ext)
                moved_count[log_key] = moved_count.get(log_key, 0) + 1
            except PermissionError:
                pass 

        for key, count in moved_count.items():
            plural = "files" if count > 1 else "file"
            if key.startswith('Scripts/'):
                self.log(f"Moved {count} developer {plural} into '{key}'")
            elif key in self.CATEGORIES:
                self.log(f"Moved {count} {plural} into '{key}'")
            else:
                self.log(f"Moved {count} {plural} into folder '{key}'")

    def log(self, message):
        time_str = time.strftime("%H:%M:%S")
        date_str = time.strftime("%Y-%m-%d")
        
        with open(self.log_file, 'a') as f:
            f.write(f"[{date_str} {time_str}] {message}\n")
            
        self.log_queue.put(f"[{time_str}] {message}")


class Api:
    def __init__(self, log_queue, master_log_file):
        self.log_queue = log_queue
        self.logs = []
        
        if master_log_file.exists():
            with open(master_log_file, 'r') as f:
                last_lines = f.readlines()[-15:]
                for line in last_lines:
                    try:
                        time_part = line.split(' ')[1].split(']')[0]
                        msg_part = line.split('] ', 1)[1].strip()
                        self.logs.append(f"[{time_part}] {msg_part}")
                    except:
                        self.logs.append(line.strip())

    def get_logs(self):
        try:
            while True:
                msg = self.log_queue.get_nowait()
                self.logs.append(msg)
                if len(self.logs) > 20: 
                    self.logs.pop(0)
        except queue.Empty:
            pass
            
        return "<br><br>".join(self.logs)

    def close_app(self):
        window.destroy()

# ==========================================
# 3. BOOTSTRAP (Start the App)
# ==========================================
if __name__ == '__main__':
    log_queue = queue.Queue()
    master_log_file = Path(__file__).parent / 'sorter_history.log'
    
    worker = DesktopWorker(log_queue, master_log_file)
    worker.start()

    api = Api(log_queue, master_log_file)

    # Allow the window to be resizable by the user, and start transparent
    window = webview.create_window(
        'Intelligent Desktop Sorter', 
        html=HTML_CONTENT, 
        js_api=api,
        width=450, 
        height=600, 
        frameless=True, 
        on_top=True,
        resizable=True, # Crucial for allowing expansion,
        transparent=True
    )
    
    webview.start() # Ensure rendering engine starts transparent