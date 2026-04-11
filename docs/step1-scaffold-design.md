# Step 1: Scaffold Tauri v2 Project — Engineering Design

**Status:** Ready to implement
**Reviewed:** CEO review (CLEAR) + Eng review (CLEAR)
**Branch:** main
**Estimated time:** 2-3 hours (first time with Tauri + Rust)

---

## What You're Building

A running Tauri v2 desktop app with:
- Custom macOS titlebar with real traffic lights
- One async IPC command (`get_app_version`) that reads from managed state
- Neo Spatial design tokens in CSS custom properties
- React ErrorBoundary + `safeInvoke()` for error visibility
- 4 Rust module stubs (identity, db, state, fs_commands)
- iroh API verification spike (proves P2P transport works)
- vitest setup with one component test
- justfile for common dev commands

## Sub-task Order

Do these in this exact order. Each builds on the previous.

```
1. Scaffold          bun create tauri-app
2. Verify            bun tauri dev (default template works)
3. Configure         tauri.conf.json (window, titlebar, identifier)
4. Titlebar          React component + CSS
5. Design tokens     tokens.css from design reference
6. IPC command       get_app_version with managed Config state
7. Module stubs      identity.rs, db.rs, state.rs, fs_commands.rs
8. ErrorBoundary     React class component + safeInvoke wrapper
9. Tests             Rust unit test + vitest setup + Titlebar test
10. iroh spike       examples/iroh_spike.rs (add iroh to Cargo.toml)
11. justfile         Write last, based on generated project structure
12. CSP              Set restrictive Content Security Policy in index.html
13. Cleanup          .gitignore audit, rust-toolchain.toml, bun+Tauri compat check
```

---

## 1. Scaffold

```bash
bun create tauri-app devmesh -- --template react-ts
cd devmesh
bun install
```

This generates:

```
devmesh/
├── src/                    # React frontend (Vite)
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── src-tauri/              # Rust backend
│   ├── Cargo.toml
│   ├── src/
│   │   └── lib.rs          # Tauri commands
│   ├── tauri.conf.json     # App config
│   └── capabilities/       # Tauri v2 permissions
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

**Verify:** `bun tauri dev` opens a window. You should see the default React template.

**What to learn:**
- Tauri v2 is two projects in one: a Vite/React frontend and a Rust backend
- They communicate via IPC: frontend calls `invoke()`, Rust handles it
- `cargo tauri dev` starts both the Vite dev server AND the Rust backend with hot-reload

---

## 2. Configure tauri.conf.json

Find `src-tauri/tauri.conf.json`. Update these fields:

```jsonc
{
  "productName": "DevMesh",
  "identifier": "com.devmesh.app",      // ONE-WAY DOOR: changing this later loses user data
  "app": {
    "windows": [
      {
        "title": "DevMesh",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "titleBarStyle": "overlay",       // Keep real macOS traffic lights
        "hiddenTitle": true               // Hide the title text (we render our own)
      }
    ]
  }
}
```

**What `titleBarStyle: "overlay"` does:**
```
┌─────────────────────────────────────────────┐
│ ● ● ●              ← real macOS buttons     │
│ ┌─────────────────────────────────────────┐ │
│ │ Your React content starts here          │ │
│ │ (you need padding-top to avoid the     │ │
│ │  traffic lights)                        │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

The traffic lights are native macOS. You don't render them. You just need to leave
space for them (about 28-32px of padding-top) and add a drag region so users can
move the window by dragging the titlebar area.

**What to learn:**
- `identifier` is used by macOS to name the app's data directory: `~/Library/Application Support/com.devmesh.app/`
- `titleBarStyle: "overlay"` vs `decorations: false`: overlay keeps native window controls, decorations:false removes everything
- `hiddenTitle: true` hides the macOS title text so you can render your own

---

## 3. Custom Titlebar Component

Create `src/components/Titlebar.tsx`:

```
VISUAL:
┌─────────────────────────────────────────────────────────┐
│ ● ● ●  [drag region fills remaining space]    DevMesh   │
│         ← 70px inset for traffic lights                 │
└─────────────────────────────────────────────────────────┘
```

**Key concepts:**

1. **Drag region:** Add `data-tauri-drag-region` attribute to the titlebar div. This tells Tauri "when the user drags this area, move the window." Without this, the window is un-movable.

2. **Traffic light inset:** The macOS traffic lights sit about 70px from the left edge. Your titlebar content (app name, etc.) should start after that.

