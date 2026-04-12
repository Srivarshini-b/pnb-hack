import subprocess
import sys
import re
import json
import urllib.request
import urllib.error
import requests
import socket
import threading
from datetime import datetime

def get_whois_info(domain):
    """Run RDAP REST API and fallback to system whois command to parse registrar and creation date."""
    info = {"registrar": "N/A", "reg_date": "N/A", "organization": "N/A"}
    
    try:
        url = f"https://rdap.org/domain/{domain}"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        for entity in data.get("entities", []):
            if "registrar" in entity.get("roles", []):
                try:
                    for item in entity.get("vcardArray", [])[1]:
                        if item[0] == "fn":
                            info["registrar"] = item[3]
                            break
                except Exception:
                    pass
                    
        for evt in data.get("events", []):
            if evt.get("eventAction") == "registration":
                info["reg_date"] = evt.get("eventDate", "N/A").split("T")[0]
    except Exception:
        pass

    if info["registrar"] == "N/A":
        try:
            result = subprocess.run(["whois", domain], capture_output=True, text=True, timeout=10)
            output = result.stdout
            for pattern in [r"Registrar:\s*(.+)", r"Sponsoring Registrar:\s*(.+)", r"registrar name:\s*(.+)", r"Registrar Name:\s*(.+)"]:
                m = re.search(pattern, output, re.I)
                if m and m.group(1).strip(): info["registrar"] = m.group(1).strip(); break
            for pattern in [r"Creation Date:\s*(.+)", r"Created:\s*(.+)", r"Registration Date:\s*(.+)", r"Created On:\s*(.+)"]:
                m = re.search(pattern, output, re.I)
                if m and m.group(1).strip():
                    raw = m.group(1).strip()
                    info["reg_date"] = raw.split("T")[0] if "T" in raw else raw
                    break
            for pattern in [r"Registrant Organization:\s*(.+)", r"Organisation:\s*(.+)", r"org-name:\s*(.+)", r"Registrant Name:\s*(.+)", r"Registrant:\s*(.+)"]:
                m = re.search(pattern, output, re.I)
                if m and m.group(1).strip(): info["organization"] = m.group(1).strip(); break
        except Exception:
            pass
            
    return info

