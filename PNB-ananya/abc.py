import subprocess
import sys
import re

# -------------------------------
# CHECK INPUT
# -------------------------------
if len(sys.argv) != 2:
    print("Usage: python3 crypto_inventory_scan.py <host>")
    sys.exit(1)

host = sys.argv[1]
openssl_bin = "openssl"

print("=" * 70)
print("        CRYPTOGRAPHIC INVENTORY SCANNER")
print("=" * 70)
print("Target Host :", host)
print()


# -------------------------------
# RUN TLS HANDSHAKE
# -------------------------------
cmd = [
    openssl_bin,
    "s_client",
    "-connect", f"{host}:443",
    "-servername", host,
    "-showcerts"
]

try:
    result = subprocess.run(
        cmd,
        input="Q\n",
        capture_output=True,
        text=True,
        timeout=15
    )

    output = result.stdout + result.stderr

except Exception as e:
    print("Connection failed:", e)
    sys.exit(1)


# -------------------------------
# EXTRACT PROTOCOL + CIPHER
# -------------------------------
protocol_match = re.search(r"Protocol\s*:\s*(.*)", output)
cipher_match = re.search(r"Cipher\s*:\s*(.*)", output)

protocol = protocol_match.group(1).strip() if protocol_match else "Unknown"
cipher = cipher_match.group(1).strip() if cipher_match else "Unknown"

print("PROTOCOL INFORMATION")
print("-" * 40)
print("Protocol Name     : TLS")
print("Version           :", protocol)
print("Cipher Suite      :", cipher)
print()


# -------------------------------
# EXTRACT CERTIFICATE
# -------------------------------
cert_match = re.search(
    r"-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----",
    output,
    re.S
)

if not cert_match:
    print("No certificate found.")
    sys.exit(1)

cert_content = cert_match.group(1) if cert_match else ""
certificate = "-----BEGIN CERTIFICATE-----" + cert_content + "-----END CERTIFICATE-----"


# -------------------------------
# DECODE CERTIFICATE
# -------------------------------
cert_cmd = [
    openssl_bin,
    "x509",
    "-text",
    "-noout"
]

cert_result = subprocess.run(
    cert_cmd,
    input=certificate,
    capture_output=True,
    text=True
)

cert_text = cert_result.stdout


# -------------------------------
# PARSE CERTIFICATE INFORMATION
# -------------------------------
subject_match = re.search(r"Subject: (.*)", cert_text)
issuer_match = re.search(r"Issuer: (.*)", cert_text)
signature_match = re.search(r"Signature Algorithm: (.*)", cert_text)
pubkey_match = re.search(r"Public-Key: \((\d+) bit\)", cert_text)
not_before_match = re.search(r"Not Before:\s*(.*)", cert_text)
not_after_match = re.search(r"Not After :\s*(.*)", cert_text)

subject = subject_match.group(1).strip() if subject_match else "Unknown"
issuer = issuer_match.group(1).strip() if issuer_match else "Unknown"
signature_algo = signature_match.group(1).strip() if signature_match else "Unknown"
key_size = pubkey_match.group(1) if pubkey_match else "Unknown"
not_before = not_before_match.group(1).strip() if not_before_match else "Unknown"
not_after = not_after_match.group(1).strip() if not_after_match else "Unknown"

print("CERTIFICATE INFORMATION")
print("-" * 40)
print("Certificate Name  :", host)
print("Certificate Type  : X.509")
print("Subject Name      :", subject)
print("Issuer Name       :", issuer)
print("Signature Alg     :", signature_algo)
print("Public Key Size   :", key_size, "bits")
print("Valid From        :", not_before)
print("Valid Until       :", not_after)
print("Certificate Format: X.509")
print("Certificate Ext   : .crt")
print()


# -------------------------------
# CRYPTOGRAPHIC ALGORITHMS
# -------------------------------
print("CRYPTOGRAPHIC ALGORITHMS")
print("-" * 40)

if cipher != "Unknown":
    parts = cipher.split("_")

    encryption = parts[1] if len(parts) > 1 else "Unknown"
    mode = parts[2] if len(parts) > 2 else "Unknown"
    hash_algo = parts[-1] if len(parts) > 0 else "Unknown"

    print("Algorithm Name    :", cipher)
    print("Primitive         : Encryption / Hash")
    print("Mode              :", mode)
    print("Crypto Functions  : Encryption, Integrity")
    print("Hash Algorithm    :", hash_algo)

print()


# -------------------------------
# PQC GROUP VERIFICATION
# -------------------------------
pq_groups = [

    # FrodoKEM
    "frodo640aes",
    "frodo640shake",
    "frodo976aes",
    "frodo976shake",
    "frodo1344aes",
    "frodo1344shake",

    # ML-KEM (Kyber - NIST Standard)
    "mlkem512",
    "mlkem768",
    "mlkem1024",
    "X25519MLKEM768",
    "SecP256r1MLKEM768",
    "SecP384r1MLKEM1024",

    # BIKE
    "bikel1",
    "bikel3",
    "bikel5"
]

print("POST-QUANTUM TLS GROUP VERIFICATION")
print("-" * 40)

supported = []

for group in pq_groups:

    cmd = [
        openssl_bin,
        "s_client",
        "-connect", f"{host}:443",
        "-servername", host,
        "-tls1_3",
        "-groups", group
    ]

    try:
        result = subprocess.run(
            cmd,
            input="Q\n",
            capture_output=True,
            text=True,
            timeout=10
        )

        combined = result.stdout + result.stderr

        if "handshake failure" in combined.lower():
            print(f"[-] {group:<25} : NOT SUPPORTED")

        elif "CONNECTED" in combined:
            print(f"[+] {group:<25} : SUPPORTED")
            supported.append(group)

        else:
            print(f"[-] {group:<25} : NOT SUPPORTED")

    except Exception as e:
        print(f"[?] {group:<25} : ERROR ({e})")

print()


# -------------------------------
# SUMMARY
# -------------------------------
print("=" * 70)
print("CRYPTOGRAPHIC INVENTORY SUMMARY")
print("=" * 70)

print("Protocol Version  :", protocol)
print("Cipher Suite      :", cipher)
print("Signature Alg     :", signature_algo)
print("Public Key Size   :", key_size, "bits")

print()
print("PQC Supported Groups:")

if supported:
    for g in supported:
        print(" -", g)
else:
    print("None")

print("=" * 70)