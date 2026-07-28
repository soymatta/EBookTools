#!/usr/bin/env python3
"""
EBookTools - Set of tools for your EBooks and EReaders
All processing happens locally, no external APIs.
"""

import argparse
import os
from pathlib import Path

from compress import compress_books
from tts import ebook_to_audio, list_voices, preview_voice
from convert import epub_to_pdf, pdf_to_epub
from metadata import get_metadata, set_metadata
from autoname import auto_rename


def main():
    parser = argparse.ArgumentParser(
        description="EBookTools - Set of tools for your EBooks and EReaders"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # compress
    compress_parser = subparsers.add_parser("compress", help="Compress ebook files")
    compress_parser.add_argument("files", nargs="+", help="Files to compress")
    compress_parser.add_argument(
        "-o", "--output-format", choices=["original", "pdf", "epub"], default="original"
    )
    compress_parser.add_argument(
        "-l", "--level", choices=["light", "normal", "strong"], default="normal",
        help="Compression level (default: normal)"
    )

    # tts
    tts_parser = subparsers.add_parser("tts", help="Convert ebook to audio")
    tts_parser.add_argument("file", help="Ebook file to convert")
    tts_parser.add_argument("-o", "--output", help="Output audio file path")
    tts_parser.add_argument("-v", "--voice", type=int, help="Voice ID (use 'list-voices' to see options)")
    tts_parser.add_argument("-s", "--speed", type=float, default=1.0, help="Speech speed (default: 1.0)")
    tts_parser.add_argument("--volume", type=float, default=1.0, help="Volume (default: 1.0)")

    # list-voices
    subparsers.add_parser("list-voices", help="List available TTS voices")

    # preview-voice
    preview_parser = subparsers.add_parser("preview-voice", help="Preview a TTS voice")
    preview_parser.add_argument("-v", "--voice", type=int, help="Voice ID")
    preview_parser.add_argument("-s", "--speed", type=float, default=1.0)
    preview_parser.add_argument("--volume", type=float, default=1.0)

    # convert
    convert_parser = subparsers.add_parser("convert", help="Convert between EPUB and PDF")
    convert_parser.add_argument("file", help="Input file")
    convert_parser.add_argument(
        "-t", "--to", required=True, choices=["pdf", "epub"], help="Output format"
    )
    convert_parser.add_argument("-o", "--output", help="Output file path")

    # metadata
    meta_parser = subparsers.add_parser("metadata", help="Edit ebook metadata")
    meta_parser.add_argument("file", help="Ebook file")
    meta_parser.add_argument("--get", action="store_true", help="Show current metadata")
    meta_parser.add_argument("--title", help="Set title")
    meta_parser.add_argument("--author", help="Set author")
    meta_parser.add_argument("--description", help="Set description")
    meta_parser.add_argument("--language", help="Set language")
    meta_parser.add_argument("--isbn", help="Set ISBN/identifier")
    meta_parser.add_argument("-o", "--output", help="Output file path")

    # autoname
    autoname_parser = subparsers.add_parser("autoname", help="Rename books using metadata from APIs")
    autoname_parser.add_argument("files", nargs="+", help="Files to rename")
    autoname_parser.add_argument(
        "-f", "--format", default="{title} - {author}",
        help='Rename format (default: "{title} - {author}")'
    )
    autoname_parser.add_argument(
        "--apply", action="store_true", help="Actually rename files (without this, shows preview only)"
    )

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    if args.command == "compress":
        results = compress_books(args.files, args.output_format, level=args.level)
        if results:
            print(f"\nDone! {len(results)} file(s) compressed.")

    elif args.command == "tts":
        ebook_to_audio(
            args.file,
            output_path=args.output,
            voice_id=args.voice,
            speed=args.speed,
            volume=args.volume,
        )

    elif args.command == "list-voices":
        list_voices()

    elif args.command == "preview-voice":
        preview_voice(voice_id=args.voice, speed=args.speed, volume=args.volume)

    elif args.command == "convert":
        ext = Path(args.file).suffix.lower()
        if args.to == "pdf" and ext == ".epub":
            epub_to_pdf(args.file, args.output)
        elif args.to == "epub" and ext == ".pdf":
            pdf_to_epub(args.file, args.output)
        else:
            print(f"Error: Cannot convert {ext} to {args.to}")

    elif args.command == "metadata":
        if args.get:
            meta = get_metadata(args.file)
            print("\nCurrent metadata:")
            for key, value in meta.items():
                print(f"  {key}: {value}")
        else:
            updates = {}
            if args.title:
                updates["title"] = args.title
            if args.author:
                updates["author"] = args.author
            if args.description:
                updates["description"] = args.description
            if args.language:
                updates["language"] = args.language
            if args.isbn:
                updates["identifier"] = args.isbn

            if updates:
                set_metadata(args.file, updates, args.output)
            else:
                print("No metadata fields to update. Use --title, --author, etc.")

    elif args.command == "autoname":
        results = auto_rename(args.files, args.format)
        if results:
            print(f"\n{'Preview' if not args.apply else 'Results'}:")
            print("-" * 60)
            for r in results:
                print(f"  {r['original']} -> {r['new_name']}")
            print("-" * 60)

            if not args.apply:
                print("\nTo apply these changes, add --apply flag")
            else:
                renamed_count = 0
                used_paths = set()
                for r in results:
                    if r["original"] == r["new_name"]:
                        continue
                    target = r["new_path"]
                    if target in used_paths:
                        base, ext = os.path.splitext(target)
                        counter = 2
                        while target in used_paths:
                            target = f"{base} ({counter}){ext}"
                            counter += 1
                        r["new_path"] = target
                    try:
                        os.rename(r["old_path"], r["new_path"])
                        used_paths.add(r["new_path"])
                        renamed_count += 1
                    except Exception as e:
                        print(f"  Failed to rename {r['original']}: {e}")
                print(f"\nRenamed {renamed_count} file(s).")


if __name__ == "__main__":
    main()
