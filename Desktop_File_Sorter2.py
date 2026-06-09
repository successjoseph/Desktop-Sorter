import os
import shutil
import time
import threading
import queue
import json
from pathlib import Path
from ursina import *
import math
import random

# ==========================================
# 1. BACKGROUND WORKER (Intelligent Sorter)
# ==========================================
class DesktopWorker(threading.Thread):
    def __init__(self, log_queue, log_file):
        super().__init__(daemon=True)
        self.log_queue = log_queue
        self.desktop_path = Path.home() / 'Desktop'
        
        # File paths
        self.script_dir = Path(__file__).parent
        self.categories_file = self.script_dir / 'categories.json'
        self.log_file = log_file
        
        self.CATEGORIES = {}
        self._load_categories()

    def _load_categories(self):
        """Loads the brain from the JSON file."""
        if not self.categories_file.exists():
            default_categories = {
                "Audio": ["mp3", "m4a", "wav", "ogg"],
                "Pictures": ["jpg", "jpeg", "png", "gif"],
                "Videos": ["mp4", "mkv", "avi"],
                "Apps": ["lnk", "url", "exe"],
                "Scripts": ["py", "html", "css", "js"]
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
        self.log("Intelligent Worker started. Watching Desktop...")
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
                    self.log(f"New script type found. Created nested folder 'Scripts/{ext}'")
                elif category:
                    self.log(f"Found a {category.lower()} file. Created '{category}' folder")
                else:
                    self.log(f"New file type found. Created folder '{ext}'")
            
            try:
                shutil.move(str(file), str(target_folder / file.name))
                
                log_key = f"Scripts/{ext}" if category == 'Scripts' else (category or ext)
                moved_count[log_key] = moved_count.get(log_key, 0) + 1
            except PermissionError:
                pass 

        for key, count in moved_count.items():
            plural = "files" if count > 1 else "file"
            
            if key.startswith('Scripts/'):
                ext = key.split('/')[1]
                self.log(f"Moved {count} developer {plural} into '{key}'")
            elif key in self.CATEGORIES:
                self.log(f"I found {key.lower()} files and moved {count} {plural} into '{key}'")
            else:
                self.log(f"Moved {count} {plural} into folder '{key}'")

    def log(self, message):
        """Writes to persistent file AND sends to the live UI"""
        time_str = time.strftime("%H:%M:%S")
        date_str = time.strftime("%Y-%m-%d")
        
        # 1. Append to the permanent log file
        with open(self.log_file, 'a') as f:
            f.write(f"[{date_str} {time_str}] {message}\n")
            
        # 2. Send to the UI (we omit the date in the UI to save space)
        self.log_queue.put(f"[{time_str}] {message}")


# ==========================================
# 2. URSINA 3D APP (Visuals)
# ==========================================
app = Ursina(
    title='Desktop Sorter',
    size=(800, 600),
    borderless=True,
    window_type='onscreen',
    development_mode=False
)

window.color = color.clear
window.always_on_top = True
camera.orthographic = True
camera.fov = 10

log_queue = queue.Queue()
master_log_file = Path(__file__).parent / 'sorter_history.log'

# --- 3D Assets ---
red_dot = Entity(model='sphere', color=color.red, scale=1, collider='sphere', position=(0, 0, 0))

expand_panel = Entity(model='quad', color=color.dark_gray, scale=(0, 0, 0.1), position=(0, 0, 0.5), collider='box')

log_text = Text(text="", parent=expand_panel, position=(-0.45, 0.45, -0.1), scale=0.15, color=color.white)
log_text.wordwrap = 60  # Apply wordwrap after creation

mist_particles = Entity(parent=expand_panel, y=-0.4, z=-0.2)
for i in range(20):
    Entity(parent=mist_particles, model='quad', color=color.rgba(138, 43, 226, 100),
           scale=(random.uniform(0.1, 0.4), random.uniform(0.05, 0.1)),
           position=(random.uniform(-0.4, 0.4), random.uniform(-0.1, 0.1)), add_to_scene_entities=False)

is_expanded = False
logs = []

# --- Load Persistent History on Startup ---
if master_log_file.exists():
    with open(master_log_file, 'r') as f:
        # Grab the last 15 lines from the file
        last_lines = f.readlines()[-15:]
        for line in last_lines:
            try:
                # The file stores [YYYY-MM-DD HH:MM:SS]. We extract just the HH:MM:SS for the UI.
                time_part = line.split(' ')[1].split(']')[0] 
                msg_part = line.split('] ', 1)[1].strip()
                logs.append(f"[{time_part}] {msg_part}")
            except:
                logs.append(line.strip())
        
        log_text.text = '\n'.join(logs)


def update():
    try:
        while True:
            msg = log_queue.get_nowait()
            logs.append(msg)
            if len(logs) > 15:
                logs.pop(0)
            log_text.text = '\n'.join(logs)
    except queue.Empty:
        pass

    scale_mod = 1 + (math.sin(time.time() * 3) * 0.1)
    if not is_expanded:
        red_dot.scale = scale_mod
        red_dot.color = color.rgb(255, int(abs(math.sin(time.time()*2))*50), int(abs(math.sin(time.time()*2))*50))

    if is_expanded:
        for p in mist_particles.children:
            p.x += math.sin(time.time() * 2 + p.y * 10) * time.dt * 0.1
            p.y += time.dt * 0.05
            if p.y > 0.2:
                p.y = random.uniform(-0.1, 0)
                p.x = random.uniform(-0.4, 0.4)

def input(key):
    global is_expanded
    if key == 'left mouse down' and mouse.hovered_entity == red_dot:
        if not is_expanded:
            expand_ui()
        else:
            collapse_ui()
            
    if key == 'right mouse down':
        application.quit()

def expand_ui():
    global is_expanded
    is_expanded = True
    expand_panel.animate_scale_x(6, duration=0.2, curve=curve.out_expo)
    invoke(expand_panel.animate_scale_y, 4, duration=0.3, curve=curve.out_back, delay=0.2)
    red_dot.animate_position((-2.8, 1.8, -0.5), duration=0.4)
    red_dot.animate_scale(0.3, duration=0.4)

def collapse_ui():
    global is_expanded
    is_expanded = False
    expand_panel.animate_scale((0, 0, 0.1), duration=0.3, curve=curve.in_expo)
    red_dot.animate_position((0, 0, 0), duration=0.3)
    red_dot.animate_scale(1, duration=0.3)

if __name__ == "__main__":
    worker = DesktopWorker(log_queue, master_log_file)
    worker.start()
    app.run()