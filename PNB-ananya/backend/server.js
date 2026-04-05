require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { exec } = require('child_process');
const ScanReport = require('./models/ScanReport');

const SYSTEM_PROMPT = `ROLE: You are the "Quantum-Resistant Architect" (QRA), a Tier-1 Cybersecurity Auditor.`;

async function getAIRecommendations(scanData, securityScore) {
  // Since we cannot use external APIs or open source local models, 
  // we use a deterministic rule-based generator for static analysis.
  return `## Overall Assessment
The asset **${scanData.asset_domain}** presents a risk profile regarding Post-Quantum Cryptography (PQC) readiness. With a readiness score of **${securityScore}/1000**, the current cryptographic architecture needs attention.

## Key Findings
* **Protocol:** ${scanData.tls_configuration.protocol}
* **Cipher:** ${scanData.tls_configuration.cipher_suite}
* **PQC Status:** ${scanData.pqc_support.status_label}

## Risks (HNDL threats)
Exposure to "Harvest Now, Decrypt Later" (HNDL) attacks remains a concern for classical-only architectures. This is a critical liability as quantum computers mature.

## Recommendations
1. **Implement Hybrid Key Exchange**: Move toward X25519+ML-KEM.
2. **Upgrade TLS stack**: Ensure your Nginx/OpenSSL supports FIPS 203/204 standards (ML-KEM/ML-DSA).
3. **Continuous Monitoring**: Schedule weekly scans to detect new legacy vulnerabilities.`;
}

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/qscan';
mongoose.connect(MONGO_URI).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.post('/api/scan', (req, res) => {
  let { target } = req.body;
  if (!target) return res.status(400).json({ error: 'Target domain is required' });

  target = target.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '').split('/')[0];

  exec(`python3 scanner.py ${target}`, { maxBuffer: 1024 * 1024 * 5 }, async (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).json({ error: 'Scan failed. Check domain connectivity.' });
    }

    try {
      const scanData = JSON.parse(stdout);
      if (scanData.error) return res.status(500).json({ error: scanData.error });

      const securityScore = scanData.security_score || 0;
      const cyberRating = scanData.cyber_rating || {
        tier: 'Tier-3 Legacy',
        securityLevel: 'Unknown',
        status: 'Legacy',
        complianceCriteria: 'Manual review required',
        priorityAction: 'Upgrade TLS stack'
      };

      const newReport = new ScanReport({
        target: scanData.asset_domain,
        tlsConfiguration: {
          protocol: scanData.tls_configuration.protocol,
          cipherSuite: scanData.tls_configuration.cipher_suite,
          tlsVersions: scanData.tls_configuration.tls_versions || {}
        },
        certificateDetails: {
          subject: scanData.certificate_details.subject,
          issuer: scanData.certificate_details.issuer,
          signatureAlgorithm: scanData.certificate_details.signature_algorithm,
          publicKeySize: scanData.certificate_details.public_key_size,
          validFrom: scanData.certificate_details.valid_from,
          validUntil: scanData.certificate_details.valid_until
        },
        pqcSupport: {
          isQuantumSafe: scanData.pqc_support.is_quantum_safe,
          supportedAlgorithms: scanData.pqc_support.supported_algorithms,
          partiallySupportedAlgorithms: scanData.pqc_support.partially_supported_algorithms,
          rejectedAlgorithms: scanData.pqc_support.rejected_algorithms,
          statusLabel: scanData.pqc_support.status_label,
          rawResults: scanData.pqc_support.rawResults
        },
        recommendations: scanData.recommendations || [],
        securityScore,
        cyberRating,
        asset_inventory: scanData.asset_inventory
      });

      await newReport.save();
      res.json(newReport);

      const aiRecommendations = await getAIRecommendations(scanData, securityScore);
      if (aiRecommendations) {
        await ScanReport.findByIdAndUpdate(newReport._id, { aiRecommendations });
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError, stdout);
      res.status(500).json({ error: 'Failed to parse scanner output' });
    }
  });
});

