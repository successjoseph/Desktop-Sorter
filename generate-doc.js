const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents, InternalHyperlink, Bookmark, ExternalHyperlink,
  TabStopType, TabStopPosition
} = require('docx');
const fs = require('fs');

// ─── Colour Palette ───────────────────────────────────────────────
const GREEN       = "2D7D46"; // Health Green (main)
const GREEN_LIGHT = "E8F5EC"; // Light green tint for table rows
const GREEN_MID   = "5FAD72"; // Midtone green
const ORANGE      = "FDF0E6"; // Light orange (paper / section bg)
const ORANGE_MID  = "E8A86C"; // Light-medium orange for accents
const WHITE       = "FFFFFF";
const DARK        = "1A1A1A";
const GREY        = "5A5A5A";
const GREY_LIGHT  = "F5F5F5";
const RED_LETTER  = "C0392B"; // P in PIMS
const BLUE_LETTER = "2980B9"; // I in PIMS
const YELLOW_LTR  = "D4AC0D"; // M in PIMS
const GREEN_LTR   = "27AE60"; // S in PIMS

// ─── Borders helpers ──────────────────────────────────────────────
const noBorder  = { style: BorderStyle.NONE, size: 0, color: WHITE };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const thinBorder = (col = "CCCCCC") => ({ style: BorderStyle.SINGLE, size: 1, color: col });
const thinBorders = (col = "CCCCCC") => ({ top: thinBorder(col), bottom: thinBorder(col), left: thinBorder(col), right: thinBorder(col) });
const greenBorder = thinBorders(GREEN);
const greenBorderBottom = { top: noBorder, bottom: thinBorder(GREEN_MID), left: noBorder, right: noBorder };

// ─── PIMS coloured title helper ───────────────────────────────────
function pimsRuns(size = 52) {
  return [
    new TextRun({ text: "P", bold: true, size, color: RED_LETTER,    font: "Arial" }),
    new TextRun({ text: "I", bold: true, size, color: BLUE_LETTER,   font: "Arial" }),
    new TextRun({ text: "M", bold: true, size, color: YELLOW_LTR,    font: "Arial" }),
    new TextRun({ text: "S", bold: true, size, color: GREEN_LTR,     font: "Arial" }),
  ];
}

// ─── Paragraph helpers ────────────────────────────────────────────
function h1(text, bookmarkId) {
  const run = new TextRun({ text, bold: true, size: 32, color: GREEN, font: "Arial" });
  const children = bookmarkId
    ? [new Bookmark({ id: bookmarkId, children: [run] })]
    : [run];
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children,
    spacing: { before: 360, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GREEN, space: 2 } },
  });
}

function h2(text, bookmarkId) {
  const run = new TextRun({ text, bold: true, size: 26, color: ORANGE_MID, font: "Arial" });
  const children = bookmarkId
    ? [new Bookmark({ id: bookmarkId, children: [run] })]
    : [run];
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children,
    spacing: { before: 280, after: 80 },
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, size: 22, color: GREEN_MID, font: "Arial" })],
    spacing: { before: 200, after: 60 },
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, font: "Arial", color: DARK, ...opts })],
    spacing: { before: 60, after: 80 },
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    children: [new TextRun({ text, size: 20, font: "Arial", color: DARK })],
    spacing: { before: 40, after: 40 },
  });
}

function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    children: [new TextRun({ text, size: 20, font: "Arial", color: DARK })],
    spacing: { before: 40, after: 40 },
  });
}

function spacer(before = 120) {
  return new Paragraph({ children: [new TextRun("")], spacing: { before, after: 0 } });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ─── Table helpers ────────────────────────────────────────────────
function headerCell(text, w) {
  return new TableCell({
    borders: thinBorders(GREEN),
    width: { size: w, type: WidthType.DXA },
    shading: { fill: GREEN, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 18, font: "Arial", color: WHITE })],
    })],
  });
}

function dataCell(text, w, shade = WHITE, bold = false) {
  return new TableCell({
    borders: thinBorders("C8E6D0"),
    width: { size: w, type: WidthType.DXA },
    shading: { fill: shade, type: ShadingType.CLEAR },
    margins: { top: 70, bottom: 70, left: 140, right: 140 },
    children: [new Paragraph({
      children: [new TextRun({ text, size: 18, font: "Arial", color: DARK, bold })],
    })],
  });
}

function gherkinBlock(lines) {
  return new Paragraph({
    children: lines.map((l, i) => {
      const isKeyword = /^(Feature:|Scenario:|Given|When|Then|And|But)/.test(l.trim());
      return new TextRun({
        text: l,
        size: 18,
        font: "Courier New",
        color: isKeyword ? GREEN : DARK,
        bold: isKeyword,
        break: i > 0 ? 1 : 0,
      });
    }),
    spacing: { before: 80, after: 80 },
    shading: { fill: GREEN_LIGHT, type: ShadingType.CLEAR },
    indent: { left: 360 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: GREEN, space: 6 },
    },
  });
}

// ─── Cover page ───────────────────────────────────────────────────
function buildCoverPage() {
  return [
    spacer(1440),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        ...pimsRuns(80),
      ],
      spacing: { before: 0, after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Pharmacy Inventory Management System", size: 36, bold: true, font: "Arial", color: GREEN })],
      spacing: { before: 0, after: 60 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Software Requirements Specification", size: 26, font: "Arial", color: GREY })],
      spacing: { before: 0, after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "─────────────────────────────────", size: 22, color: ORANGE_MID, font: "Arial" })],
      spacing: { before: 0, after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Version 1.0", size: 22, font: "Arial", color: GREY })],
      spacing: { before: 0, after: 60 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "June 2025", size: 22, font: "Arial", color: GREY })],
      spacing: { before: 0, after: 60 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "CONFIDENTIAL — INTERNAL USE ONLY", size: 18, bold: true, font: "Arial", color: ORANGE_MID })],
      spacing: { before: 200, after: 0 },
    }),
    pageBreak(),
  ];
}

