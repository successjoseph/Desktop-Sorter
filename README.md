# Desktop-Sorter

![Python](https://img.shields.io/badge/Python-Desktop%20Utility-blue)
![JavaScript](https://img.shields.io/badge/Node.js-docx%20generator-yellow)

## Table of Contents
- [About](#about)
- [Project Contents](#project-contents)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Testing](#testing)
- [Contributing](#contributing)
- [Authors and License](#authors-and-license)

## About

This repository holds four successive iterations of a personal Windows desktop-cleanup utility, plus one unrelated Node.js script for generating a Word document. The core idea across all four Python scripts is the same: a background thread scans `Path.home() / 'Desktop'` every 5 seconds, looks up each loose file's extension against a category map, and moves it into an auto-created subfolder (e.g. `Pictures`, `Videos`, `Documents`, or `Scripts/<ext>` for code files). The four versions differ mainly in their UI layer, showing a clear evolution: `Desktop_File_Sorter.pyw` uses plain `tkinter`; `Desktop_File_Sorter2.py` renders its UI with the `ursina` game engine; `Desktop_File_Sorter3.py` and `Desktop_File_Sorter4.py` switch to `pywebview`, embedding an HTML/CSS/JS front-end (a small pulsing red "dot" that expands into a stats/log panel showing files moved, folders created, and a live activity log) driven by a Python/JS API bridge. `categories.json` holds the shared extension-to-category mapping (Audio, Pictures, Videos, Apps, Scripts, Documents, Archives), and `sorter_history.log` is a real runtime log left over from actual use, confirming the tool has genuinely been run. `generate-doc.js` is unrelated to the sorter: it's a Node script (using the `docx` npm package) that programmatically builds `PIMS_SRS_v1.0.docx`, a full Software Requirements Specification for a separate "Pharmacy Inventory Management System" project, including cover page, table of contents, entity tables, and Gherkin-style functional requirements.

## Project Contents

```
Desktop-Sorter/
├── Desktop_File_Sorter.pyw     # v1 — tkinter UI
├── Desktop_File_Sorter2.py     # v2 — ursina (game engine) UI
├── Desktop_File_Sorter3.py     # v3 — pywebview + HTML UI
├── Desktop_File_Sorter4.py     # v4 — pywebview + HTML UI (refined "pulsing dot" panel)
├── categories.json             # Shared extension → category mapping
├── sorter_history.log          # Real run history from actual use
├── generate-doc.js             # Unrelated: builds a Word SRS document via the `docx` npm package
└── PIMS_SRS_v1.0.docx           # Output of generate-doc.js (a Pharmacy Inventory Management System SRS)
```

## Prerequisites

For the sorter scripts (pick the version you want to run):
- Python 3.x
- `Desktop_File_Sorter.pyw`: stdlib only (`tkinter` ships with most Python installs)
- `Desktop_File_Sorter2.py`: the `ursina` package
- `Desktop_File_Sorter3.py` / `Desktop_File_Sorter4.py`: the `pywebview` package

For `generate-doc.js`:
- Node.js
- The `docx` npm package (referenced via `require('docx')`; `package.json`/`package-lock.json`/`node_modules` are all listed in `.gitignore` so no manifest is committed to the repo)

## Installation

```bash
git clone https://github.com/successjoseph/Desktop-Sorter.git
cd Desktop-Sorter

# For the latest sorter version
pip install pywebview

# For the docx generator
npm install docx
```

## Configuration

`categories.json` is the one piece of real configuration: it maps category names to lists of file extensions (e.g. `"Pictures": ["jpg","jpeg","png","gif","bmp","webp","svg","tiff"]`). If it doesn't exist next to the script, `Desktop_File_Sorter4.py` recreates it with a built-in default the first time it runs. There are no `.env` files or other secrets.

## Usage

Run the latest sorter version in the background — it watches your Desktop and auto-sorts loose files into category subfolders every 5 seconds:
```bash
python Desktop_File_Sorter4.py
```
A small always-on-top, frameless "pulsing dot" window appears; click it to expand into a stats/log panel, right-click to quit with a confirmation prompt.

Generate the SRS Word document:
```bash
node generate-doc.js
```
This writes `PIMS_SRS_v1.0.docx` in the current directory.

## Testing

No automated tests are currently included.

## Contributing

This is a personal utility/scratch repo (multiple experimental versions of the same idea, plus an unrelated script), not intended for outside contributions. Notes above are for future-you when picking which sorter version to keep building on.

## Authors and License

- **Author:** successjoseph ([github.com/successjoseph](https://github.com/successjoseph))
- **License:** No license file included in this repository — all rights reserved by default.