3. **No-drag zones:** Buttons and interactive elements inside the titlebar should NOT have the drag attribute, or they won't be clickable.

**CSS for the titlebar:**
```css
.titlebar {
  height: 32px;
  display: flex;
  align-items: center;
  padding-left: 70px;           /* Space for traffic lights */
  padding-right: 16px;
  -webkit-app-region: drag;     /* Make the whole area draggable */
  user-select: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);  /* Frosted glass effect */
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);
}

.titlebar-title {
  font-size: 13px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.85);
  margin: 0 auto;              /* Center the title */
}

/* IMPORTANT: buttons inside titlebar need this to be clickable */
.titlebar button {
  -webkit-app-region: no-drag;
}
```

**And the main content needs padding:**
```css
.main-content {
  padding-top: 32px;  /* Height of titlebar */
}
```

**What to learn:**
- `-webkit-app-region: drag` is a WebView CSS property, not standard CSS
- `backdrop-filter: blur()` creates the frosted glass effect (like macOS Sonoma)
- `position: fixed` + `top: 0` makes the titlebar stick to the top even when scrolling
- Anything inside the drag region that should be clickable needs `-webkit-app-region: no-drag`

---

## 4. CSS Design Tokens

Create `src/tokens.css` with values extracted from Neo Spatial design reference:

```css
:root {
  /* Colors */
  --color-accent: #007AFF;           /* System blue, primary actions */
  --color-accent-hover: #0066D6;
  --color-success: #34C759;          /* Online status */
  --color-warning: #FF9500;          /* Read+Copy permission badge */
  --color-danger: #FF3B30;           /* Destructive actions */
  --color-offline: #8E8E93;          /* Offline device text */

  /* Backgrounds */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F9F9F9;          /* Alternating rows */
  --bg-sidebar: rgba(246, 246, 246, 0.8);
  --bg-hover: rgba(0, 0, 0, 0.04);

  /* Text */
  --text-primary: rgba(0, 0, 0, 0.85);
  --text-secondary: rgba(0, 0, 0, 0.5);
  --text-tertiary: rgba(0, 0, 0, 0.3);

  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
  --font-size-sm: 11px;
  --font-size-base: 13px;
  --font-size-lg: 15px;

  /* Spacing */
  --row-height: 22px;               /* Finder-like density */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;

  /* Borders */
  --border-hairline: 0.5px solid rgba(0, 0, 0, 0.1);
  --border-radius-sm: 4px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);

  /* Transitions */
  --transition-fast: 120ms ease;
  --transition-normal: 200ms ease;
}
```

Import this in `main.tsx` before other styles:
```tsx
import './tokens.css';
import './styles.css';
```

**What to learn:**
- CSS custom properties (variables) are defined with `--name` and used with `var(--name)`
- `:root` means "apply to the whole document"
- `rgba()` with low alpha creates subtle, macOS-style transparency effects
- These tokens will be referenced by every component in Steps 9-10

---

## 5. IPC Command: get_app_version

In `src-tauri/src/lib.rs`:

```
FLOW:
  Frontend                         Rust Backend
     │                                │
     ├── invoke("get_app_version") ──>│
     │                                ├── fn get_app_version(state: State<Config>)
     │                                ├── reads name + version from Config
     │                                ├── returns AppVersion { name, version }
     │   <── JSON { name, version } ──┤
     │                                │
     ├── Display version              │
```

**Rust side (lib.rs):**

You need to understand 4 Rust concepts:

1. **`#[derive(serde::Serialize)]`** — tells Rust how to convert a struct to JSON automatically. Tauri uses this to send data back to the frontend.

2. **`#[tauri::command]`** — marks a function as callable from the frontend via `invoke()`.

3. **`tauri::State<T>`** — Tauri's dependency injection. You register a value with `.manage()`, and any command can access it by declaring `State<T>` as a parameter. The framework hands it to you.

4. **`async fn`** — the function can pause and resume (important for I/O). All your future commands will be async because they touch the network, filesystem, or database.

