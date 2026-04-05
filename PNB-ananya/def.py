import subprocess
import sys
import re
import json
from datetime import datetime

def run_pipeline():
    # -------------------------------
    # 1. SETUP & INPUT CHECKS
    # -------------------------------
    if len(sys.argv) < 2 or len(sys.argv) > 3:
        print("Usage: python3 qscan_pipeline.py <domain> [openssl_path]")
        print("Example: python3 qscan_pipeline.py www.pnbindia.in /usr/local/oqs/bin/openssl")
        sys.exit(1)

    host = sys.argv[1]
    # Default to 'openssl' if no custom path is provided
    openssl_bin = sys.argv[2] if len(sys.argv) == 3 else "openssl"

    print("=" * 70)
    print(" 🚀 QScan: QUANTUM-SAFE COMMUNICATION CAPABILITY SCANNER")
    print("=" * 70)
    print(f"Target Host : {host}")
    print(f"Scanner     : {openssl_bin}")
    print("Status      : Scanning...\n")

    cbom_data = {
        "asset_domain": host,
        "scan_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "tls_configuration": {},
        "certificate_details": {},
        "pqc_support": {
            "is_quantum_safe": False,
            "supported_algorithms": [],
            "status_label": "Non-PQC Ready"
        },
        "recommendations": []
    }

    # -------------------------------
    # 2. EXTRACT TLS & CIPHER INFO
    # -------------------------------
    cmd_info = [
        openssl_bin, "s_client", "-connect", f"{host}:443", 
        "-servername", host, "-showcerts"
    ]

    try:
        result = subprocess.run(cmd_info, input="Q\n", capture_output=True, text=True, timeout=15)
        output = result.stdout + result.stderr
    except Exception as e:
        print(f"[!] Connection failed: {e}")
        sys.exit(1)

    protocol_match = re.search(r"Protocol\s*:\s*(.*)", output)
    cipher_match = re.search(r"Cipher\s*:\s*(.*)", output)
    
    cbom_data["tls_configuration"]["protocol"] = protocol_match.group(1).strip() if protocol_match else "Unknown"
    cbom_data["tls_configuration"]["cipher_suite"] = cipher_match.group(1).strip() if cipher_match else "Unknown"

    # -------------------------------
    # 3. EXTRACT & PARSE CERTIFICATE
    # -------------------------------
    cert_match = re.search(r"-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----", output, re.S)
    
    if cert_match:
        certificate = "-----BEGIN CERTIFICATE-----" + cert_match.group(1) + "-----END CERTIFICATE-----"
        cert_cmd = [openssl_bin, "x509", "-text", "-noout"]
        cert_result = subprocess.run(cert_cmd, input=certificate, capture_output=True, text=True)
        cert_text = cert_result.stdout

        cbom_data["certificate_details"] = {
            "subject": (re.search(r"Subject: (.*)", cert_text) or [None, "Unknown"])[1].strip(),
            "issuer": (re.search(r"Issuer: (.*)", cert_text) or [None, "Unknown"])[1].strip(),
            "signature_algorithm": (re.search(r"Signature Algorithm: (.*)", cert_text) or [None, "Unknown"])[1].strip(),
            "public_key_size": (re.search(r"Public-Key: \((\d+) bit\)", cert_text) or [None, "Unknown"])[1],
            "valid_from": (re.search(r"Not Before:\s*(.*)", cert_text) or [None, "Unknown"])[1].strip(),
            "valid_until": (re.search(r"Not After :\s*(.*)", cert_text) or [None, "Unknown"])[1].strip()
        }

    # -------------------------------
    # 4. EXHAUSTIVE PQC GROUP VERIFICATION
    # -------------------------------
    print("Testing Post-Quantum Algorithms...")
    pq_groups = [
        "mlkem512", "p256_mlkem512", "x25519_mlkem512",
        "mlkem768", "p384_mlkem768", "x448_mlkem768", "X25519MLKEM768", "SecP256r1MLKEM768",
        "mlkem1024", "p521_mlkem1024", "SecP384r1MLKEM1024",
        "frodo640aes", "x25519_frodo640aes", "frodo976aes", "x448_frodo976aes",
        "bikel1", "x25519_bikel1", "bikel3"
    ]

    supported_pqc = []
    
    for group in pq_groups:
        cmd_pqc = [
            openssl_bin, "s_client", "-connect", f"{host}:443",
            "-servername", host, "-tls1_3", "-groups", group
        ]
        try:
            res = subprocess.run(cmd_pqc, input="Q\n", capture_output=True, text=True, timeout=5)
            combined = (res.stdout + res.stderr).lower()
            
            if "server public key is" in combined or "ssl handshake has read" in combined or "connected(" in combined:
                if "handshake failure" not in combined:
                    print(f"  [+] {group:<20} : SUPPORTED")
                    supported_pqc.append(group)
        except subprocess.TimeoutExpired:
            pass # Skip on timeout to keep things moving
        except Exception:
            pass

    cbom_data["pqc_support"]["supported_algorithms"] = supported_pqc

    # -------------------------------
    # 5. ASSIGN LABELS & RECOMMENDATIONS
    # -------------------------------
    if supported_pqc:
        cbom_data["pqc_support"]["is_quantum_safe"] = True
        cbom_data["pqc_support"]["status_label"] = "CERTIFIED: Post Quantum Cryptography (PQC) Ready 🛡️"
        cbom_data["recommendations"].append("Maintain current NIST-standardized Post-Quantum algorithms.")
    else:
        cbom_data["pqc_support"]["is_quantum_safe"] = False
        cbom_data["pqc_support"]["status_label"] = "WARNING: Non-PQC Ready ⚠️"
        cbom_data["recommendations"].append("Vulnerable to Harvest Now, Decrypt Later (HNDL) attacks.")
        cbom_data["recommendations"].append("Actionable: Upgrade TLS stack to support hybrid ML-KEM key exchanges (e.g., X25519MLKEM768).")

    # -------------------------------
    # 6. OUTPUT CBOM TO CONSOLE & FILE
    # -------------------------------
    print("\n" + "=" * 70)
    print(" 📄 CRYPTOGRAPHIC BILL OF MATERIALS (CBOM) REPORT")
    print("=" * 70)
    
    cbom_json = json.dumps(cbom_data, indent=4)
    print(cbom_json)

    # Save to file
    filename = f"CBOM_{host.replace('.', '_')}.json"
    with open(filename, "w") as f:
        f.write(cbom_json)
    
    print("\n" + "=" * 70)
    print(f"✅ Scan Complete. CBOM saved locally as: {filename}")
    print(f"🏷️  Final Label: {cbom_data['pqc_support']['status_label']}")
    print("=" * 70)

if __name__ == "__main__":
    run_pipeline()