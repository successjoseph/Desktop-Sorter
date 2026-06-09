import os
import shutil
import time
import threading
import queue
import tkinter as tk
from pathlib import Path
import math

# --- BACKGROUND WORKER LOGIC ---
class DesktopWorker(threading.Thread):
    def __init__(self, log_queue):
        super().__init__(daemon=True)
        self.log_queue = log_queue
        self.desktop_path = Path.home() / 'Desktop'

    def run(self):
        self.log("Worker started. Watching Desktop for loose files...")
        while True:
            try:
                self._organize_desktop()
            except Exception as e:
                self.log(f"Error during scan: {e}")
            time.sleep(5) # Scan every 5 seconds

    def _organize_desktop(self):
        # Find files directly on the desktop (ignoring directories and hidden system files)
        loose_files = [f for f in self.desktop_path.iterdir() 
                       if f.is_file() and not f.name.startswith('.') and f.name != 'desktop.ini']
        
        # Group files by extension
        moved_count = {}
        for file in loose_files:
            ext = file.suffix.lower().strip('.')
            if not ext:
                ext = 'misc' # Fallback for files with no extension
            
            target_folder = self.desktop_path / ext
            
            if not target_folder.exists():
                target_folder.mkdir()
                self.log(f"I found a new file type, I created a new folder named '{ext}'")
            
            try:
                shutil.move(str(file), str(target_folder / file.name))
                moved_count[ext] = moved_count.get(ext, 0) + 1
            except PermissionError:
                pass # File might be currently open/downloading, skip for now

        # Log the aggregated moves
        for ext, count in moved_count.items():
            plural = "files" if count > 1 else "file"
            self.log(f"I put {count} {plural} with the extension '{ext}' into the folder named '{ext}'")

    def log(self, message):
        timestamp = time.strftime("%H:%M:%S")
        self.log_queue.put(f"[{timestamp}] {message}\n")


