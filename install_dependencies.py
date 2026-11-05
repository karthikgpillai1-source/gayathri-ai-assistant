import os
import sys
import subprocess

def main():
    print("=" * 60)
    print("         GAYATHRI AI DEPENDENCY INSTALLER (PYTHON)")
    print("=" * 60)
    
    # 1. Install Backend Python requirements
    req_file = os.path.join("backend", "requirements.txt")
    if os.path.exists(req_file):
        print(f"[*] Installing backend dependencies from {req_file}...")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "-r", req_file], check=True)
            print("[+] Python backend packages installed successfully.")
        except subprocess.CalledProcessError as e:
            print(f"[-] Error: Failed to install Python dependencies: {e}")
            sys.exit(1)
    else:
        print("[-] Warning: requirements.txt not found in backend directory.")
        
    # 2. Check if frontend package.json exists
    if os.path.exists("package.json"):
        print("\n[*] Installing frontend Node.js packages...")
        try:
            subprocess.run(["npm", "install"], check=True, shell=True)
            print("[+] Node.js packages installed successfully.")
        except subprocess.CalledProcessError as e:
            print(f"[-] Error: Failed to install Node.js dependencies: {e}")
            sys.exit(1)
            
    print("\n" + "=" * 60)
    print("[+] All dependencies verified and installed successfully.")
    print("=" * 60)

if __name__ == "__main__":
    main()