**Important: Tauri manages the tokio runtime for you.**
You do NOT need to create a tokio runtime yourself. When you write `async fn get_app_version(...)`,
Tauri runs it on its own internal tokio runtime. This is different from standalone Rust programs
where you'd write `#[tokio::main] async fn main()`. In Tauri:
- The `run()` function starts the tokio runtime internally
- All `#[tauri::command] async fn` functions execute on that runtime
- You can use `tokio::spawn()` inside commands to spawn background tasks
- The runtime is multi-threaded by default (tokio's "current thread" for the main thread, worker threads for commands)

The only place you'll write `#[tokio::main]` is in standalone programs like the iroh spike
(`examples/iroh_spike.rs`), because those aren't running inside Tauri.

**The Config struct:**
```rust
#[derive(Clone, serde::Serialize)]
struct Config {
    name: String,
    version: String,
}
```

**The command:**
```rust
#[tauri::command]
async fn get_app_version(config: tauri::State<'_, Config>) -> Result<Config, String> {
    Ok(config.inner().clone())
}
```

**The Builder (in the `run()` function):**
```rust
tauri::Builder::default()
    .manage(Config {
        name: "DevMesh".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
    .invoke_handler(tauri::generate_handler![get_app_version])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

**Frontend side (in App.tsx):**
```tsx
import { invoke } from '@tauri-apps/api/core';

interface AppVersion {
  name: string;
  version: string;
}

const version = await invoke<AppVersion>('get_app_version');
```

**What to learn:**
- `#[derive(...)]` — Rust's code generation macros. They auto-implement traits (like interfaces) for your structs.
- `State<'_, T>` — the `'_` is a lifetime annotation. For now, just know Tauri needs it. You'll understand lifetimes deeply in Step 4.
- `.inner().clone()` — `State` wraps your value. `.inner()` gets a reference, `.clone()` makes a copy. You need to clone because the function returns an owned value.
- `env!("CARGO_PKG_VERSION")` — reads the version from Cargo.toml at compile time. Changes when you bump the version.
- `Result<T, String>` — Tauri commands return Result. Ok(value) on success, Err(string) on failure. The frontend sees the Ok value or catches the Err string.

---

## 6. Module Stubs

Create these 4 files in `src-tauri/src/`:

**identity.rs:**
```rust
/// Step 3: Ed25519 keypair generation and persistent storage.
/// Generates on first launch, loads from ~/.config/devmesh/identity.key on subsequent launches.
/// The public key IS the device's identity in the mesh.
pub struct Identity;
```

**db.rs:**
```rust
/// Step 3: SQLite database schema and queries.
/// Tables: local_device (your identity), paired_devices (known peers), pending_transfers (offline queue).
pub struct Database;
```

**state.rs:**
```rust
/// Step 3: Shared application state across all Tauri commands.
/// Contains: Database connection (behind tokio::sync::Mutex), Identity, iroh Endpoint, device name.
pub struct AppState;
```

**fs_commands.rs:**
```rust
/// Step 7: Tauri commands for local filesystem operations.
/// Commands: list_dir (paginated), read_file, stat_path, get_home_dir.
```

**In lib.rs, add module declarations:**
```rust
mod identity;
mod db;
mod state;
mod fs_commands;
```

**What to learn:**
- `mod identity;` tells Rust "look for identity.rs in the same directory"
- `pub struct Identity;` — `pub` makes it visible to other modules. The `;` means no fields (unit struct).
- You'll see "unused" warnings. That's Rust telling you these modules exist but nothing uses them yet. Each warning disappears as you implement the module in its step.
- Rust's module system is file-based: `mod foo;` looks for `foo.rs` or `foo/mod.rs`

---

## 7. ErrorBoundary + safeInvoke

Two parts:

**safeInvoke (src/lib/tauri.ts):**
```
PURPOSE: Wrap Tauri's invoke() so errors are catchable and typed.
React ErrorBoundaries only catch render errors, not Promise rejections.
This wrapper handles the async IPC error path.
```

```typescript
import { invoke } from '@tauri-apps/api/core';

export async function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    // Tauri sends Err(...) variant as a string
    const message = typeof e === 'string' ? e : String(e);
    throw new Error(`IPC error [${cmd}]: ${message}`);
  }
}
```

**ErrorBoundary (src/components/ErrorBoundary.tsx):**
```
PURPOSE: Catch render-time errors (e.g., a component crashes during render).
Shows the error in the UI instead of a white screen.
Class component because React hooks can't catch errors (yet).
```

This is a standard React pattern. Class component with `componentDidCatch` and
`getDerivedStateFromError`. Render the error message with a "Retry" button that
resets the state.

**What to learn:**
- React class components vs function components: ErrorBoundary is one of the few cases where you still need a class component
- `componentDidCatch(error, errorInfo)` — React calls this when a child component throws during render
- The `invoke()` function returns a Promise. If the Rust command returns `Err(...)`, the Promise rejects. React ErrorBoundaries don't catch Promise rejections, which is why you need `safeInvoke` too.

---

## 8. Tests

### Rust unit test (src-tauri/src/lib.rs)

Add at the bottom of lib.rs:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_serializes_correctly() {
        let config = Config {
            name: "DevMesh".to_string(),
            version: "0.1.0".to_string(),
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("DevMesh"));
        assert!(json.contains("0.1.0"));
    }
}
```

Run with: `cd src-tauri && cargo test`

**What to learn:**
- `#[cfg(test)]` — this module only compiles when running tests, not in the final binary
- `mod tests` — convention: test module at the bottom of each file
- `use super::*` — import everything from the parent module (where Config is defined)
- `#[test]` — marks a function as a test case
- `.unwrap()` — "crash if this is an error." OK in tests, never in production code.