app.get('/api/scans', async (req, res) => {
  try {
    const scans = await ScanReport.find().sort({ scanDate: -1 }).limit(50);
    res.json(scans);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/scans/:id', async (req, res) => {
  try {
    const scan = await ScanReport.findById(req.params.id);
    res.json(scan);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// --- SECURE PROPRIETARY EXPERT SYSTEM (CHAT) ---
app.post('/api/chat', async (req, res) => {
  const { message, chatHistory } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const query = message.toLowerCase();
    let responseText = "";

    // CONTEXT RECOVERY: Look for the last domain in the conversation history
    let contextDomain = "";
    if (chatHistory && chatHistory.length > 0) {
      for (let i = chatHistory.length - 1; i >= 0; i--) {
        const historyText = chatHistory[i].parts[0].text;
        const match = historyText.match(/([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}/i);
        if (match) {
          contextDomain = match[0].replace(/^(www\.)/, "");
          break;
        }
      }
    }

    // 1. INTENT: SUMMARIZE / OVERVIEW
    if (query.includes("summarize") || query.includes("summary") || query.includes("overview")) {
       // If they say "summarize it" or "summarize this" and we have a context domain
       let targetDomain = "";
       if ((query.includes(" it") || query.includes(" this") || query.includes(" that")) && contextDomain) {
         targetDomain = contextDomain;
       }
       
       const report = targetDomain 
         ? await ScanReport.findOne({ target: new RegExp(targetDomain, 'i') }).sort({ scanDate: -1 })
         : await ScanReport.findOne().sort({ scanDate: -1 });

      if (report) {
        responseText = `### Audit Summary for: **${report.target}**
- **Security Score**: ${report.securityScore}/1000
- **PQC Status**: ${report.pqcSupport.statusLabel}
- **Handshake**: ${report.tlsConfiguration.protocol} (${report.tlsConfiguration.cipherSuite})
- **PQC Readiness**: ${report.pqcSupport.isQuantumSafe ? 'Quantum-Safe' : 'Legacy / Vulnerable (Recommended: ML-KEM)'}
- **Compliance Action**: ${report.cyberRating.priorityAction || 'Upgrade to post-quantum hybrid ciphers.'}`;
      } else {
        responseText = "No scan data available in the vault yet. Please run a new scan from the Dashboard to generate a summary.";
      }
    }
    // 2. INTENT: VULNERABILITIES / RISKS
    else if (query.includes("vulnerabilities") || query.includes("risk") || query.includes("bad") || query.includes("weak")) {
      const weakScans = await ScanReport.find({ securityScore: { $lt: 500 } }).limit(5);
      if (weakScans.length > 0) {
        responseText = "### Critical Cryptographic Weaknesses Found:\n" + weakScans.map(s => 
          `- **${s.target}** (Score: ${s.securityScore}): Uses ${s.pqcSupport.statusLabel} ciphers.`
        ).join("\n") + "\n\nI recommend prioritizing these for PQC migration (ML-KEM).";
      } else {
        responseText = "Your recent audits show no critical vulnerabilities (Score < 500). Your infrastructure is maintaining a healthy baseline.";
      }
    }
    // 3. INTENT: DOMAIN SPECIFIC (LOOKUP)
    else if (message.match(/([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}/i)) {
      const domainMatch = message.match(/([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}/i);
      const domain = domainMatch[0].replace(/^(www\.)/, "");
      const report = await ScanReport.findOne({ target: new RegExp(domain, 'i') }).sort({ scanDate: -1 });
      
      if (report) {
         responseText = `### Detailed Intel for: **${domain}**
- **Readiness**: ${report.pqcSupport.statusLabel} (${report.securityScore}/1000)
- **Protocol Security**: ${report.tlsConfiguration.protocol}
- **Signature Alg**: ${report.certificateDetails.signatureAlgorithm}
- **Compliance**: ${report.pqcSupport.isQuantumSafe ? 'Quantum-Safe' : 'Legacy / Vulnerable'}
- **Action**: ${report.cyberRating.priorityAction}`;
      } else {
        responseText = `No records for **${domain}** found in internal vault. You can start a targeted scan from the main dashboard.`;
      }
    }
    // 4. INTENT: PQC EXPLANATION / NIST
    else if (query.includes("pqc") || query.includes("quantum") || query.includes("nist")) {
      responseText = `**Post-Quantum Cryptography (PQC)** is the next generation of encryption designed to withstand attacks from future quantum computers. 
QScan currently audits for:
- **ML-KEM (Kyber)**: For key encapsulation.
- **ML-DSA (Dilithium)**: For digital signatures.
- **Hybrid Modes**: Combining classical (RSA/ECC) with PQC for transition safety.`;
    }
    // 5. INTENT: STATS / AVERAGE
    else if (query.includes("stats") || query.includes("average") || query.includes("performance")) {
      const allScans = await ScanReport.aggregate([
        { $group: { _id: null, avg: { $avg: "$securityScore" }, count: { $sum: 1 } } }
      ]);
      if (allScans.length > 0) {
        responseText = `### Infrastructure Cryptographic Metrics:
- **Total Audits**: ${allScans[0].count}
- **Average Security Score**: ${Math.round(allScans[0].avg)}/1000
- **Status**: ${allScans[0].avg > 700 ? 'Secure Baseline' : 'Critical Migration Required'}`;
      } else {
        responseText = "Telemetry data is currently empty. Run scans to populate stats.";
      }
    }
    // FALLBACK
    else {
      responseText = "I'm listening. Ask me to 'summarize the latest scan', 'list vulnerabilities', or 'check stats' for your infrastructure.";
    }

    res.json({ text: responseText });
  } catch (err) {
    console.error("EXPERT SYSTEM ERROR:", err);
    res.status(500).json({ error: 'Internal Query Engine failure.' });
  }
});

app.delete('/api/scans/:id', async (req, res) => {
  try {
    await ScanReport.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
