require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { exec } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ScanReport = require('./models/ScanReport');

console.log("KEY:", process.env.GEMINI_API_KEY ? "EXISTS" : "MISSING");

// Gemini AI Setup
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];

async function getAIRecommendations(scanData, securityScore) {
  const supported = scanData.pqc_support.supported_algorithms.slice(0, 5).join(', ') || 'None';
  const rejected = scanData.pqc_support.rejected_algorithms.slice(0, 5).join(', ') || 'None';

  const prompt = `You are a PQC cybersecurity expert. Analyze this scan and give a brief security report in markdown.

Domain: ${scanData.asset_domain}
TLS: ${scanData.tls_configuration.protocol}, Cipher: ${scanData.tls_configuration.cipher_suite}
Cert: ${scanData.certificate_details.issuer}, Sig: ${scanData.certificate_details.signature_algorithm}, Key: ${scanData.certificate_details.public_key_size}
PQC Status: ${scanData.pqc_support.status_label}, Score: ${securityScore}/1000
Supported Algorithms: ${supported}
Rejected Algorithms: ${rejected}

Write 4 short sections with markdown headers:
## Overall Assessment
## Key Findings
## Risks (HNDL threats)
## Recommendations`;

  if (genAI) {
    for (const modelName of GEMINI_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        console.warn(`Model ${modelName} failed, trying next...`);
      }
    }
  }

  return `## Overall Assessment
The asset **${scanData.asset_domain}** presents a risk profile regarding Post-Quantum Cryptography (PQC) readiness. With a readiness score of **${securityScore}/1000**, the current cryptographic architecture needs attention.

## Key Findings
* **Protocol:** ${scanData.tls_configuration.protocol}
* **Cipher:** ${scanData.tls_configuration.cipher_suite}
* **PQC Status:** ${scanData.pqc_support.status_label}

## Risks (HNDL threats)
Exposure to "Harvest Now, Decrypt Later" (HNDL) attacks remains a concern for classical-only architectures.

## Recommendations
1. Implement Hybrid Key Exchange.
2. Upgrade TLS stack to support ML-KEM.`;
}

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/qscan').then(() => console.log('MongoDB connected'))
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
