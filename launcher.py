import os
import sys
import socket
import urllib.request
import json
import subprocess
import time
import webbrowser
import platform
import traceback
import threading
import msvcrt
from datetime import datetime

LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)
LAUNCHER_LOG = os.path.join(LOG_DIR, "launcher.log")
PID_FILE = os.path.join(LOG_DIR, "services.pid")
REPORT_FILE = "startup_failure_report.txt"

# Keep lock socket alive globally
LOCK_SOCKET = None
START_TIME = time.time()
LOG_BUFFER = []

def log_event(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted_msg = f"[{timestamp}] {msg}"
    with open(LAUNCHER_LOG, "a", encoding="utf-8") as f:
        f.write(formatted_msg + "\n")
    # Keep last 5 events for dashboard display
    LOG_BUFFER.append(formatted_msg)
    if len(LOG_BUFFER) > 5:
        LOG_BUFFER.pop(0)

# Set console title
if platform.system() == "Windows":
    os.system("title Gayathri AI Platform Manager")

def get_cpu_usage():
    try:
        # Fallback to wmic on Windows
        res = subprocess.run("wmic cpu get loadpercentage /value", shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out = res.stdout.decode().strip()
        for line in out.splitlines():
            if "LoadPercentage" in line:
                return f"{line.split('=')[1].strip()}%"
    except Exception:
        pass
    return "N/A"

def get_memory_usage():
    try:
        res = subprocess.run("wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value", shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out = res.stdout.decode().strip()
        free = None
        total = None
        for line in out.splitlines():
            if "FreePhysicalMemory" in line:
                free = int(line.split('=')[1].strip())  # KB
            elif "TotalVisibleMemorySize" in line:
                total = int(line.split('=')[1].strip())  # KB
        if free and total:
            used = total - free
            percent = (used / total) * 100
            return f"{percent:.1f}% ({used // 1024}MB / {total // 1024}MB)"
    except Exception:
        pass
    return "N/A"

def check_port_status(port):
    try:
        res = subprocess.run("netstat -ano", shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        output = res.stdout.decode(errors='ignore')
        
        state = "FREE"
        pid = None
        process_name = "None"
        
        lines = output.split('\n')
        port_suffix = f":{port}"
        
        for line in lines:
            parts = line.strip().split()
            if len(parts) >= 2:
                local_addr = parts[1]
                if local_addr.endswith(port_suffix):
                    line_state = parts[3] if len(parts) >= 4 else "UNKNOWN"
                    line_pid = parts[-1] if parts[-1].isdigit() else None
                    
                    if line_state in ["LISTENING", "CLOSE_WAIT", "ESTABLISHED"]:
                        state = line_state
                        pid = line_pid
                        break
                    elif state == "FREE" and line_state == "TIME_WAIT":
                        state = "TIME_WAIT"
                        pid = line_pid
                        
        if pid and pid != "0":
            app_res = subprocess.run(f'tasklist /FI "PID eq {pid}" /NH', shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            app_line = app_res.stdout.decode(errors='ignore').strip()
            if app_line and not app_line.startswith("INFO:"):
                process_name = app_line.split()[0]
                
        return state, pid, process_name
    except Exception as e:
        log_event(f"Error checking port status for {port}: {e}")
        return "FREE", None, "None"

def is_gsip_process(port, pid, process_name):
    pname = (process_name or "").lower()
    if "python" in pname or "uvicorn" in pname:
        return True
    if port == 8100:
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{port}/health")
            with urllib.request.urlopen(req, timeout=1.0) as response:
                return response.status == 200
        except Exception:
            pass
    elif port in [3100, 3101]:
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{port}/")
            with urllib.request.urlopen(req, timeout=1.0) as response:
                return response.status == 200
        except Exception:
            pass
    return False

def kill_process(pid):
    try:
        subprocess.run(f"taskkill /F /T /PID {pid}", shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except Exception as e:
        log_event(f"Failed to terminate PID {pid}: {e}")
        return False

def generate_failure_report(phase, exception, suggested_action):
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        report = [
            "==================================================",
            "GSIP STARTUP FAILURE REPORT (CRITICAL)",
            "==================================================",
            f"Timestamp: {timestamp}",
            f"Startup Phase: {phase}",
            f"OS: {platform.system()} {platform.release()} ({platform.version()})",
            f"Python Version: {sys.version}",
            f"Suggested Action: {suggested_action}",
            ""
        ]
        
        # Sockets state
        for port in [8100, 3100, 3101]:
            state, pid, name = check_port_status(port)
            report.append(f"Port {port} State: {state} | Owner PID: {pid} | Process: {name}")
            
        if exception:
            report.append("\n--- Exception Stack Trace ---")
            report.append("".join(traceback.format_exception(type(exception), exception, exception.__traceback__)))
            
        report.append("\n==================================================")
        with open(REPORT_FILE, "w", encoding="utf-8") as f:
            f.write("\n".join(report))
        print(f"\n[DIAGNOSTICS] Critical failure report written to '{REPORT_FILE}'.")
    except Exception as e:
        log_event(f"Failed to generate failure report: {e}")

def main():
    global LOCK_SOCKET
    
    # Startup Lock to prevent multiple launchers
    LOCK_SOCKET = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        LOCK_SOCKET.bind(("127.0.0.1", 39100))
    except Exception:
        print("[CRITICAL] Another GSIP launcher is already active.")
        sys.exit(0)
        
    print("=" * 60)
    print("         Gayathri AI Platform Manager V2.0")
    print("=" * 60)
    log_event("Launcher V2.0 initialized.")

    # Load env config
    env_path = ".env"
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip()
                    
    user_port = int(os.environ.get("USER_PORT", 3100))
    admin_port = int(os.environ.get("ADMIN_PORT", 3101))
    backend_port = int(os.environ.get("BACKEND_PORT", 8100))
    ollama_url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
    
    # 1. DEPENDENCY CHECKS
    print("[*] Running dependency checks...")
    log_event("Running dependency checks.")
    
    # Python Check
    print(f"  Python version ............ [OK] {sys.version.split()[0]}")
    
    # Node Check
    try:
        node_res = subprocess.run(["node", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, text=True)
        if node_res.returncode == 0:
            print(f"  Node version .............. [OK] {node_res.stdout.strip()}")
        else:
            raise Exception("Node returned non-zero code")
    except Exception as e:
        print("  Node version .............. [FAIL]")
        generate_failure_report("Dependency Check - Node", e, "Install Node.js (LTS version) and ensure it is in the PATH env variable.")
        sys.exit(1)
        
    # npm Check
    try:
        npm_res = subprocess.run(["npm", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, text=True)
        if npm_res.returncode == 0:
            print(f"  npm version ............... [OK] {npm_res.stdout.strip()}")
        else:
            raise Exception("npm returned non-zero code")
    except Exception as e:
        print("  npm version ............... [FAIL]")
        generate_failure_report("Dependency Check - npm", e, "Install npm (included with Node.js) and ensure it is in PATH.")
        sys.exit(1)

    # Ollama Check
    try:
        req = urllib.request.Request(f"{ollama_url}/api/tags")
        with urllib.request.urlopen(req, timeout=2.0) as response:
            if response.status == 200:
                print("  Ollama service ............ [OK] Online")
            else:
                raise Exception("Ollama endpoint status code not 200")
    except Exception as e:
        print("  Ollama service ............ [FAIL] Offline or Unreachable")
        generate_failure_report("Dependency Check - Ollama", e, f"Ensure Ollama is running locally at {ollama_url}.")
        sys.exit(1)
        
    # Knowledge Folder Check
    k_dir = os.path.join("backend", "knowledge")
    os.makedirs(k_dir, exist_ok=True)
    print(f"  Knowledge folders ......... [OK] Verified {k_dir}")
    log_event("All dependency checks passed.")

    # 2. VALIDATE PORTS & RECOVER STALE PROCESSES
    print("\n[*] Validating port availability & recovering stale processes...")
    target_ports = [backend_port, user_port, admin_port]
    for port in target_ports:
        state, pid, owner = check_port_status(port)
        if state != "FREE" and state != "TIME_WAIT":
            if is_gsip_process(port, pid, owner):
                print(f"  [RECOVERY] Port {port} is occupied by stale GSIP process (PID {pid}, {owner}). Terminating...")
                log_event(f"Terminating stale GSIP process PID {pid} on port {port}")
                kill_process(pid)
                # Wait for release
                released = False
                for _ in range(10):
                    time.sleep(1)
                    st, _, _ = check_port_status(port)
                    if st in ["FREE", "TIME_WAIT"]:
                        released = True
                        break
                if released:
                    print(f"  [RECOVERY] Port {port} released successfully.")
                else:
                    print(f"  [ERROR] Port {port} socket failed to release. Aborting.")
                    generate_failure_report("Port Release Failure", Exception(f"Port {port} remains blocked."), "Check for system processes locking the port or restart the machine.")
                    sys.exit(1)
            else:
                print(f"  [CRITICAL] Port {port} is occupied by non-GSIP process '{owner}' (PID {pid}). Aborting.")
                generate_failure_report("Port Conflict", Exception(f"Port {port} occupied by unrelated process."), "Change the application ports in .env or close the conflicting application.")
                sys.exit(1)
        else:
            print(f"  Port {port} ................ FREE")

    # Clean old PID files
    if os.path.exists(PID_FILE):
        try:
            os.remove(PID_FILE)
        except Exception:
            pass

    # Service definitions & configuration
    services = {
        "Backend": {
            "proc": None,
            "cmd": [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", str(backend_port)],
            "log": os.path.join(LOG_DIR, "backend.log"),
            "url": f"http://127.0.0.1:{backend_port}/api/health",
            "online": False,
            "last_restart": "Never",
            "restarts": 0
        },
        "User Portal": {
            "proc": None,
            "cmd": [sys.executable, "-m", "http.server", str(user_port), "--directory", "frontend/user"],
            "log": os.path.join(LOG_DIR, "user.log"),
            "url": f"http://127.0.0.1:{user_port}",
            "online": False,
            "last_restart": "Never",
            "restarts": 0
        },
        "Admin Portal": {
            "proc": None,
            "cmd": [sys.executable, "-m", "http.server", str(admin_port), "--directory", "frontend/admin"],
            "log": os.path.join(LOG_DIR, "admin.log"),
            "url": f"http://127.0.0.1:{admin_port}",
            "online": False,
            "last_restart": "Never",
            "restarts": 0
        }
    }

    # Start function
    def start_service(name):
        svc = services[name]
        try:
            log_event(f"Starting {name}...")
            f_log = open(svc["log"], "w", encoding="utf-8")
            svc["proc"] = subprocess.Popen(svc["cmd"], stdout=f_log, stderr=f_log)
            # Write PID to file
            with open(PID_FILE, "a") as pf:
                pf.write(f"{svc['proc'].pid}\n")
            log_event(f"{name} spawned with PID {svc['proc'].pid}")
        except Exception as e:
            log_event(f"Failed to start {name}: {e}")
            generate_failure_report(f"Starting {name}", e, f"Check logs/{name.lower().replace(' ', '_')}.log for detail.")
            shutdown_all()
            sys.exit(1)

    def shutdown_all():
        log_event("Shutting down GSIP Services...")
        # Order: User Portal -> Admin Portal -> Backend
        for name in ["User Portal", "Admin Portal", "Backend"]:
            svc = services[name]
            if svc["proc"] and svc["proc"].poll() is None:
                log_event(f"Stopping {name} (PID {svc['proc'].pid})...")
                kill_process(svc["proc"].pid)
                svc["online"] = False

        if os.path.exists(PID_FILE):
            try:
                os.remove(PID_FILE)
            except Exception:
                pass
        log_event("Shutdown sequence complete.")

    # 3. LAUNCH BACKEND
    print("\n[*] Starting Backend service...")
    start_service("Backend")
    
    backend_ready = False
    for i in range(60):
        time.sleep(1)
        # Check if backend crashed
        if services["Backend"]["proc"].poll() is not None:
            print("\n[CRITICAL] Backend exited immediately after launch.")
            generate_failure_report("Backend runtime check", Exception("Backend exited immediately"), "Check logs/backend.log for errors.")
            shutdown_all()
            sys.exit(1)
            
        print(f"  Polling /api/health ({i+1}/60)...", end="\r", flush=True)
        try:
            req = urllib.request.Request(services["Backend"]["url"])
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                data = json.loads(resp.read().decode())
                if data.get("status") == "ok":
                    backend_ready = True
                    services["Backend"]["online"] = True
                    break
        except Exception:
            pass

    if backend_ready:
        print("\n  Backend ............. ONLINE")
        log_event("Backend verified healthy.")
    else:
        print("\n[CRITICAL] Backend health check timed out.")
        generate_failure_report("Backend Health Polling", Exception("Timeout waiting for health response"), "Ensure ports are clear or inspect logs/backend.log.")
        shutdown_all()
        sys.exit(1)

    # Write dynamic configurations
    config_js = f"""window.APP_CONFIG = {{
  BACKEND_URL: "http://localhost:{backend_port}",
  USER_PORTAL_URL: "http://localhost:{user_port}",
  ADMIN_PORTAL_URL: "http://localhost:{admin_port}"
}};\n"""
    config_paths = [
        "frontend/shared/config.js",
        "frontend/user/shared/config.js",
        "frontend/admin/shared/config.js"
    ]
    for cp in config_paths:
        try:
            os.makedirs(os.path.dirname(cp), exist_ok=True)
            with open(cp, "w", encoding="utf-8") as f:
                f.write(config_js)
        except Exception as e:
            log_event(f"Failed to write configuration file {cp}: {e}")

    # 4. LAUNCH PORTALS
    print("\n[*] Starting User Portal...")
    start_service("User Portal")
    for _ in range(10):
        time.sleep(0.5)
        try:
            req = urllib.request.Request(services["User Portal"]["url"])
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status == 200:
                    services["User Portal"]["online"] = True
                    break
        except Exception:
            pass
    if services["User Portal"]["online"]:
        print("  User Portal ......... ONLINE")
    else:
        print("  [WARNING] User Portal failed to respond to initial HTTP request.")

    print("\n[*] Starting Admin Portal...")
    start_service("Admin Portal")
    for _ in range(10):
        time.sleep(0.5)
        try:
            req = urllib.request.Request(services["Admin Portal"]["url"])
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status == 200:
                    services["Admin Portal"]["online"] = True
                    break
        except Exception:
            pass
    if services["Admin Portal"]["online"]:
        print("  Admin Portal ........ ONLINE")
    else:
        print("  [WARNING] Admin Portal failed to respond to initial HTTP request.")

    # 5. OPEN BROWSER ONCE
    print("\n[*] Launching browser portals...")
    try:
        webbrowser.open(services["User Portal"]["url"])
        webbrowser.open(services["Admin Portal"]["url"])
        log_event("Browser pages launched successfully.")
    except Exception as e:
        log_event(f"Failed to open browser: {e}")

    # 6. PERSISTENT SUPERVISOR LOOP
    log_event("Persistent supervisor monitoring loop active.")
    try:
        while True:
            # check statuses
            for name, svc in services.items():
                # check process status
                is_alive = False
                if svc["proc"] and svc["proc"].poll() is None:
                    # process is running; let's do a quick HTTP ping
                    try:
                        req = urllib.request.Request(svc["url"])
                        with urllib.request.urlopen(req, timeout=1.0) as resp:
                            if resp.status == 200 or json.loads(resp.read().decode()).get("status") == "ok":
                                is_alive = True
                    except Exception:
                        pass
                
                svc["online"] = is_alive

                # Auto restart if dead
                if not is_alive:
                    log_event(f"[ALERT] {name} is dead. Attempting automatic restart.")
                    if svc["proc"]:
                        kill_process(svc["proc"].pid)
                    svc["restarts"] += 1
                    svc["last_restart"] = datetime.now().strftime("%H:%M:%S")
                    start_service(name)
                    # wait 2 seconds for boot
                    time.sleep(2)
            
            # check Ollama status
            ollama_status = "OFFLINE"
            try:
                req = urllib.request.Request(f"{ollama_url}/api/tags")
                with urllib.request.urlopen(req, timeout=1.0) as response:
                    if response.status == 200:
                        ollama_status = "ONLINE"
            except Exception:
                pass

            # calculate uptime
            uptime_sec = int(time.time() - START_TIME)
            uptime_str = f"{uptime_sec // 3600:02d}:{(uptime_sec % 3600) // 60:02d}:{uptime_sec % 60:02d}"

            # gather metrics
            cpu = get_cpu_usage()
            mem = get_memory_usage()

            # DRAW DASHBOARD
            os.system("cls" if os.name == "nt" else "clear")
            print("=" * 70)
            print("                  GAYATHRI AI PLATFORM MANAGER V2.0                  ")
            print("=" * 70)
            print(f" Uptime: {uptime_str} | CPU: {cpu} | Memory: {mem}")
            print("=" * 70)
            print(" Service Status:")
            for name, svc in services.items():
                status_str = "ONLINE" if svc["online"] else "OFFLINE"
                print(f"   {name:<20} .............................. [{status_str}]  (Restarts: {svc['restarts']}, Last: {svc['last_restart']})")
            print(f"   {'Ollama AI Engine':<20} .............................. [{ollama_status}]  (External)")
            print("=" * 70)
            print(" System Logs (Last 5 events):")
            for log in LOG_BUFFER:
                print(f"  {log}")
            print("=" * 70)
            print(" Monitoring services active...")
            print(" Press 'Q' to trigger graceful shutdown.")
            print("=" * 70)

            # Non-blocking check for Q
            if msvcrt.kbhit():
                try:
                    key = msvcrt.getch().decode("utf-8").lower()
                except Exception:
                    key = ""
                if key == "q":
                    print("\n[INFO] Shutdown request detected (Q).")
                    break

            time.sleep(3)

    except KeyboardInterrupt:
        print("\n[INFO] KeyboardInterrupt detected. Shutting down...")
    
    # Graceful shutdown on exit
    shutdown_all()
    print("=" * 60)
    print("GSIP Platform Manager exited cleanly.")
    print("=" * 60)

if __name__ == "__main__":
    main()
