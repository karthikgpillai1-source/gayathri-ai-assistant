import sys
import subprocess

def main():
    # Consolidate: direct execution to the primary launcher
    subprocess.run([sys.executable, "launcher.py"])

if __name__ == "__main__":
    main()