# --- GUI / VISUAL EFFECTS LOGIC ---
class FloatingApp(tk.Tk):
    def __init__(self, log_queue):
        super().__init__()
        self.log_queue = log_queue
        
        # Window configuration
        self.overrideredirect(True) # Remove standard window borders
        self.wm_attributes("-topmost", True) # Always on top
        self.transparent_color = '#000001' # Magic color to act as transparent
        self.wm_attributes("-transparentcolor", self.transparent_color)
        self.config(bg=self.transparent_color)

        self.screen_width = self.winfo_screenwidth()
        self.screen_height = self.winfo_screenheight()
        
        # State variables
        self.is_expanded = False
        self.pulse_angle = 0
        self.geometry(f"60x60+{self.screen_width-100}+50") # Start top-right
        self.x_offset = 0
        self.y_offset = 0

        self._build_ui()
        self._start_loops()

    def _build_ui(self):
        # 1. The Red Dot Canvas (Default state)
        self.dot_canvas = tk.Canvas(self, width=60, height=60, bg=self.transparent_color, highlightthickness=0)
        self.dot_canvas.pack()
        self.dot = self.dot_canvas.create_oval(15, 15, 45, 45, fill='#ff0000', outline='#ff4444', width=2)
        
        # Bindings for the Dot
        self.dot_canvas.bind("<ButtonPress-1>", self.start_drag)
        self.dot_canvas.bind("<B1-Motion>", self.do_drag)
        self.dot_canvas.bind("<Double-1>", self.expand_ui)
        self.dot_canvas.bind("<Button-3>", self.show_context_menu) # Right click to exit

        # 2. The Expanded Rectangle (Hidden initially)
        self.expand_frame = tk.Frame(self, bg='#8b0000', bd=2, relief='ridge')
        
        # Inner content of expanded frame
        self.log_text = tk.Text(self.expand_frame, bg='#660000', fg='#ffdddd', font=("Consolas", 10),
                                wrap='word', bd=0, highlightthickness=0)
        self.scrollbar = tk.Scrollbar(self.expand_frame, command=self.log_text.yview, bg='#440000')
        self.log_text.configure(yscrollcommand=self.scrollbar.set)
        
        self.log_text.pack(side='left', fill='both', expand=True, padx=(10, 0), pady=10)
        self.scrollbar.pack(side='right', fill='y', pady=10)

        # "Purple Mist" pseudo-effect (Gradient Canvas at the bottom)
        self.mist_canvas = tk.Canvas(self.expand_frame, height=30, bg='#8b0000', highlightthickness=0)
        self.mist_canvas.pack(side='bottom', fill='x')
        self._draw_purple_mist()

        # Minimize Button (The dot popping out)
        self.min_btn = tk.Canvas(self.expand_frame, width=30, height=30, bg='#8b0000', highlightthickness=0)
        self.min_btn.place(x=5, y=5)
        self.min_btn.create_oval(5, 5, 25, 25, fill='#ff0000')
        self.min_btn.bind("<Button-1>", self.collapse_ui)

        # Allow dragging from the expanded frame's background
        self.expand_frame.bind("<ButtonPress-1>", self.start_drag)
        self.expand_frame.bind("<B1-Motion>", self.do_drag)

    def _draw_purple_mist(self):
        # Simulate a purple mist/gradient at the bottom using rectangles
        # 139 is the decimal equivalent of the hex value 8b (Dark Red)
        for i in range(30):
            # Calculate RGB values in decimal, then format as 2-digit hex
            r = 139 - int(i * 2.5)  
            g = 0
            b = int(i * 4.2)
            
            # Ensure values stay within the valid 0-255 RGB range
            r = max(0, min(255, r))
            b = max(0, min(255, b))
            
            color = f"#{r:02x}{g:02x}{b:02x}" # Transition Dark Red to Purple
            self.mist_canvas.create_line(0, i, 1000, i, fill=color)
            
        self.mist_canvas.create_text(150, 15, text="~~~~ Mysterious Layer ~~~~", fill="#ddaadd", font=("Arial", 9, "italic"))

    # --- DRAG MECHANICS ---
    def start_drag(self, event):
        self.x_offset = event.x
        self.y_offset = event.y

    def do_drag(self, event):
        x = self.winfo_x() + event.x - self.x_offset
        y = self.winfo_y() + event.y - self.y_offset
        self.geometry(f"+{x}+{y}")

    # --- ANIMATIONS ---
    def pulse_animation(self):
        if not self.is_expanded:
            # Pulsing logic for the dot
            self.pulse_angle += 0.2
            scale = math.sin(self.pulse_angle) * 3
            self.dot_canvas.coords(self.dot, 15 - scale, 15 - scale, 45 + scale, 45 + scale)
        else:
            # Pulsing logic for the expanded rectangle (changing border/bg slightly)
            self.pulse_angle += 0.1
            color_intensity = int(100 + math.sin(self.pulse_angle) * 39)
            hex_color = f"#{color_intensity:02x}0000"
            self.expand_frame.config(bg=hex_color)
            self.mist_canvas.config(bg=hex_color)
            
        self.after(50, self.pulse_animation)

    def expand_ui(self, event=None):
        if self.is_expanded: return
        self.is_expanded = True
        self.dot_canvas.pack_forget()
        self.expand_frame.pack(fill='both', expand=True)
        
        # "Cylinder crack" simulation: Expand width first, then height
        target_w = min(400, self.screen_width // 2)
        target_h = min(300, self.screen_height // 2)
        
        self._animate_geometry(60, 60, target_w, 60, step=1, next_anim=lambda: 
                               self._animate_geometry(target_w, 60, target_w, target_h, step=1))

    def collapse_ui(self, event=None):
        if not self.is_expanded: return
        
        # "Blackhole slurp" simulation: Rapidly shrink both dimensions to center
        current_w = self.winfo_width()
        current_h = self.winfo_height()
        
        self._animate_geometry(current_w, current_h, 60, 60, step=3, next_anim=self._finalize_collapse)

    def _finalize_collapse(self):
        self.expand_frame.pack_forget()
        self.dot_canvas.pack()
        self.is_expanded = False

    def _animate_geometry(self, start_w, start_h, end_w, end_h, step=1, next_anim=None, current_step=0, max_steps=15):
        if current_step <= max_steps:
            # Calculate interpolation
            w = int(start_w + (end_w - start_w) * (current_step / max_steps))
            h = int(start_h + (end_h - start_h) * (current_step / max_steps))
            
            # Keep the center anchored during animation
            x = self.winfo_x() + (self.winfo_width() - w) // 2
            y = self.winfo_y() + (self.winfo_height() - h) // 2
            
            self.geometry(f"{w}x{h}+{x}+{y}")
            self.after(10 + step, lambda: self._animate_geometry(start_w, start_h, end_w, end_h, step, next_anim, current_step + 1, max_steps))
        elif next_anim:
            next_anim()

    # --- LOG UPDATER ---
    def process_logs(self):
        try:
            while True:
                log_msg = self.log_queue.get_nowait()
                self.log_text.insert(tk.END, log_msg)
                self.log_text.see(tk.END) # Auto-scroll to bottom
                
                # Auto-adjust height based on content up to half screen
                if self.is_expanded:
                    req_height = min(self.log_text.winfo_reqheight() + 50, self.screen_height // 2)
                    current_w = self.winfo_width()
                    if self.winfo_height() < req_height:
                        self.geometry(f"{current_w}x{req_height}")

        except queue.Empty:
            pass
        self.after(200, self.process_logs)

    # --- LOOPS & EXITS ---
    def _start_loops(self):
        self.pulse_animation()
        self.process_logs()

    def show_context_menu(self, event):
        menu = tk.Menu(self, tearoff=0, bg='darkred', fg='white')
        menu.add_command(label="Exit App", command=self.destroy)
        menu.post(event.x_root, event.y_root)

# --- BOOTSTRAP ---
if __name__ == "__main__":
    log_queue = queue.Queue()
    
    # Start the background file sorter thread
    worker = DesktopWorker(log_queue)
    worker.start()
    
    # Start the GUI
    app = FloatingApp(log_queue)
    app.mainloop()