def get_ip_info(ip_address):
    """Look up IP geolocation and ASN info from the free ip-api.com service."""
    info = {"asn": "N/A", "netname": "N/A", "location": "N/A", "org": "N/A"}
    try:
        url = f"http://ip-api.com/json/{ip_address}?fields=status,country,city,isp,as,org,lat,lon"
        req = urllib.request.Request(url, headers={"User-Agent": "QScan/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            if data.get("status") == "success":
                as_field = data.get("as", "")
                info["asn"] = as_field.split(" ")[0] if as_field else "N/A"
                info["netname"] = data.get("isp", "N/A") or "N/A"
                city = data.get("city", "")
                country = data.get("country", "")
                info["location"] = ", ".join(filter(None, [city, country])) or "N/A"
                info["org"] = data.get("org", "N/A") or "N/A"
                info["lat"] = data.get("lat")
                info["lon"] = data.get("lon")
    except Exception:
        pass
    return info

def get_registered_subdomains(domain):
    """Fetch registered subdomains using multiple passive API fallbacks and scraping."""
    subdomains = set()
    
    # 0. Scrape from the default page of the domain
    try:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    except Exception:
        pass

    for proto in ["https", "http"]:
        try:
            url = f"{proto}://{domain}"
            response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5, verify=False)
            html = response.text
            pattern = r'([a-zA-Z0-9][a-zA-Z0-9.-]*\.' + re.escape(domain) + r')'
            for match in re.findall(pattern, html):
                name = match.lower().strip()
                if name and not name.startswith("*") and name.endswith(domain) and name != domain:
                    subdomains.add(name)
            break
        except Exception:
            pass
            
    # 1. Primary: HackerTarget (Usually very fast, returns verified live targets)
    try:
        url = f"https://api.hackertarget.com/hostsearch/?q={domain}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                data = resp.read().decode('utf-8', errors='ignore').splitlines()
                for line in data:
                    name = line.split(",")[0].strip().lower()
                    if name and not name.startswith("*") and name.endswith(domain) and name != domain:
                        subdomains.add(name)
    except Exception:
        pass
        
    # 2. Secondary: crt.sh (Often 503s on large enterprise targets like sc.com)
    if len(subdomains) < 5:
        try:
            url = f"https://crt.sh/?q=%.{domain}&output=json"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode('utf-8', errors='ignore'))
                    for entry in data:
                        for name in entry.get("name_value", "").split('\n'):
                            name = name.strip().lower()
                            if name and not name.startswith("*") and name.endswith(domain) and name != domain:
                                subdomains.add(name)
        except Exception:
            pass
            
    # 3. Tertiary: CertSpotter (Very reliable JSON output for CT logs)
    if len(subdomains) < 5:
        try:
            url = f"https://api.certspotter.com/v1/issuances?domain={domain}&include_subdomains=true&expand=dns_names"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode('utf-8', errors='ignore'))
                    for entry in data:
                        for name in entry.get("dns_names", []):
                            name = name.strip().lower()
                            if name and not name.startswith("*") and name.endswith(domain) and name != domain:
                                subdomains.add(name)
        except Exception as e:
            print(f"All enumeration fallback APIs failed: {e}", file=sys.stderr)
        
    subdomain_list = list(subdomains)
    
    # Priority keywords for "high-traffic / important" domains
    priority_keywords = ['www', 'api', 'mail', 'app', 'web', 'login', 'portal', 'auth', 'secure', 'vpn', 'cloud', 'sso']
    
    def score_subdomain(sub):
        score = 0
        prefix = sub.replace(f".{domain}", "")
        
        # Penalize very long or seemingly random junk subdomains (like test-mbank.lk...)
        score -= len(prefix) 
        
        if prefix in priority_keywords:
            score += 100
        else:
            for kw in priority_keywords:
                if kw in prefix:
                    score += 20
                    
        # Penalize test/sandbox/dev
        if any(x in prefix for x in ['test', 'dev', 'uat', 'sandbox', 'staging']):
            score -= 50
            
        return score

    # Sort subdomains so highest score is first
    subdomain_list.sort(key=score_subdomain, reverse=True)
    
    total = len(subdomain_list)
    
    # Intelligently limit: Max 20. If between 10-40, return ~50%. Else return all.
    if total > 40:
        limit = 20
    elif total > 10:
        limit = int(total * 0.5)
    else:
        limit = total
        
    return subdomain_list[:limit]

def calculate_subnet(ip_address):
    """Calculate /24 subnet from an IP address."""
    try:
        octets = ip_address.split(".")
        if len(octets) == 4:
            return f"{octets[0]}.{octets[1]}.{octets[2]}.0/24"
    except Exception:
        pass
    return "N/A"

def extract_company_from_cert(subject_str):
    """Extract organization name from X.509 certificate subject string."""
    if not subject_str: return None
    m = re.search(r'O\s*=\s*([^,]+)', subject_str)
    return m.group(1).strip() if m else None

