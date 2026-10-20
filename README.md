# EBookTools

Set of tools for your EBooks and EReaders. Available as a Python CLI and a
browser app (Next.js, deployable to Vercel).

Every feature runs **fully offline**. Files never leave your machine: the web
app processes everything client-side and the CLI ships no network code. The
only online step is the optional one-time download of the neural TTS voices
(Meta MMS, English + Spanish), which are cached in the browser afterwards.

## Tools

- **Compress Books** — reduce PDF and EPUB file sizes. EPUB junk removal,
  repacking, and optional JPEG downscaling; PDF object-stream rebuilding.
- **EBook to Voice** — text-to-speech with the operating system voices or
  in-browser neural voices (English + Spanish, cached after first download).
- **EPUB ↔ PDF** — convert in either direction with chapter structure.
- **Book Manager** — edit title, author, description and other metadata, and
  rename badly named books using the metadata already embedded in the file.

## Python CLI

```bash
cd python
pip install -r requirements.txt
python ebook_tools.py --help

python ebook_tools.py compress book.pdf book.epub --level normal
python ebook_tools.py convert book.epub --to pdf
python ebook_tools.py tts book.epub -o audiobook.wav
python ebook_tools.py metadata book.epub --get
python ebook_tools.py metadata book.epub --title "New Title" --author "Author"
python ebook_tools.py autoname *.epub --format "{author} - {title}" --apply
python ebook_tools.py list-voices
```

Dependencies are imported lazily: a missing library raises a clear `ImportError`
only when the matching command runs, so the CLI stays usable without all extras.

## Web app

```bash
cd web
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (Vercel uses this)
npm run lint
```

There are no API routes: all processing happens in the browser. Adding a tool
means creating `web/app/tools/<id>/page.tsx` and registering it in
`web/app/tools/registry.ts`.

## Layout

- `python/` — standalone CLI (`ebook_tools.py` + one module per tool)
- `web/` — Next.js 15 app (`app/tools/*` pages, `lib/*` processors)

The two codebases share no code. See `AGENTS.md` for the project rules
(offline policy, visual style, commit convention, gotchas).

## License

MIT