### React test setup

```bash
bun add -d vitest @testing-library/react @testing-library/jest-dom jsdom
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

**Titlebar test (src/components/Titlebar.test.tsx):**

Test that the Titlebar renders with a drag region attribute and displays "DevMesh".

Run with: `bun vitest run`

---

## 9. iroh API Spike

Add to `src-tauri/Cargo.toml` dependencies:
```toml
iroh = "0.97"
tokio = { version = "1", features = ["full"] }
```

Create `src-tauri/examples/iroh_spike.rs`:

```
WHAT THIS PROVES:
1. iroh 0.97 compiles on your machine
2. You can create an Endpoint (your node in the P2P network)
3. Two endpoints can connect on localhost
4. They can open a bi-directional stream and exchange messages

If all 4 work, the transport layer design in Steps 4-8 is feasible.
If any fail, we need to reassess before building on iroh.
```

The spike creates two iroh Endpoints in the same process, connects one to the other
using the ALPN protocol identifier `b"devmesh/1"`, opens a bi-directional stream,
sends "hello" one way and "world" back, and prints success.

Run with: `cd src-tauri && cargo run --example iroh_spike`

**Success:** "iroh spike passed: bi-directional stream works on iroh 0.97"
**Failure:** If it doesn't compile or connect, document the error and check iroh 0.96 or latest.

**What to learn:**
- `examples/` directory in a Cargo project: standalone programs that share the project's dependencies
- `#[tokio::main]` — the entry point for an async program (tokio runs the async runtime)
- ALPN (Application-Layer Protocol Negotiation) — how two peers agree on what protocol to speak
- `Endpoint` — iroh's abstraction for "a node in the network that can connect to other nodes"
- Bi-directional streams — like a two-way pipe. Both sides can send and receive.

---

## 10. justfile

Create `justfile` in the project root:

```just
# DevMesh development commands

# Start development (frontend + backend with hot-reload)
dev:
    bun tauri dev

# Run Rust tests
test-rust:
    cd src-tauri && cargo test

# Run React tests
test-react:
    bun vitest run

# Run all tests
test: test-rust test-react

# Build for production
build:
    bun tauri build

# Clean build artifacts
clean:
    cd src-tauri && cargo clean

# Run iroh API spike
spike:
    cd src-tauri && cargo run --example iroh_spike

# Type-check frontend
check-ts:
    bun tsc --noEmit

# Type-check backend
check-rust:
    cd src-tauri && cargo check
```

Run any command with: `just dev`, `just test`, `just spike`

**What to learn:**
- `justfile` is like Makefile but simpler. Each recipe is `name:` followed by indented commands.
- Unlike Make, just doesn't track file dependencies. It just runs commands.
- Install with `brew install just` if you don't have it.

---

## 11. Content Security Policy (CSP)

Set a restrictive CSP before adding IPC calls that pass filesystem data to the WebView.
This prevents XSS if any user-controlled data (filenames, file contents) reaches the frontend.

In `index.html`, add this `<meta>` tag inside `<head>`:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: https://asset.localhost; connect-src ipc: http://ipc.localhost"
/>
```

**What each directive does:**
- `default-src 'self'` — only load resources from the app itself (no external CDNs, no inline scripts)
- `script-src 'self'` — JavaScript only from your bundled files, not injected scripts
- `style-src 'self' 'unsafe-inline'` — styles from your files + inline styles (React needs this for some patterns)
- `img-src 'self' asset:` — images from your app + Tauri's asset protocol (for loading local files)
- `connect-src ipc: http://ipc.localhost` — IPC calls to the Rust backend only

**Why this matters:**
In Steps 7-8, you'll display filesystem data (filenames, file metadata) in the UI. If a filename
contains `<script>alert('xss')</script>`, the CSP prevents it from executing. Without a CSP,
your app is an XSS vector for any malicious filename on a remote machine.