groups_info = {
    "frodo640aes": "PQ", "p256_frodo640aes": "Hybrid", "x25519_frodo640aes": "Hybrid",
    "frodo640shake": "PQ", "p256_frodo640shake": "Hybrid", "x25519_frodo640shake": "Hybrid",
    "frodo976aes": "PQ", "p384_frodo976aes": "Hybrid", "x448_frodo976aes": "Hybrid",
    "frodo976shake": "PQ", "p384_frodo976shake": "Hybrid", "x448_frodo976shake": "Hybrid",
    "frodo1344aes": "PQ", "p521_frodo1344aes": "Hybrid",
    "frodo1344shake": "PQ", "p521_frodo1344shake": "Hybrid",
    "mlkem512": "PQ", "p256_mlkem512": "Hybrid", "x25519_mlkem512": "Hybrid", "bp256_mlkem512": "Hybrid",
    "mlkem768": "PQ", "p384_mlkem768": "Hybrid", "x448_mlkem768": "Hybrid", "bp384_mlkem768": "Hybrid",
    "X25519MLKEM768": "Hybrid", "SecP256r1MLKEM768": "Hybrid",
    "mlkem1024": "PQ", "p521_mlkem1024": "Hybrid", "SecP384r1MLKEM1024": "Hybrid", "bp512_mlkem1024": "Hybrid",
    "bikel1": "PQ", "p256_bikel1": "Hybrid", "x25519_bikel1": "Hybrid",
    "bikel3": "PQ", "p384_bikel3": "Hybrid", "x448_bikel3": "Hybrid",
    "bikel5": "PQ", "p521_bikel5": "Hybrid",
    "X25519": "Classical", "X448": "Classical", "secp256r1": "Classical", "secp384r1": "Classical", "secp521r1": "Classical"
}
def probe_tls_versions(domain, openssl_bin="openssl"):
    """Probe each TLS version individually and return support status."""
    versions = [
        {"name": "SSLv3",   "flag": "-ssl3",   "label": "SSL 3.0"},
        {"name": "TLSv1.0", "flag": "-tls1",   "label": "TLS 1.0"},
        {"name": "TLSv1.1", "flag": "-tls1_1", "label": "TLS 1.1"},
        {"name": "TLSv1.2", "flag": "-tls1_2", "label": "TLS 1.2"},
        {"name": "TLSv1.3", "flag": "-tls1_3", "label": "TLS 1.3"},
    ]
    results = {}

    def test_version(ver):
        cmd = [
            openssl_bin,
            "s_client",
            "-connect", f"{domain}:443",
            "-servername", domain,
            ver["flag"],
            "-cipher",
            "ALL:@SECLEVEL=0"
        ]

        try:
            res = subprocess.run(
                cmd,
                input="Q\n",
                capture_output=True,
                text=True,
                timeout=10
            )

            output = (res.stdout + res.stderr).lower()

            # ❌ Strong failure detection FIRST
            if any(err in output for err in [
                "no protocols available",
                "handshake failure",
                "no peer certificate",
                "unsupported protocol",
                "wrong version number",
                "connection refused"
            ]):
                results[ver["name"]] = {
                    "supported": False,
                    "negotiated": None,
                    "label": ver["label"]
                }
                return

            # ✅ Extract protocol ONLY reliable indicator
            proto_match = re.search(r"protocol\s*:\s*(tlsv1\.[0-3])", output)

            if proto_match:
                negotiated = proto_match.group(1).lower()

                # ✔ Exact match required
                if negotiated == ver["name"].lower():
                    results[ver["name"]] = {
                        "supported": True,
                        "negotiated": negotiated.upper(),
                        "label": ver["label"]
                    }
                else:
                    results[ver["name"]] = {
                        "supported": False,
                        "negotiated": None,
                        "label": ver["label"]
                    }
            else:
                # No protocol line → unsupported
                results[ver["name"]] = {
                    "supported": False,
                    "negotiated": None,
                    "label": ver["label"]
                }

        except Exception:
            results[ver["name"]] = {
                "supported": False,
                "negotiated": None,
                "label": ver["label"]
            }

    threads = []
    for v in versions:
        t = threading.Thread(target=test_version, args=(v,))
        threads.append(t)
        t.start()
    for t in threads:
        t.join()

    return results

def quick_pqc_test(domain, openssl_bin="openssl"):
    """Run a fast PQC test against a domain using all 43 algorithms via threading."""
    try:
        with socket.create_connection((domain, 443), timeout=3): pass
    except Exception: return 0, len(groups_info), "Non-PQC Ready"

    results = {}
    def test_group(group):
        cmd = [openssl_bin, "s_client", "-connect", f"{domain}:443", "-servername", domain, "-tls1_3", "-groups", group, "-provider", "default", "-provider", "oqsprovider"]
        try:
            res = subprocess.run(cmd, input="Q\n", capture_output=True, text=True, timeout=8)
            output = (res.stdout + res.stderr).lower()
            if "server public key is" in output or "ssl handshake has read" in output: results[group] = "FULLY SUPPORTED"
            elif "handshake failure" in output: results[group] = "NOT SUPPORTED"
            else: results[group] = "PARTIALLY SUPPORTED"
        except Exception: results[group] = "ERROR"

    threads = []
    for g in groups_info:
        t = threading.Thread(target=test_group, args=(g,))
        threads.append(t); t.start()
    for t in threads: t.join()

    fully = [g for g, v in results.items() if "FULLY SUPPORTED" in v]
    partial = [g for g, v in results.items() if "PARTIALLY SUPPORTED" in v]
    total_supported = len(fully) + len(partial)
    label = "Non-PQC Ready" if len(fully) == 0 else ("Fully Quantum Safe" if len(fully) == len(groups_info) else "PQC Ready")
    return total_supported, len(groups_info), label

