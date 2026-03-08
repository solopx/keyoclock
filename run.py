#!/usr/bin/env python3
"""keyoclock — use: python app.py (este arquivo delega para app.py)"""
import os
import runpy

os.chdir(os.path.dirname(os.path.abspath(__file__)))
runpy.run_path(os.path.join(os.path.dirname(__file__), 'app.py'), run_name='__main__')
