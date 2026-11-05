import os
import sys
import subprocess
import time
from datetime import datetime

PID_FILE = os.path.join("logs", "services.pid")
LAUNCHER_LOG = os.path.join("logs", "launcher.log")

def log_event(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LAUNCHER_LOG, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {msg}\n")

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

def kill_process(pid):
    try:
        subprocess.run(f"taskkill /F /T /PID {pid}", shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except Exception as e:
        log_event(f"Failed to terminate PID {pid}: {e}")
        return False

def main():
    print("=" * 60)
    print("             GAYATHRI AI SHUTDOWN UTILITY")
    print("=" * 60)
    log_event("--- Shutdown Process Triggered ---")

    # 1. Kill known pids from services.pid
    if os.path.exists(PID_FILE):
        pids = []
        with open(PID_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    pids.append(line)
        for pid in pids:
            print(f"[*] Terminating registered Process ID: {pid}...")
            kill_process(pid)
            
    # 2. Check and terminate active port listeners
    target_ports = [8100, 3100, 3101]
    for port in target_ports:
        state, pid, owner = check_port_status(port)
        if state != "FREE" and state != "TIME_WAIT" and pid:
            print(f"[*] Port {port} occupied by PID {pid} ({owner}). Terminating...")
            kill_process(pid)

    # 3. Wait until sockets release
    print("\nWaiting for port socket release...")
    released_all = False
    for attempt in range(10):
        states = []
        for port in target_ports:
            state, _, _ = check_port_status(port)
            states.append(state in ["FREE", "TIME_WAIT"])
        if all(states):
            released_all = True
            break
        time.sleep(1)

    # 4. Verify status of port 8100
    state_8100, _, _ = check_port_status(8100)
    print(f"\nPort 8100 state verification: {state_8100}")
    if state_8100 in ["FREE", "TIME_WAIT"]:
        print("Port 8100: FREE")
    else:
        print("Port 8100: OCCUPIED")

    try:
        if os.path.exists(PID_FILE):
            os.remove(PID_FILE)
        print("[+] Services process catalog cleaned.")
    except Exception:
        pass

    print("\n" + "=" * 60)
    print("[+] All registered services stopped successfully.")
    print("=" * 60)

if __name__ == "__main__":
    main()