def get_best_cipher(domain, openssl_bin="openssl"):
    """Get the connection cipher suite."""
    cmd = [openssl_bin, "s_client", "-connect", f"{domain}:443", "-servername", domain]
    try:
        res = subprocess.run(cmd, input="Q\n", capture_output=True, text=True, timeout=5)
        m = re.search(r"Cipher\s*(?:is|:)\s*(\S+)", res.stdout + res.stderr)
        val = m.group(1).strip() if m else "Unknown"
        return "Unknown" if val in ["0000", "(NONE)"] else val
    except Exception:
        return "Unknown"

def run_pipeline():
    if len(sys.argv) < 2:
        print("Usage: python3 scanner.py <domain> [openssl_path]", file=sys.stderr)
        sys.exit(1)

    host = sys.argv[1].strip()
    host = re.sub(r'^https?://', '', host).rstrip('/').split('/')[0]
    openssl_bin = sys.argv[2] if len(sys.argv) >= 3 else "openssl"

    cbom_data = {
        "asset_domain": host,
        "scan_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "tls_configuration": {}, "certificate_details": {},
        "pqc_support": {"is_quantum_safe": False, "supported_algorithms": [], "partially_supported_algorithms": [], "rejected_algorithms": [], "status_label": "Unknown"},
        "recommendations": []
    }

    cmd_info = [openssl_bin, "s_client", "-connect", f"{host}:443", "-servername", host, "-showcerts"]
    try:
        result = subprocess.run(cmd_info, input="Q\n", capture_output=True, text=True, timeout=15)
        output = result.stdout + result.stderr
    except Exception as e:
        output = ""  # Proceed aggressively to algorithmic check even on completely dead connection

    # Proceed with algorithmic scan even if the initial connection lacks a typical certificate.

    protocol_match = re.search(r"Protocol\s*:\s*(.*)", output)
    cipher_match = re.search(r"Cipher\s*(?:is|:)\s*(\S+)", output)
    cbom_data["tls_configuration"]["protocol"] = protocol_match.group(1).strip() if protocol_match else "Unknown"
    cipher_value = cipher_match.group(1).strip() if cipher_match else "Unknown"
    if cipher_value in ["0000", "(NONE)"]: cipher_value = "Unknown"
    cbom_data["tls_configuration"]["cipher_suite"] = cipher_value

    # Check TLS version support (SSLv3, 1.0, 1.1, 1.2, 1.3)
    cbom_data["tls_configuration"]["tls_versions"] = probe_tls_versions(host, openssl_bin)

    cert_match = re.search(r"-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----", output, re.S)
    target_ip = "Unknown"
    try: target_ip = socket.gethostbyname(host)
    except Exception: pass
    fingerprint = "Unknown"
    
    if cert_match:
        certificate = "-----BEGIN CERTIFICATE-----" + cert_match.group(1) + "-----END CERTIFICATE-----"
        cert_text = subprocess.run([openssl_bin, "x509", "-text", "-noout"], input=certificate, capture_output=True, text=True).stdout
        fp_out = subprocess.run([openssl_bin, "x509", "-noout", "-fingerprint", "-sha256"], input=certificate, capture_output=True, text=True).stdout
        fp_match = re.search(r"Fingerprint=(.*)", fp_out, re.I)
        if fp_match: fingerprint = fp_match.group(1).replace(":", "").strip()

        cbom_data["certificate_details"] = {
            "subject": (re.search(r"Subject: (.*)", cert_text) or [None, "Unknown"])[1].strip(),
            "issuer": (re.search(r"Issuer: (.*)", cert_text) or [None, "Unknown"])[1].strip(),
            "signature_algorithm": (re.search(r"Signature Algorithm: (.*)", cert_text) or [None, "Unknown"])[1].strip(),
            "public_key_size": (re.search(r"(\d+)\s*bit", cert_text, re.I) or [None, "Unknown"])[1],
            "valid_from": (re.search(r"Not Before:\s*(.*)", cert_text) or [None, "Unknown"])[1].strip(),
            "valid_until": (re.search(r"Not After :\s*(.*)", cert_text) or [None, "Unknown"])[1].strip()
        }

    # Gather potential subdomains using standard fallback list + crt.sh registered certs
    common_subdomains = [ "www", "api", "mail", "dev", "vpn", "portal", "admin", "webmail",
        "remote", "ftp", "ssh", "test", "staging", "uat", "beta", "demo",
        "cdn", "static", "assets", "media", "images", "img", "video",
        "app", "mobile", "m", "login", "auth", "sso", "oauth", "iam",
        "dashboard", "panel", "console", "manage", "cms", "blog", "news",
        "shop", "store", "pay", "payment", "gateway", "checkout", "billing",
        "db", "database", "sql", "mysql", "postgres", "mongo", "redis", "cache",
        "ns1", "ns2", "dns", "dns1", "dns2", "mx", "mx1", "mx2", "smtp", "imap", "pop",
        "git", "gitlab", "github", "svn", "repo", "ci", "cd", "jenkins", "build",
        "monitoring", "grafana", "prometheus", "kibana", "elk", "logs", "log",
        "backup", "bak", "archive", "old", "legacy", "v1", "v2", "v3",
        "secure", "ssl", "tls", "cert", "pki",
        "intranet", "internal", "corp", "corporate", "erp", "crm", "hr",
        "exchange", "owa", "autodiscover", "outlook",
        "cloud", "aws", "azure", "gcp",
        "proxy", "lb", "loadbalancer", "gateway", "edge", "waf",
        "api-gateway", "rest", "graphql", "ws", "websocket",
        "docs", "doc", "help", "support", "kb", "wiki", "confluence", "jira",
        "status", "health", "monitor", "uptime",
        "nps", "survey", "feedback", "ticket",
        "sandbox", "qa", "preprod", "stage",
        "ib", "netbanking", "ebanking", "onlinebanking", "neft", "rtgs", "upi",
        "treasury", "forex", "trade", "swift",
]
    discovered_domains = []; discovered_ips = set(); discovered_ips_list = []
    parts = host.split('.')
    base_domain = '.'.join(parts[1:]) if (len(parts) > 2 and parts[0] == 'www') else host
    
    # dynamically fetch registered subdomains
    registered_subs = get_registered_subdomains(base_domain)
    candidate_subdomains = set([f"{sub}.{base_domain}" for sub in common_subdomains] + registered_subs)
    
    scan_date_str = cbom_data["scan_date"].split(" ")[0]

    whois_info = get_whois_info(base_domain)
    company_name = extract_company_from_cert(cbom_data["certificate_details"].get("subject", "")) or whois_info["organization"]
    if not company_name or company_name == "N/A":
        company_name = parts[-3].upper() if len(parts) > 2 else (parts[-2].upper() if len(parts) > 1 else "N/A")

    main_pqc_supported, main_pqc_total, main_pqc_label = quick_pqc_test(host, openssl_bin)
    main_cipher = cbom_data["tls_configuration"].get("cipher_suite", "Unknown")
    discovered_domains.append({"detectionDate": scan_date_str, "domain": host, "regDate": whois_info["reg_date"], "registrar": whois_info["registrar"], "company": company_name, "pqcSupported": main_pqc_supported, "pqcStatus": main_pqc_label, "cipherSuite": main_cipher})
    
    if target_ip != "Unknown":
        discovered_ips.add(target_ip); ip_info = get_ip_info(target_ip)
        discovered_ips_list.append({"detectionDate": scan_date_str, "ip": target_ip, "ports": "443", "subnet": calculate_subnet(target_ip), "asn": ip_info["asn"], "netname": ip_info["netname"], "location": ip_info["location"], "lat": ip_info.get("lat"), "lon": ip_info.get("lon"), "company": ip_info["org"] if ip_info["org"] != "N/A" else company_name, "pqcSupported": main_pqc_supported, "pqcStatus": main_pqc_label})

    for candidate in candidate_subdomains:
        if candidate == host: continue
        try:
            ip = socket.gethostbyname(candidate)
            s_pqc_supp, s_pqc_tot, s_pqc_lab = quick_pqc_test(candidate, openssl_bin)
            s_cipher = get_best_cipher(candidate, openssl_bin)
            discovered_domains.append({"detectionDate": scan_date_str, "domain": candidate, "regDate": whois_info["reg_date"], "registrar": whois_info["registrar"], "company": company_name, "pqcSupported": s_pqc_supp, "pqcStatus": s_pqc_lab, "cipherSuite": s_cipher})
            if ip not in discovered_ips:
                discovered_ips.add(ip); s_ip = get_ip_info(ip)
                discovered_ips_list.append({"detectionDate": scan_date_str, "ip": ip, "ports": "443, 80", "subnet": calculate_subnet(ip), "asn": s_ip["asn"], "netname": s_ip["netname"], "location": s_ip["location"], "lat": s_ip.get("lat"), "lon": s_ip.get("lon"), "company": s_ip["org"] if s_ip["org"] != "N/A" else company_name, "pqcSupported": s_pqc_supp, "pqcStatus": s_pqc_lab})
        except: pass

    cbom_data["asset_inventory"] = {"domains": discovered_domains, "certificates": [{"detectionDate": scan_date_str, "fingerprint": fingerprint, "validFrom": cbom_data["certificate_details"].get("valid_from", "N/A"), "commonName": cbom_data["certificate_details"].get("subject", "N/A"), "company": company_name, "ca": cbom_data["certificate_details"].get("issuer", "N/A")}] if cert_match else [], "ips": discovered_ips_list}

    results = {}
    def test_full_group(group):
        cmd = [openssl_bin, "s_client", "-connect", f"{host}:443", "-servername", host, "-tls1_3", "-groups", group, "-provider", "default", "-provider", "oqsprovider"]
        try:
            result = subprocess.run(cmd, input="Q\n", capture_output=True, text=True, timeout=15)
            output = (result.stdout + result.stderr).lower()
            
            group_type = "PURE PQ" if groups_info[group] == "PQ" else ("HYBRID PQ" if groups_info[group] == "Hybrid" else "CLASSICAL")
            
            if "server public key is" in output or "ssl handshake has read" in output:
                results[group] = f"FULLY SUPPORTED – {group_type}"
            elif "handshake failure" in output or "no protocol" in output or "protocol version" in output or "ssl/tls alert" in output:
                results[group] = f"NOT SUPPORTED – {group_type}"
            else:
                results[group] = f"PARTIALLY SUPPORTED – {group_type}"
        except Exception as e:
            group_type = "PURE PQ" if groups_info[group] == "PQ" else ("HYBRID PQ" if groups_info[group] == "Hybrid" else "CLASSICAL")
            results[group] = f"ERROR – {group_type}"

    workers = []
    for g in groups_info:
        t = threading.Thread(target=test_full_group, args=(g,))
        workers.append(t)
        t.start()
    for w in workers: w.join()

    supported_pqc = [g for g, v in results.items() if "FULLY SUPPORTED" in v]
    partially_supported_pqc = [g for g, v in results.items() if "PARTIALLY SUPPORTED" in v]
    cbom_data["pqc_support"] = {
        "supported_algorithms": supported_pqc,
        "partially_supported_algorithms": partially_supported_pqc,
        "rejected_algorithms": [g for g, v in results.items() if "NOT SUPPORTED" in v or "ERROR" in v],
        "is_quantum_safe": len(supported_pqc) > 0,
        "status_label": "Fully Quantum Safe" if len(supported_pqc) == (len(groups_info)-5) else ("PQC Ready" if len(supported_pqc) > 0 else "Non-PQC Ready"),
        "rawResults": results
    }
    
    if len(supported_pqc) > 0: cbom_data["recommendations"].append("Maintain current NIST-standardized Post-Quantum algorithms.")
    else: 
        cbom_data["recommendations"].append("Vulnerable to Harvest Now, Decrypt Later (HNDL) attacks.")
        cbom_data["recommendations"].append("Upgrade TLS stack to support hybrid ML-KEM key exchanges.")

    # --- Final Scoring (0-1000) ---
    # 1. BASE HYGIENE SCORE (Max 500)
    # Focuses on classical strength: TLS Version, Cipher, and Key Size
    hygiene_score = 0
    
    # TLS Protocol (Max 200)
    prot = cbom_data["tls_configuration"].get("protocol", "")
    if "TLSv1.3" in prot: hygiene_score += 200
    elif "TLSv1.2" in prot: hygiene_score += 150
    else: hygiene_score += 50

    # Cipher Suite (Max 200)
    ciph = cbom_data["tls_configuration"].get("cipher_suite", "").upper()
    if any(x in ciph for x in ["GCM", "CHACHA20", "POLY1305"]): hygiene_score += 200
    elif "AES" in ciph: hygiene_score += 100
    
    # RSA/ECC Key Strength (Max 100)
    try:
        ks = int(re.search(r"\d+", str(cbom_data["certificate_details"].get("public_key_size", "0"))).group())
        if ks >= 4096: hygiene_score += 100
        elif ks >= 2048: hygiene_score += 80
    except: pass

    # 2. QUANTUM READINESS MULTIPLIER (Max 500)
    # Based on NIST FIPS 203/204/205 standards
    pqc_score = 0
    supported = supported_pqc
    partial = partially_supported_pqc
    
    # Weight algorithms by NIST Security Category
    # Level 5 (ML-KEM-1024) > Level 3 (ML-KEM-768) > Level 1 (ML-KEM-512)
    high_strength_pqc = [g for g in supported if "1024" in g or "l5" in g or "1344" in g]
    mid_strength_pqc = [g for g in supported if "768" in g or "l3" in g or "976" in g]
    
    if len(supported) > 0:
        pqc_score += 200  # Fundamental 'Quantum-Ready' baseline
        
        # Reward Diversity: Having both Pure PQ and Hybrid is the "Elite" research standard
        has_hybrid = any("p256" in g or "x25519" in g for g in supported)
        if has_hybrid: pqc_score += 100
        
        # Reward Strength
        if len(high_strength_pqc) > 0: pqc_score += 200
        elif len(mid_strength_pqc) > 0: pqc_score += 150
        else: pqc_score += 100
        
    elif len(partial) > 0:
        # Partial support is "Fragile" in research—it shows intent but no security
        pqc_score = 75 

    # 3. FINAL AGGREGATION
    final_score = hygiene_score + pqc_score
    
    # CAPPING & SAFETY FLOORS
    # Research Justification: An "Elite" score (>800) MUST have both TLS 1.3 AND PQC.
    if len(supported) == 0:
        final_score = min(final_score, 749) # Cannot enter Tier-1 without PQC
        
    score = min(1000, final_score)
    cbom_data["security_score"] = score

    tier, s_lvl, status = ("Tier-3 Legacy", "Weak but operational", "Legacy")
    if score > 750: tier, s_lvl, status = ("Tier-1 Elite", "Modern best-practise crypto posture", "Elite-PQC")
    elif score >= 500: tier, s_lvl, status = ("Tier-2 Standard", "Acceptable enterprise configuration", "Standard")
    
    cbom_data["cyber_rating"] = {
        "tier": tier, "securityLevel": s_lvl, "status": status,
        "complianceCriteria": "TLS 1.2+; AES-GCM; Key >= 2048-bit" if tier != "Tier-3 Legacy" else "Legacy protocols or weak ciphers",
        "priorityAction": "Begin PQC migration" if tier == "Tier-2 Standard" else ("Maintain posture" if tier == "Tier-1 Elite" else "Immediate TLS upgrade required")
    }

    print(json.dumps(cbom_data))

    # Save to JSON file for the dashboard "View Raw JSON" feature
    import os
    json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scan_results.json")
    with open(json_path, "w") as f:
        json.dump(cbom_data, f, indent=2)

if __name__ == "__main__": run_pipeline()