// ─── Main document ────────────────────────────────────────────────
const children = [
  ...buildCoverPage(),

  // ── TOC ──
  h1("Table of Contents"),
  new TableOfContents("Table of Contents", {
    hyperlink: true,
    headingStyleRange: "1-3",
  }),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════
  // 1. INTRODUCTION
  // ══════════════════════════════════════════════════════════════
  h1("1. Introduction", "intro"),
  body("This Software Requirements Specification (SRS) describes the Pharmacy Inventory Management System (PIMS), an administrative-grade, edge-computing inventory platform designed for pharmacy store owners and administrative staff. It captures the full functional and non-functional requirements, system architecture, data model, and interface contracts needed to build, validate, and maintain the system."),

  h2("1.1 Purpose", "s11"),
  body("The purpose of this document is to define, in precise and unambiguous terms, the requirements of PIMS so that developers, QA engineers, and stakeholders share a single source of truth. It serves as the contract between the project team and the client throughout the software development lifecycle."),

  h2("1.2 Scope", "s12"),
  body("PIMS is an Inventory Management System (IMS), not a comprehensive Store Management System (SMS). Its boundaries are:"),
  bullet("In-scope: Real-time inventory tracking, cashier-driven deduction processing, inventory manager stock entry and adjustment, Write-Ahead Log (WAL) crash recovery, 30-second batch cloud synchronisation, admin dashboard reporting, and role-based access control."),
  bullet("Out-of-scope: Patient management, prescription processing, point-of-sale payment processing, supplier ordering workflows, and HR or payroll functions."),
  body("The system targets a single pharmacy store with up to five concurrent cashier terminals and an indeterminate number of inventory manager devices on the local network."),

  h2("1.3 Definitions, Acronyms, and Abbreviations", "s13"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2200, 7160],
    rows: [
      new TableRow({ children: [headerCell("Term / Acronym", 2200), headerCell("Definition", 7160)] }),
      ...[
        ["PIMS", "Pharmacy Inventory Management System — the system described in this document."],
        ["IMS", "Inventory Management System — the class of software to which PIMS belongs."],
        ["SMS", "Store Management System — a broader class that includes POS, patient, and HR modules. PIMS is explicitly not an SMS."],
        ["Validator", "The PIMS service component that acts as a traffic warden for all inbound deduction requests."],
        ["Processor", "The PIMS core engine managing Hard Storage CRUD and overall system state."],
        ["Soft Storage", "A volatile, in-memory temporary store managed by the Validator for active checkout sessions."],
        ["Hard Storage", "The persistent local relational database managed by the Processor."],
        ["Cloud Storage", "The remote backup database that receives batched events from the Sync Queue Worker every 30 seconds."],
        ["WAL", "Write-Ahead Log — a disk-backed journal ensuring crash recovery for the Processor."],
        ["Auth Node", "The PIMS authentication and authorisation service controlling role-based access."],
        ["Sync Queue", "Background worker that reads unsynced events and pushes them to Cloud Storage."],
        ["Race Condition", "A system state where two or more concurrent requests compete for the same last digital inventory unit."],
        ["Sub-500 ms", "The maximum acceptable end-to-end latency target for all interactive operations."],
        ["FastAPI", "A lightweight, asynchronous Python web framework used for the PIMS backend."],
        ["CRUD", "Create, Read, Update, Delete — the four standard database operations."],
        ["SRS", "Software Requirements Specification — this document."],
        ["WAL Disk", "The physical or logical storage medium holding the Write-Ahead Log journal."],
      ].map(([term, def], i) =>
        new TableRow({
          children: [
            dataCell(term, 2200, i % 2 === 0 ? GREEN_LIGHT : WHITE, true),
            dataCell(def, 7160, i % 2 === 0 ? GREEN_LIGHT : WHITE),
          ],
        })
      ),
    ],
  }),

  spacer(),
  h2("1.4 References", "s14"),
  bullet("Pharm IMS Architecture Document v0.1 (internal, provided by client)"),
  bullet("Pharm IMS System Flowchart — draw.io file (Pharm_IMS.drawio, provided by client)"),
  bullet("FastAPI Official Documentation — https://fastapi.tiangolo.com"),
  bullet("SQLite WAL Mode Documentation — https://www.sqlite.org/wal.html"),
  bullet("ISO/IEC/IEEE 29148:2018 — Systems and Software Engineering: Requirements Engineering"),

  h2("1.5 Document Conventions", "s15"),
  body("This document follows the conventions below:"),
  bullet("Section headings are numbered hierarchically (1, 1.1, 1.1.1)."),
  bullet("Functional requirements are written in Gherkin (Given / When / Then) syntax in Section 5."),
  bullet("Non-functional requirements are expressed as measurable constraints in Section 6."),
  bullet("All latency figures are expressed in milliseconds (ms) at the 95th percentile unless otherwise stated."),
  bullet("The word SHALL denotes a mandatory requirement; SHOULD denotes a recommendation; MAY denotes an option."),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════
  // 2. OVERALL DESCRIPTION
  // ══════════════════════════════════════════════════════════════
  h1("2. Overall Description", "overall"),

  h2("2.1 Product Perspective", "s21"),
  body("PIMS is a standalone edge-computing application deployed entirely within the pharmacy's local network. It is not a module of a larger system. The system interfaces with:"),
  bullet("Cashier terminals (up to 5) that send deduction signals over the local network."),
  bullet("Inventory management devices (handheld or desktop) used by store staff to add, adjust, or query stock."),
  bullet("An onsite admin device (desktop or tablet) providing the owner's dashboard view."),
  bullet("A remote Cloud Storage endpoint for asynchronous backup and multi-site visibility."),
  body("The diagram below summarises the product context as extracted from the provided system flowchart. Key components are the Cashier Terminals, Validator, Processor, Soft Storage, Hard Storage, WAL Disk, Sync Queue, Auth Node, Inventory Management Devices, and Cloud Storage."),

  h2("2.2 Product Functions (Summary)", "s22"),
  body("At a high level, PIMS performs the following functions:"),
  numbered("Real-time inventory deduction processing — cashiers submit deduction requests; the Validator verifies stock and commits via the Processor."),
  numbered("Race-condition arbitration — when multiple cashiers request the last unit of an item simultaneously, the Validator approves exactly one request and rejects the rest."),
  numbered("Inventory management — authorised inventory managers create, read, update, and delete stock records via dedicated management devices."),
  numbered("Crash recovery — the WAL Disk captures every intent before execution, enabling the Processor to roll back or resume on restart."),
  numbered("Cloud synchronisation — the Sync Queue Worker batches unsynced local events and pushes them to Cloud Storage every 30 seconds."),
  numbered("Role-based access control — the Auth Node enforces permissions across all system actors."),
  numbered("Admin dashboard — the System Admin monitors live inventory state via an onsite or mobile device."),

  h2("2.3 User Classes and Characteristics (Actors)", "s23"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2000, 2600, 4760],
    rows: [
      new TableRow({ children: [headerCell("Actor", 2000), headerCell("Access Device", 2600), headerCell("Characteristics & Permissions", 4760)] }),
      ...[
        ["Cashier (×1–5)", "Cashier Terminal (fixed)", "Initiates inventory deduction requests. Read-only access to product availability. No ability to create or delete records. Low technical sophistication assumed."],
        ["Inventory Manager (×1+)", "Inventory Management Device (mobile/desktop)", "Creates new stock entries, reads current levels, triggers stock adjustments (upward updates). Cannot delete records directly; escalates to System Admin."],
        ["System Admin / Store Owner", "Onsite Device + Mobile Device", "Full read access to all inventory data and system state. Approves record deletions. Views admin dashboard. Receives system state reports. Has override authority."],
        ["System (Automated)", "Internal — Sync Queue Worker", "Non-human actor. Reads unsynced events from the Processor and writes to Cloud Storage on a 30-second schedule. No UI interaction."],
      ].map(([actor, device, chars], i) =>
        new TableRow({
          children: [
            dataCell(actor, 2000, i % 2 === 0 ? GREEN_LIGHT : WHITE, true),
            dataCell(device, 2600, i % 2 === 0 ? GREEN_LIGHT : WHITE),
            dataCell(chars, 4760, i % 2 === 0 ? GREEN_LIGHT : WHITE),
          ],
        })
      ),
    ],
  }),

  spacer(),
  h2("2.4 Operating Environment", "s24"),
  bullet("Deployment model: Edge computing — all processing occurs on-premises on a local server or high-spec workstation."),
  bullet("Network: Local area network (LAN) for all terminal-to-backend communication. Internet connectivity required only for cloud synchronisation."),
  bullet("Backend runtime: Python 3.10+ with FastAPI (asynchronous ASGI server)."),
  bullet("Local database: SQLite in WAL mode (or equivalent embedded RDBMS) for Hard Storage."),
  bullet("Temporary storage: In-memory cache (e.g., Redis or in-process dictionary) for Soft Storage."),
  bullet("Operating system: Linux-based server (Ubuntu 22.04 LTS recommended); Windows Server supported with equivalent configuration."),
  bullet("Client terminals: Any modern web browser or lightweight Electron/PWA application."),
  bullet("Cloud endpoint: REST-compatible cloud database (e.g., Supabase, Firebase, or custom hosted PostgreSQL) reachable over HTTPS."),

  h2("2.5 Design and Implementation Constraints", "s25"),
  bullet("Latency: All end-to-end interactive operations MUST complete within 500 ms at the 95th percentile under normal load (up to 5 concurrent cashier requests)."),
  bullet("Asynchronous I/O: The backend SHALL use non-blocking I/O (FastAPI + asyncio) to prevent the Sync Queue from blocking the main request thread."),
  bullet("WAL-first writes: The Processor SHALL write to the WAL Disk before committing any mutation to Hard Storage."),
  bullet("Single-approval guarantee: When N > 1 simultaneous requests arrive for the last unit of an item, exactly one SHALL be approved and N−1 SHALL be rejected with an appropriate error code."),
  bullet("No patient data: PIMS SHALL NOT store, process, or transmit any patient personally identifiable information (PII) or medical records."),
  bullet("Offline resilience: PIMS SHALL remain fully operational for all local functions even when the internet connection to Cloud Storage is unavailable."),

  h2("2.6 Assumptions and Dependencies", "s26"),
  body("The following assumptions have been made in deriving these requirements:"),
  bullet("The pharmacy operates a single physical location. Multi-branch scenarios are out of scope for version 1.0."),
  bullet("The local server hosting the Processor and WAL Disk is on an uninterruptible power supply (UPS) to minimise ungraceful shutdowns."),
  bullet("Cashier terminals are always on the same LAN as the backend server; sub-10 ms internal network latency is assumed."),
  bullet("Inventory managers have received basic training on stock entry procedures before using the system."),
  bullet("The cloud storage provider offers 99.5% monthly uptime; PIMS tolerates extended offline periods by buffering in Hard Storage."),
  bullet("Product barcodes are unique and managed outside PIMS (e.g., via a supplier catalogue); PIMS treats barcode as a primary key without validation."),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════
  // 3. SYSTEM ARCHITECTURE
  // ══════════════════════════════════════════════════════════════
  h1("3. System Architecture", "arch"),

  h2("3.1 High-Level Components", "s31"),
  body("PIMS is composed of the following eight logical components, as captured in the system flowchart:"),

  h3("3.1.1 Cashier Terminals (×1–5)"),
  body("Frontend interfaces (web or native) operated by cashiers. Each terminal communicates exclusively with the Validator via authenticated HTTP requests over the LAN. Terminals have no direct access to Hard Storage or Cloud Storage."),

  h3("3.1.2 Validator (The Traffic Warden)"),
  body("A FastAPI service acting as the first and only entry point for deduction requests. Responsibilities:"),
  bullet("Queries the Processor to confirm product existence and available quantity before committing."),
  bullet("Creates, reads, and deletes Soft Storage entries to hold product and cashier information during an active checkout session."),
  bullet("Implements a mutex-style lock to ensure that when multiple simultaneous requests arrive for the last digital item, exactly one is approved and all others receive a 409 Conflict response."),
  bullet("Reports system state observations back to the Processor."),
  bullet("Forwards confirmed deduction payloads to the Processor for hard commit."),

  h3("3.1.3 Processor"),
  body("The central engine of PIMS. Responsibilities:"),
  bullet("Manages Hard Storage with full CRUD authority; responds to Validator read queries and commits Validator-approved deductions."),
  bullet("Accepts Create, Read, and upward-Update operations from Inventory Management Devices (direct deletions from manager devices are not permitted without admin approval)."),
  bullet("Maintains the authoritative system state and distributes state updates to requesting components."),
  bullet("Writes every intended action to the WAL Disk before execution."),
  bullet("Exposes an endpoint consumed by the Sync Queue Worker to retrieve unsynced event records."),

  h3("3.1.4 Soft Storage (Temporary)"),
  body("A volatile in-memory store managed by the Validator. It holds product metadata and cashier session context for the duration of an active checkout. Records are purged on session commit, timeout, or system reset. Soft Storage is not persisted to disk and is not replicated to cloud."),

  h3("3.1.5 Hard Storage (Persistent)"),
  body("The local relational database managed exclusively by the Processor. It is the immutable local source of truth. All completed transactions and inventory mutations are permanently recorded here. Operates in WAL mode to support concurrent reads and serialised writes."),

  h3("3.1.6 WAL Disk"),
  body("A disk-backed Write-Ahead Log connected directly to the Processor. Every intended database mutation is first appended to the WAL before being applied to Hard Storage. On crash recovery, the Processor reads the WAL to determine whether to roll back incomplete transactions or replay and commit interrupted ones, guaranteeing zero data corruption."),

  h3("3.1.7 Sync Queue Worker"),
  body("A background asyncio task (not a separate process) that runs on a 30-second timer. It polls the Processor for events flagged as unsynced, serialises them, and pushes them over HTTPS to Cloud Storage. On failure, it retries with exponential back-off without blocking the main request thread."),

  h3("3.1.8 Auth Node"),
  body("A dedicated authentication and authorisation service (or middleware layer) that verifies identity and enforces role-based permissions across all system boundaries. Every inter-component API call carries a signed token validated by the Auth Node. The Auth Node also gates access to Onsite Devices, Mobile Devices, and the admin dashboard."),

  h3("3.1.9 Cloud Storage (Backup)"),
  body("A remote database endpoint that receives batched synchronisation payloads from the Sync Queue Worker. It stores product snapshots, system state logs, and anonymised user interaction data. It is the basis for the admin's global inventory view and remote reporting."),

  h3("3.1.10 Inventory Management Devices"),
  body("Handheld or desktop devices operated by Inventory Managers. They communicate with the Processor via the Auth Node to create new stock records, read current levels, and submit upward stock adjustments. They report system state observations to the Processor."),

  h3("3.1.11 Onsite Device & Mobile Device"),
  body("Admin-facing devices (desktop and mobile) used by the System Admin to view the real-time dashboard, approve deletions, and receive system state alerts. Both are mediated by the Auth Node. The Admin's onsite device also communicates with the Processor directly for privileged operations."),

  h2("3.2 Integration Boundaries", "s32"),
  body("The table below summarises the direction of data flow between components:"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 2800, 3760],
    rows: [
      new TableRow({ children: [headerCell("From", 2800), headerCell("To", 2800), headerCell("Protocol / Notes", 3760)] }),
      ...[
        ["Cashier Terminal (1–5)", "Validator", "HTTP POST over LAN; Auth token required."],
        ["Validator", "Processor", "Internal function call or local HTTP; bidirectional (query + commit)."],
        ["Validator", "Soft Storage", "In-memory read/write; no network hop."],
        ["Soft Storage", "Validator", "State reporting callback."],
        ["Processor", "Hard Storage", "Direct DB driver; serialised writes via WAL."],
        ["Hard Storage", "Processor", "Query responses; state reporting."],
        ["Processor", "WAL Disk", "File I/O; write-before-commit pattern."],
        ["WAL Disk", "Processor", "Recovery read on system restart."],
        ["Processor", "Sync Queue Worker", "Internal event queue; unsynced records polled every 30 s."],
        ["Sync Queue Worker", "Cloud Storage", "HTTPS REST POST; batch payload; retry on failure."],
        ["Inventory Mgmt Device", "Processor", "HTTP via Auth Node; bidirectional (C, R, upward-U)."],
        ["Auth Node", "Onsite / Mobile Device", "Token issuance and validation; bidirectional."],
        ["Auth Node", "Cloud Storage", "User credential sync for admin access."],
        ["Onsite Device", "Processor", "HTTP via Auth Node; read + privileged operations."],
      ].map(([from, to, notes], i) =>
        new TableRow({
          children: [
            dataCell(from, 2800, i % 2 === 0 ? GREEN_LIGHT : WHITE, true),
            dataCell(to, 2800, i % 2 === 0 ? GREEN_LIGHT : WHITE, true),
            dataCell(notes, 3760, i % 2 === 0 ? GREEN_LIGHT : WHITE),
          ],
        })
      ),
    ],
  }),

  spacer(),
  h2("3.3 Search Strategy", "s33"),
  body("When a cashier submits a deduction request, the system executes the following lookup strategy to minimise latency:"),
  numbered("Soft Storage check (in-memory, ~1 ms) — the Validator checks whether the item already has an active session lock. If a lock exists and is owned by another cashier, the request is queued or rejected."),
  numbered("Processor product existence query (~5–20 ms) — the Validator queries the Processor, which reads the item record from Hard Storage (SQLite indexed by product_id)."),
  numbered("Quantity gate — if quantity_on_hand > 0, the Validator creates a Soft Storage reservation and signals the Processor to commit the deduction. If quantity_on_hand == 0, a 404 Not Found is returned."),
  numbered("Last-item race gate — if quantity_on_hand == 1 and multiple simultaneous requests arrive, the Validator's mutex approves only the first confirmed reservation; all subsequent requests receive a 409 Conflict."),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════
  // 4. DATA MODEL
  // ══════════════════════════════════════════════════════════════
  h1("4. Data Model", "data"),

  h2("4.1 Entity Overview", "s41"),
  body("PIMS manages the following primary entities stored in Hard Storage:"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2200, 7160],
    rows: [
      new TableRow({ children: [headerCell("Entity", 2200), headerCell("Description", 7160)] }),
      ...[
        ["Product", "A distinct pharmaceutical or retail item tracked in inventory. Core unit of the IMS."],
        ["Transaction", "An immutable record of each inventory mutation (deduction or addition), with source actor and timestamp."],
        ["Session", "A transient Soft Storage record representing an active cashier checkout, holding a product reservation."],
        ["User", "An authenticated system user (Cashier, Inventory Manager, or System Admin) with an assigned role."],
        ["SyncEvent", "A Hard Storage record of each data mutation pending cloud synchronisation, consumed by the Sync Queue Worker."],
        ["WALEntry", "An entry in the Write-Ahead Log describing an intended mutation before it is applied to Hard Storage."],
      ].map(([e, d], i) =>
        new TableRow({
          children: [
            dataCell(e, 2200, i % 2 === 0 ? GREEN_LIGHT : WHITE, true),
            dataCell(d, 7160, i % 2 === 0 ? GREEN_LIGHT : WHITE),
          ],
        })
      ),
    ],
  }),

  spacer(),
  h2("4.2 Key Attributes and Relationships", "s42"),
  h3("Product"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 1800, 5160],
    rows: [
      new TableRow({ children: [headerCell("Attribute", 2400), headerCell("Type", 1800), headerCell("Description", 5160)] }),
      ...[
        ["product_id", "UUID / VARCHAR PK", "Globally unique identifier, typically barcode."],
        ["name", "VARCHAR(255)", "Display name of the product."],
        ["category", "VARCHAR(100)", "Product category (e.g., analgesic, antibiotic)."],
        ["quantity_on_hand", "INTEGER ≥ 0", "Current stock count. Never negative."],
        ["reorder_threshold", "INTEGER", "Admin-defined low-stock alert level."],
        ["unit_price", "DECIMAL(10,2)", "Reference price (informational; not transactional)."],
        ["last_updated", "TIMESTAMP", "UTC timestamp of the most recent mutation."],
        ["synced", "BOOLEAN", "False until the Sync Queue Worker confirms cloud upload."],
      ].map(([a, t, d], i) =>
        new TableRow({
          children: [
            dataCell(a, 2400, i % 2 === 0 ? GREEN_LIGHT : WHITE, true),
            dataCell(t, 1800, i % 2 === 0 ? GREEN_LIGHT : WHITE),
            dataCell(d, 5160, i % 2 === 0 ? GREEN_LIGHT : WHITE),
          ],
        })
      ),
    ],
  }),

  spacer(),
  h3("Transaction"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 1800, 5160],
    rows: [
      new TableRow({ children: [headerCell("Attribute", 2400), headerCell("Type", 1800), headerCell("Description", 5160)] }),
      ...[
        ["transaction_id", "UUID PK", "Unique transaction identifier."],
        ["product_id", "UUID FK → Product", "The product affected."],
        ["actor_id", "UUID FK → User", "The user or system actor that triggered the mutation."],
        ["mutation_type", "ENUM", "DEDUCTION, ADDITION, ADJUSTMENT, DELETION."],
        ["quantity_delta", "INTEGER", "Signed quantity change (negative for deductions)."],
        ["timestamp", "TIMESTAMP", "UTC time of commit."],
        ["synced", "BOOLEAN", "Cloud sync status flag."],
      ].map(([a, t, d], i) =>
        new TableRow({
          children: [
            dataCell(a, 2400, i % 2 === 0 ? GREEN_LIGHT : WHITE, true),
            dataCell(t, 1800, i % 2 === 0 ? GREEN_LIGHT : WHITE),
            dataCell(d, 5160, i % 2 === 0 ? GREEN_LIGHT : WHITE),
          ],
        })
      ),
    ],
  }),

  spacer(),
  h2("4.3 Data Integrity Rules", "s43"),
  bullet("quantity_on_hand SHALL never be set below 0. The Processor SHALL reject any mutation that would produce a negative quantity."),
  bullet("Every Transaction record is immutable once committed. Corrections are recorded as new ADJUSTMENT transactions."),
  bullet("A WALEntry MUST be written and flushed to disk before the corresponding Hard Storage mutation begins."),
  bullet("A SyncEvent record is deleted from Hard Storage only after the Sync Queue Worker receives a 2xx HTTP response from Cloud Storage."),
  bullet("Session records in Soft Storage expire after 120 seconds of inactivity, releasing any held quantity reservation."),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════
  // 5. FUNCTIONAL REQUIREMENTS (GHERKIN)
  // ══════════════════════════════════════════════════════════════
  h1("5. Functional Requirements (Gherkin)", "func"),
  body("All functional requirements below are written in Gherkin BDD syntax. Each scenario represents a discrete, testable behaviour."),

  h2("5.1 Accounts & Authentication", "s51"),
  gherkinBlock([
    "Feature: User Authentication",
    "",
    "  Scenario: Cashier logs in with valid credentials",
    "    Given a registered Cashier user with role CASHIER",
    "    When the cashier submits valid username and password to the Auth Node",
    "    Then the Auth Node issues a signed JWT token",
    "    And the token expires after 8 hours",
    "",
    "  Scenario: Login attempt with invalid credentials",
    "    Given any user submits incorrect credentials",
    "    When the Auth Node validates the request",
    "    Then the Auth Node returns HTTP 401 Unauthorized",
    "    And no token is issued",
    "",
    "  Scenario: Expired token is used",
    "    Given a cashier holds an expired JWT token",
    "    When the cashier submits a deduction request",
    "    Then the system returns HTTP 401 Unauthorized",
    "    And the cashier is prompted to re-authenticate",
  ]),

  h2("5.2 Inventory Management", "s52"),
  gherkinBlock([
    "Feature: Stock Record Management",
    "",
    "  Scenario: Inventory Manager adds a new product",
    "    Given an authenticated Inventory Manager",
    "    When the manager submits a new product payload (name, barcode, quantity, category)",
    "    Then the Processor creates a new Product record in Hard Storage",
    "    And a WALEntry is written before the insert",
    "    And a SyncEvent is queued for cloud upload",
    "",
    "  Scenario: Inventory Manager increases stock quantity",
    "    Given an authenticated Inventory Manager",
    "    And a Product with product_id P001 exists with quantity_on_hand of 10",
    "    When the manager submits an ADDITION of 50 units for P001",
    "    Then the Processor updates quantity_on_hand to 60",
    "    And a Transaction record of type ADDITION is created",
    "",
    "  Scenario: Inventory Manager attempts to delete a product",
    "    Given an authenticated Inventory Manager",
    "    When the manager submits a deletion request for product P001",
    "    Then the system returns HTTP 403 Forbidden",
    "    And a deletion request notification is sent to the System Admin for approval",
  ]),

  h2("5.3 Cashier Deduction Processing", "s53"),
  gherkinBlock([
    "Feature: Inventory Deduction via Cashier Terminal",
    "",
    "  Scenario: Successful single-item deduction",
    "    Given an authenticated Cashier at Terminal 1",
    "    And Product P002 has quantity_on_hand of 5",
    "    When the cashier submits a deduction request for 1 unit of P002",
    "    Then the Validator confirms P002 exists and quantity > 0",
    "    And the Validator creates a Soft Storage session for Terminal 1",
    "    And the Processor decrements quantity_on_hand by 1 to 4",
    "    And a Transaction record of type DEDUCTION is created",
    "    And the response is returned within 500 ms",
    "",
    "  Scenario: Deduction request for out-of-stock item",
    "    Given Product P003 has quantity_on_hand of 0",
    "    When a cashier submits a deduction request for P003",
    "    Then the Validator returns HTTP 404 Not Found",
    "    And no Soft Storage session is created",
    "    And Hard Storage is not modified",
  ]),

  h2("5.4 Last-Item Race Condition Handling", "s54"),
  gherkinBlock([
    "Feature: Concurrent Last-Item Request Arbitration",
    "",
    "  Scenario: Two cashiers simultaneously request the last unit",
    "    Given Product P004 has quantity_on_hand of 1",
    "    When Cashier Terminal 2 and Cashier Terminal 3 simultaneously submit deduction requests",
    "    Then the Validator approves exactly one request (first to acquire mutex lock)",
    "    And returns HTTP 200 OK to the approved terminal",
    "    And returns HTTP 409 Conflict to the rejected terminal",
    "    And quantity_on_hand is decremented to 0 exactly once",
    "",
    "  Scenario: Five cashiers request last item simultaneously",
    "    Given Product P005 has quantity_on_hand of 1",
    "    When all five Cashier Terminals simultaneously submit deduction requests",
    "    Then exactly 1 request is approved",
    "    And exactly 4 requests receive HTTP 409 Conflict",
    "    And quantity_on_hand is 0 after all requests are processed",
  ]),

  h2("5.5 Crash Recovery", "s55"),
  gherkinBlock([
    "Feature: Write-Ahead Log Crash Recovery",
    "",
    "  Scenario: System restarts after crash mid-transaction",
    "    Given the Processor was in the middle of committing a deduction for P006",
    "    And a WALEntry exists recording the intended mutation",
    "    And Hard Storage was not yet updated",
    "    When the system restarts",
    "    Then the Processor reads the WAL on startup",
    "    And determines the transaction is incomplete",
    "    And rolls back the WALEntry",
    "    And Hard Storage remains in its pre-crash state",
    "",
    "  Scenario: System restarts after crash post-commit",
    "    Given the Processor had fully committed a deduction for P007",
    "    And the WALEntry is marked as complete",
    "    When the system restarts",
    "    Then the Processor reads the WAL",
    "    And determines the transaction is complete",
    "    And no rollback or replay is needed",
  ]),

  h2("5.6 Cloud Synchronisation", "s56"),
  gherkinBlock([
    "Feature: Sync Queue Cloud Upload",
    "",
    "  Scenario: Successful batch sync",
    "    Given there are 15 unsynced SyncEvent records in Hard Storage",
    "    When the Sync Queue Worker timer fires (every 30 seconds)",
    "    Then the worker reads all unsynced records",
    "    And posts them as a batch to Cloud Storage via HTTPS",
    "    And on receiving HTTP 200, marks all records as synced",
    "",
    "  Scenario: Cloud Storage is unreachable",
    "    Given the internet connection is unavailable",
    "    When the Sync Queue Worker attempts to push events",
    "    Then the worker logs the failure",
    "    And retries with exponential back-off (max 5 retries)",
    "    And does not block any local PIMS operations",
    "    And all unsynced records remain in Hard Storage until successfully uploaded",
  ]),

  h2("5.7 Admin Dashboard & Reporting", "s57"),
  gherkinBlock([
    "Feature: System Admin Dashboard",
    "",
    "  Scenario: Admin views live inventory summary",
    "    Given an authenticated System Admin on the Onsite Device",
    "    When the admin opens the inventory dashboard",
    "    Then the dashboard displays all products with current quantity_on_hand",
    "    And highlights products below reorder_threshold in amber",
    "    And highlights out-of-stock products in red",
    "",
    "  Scenario: Admin approves an inventory deletion",
    "    Given a pending deletion request for Product P008 from an Inventory Manager",
    "    When the System Admin approves the request",
    "    Then the Processor marks P008 as deleted (soft delete)",
    "    And a Transaction of type DELETION is recorded",
    "    And a SyncEvent is queued for cloud upload",
  ]),

  h2("5.8 Notifications", "s58"),
  gherkinBlock([
    "Feature: System Alerts and Notifications",
    "",
    "  Scenario: Low stock alert",
    "    Given Product P009 has quantity_on_hand equal to reorder_threshold",
    "    When the Processor commits a deduction bringing quantity below threshold",
    "    Then the system dispatches a low-stock alert to the System Admin",
    "",
    "  Scenario: Out-of-stock notification",
    "    Given Product P010 has quantity_on_hand of 1",
    "    When a deduction reduces quantity_on_hand to 0",
    "    Then the system dispatches an out-of-stock alert to the System Admin",
  ]),

  h2("5.9 Role-Based Access Control", "s59"),
  gherkinBlock([
    "Feature: Role Enforcement",
    "",
    "  Scenario: Cashier attempts to access inventory management endpoint",
    "    Given a user with role CASHIER",
    "    When the user submits a POST request to /inventory/products",
    "    Then the Auth Node returns HTTP 403 Forbidden",
    "",
    "  Scenario: Inventory Manager attempts admin-only delete approval",
    "    Given a user with role INVENTORY_MANAGER",
    "    When the user submits a DELETE approval request",
    "    Then the Auth Node returns HTTP 403 Forbidden",
  ]),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════
  // 6. NON-FUNCTIONAL REQUIREMENTS
  // ══════════════════════════════════════════════════════════════
  h1("6. Non-Functional Requirements", "nfr"),

  h2("6.1 Performance", "s61"),
  bullet("All interactive cashier deduction responses SHALL be returned within 500 ms (95th percentile) under a load of 5 concurrent terminals."),
  bullet("Dashboard read queries SHALL return within 300 ms for inventories of up to 10,000 product SKUs."),
  bullet("The Sync Queue Worker SHALL not add more than 5 ms of latency to any interactive transaction."),
  bullet("System startup (from cold boot to first request acceptance) SHALL complete within 10 seconds."),

  h2("6.2 Security & Privacy", "s62"),
  bullet("All inter-component API calls SHALL use signed JWT tokens validated by the Auth Node."),
  bullet("All cloud synchronisation payloads SHALL be transmitted over HTTPS (TLS 1.2 minimum)."),
  bullet("Passwords SHALL be stored as bcrypt hashes (cost factor ≥ 12) in Hard Storage."),
  bullet("PIMS SHALL NOT store patient names, patient IDs, prescription numbers, or any medical records."),
  bullet("Failed login attempts SHALL be rate-limited to 5 attempts per minute per IP address."),
  bullet("WAL Disk files SHALL be readable only by the PIMS process user account (file permissions 600)."),

  h2("6.3 Accessibility & Usability", "s63"),
  bullet("Cashier terminal UI SHALL be operable with a single hand and a standard barcode scanner, requiring no keyboard input for standard deduction workflows."),
  bullet("Error messages SHALL be human-readable and include a suggested remediation action."),
  bullet("The admin dashboard SHALL be responsive and usable on screens from 5 inches (mobile) to 27 inches (desktop)."),

  h2("6.4 Reliability & Availability", "s64"),
  bullet("PIMS SHALL achieve 99.9% local uptime (excluding planned maintenance), equating to no more than 8.7 hours of downtime per year."),
  bullet("The WAL-based crash recovery SHALL guarantee zero data loss for any transaction that received a 200 OK response before the crash."),
  bullet("Soft Storage sessions that become orphaned (cashier terminal disconnects) SHALL be automatically cleaned up within 120 seconds."),
  bullet("The Sync Queue SHALL buffer up to 7 days of unsynced events in Hard Storage without data loss in the event of prolonged cloud outage."),

  h2("6.5 Scalability & Maintainability", "s65"),
  bullet("The Validator SHALL support horizontal scaling to a second instance without architectural changes, using a shared Soft Storage backend (e.g., Redis)."),
  bullet("All components SHALL log structured JSON to a central log file, rotating daily, retained for 30 days."),
  bullet("The codebase SHALL maintain a minimum 80% unit test coverage across all Processor and Validator modules."),
  bullet("Database schema migrations SHALL be managed via a versioned migration tool (e.g., Alembic) to ensure reproducible deployments."),

  h2("6.6 Localization & Time", "s66"),
  bullet("All timestamps stored in Hard Storage and Cloud Storage SHALL be in UTC."),
  bullet("The admin dashboard MAY display timestamps converted to the local pharmacy timezone, configurable per deployment."),
  bullet("Currency values SHALL be stored as INTEGER cents to avoid floating-point rounding errors."),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════
  // 7. EXTERNAL INTERFACE REQUIREMENTS
  // ══════════════════════════════════════════════════════════════
  h1("7. External Interface Requirements", "eir"),

  h2("7.1 User Interfaces", "s71"),
  bullet("Cashier Terminal UI: A minimal web-based or Electron application presenting a single product search/scan input and a confirm-deduction button. Displays product name, quantity available, and transaction result."),
  bullet("Inventory Manager UI: A form-based web application supporting product creation, stock addition, and current level lookup."),
  bullet("Admin Dashboard: A read-heavy web application displaying live inventory table, low-stock alerts, sync status indicator, and system health metrics."),
  bullet("Mobile Admin View: A responsive single-page application (PWA) exposing dashboard and notification functions for the System Admin on mobile."),

  h2("7.2 Software Interfaces", "s72"),
  bullet("Cloud Storage API: PIMS SHALL communicate with the cloud backend via a RESTful JSON API over HTTPS. Authentication SHALL use API key or OAuth 2.0 service account credentials."),
  bullet("Auth Node Integration: All frontend applications and backend-to-backend calls SHALL include a Bearer token in the HTTP Authorization header."),
  bullet("Barcode Scanner: Cashier terminals SHALL accept USB or Bluetooth HID-class barcode scanner input, treated as keyboard input in the scan field."),
  bullet("WAL File System Interface: The Processor SHALL use synchronous file I/O (fsync) for WAL writes to ensure durability."),

  h2("7.3 API (FastAPI) Conventions", "s73"),
  body("All PIMS REST endpoints SHALL follow these conventions:"),
  bullet("Base URL pattern: /api/v1/{resource}"),
  bullet("Standard HTTP methods: GET (read), POST (create / deduction), PUT (update), DELETE (admin-only soft delete)."),
  bullet("Response envelope: { \"status\": \"ok\" | \"error\", \"data\": {...}, \"message\": \"...\", \"timestamp\": \"ISO-8601 UTC\" }"),
  bullet("Error codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict (last-item race), 500 Internal Server Error."),
  bullet("All endpoints SHALL return a response within 500 ms or issue an async task receipt with a polling URL."),
  bullet("API versioning is via URL path (/v1/); breaking changes increment the version."),

  h2("7.4 Hardware Interfaces", "s74"),
  bullet("Local Server: Minimum Intel Core i5 (or equivalent) with 8 GB RAM, 256 GB SSD, and a gigabit LAN port."),
  bullet("Cashier Terminals: Any device capable of running a modern web browser (Chrome 90+, Firefox 88+) on the LAN."),
  bullet("WAL Disk: The WAL file SHALL reside on the local SSD (not a network share) to guarantee fsync latency below 10 ms."),
  bullet("Inventory Management Devices: Android 10+ or iOS 14+ smartphones/tablets, or any LAN-connected desktop."),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════
  // 8. APPENDICES
  // ══════════════════════════════════════════════════════════════
  h1("8. Appendices", "appendices"),

  h2("8.1 Actor ↔ Capability Matrix", "s81"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2200, 1260, 1260, 1260, 1260, 1260, 1060],
    rows: [
      new TableRow({
        children: [
          headerCell("Capability", 2200),
          headerCell("Cashier", 1260),
          headerCell("Inv. Manager", 1260),
          headerCell("System Admin", 1260),
          headerCell("Auth Node", 1260),
          headerCell("Sync Worker", 1260),
          headerCell("Cloud", 1060),
        ],
      }),
      ...[
        ["Submit deduction request",       "✓", "✗", "✗", "✗", "✗", "✗"],
        ["View product availability",       "✓", "✓", "✓", "✗", "✗", "✗"],
        ["Create product record",           "✗", "✓", "✓", "✗", "✗", "✗"],
        ["Add stock (upward update)",        "✗", "✓", "✓", "✗", "✗", "✗"],
        ["Approve deletion",                "✗", "✗", "✓", "✗", "✗", "✗"],
        ["View admin dashboard",            "✗", "✗", "✓", "✗", "✗", "✗"],
        ["Authenticate users",              "✗", "✗", "✗", "✓", "✗", "✗"],
        ["Issue/validate JWT",              "✗", "✗", "✗", "✓", "✗", "✗"],
        ["Sync to cloud",                   "✗", "✗", "✗", "✗", "✓", "✗"],
        ["Receive sync payload",            "✗", "✗", "✗", "✗", "✗", "✓"],
      ].map(([cap, ...cells], i) =>
        new TableRow({
          children: [
            dataCell(cap, 2200, i % 2 === 0 ? GREEN_LIGHT : WHITE, true),
            ...cells.map((c, j) =>
              new TableCell({
                borders: thinBorders("C8E6D0"),
                width: { size: [1260,1260,1260,1260,1260,1060][j], type: WidthType.DXA },
                shading: { fill: i % 2 === 0 ? GREEN_LIGHT : WHITE, type: ShadingType.CLEAR },
                margins: { top: 70, bottom: 70, left: 140, right: 140 },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({
                    text: c,
                    size: 18,
                    font: "Arial",
                    color: c === "✓" ? GREEN : "CC3333",
                    bold: true,
                  })],
                })],
              })
            ),
          ],
        })
      ),
    ],
  }),

  spacer(),
  h2("8.2 Glossary", "s82"),
  body("See Section 1.3 (Definitions, Acronyms, and Abbreviations) for the primary glossary. Additional terms:"),
  bullet("Edge Computing: A computing paradigm where processing occurs close to the data source (on-premises), reducing latency and cloud dependency."),
  bullet("Mutex: A mutual exclusion lock ensuring that only one concurrent process can access a shared resource at a time."),
  bullet("Exponential Back-off: A retry strategy where successive retry delays increase exponentially (e.g., 1 s, 2 s, 4 s, 8 s) to reduce server load."),
  bullet("Soft Delete: Marking a record as deleted in the database without physically removing the row, preserving audit history."),
  bullet("Idempotent: An operation that produces the same result regardless of how many times it is executed."),

  h2("8.3 Traceability Matrix", "s83"),
  body("The following matrix maps functional requirements to their corresponding system components:"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1200, 4160, 4000],
    rows: [
      new TableRow({ children: [headerCell("Req. ID", 1200), headerCell("Requirement Summary", 4160), headerCell("Primary Component(s)", 4000)] }),
      ...[
        ["FR-01", "Cashier submits deduction; Validator approves or rejects",              "Cashier Terminal, Validator, Processor, Hard Storage"],
        ["FR-02", "Last-item race condition — exactly one approval",                        "Validator (mutex), Soft Storage"],
        ["FR-03", "Inventory Manager creates/updates product records",                       "Inventory Management Device, Processor, Hard Storage"],
        ["FR-04", "System Admin approves deletions",                                         "Admin Device, Processor, Auth Node"],
        ["FR-05", "WAL crash recovery — roll back or resume on restart",                    "Processor, WAL Disk, Hard Storage"],
        ["FR-06", "Sync Queue pushes events to Cloud Storage every 30 s",                  "Sync Queue Worker, Cloud Storage"],
        ["FR-07", "Auth Node issues and validates JWT tokens",                               "Auth Node"],
        ["FR-08", "Admin dashboard shows live inventory and alerts",                         "Admin Device, Processor, Hard Storage"],
        ["FR-09", "Low-stock and out-of-stock notifications dispatched to admin",            "Processor, Auth Node, Admin Device"],
        ["NFR-01", "Sub-500 ms interactive latency at 95th percentile",                    "Validator, Processor (FastAPI + SQLite WAL)"],
        ["NFR-02", "99.9% local system availability",                                       "All local components, WAL Disk, UPS"],
        ["NFR-03", "Cloud outage tolerance — 7-day local buffer",                           "Sync Queue Worker, Hard Storage"],
      ].map(([id, summary, components], i) =>
        new TableRow({
          children: [
            dataCell(id, 1200, i % 2 === 0 ? GREEN_LIGHT : WHITE, true),
            dataCell(summary, 4160, i % 2 === 0 ? GREEN_LIGHT : WHITE),
            dataCell(components, 4000, i % 2 === 0 ? GREEN_LIGHT : WHITE),
          ],
        })
      ),
    ],
  }),

  spacer(),
  h2("8.4 Future Scope (YAGNI)", "s84"),
  body("The following items are explicitly deferred from version 1.0 in adherence to the You Aren't Gonna Need It (YAGNI) principle:"),
  bullet("Multi-branch inventory consolidation and inter-store transfers."),
  bullet("Automated purchase order generation to suppliers when stock falls below reorder threshold."),
  bullet("Patient prescription integration or drug interaction checking."),
  bullet("Point-of-sale payment processing or receipt printing."),
  bullet("Analytics and forecasting dashboards (demand prediction, seasonality)."),
  bullet("Barcode generation or label printing for new product entries."),
  bullet("Employee scheduling, HR, or payroll modules."),
  bullet("Native mobile applications (iOS/Android); version 1.0 uses a PWA/responsive web approach."),

  h2("8.5 Open Questions", "s85"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [600, 4560, 2600, 1600],
    rows: [
      new TableRow({ children: [headerCell("#", 600), headerCell("Question", 4560), headerCell("Owner", 2600), headerCell("Status", 1600)] }),
      ...[
        ["1", "What is the preferred cloud storage provider (Supabase, Firebase, custom PostgreSQL)? This affects the Sync Queue's serialisation format.", "Client / Architect", "Open"],
        ["2", "Should Soft Storage use an in-process dict (simpler, single-process only) or Redis (supports future horizontal scaling)?", "Architect", "Open"],
        ["3", "What is the exact session timeout for Soft Storage reservations (currently assumed 120 s)?", "Client", "Open"],
        ["4", "Are product deletions permanently soft-deleted or eventually hard-purged after an archival period?", "Client", "Open"],
        ["5", "Is biometric authentication (fingerprint) required for the mobile admin device, or is PIN/password sufficient?", "Client", "Open"],
        ["6", "Should the Sync Queue Worker run as a separate process or as an asyncio background task within the main FastAPI process?", "Architect", "Open"],
      ].map(([num, q, owner, status], i) =>
        new TableRow({
          children: [
            dataCell(num, 600, i % 2 === 0 ? GREEN_LIGHT : WHITE, true),
            dataCell(q, 4560, i % 2 === 0 ? GREEN_LIGHT : WHITE),
            dataCell(owner, 2600, i % 2 === 0 ? GREEN_LIGHT : WHITE),
            new TableCell({
              borders: thinBorders("C8E6D0"),
              width: { size: 1600, type: WidthType.DXA },
              shading: { fill: i % 2 === 0 ? GREEN_LIGHT : WHITE, type: ShadingType.CLEAR },
              margins: { top: 70, bottom: 70, left: 140, right: 140 },
              children: [new Paragraph({
                children: [new TextRun({
                  text: status,
                  size: 18,
                  font: "Arial",
                  color: status === "Open" ? "CC6600" : GREEN,
                  bold: true,
                })],
              })],
            }),
          ],
        })
      ),
    ],
  }),

  spacer(240),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "— End of Document —", size: 18, font: "Arial", color: GREY, italics: true })],
    spacing: { before: 400, after: 0 },
  }),
];

// ─── Assemble Document ────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: "Arial", size: 20, color: DARK } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: GREEN },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: ORANGE_MID },
        paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial", color: GREEN_MID },
        paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2 },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [
              ...pimsRuns(20),
              new TextRun({ text: "  |  Pharmacy Inventory Management System SRS", size: 18, font: "Arial", color: GREY }),
              new TextRun({ text: "\t", size: 18 }),
              new TextRun({ text: "v1.0", size: 18, font: "Arial", color: ORANGE_MID }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN, space: 1 } },
            spacing: { before: 0, after: 100 },
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "CONFIDENTIAL — PIMS Internal Document", size: 16, font: "Arial", color: GREY }),
              new TextRun({ text: "\t", size: 16 }),
              new TextRun({ text: "Page ", size: 16, font: "Arial", color: GREY }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: GREEN }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: ORANGE_MID, space: 1 } },
            spacing: { before: 80, after: 0 },
          }),
        ],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("./PIMS_SRS_v1.0.docx", buffer);
  console.log("Done.");
});