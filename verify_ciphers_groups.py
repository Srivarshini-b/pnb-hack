
import subprocess
import sys
import threading

if len(sys.argv) != 3:
    print("Usage: python3 verify_pq_ciphers.py <host_or_ip> <openssl_path>")
    sys.exit(1)

host = sys.argv[1]
openssl_bin = sys.argv[2]

# Define PQ, Hybrid PQ, and Classical TLS 1.3 groups
groups_info = {
    # Frodo (pure PQ)
    "frodo640aes": "PQ",
    "p256_frodo640aes": "Hybrid",
    "x25519_frodo640aes": "Hybrid",
    "frodo640shake": "PQ",
    "p256_frodo640shake": "Hybrid",
    "x25519_frodo640shake": "Hybrid",
    "frodo976aes": "PQ",
    "p384_frodo976aes": "Hybrid",
    "x448_frodo976aes": "Hybrid",
    "frodo976shake": "PQ",
    "p384_frodo976shake": "Hybrid",
    "x448_frodo976shake": "Hybrid",
    "frodo1344aes": "PQ",
    "p521_frodo1344aes": "Hybrid",
    "frodo1344shake": "PQ",
    "p521_frodo1344shake": "Hybrid",

    # ML-KEM
    "mlkem512": "PQ",
    "p256_mlkem512": "Hybrid",
    "x25519_mlkem512": "Hybrid",
    "bp256_mlkem512": "Hybrid",
    "mlkem768": "PQ",
    "p384_mlkem768": "Hybrid",
    "x448_mlkem768": "Hybrid",
    "bp384_mlkem768": "Hybrid",
    "X25519MLKEM768": "Hybrid",
    "SecP256r1MLKEM768": "Hybrid",
    "mlkem1024": "PQ",
    "p521_mlkem1024": "Hybrid",
    "SecP384r1MLKEM1024": "Hybrid",
    "bp512_mlkem1024": "Hybrid",

    # BIKE
    "bikel1": "PQ",
    "p256_bikel1": "Hybrid",
    "x25519_bikel1": "Hybrid",
    "bikel3": "PQ",
    "p384_bikel3": "Hybrid",
    "x448_bikel3": "Hybrid",
    "bikel5": "PQ",
    "p521_bikel5": "Hybrid",

    # Classical TLS 1.3
    "X25519": "Classical",
    "X448": "Classical",
    "secp256r1": "Classical",
    "secp384r1": "Classical",
    "secp521r1": "Classical",
}

results = {}

def test_group(group):
    cmd = [
        openssl_bin,
        "s_client",
        "-connect", f"{host}:443",
        "-servername", host,
        "-tls1_3",
        "-groups", group,
        "-provider", "default",
        "-provider", "oqsprovider"
    ]
    try:
        result = subprocess.run(cmd, input="Q\n", capture_output=True, text=True, timeout=15)
        output = (result.stdout + result.stderr).lower()

        if "server public key is" in output or "ssl handshake has read" in output:
            if groups_info[group] == "PQ":
                results[group] = "FULLY SUPPORTED – PURE PQ"
            elif groups_info[group] == "Hybrid":
                results[group] = "FULLY SUPPORTED – HYBRID PQ"
            else:
                results[group] = "FULLY SUPPORTED – CLASSICAL"
        elif "handshake failure" in output:
            if groups_info[group] == "PQ":
                results[group] = "NOT SUPPORTED – PURE PQ"
            elif groups_info[group] == "Hybrid":
                results[group] = "NOT SUPPORTED – HYBRID PQ"
            else:
                results[group] = "NOT SUPPORTED – CLASSICAL"
        else:
            if groups_info[group] == "PQ":
                results[group] = "PARTIALLY SUPPORTED – PURE PQ"
            elif groups_info[group] == "Hybrid":
                results[group] = "PARTIALLY SUPPORTED – HYBRID PQ"
            else:
                results[group] = "PARTIALLY SUPPORTED – CLASSICAL"

    except subprocess.TimeoutExpired:
        results[group] = f"NOT SUPPORTED (Timeout) – {groups_info[group]}"
    except Exception as e:
        results[group] = f"ERROR ({e}) – {groups_info[group]}"

# Launch threads
threads = []
for g in groups_info:
    t = threading.Thread(target=test_group, args=(g,))
    threads.append(t)
    t.start()

for t in threads:
    t.join()

# Print results
print("="*80)
print(f"POST-QUANTUM TLS GROUP VERIFICATION FOR {host}")
print("="*80)

for g in groups_info:
    print(f"{g:<25} : {results[g]}")

print("="*80)

# Categorize results
full_pq = [g for g,v in results.items() if v == "FULLY SUPPORTED – PURE PQ"]
full_hybrid = [g for g,v in results.items() if v == "FULLY SUPPORTED – HYBRID PQ"]
partial_pq = [g for g,v in results.items() if v == "PARTIALLY SUPPORTED – PURE PQ"]
partial_hybrid = [g for g,v in results.items() if v == "PARTIALLY SUPPORTED – HYBRID PQ"]
full_classical = [g for g,v in results.items() if "CLASSICAL" in v and "FULLY SUPPORTED" in v]
not_supported = [g for g,v in results.items() if "NOT SUPPORTED" in v]

print(f"[✓] Fully Supported – Pure PQ : {len(full_pq)} -> {full_pq}")
print(f"[✓] Fully Supported – Hybrid PQ : {len(full_hybrid)} -> {full_hybrid}")
print(f"[~] Partially Supported – Pure PQ : {len(partial_pq)} -> {partial_pq}")
print(f"[~] Partially Supported – Hybrid PQ : {len(partial_hybrid)} -> {partial_hybrid}")
print(f"[✓] Fully Supported – Classical : {len(full_classical)} -> {full_classical}")
print(f"[✗] Not Supported : {len(not_supported)} -> {not_supported}")
print("="*80)