**What to learn:**
- CSP is an HTTP header (or meta tag) that tells the browser "only run code from these sources"
- Tauri's WebView respects CSP just like a regular browser
- `'self'` means "same origin" — your bundled app code
- `'unsafe-inline'` for styles is a tradeoff — needed for React, but means injected `<style>` tags would work too
- You'll tighten this further when you add network code in Step 4

---

## 12. Cleanup

### rust-toolchain.toml
Create `src-tauri/rust-toolchain.toml`:
```toml
[toolchain]
channel = "stable"
```

### .gitignore audit
Verify the generated `.gitignore` includes:
```
target/
node_modules/
dist/
.env
.claude/
*.dmg
*.app
```

If `.claude/` is missing, add it. (Your CLAUDE.md rules require this.)

### bun + Tauri compatibility check
After everything works with `bun tauri dev`, also verify `bun tauri build` produces
a working .app bundle. If bun has issues with Tauri's build hooks, fall back to pnpm
(add it to `engines` in package.json as a note).

---

## Verification Checklist

- [ ] `bun tauri dev` opens a window with custom titlebar
- [ ] macOS traffic lights (red/yellow/green) visible and functional
- [ ] Window is draggable by the titlebar area
- [ ] "DevMesh" title centered in the titlebar
- [ ] Frosted glass effect visible on the titlebar
- [ ] Version string from Rust backend displayed in the UI
- [ ] `just test` passes (1 Rust test + 1 React test)
- [ ] `just spike` runs iroh spike successfully
- [ ] CSS design tokens loaded (inspect with browser devtools)
- [ ] Rust compiler shows "unused module" warnings for stubs (expected)
- [ ] `.gitignore` includes `.claude/`
- [ ] `rust-toolchain.toml` exists with stable channel
- [ ] CSP meta tag present in `index.html` (inspect with browser devtools > Application > Security)

---

## File Map (everything you create in Step 1)

```
devmesh/
├── src/
│   ├── main.tsx                  # Entry point (import tokens.css)
│   ├── App.tsx                   # Layout with Titlebar + main content
│   ├── tokens.css                # NEW: Neo Spatial design tokens
│   ├── styles.css                # Modified: add titlebar/content styles
│   ├── components/
│   │   ├── Titlebar.tsx          # NEW: custom titlebar with drag region
│   │   ├── Titlebar.test.tsx     # NEW: vitest component test
│   │   └── ErrorBoundary.tsx     # NEW: render error boundary
│   └── lib/
│       └── tauri.ts              # NEW: safeInvoke() wrapper
├── src-tauri/
│   ├── Cargo.toml                # Modified: add iroh, tokio
│   ├── rust-toolchain.toml       # NEW: pin stable Rust
│   ├── src/
│   │   ├── lib.rs                # Modified: Config, get_app_version, mod stubs, test
│   │   ├── identity.rs           # NEW: stub
│   │   ├── db.rs                 # NEW: stub
│   │   ├── state.rs              # NEW: stub
│   │   └── fs_commands.rs        # NEW: stub
│   ├── examples/
│   │   └── iroh_spike.rs         # NEW: iroh API verification
│   └── tauri.conf.json           # Modified: window, titlebar, identifier
├── index.html                    # Modified: add CSP meta tag
├── vitest.config.ts              # NEW: React test configuration
├── justfile                      # NEW: dev commands
└── .gitignore                    # Modified: add .claude/
```

**Total new files:** 13
**Modified files:** 6 (includes index.html for CSP)

---

## Rust Concepts Learned in Step 1

| Concept | Where you see it | What it means |
|---------|-----------------|---------------|
| `#[derive(...)]` | Config struct | Auto-generate trait implementations |
| `#[tauri::command]` | get_app_version | Mark function as IPC-callable |
| `async fn` | get_app_version | Function that can pause/resume |
| `State<'_, T>` | get_app_version params | Tauri's dependency injection |
| `Result<T, E>` | command return type | Success or error, explicit handling |
| `.clone()` | config.inner().clone() | Make a copy of a value |
| `mod name;` | lib.rs module declarations | File-based module system |
| `pub struct` | module stubs | Public type visible to other modules |
| `#[cfg(test)]` | tests module | Compile only during testing |
| `env!()` | CARGO_PKG_VERSION | Read value at compile time |
| `.to_string()` | string conversions | Convert &str to owned String |
| `.unwrap()` | tests only | Crash on error (OK in tests) |
