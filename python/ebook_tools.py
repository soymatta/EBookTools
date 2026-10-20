#!/usr/bin/env python3
"""
EBookTools - Set of tools for your EBooks and EReaders
All processing happens locally, no external APIs.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cli import main

if __name__ == "__main__":
    main()
