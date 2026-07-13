# AGENTS.md

## Structure

Two independent codebases sharing the same feature set:

- **`python/`** — Standalone CLI tool (`ebook_tools.py`)
- **`web/`** — Next.js 15 app for Vercel deployment

No shared code between them. Each must be maintained independently.

## Commands

### Python
```bash
cd python
pip install -r requirements.txt
python ebook_tools.py --help
python ebook_tools.py compress file.pdf file.epub
python ebook_tools.py tts file.epub -o output.mp3
python ebook_tools.py convert file.epub --to pdf
python ebook_tools.py metadata file.epub --get
```

### Web
```bash
cd web
npm install
npm run dev       # dev server
npm run build     # production build (used by Vercel)
npm run lint      # next lint
```

## Commit convention

After completing a significant feature or tool, commit immediately so the deployed page stays in sync with the working version. A "significant" change is:
- A new tool added
- A tool's core functionality implemented or changed
- A UI component that affects multiple pages
- A bug fix that changes behavior

Do NOT commit after every small tweak. Group related small edits into one commit.

## Git workflow

After every commit or series of commits:
1. `git pull --rebase` to sync with remote
2. If there are conflicts, STOP and ask the user how to resolve them before pushing
3. `git push` to update the remote

Do not skip the pull step. Always pull before pushing.

## Adding a new tool

The web app uses a **registry pattern**. To add a tool:

1. Create `web/app/tools/{id}/page.tsx`
2. Add an entry to `web/app/tools/registry.ts` (the `tools` array)
3. Landing page auto-renders the new card

## Visual style

Every page MUST follow this style. Do not deviate.

### Colors (CSS variables in `globals.css`)
- Backgrounds: `--bg-primary` (#0a0a0a), `--bg-secondary` (#141414), `--bg-card` (#1a1a1a)
- Text: `--text-primary` (#f5f5f5), `--text-secondary` (#a0a0a0)
- Accent: `--accent` (#3b82f6), `--accent-hover` (#2563eb)
- Border: `--border` (#2a2a2a)
- Status: `--success` (#22c55e), `--error` (#ef4444)

### Layout pattern for every tool page
```
<div className="max-w-3xl mx-auto px-6 py-12">
  <h1 className="text-3xl font-bold mb-2">{icon} {Tool Name}</h1>
  <p className="mb-8" style={{ color: "var(--text-secondary)" }}>{description}</p>
  ...content...
</div>
```

### Component conventions
- **Cards**: `rounded-xl border` with `var(--bg-card)` background, `var(--border)` border. Hover: `var(--bg-card-hover)` + `var(--accent)` border + `translateY(-2px)`.
- **Buttons**: Primary uses `var(--accent)` bg, white text. Hover: `var(--accent-hover)`. Disabled: `var(--bg-card)` bg + `var(--text-secondary)` text.
- **Inputs/Selects**: `var(--bg-card)` bg, `var(--border)` border, `var(--text-primary)` text. Always `rounded-lg` + `text-sm`.
- **File lists**: Each item is a flex row inside `var(--bg-card)` with a border. Shows icon + name + size + remove button.
- **Progress bars**: Container `var(--bg-card)`, fill `var(--accent)`, `rounded-full`.
- Use CSS variables via `style={{}}`, not Tailwind color classes.

## AutoName (book rename tool)

Renames badly named ebook files using metadata fetched from free APIs.

### Behavior
1. User uploads one or more books with bad filenames (e.g., `document(3).epub`, `book_final_v2.pdf`)
2. App extracts available metadata from inside the file (title, author from EPUB/PDF metadata)
3. If metadata is empty or incomplete, queries **Open Library Search API** (`https://openlibrary.org/search.json?q={query}`) — no API key required
4. Falls back to **Google Books API** (`https://www.googleapis.com/books/v1/volumes?q={query}`) if Open Library returns nothing — also no API key required for basic search
5. User picks a rename format before confirming:
   - `{title} - {author}` (default)
   - `{title} - {author} ({year})`
   - `{title} - {author} - {category}`
   - `{author} - {title}`
   - Custom: user writes their own template with `{title}`, `{author}`, `{year}`, `{category}`, `{isbn}`
6. Preview shows old name → new name for each file before applying
7. User confirms, downloads renamed files (client-side, no server)

### API details
- **Open Library**: `https://openlibrary.org/search.json?q={title}+{author}&fields=title,author_name,first_publish_year,isbn,subject` — returns `docs[]` with `title`, `author_name[]`, `first_publish_year`, `subject[]`, `isbn[]`
- **Google Books**: `https://www.googleapis.com/books/v1/volumes?q={title}+{author}` — returns `items[]` with `volumeInfo.title`, `volumeInfo.authors[]`, `volumeInfo.publishedDate`, `volumeInfo.categories[]`, `volumeInfo.industryIdentifiers[]`

### Files to create
- `web/app/tools/autoname/page.tsx`
- `web/lib/autoname-utils.ts` — API fetch + rename logic
- Add entry to `web/app/tools/registry.ts`
- Python equivalent in `ebook_tools.py`

## Key gotchas

- **pdf-lib + TypeScript**: `pdfDoc.save()` returns `Uint8Array<ArrayBufferLike>` which is not assignable to `BlobPart`. Use `.slice().buffer as ArrayBuffer` when creating Blobs. This affects `web/lib/pdf-utils.ts` and `web/lib/convert-utils.ts`.
- **Python imports are optional**: `ebook_tools.py` wraps every import in try/except. Functions raise `ImportError` at call time if a library is missing. This is intentional for portability.
- **No test framework**: Neither Python nor web has tests configured. Verify manually via `npm run build` (web) and `python ebook_tools.py --help` (Python).
- **Web is client-side only**: All processing (PDF, EPUB, TTS) runs in the browser. No API routes, no server-side processing. Files never leave the user's machine.
- **Tailwind v4**: Uses `@tailwindcss/postcss` plugin, not the v3 `tailwindcss` PostCSS plugin. Config is in `web/postcss.config.mjs`.
