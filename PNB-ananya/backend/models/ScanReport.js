const mongoose = require('mongoose');

const scanReportSchema = new mongoose.Schema({
  target: {
    type: String,
    required: true,
  },
  scanDate: {
    type: Date,
    default: Date.now,
  },
  tlsConfiguration: {
    protocol: { type: String, default: 'Unknown' },
    cipherSuite: { type: String, default: 'Unknown' },
    tlsVersions: { type: Object, default: {} }
  },
  certificateDetails: {
    subject: { type: String, default: 'Unknown' },
    issuer: { type: String, default: 'Unknown' },
    signatureAlgorithm: { type: String, default: 'Unknown' },
    publicKeySize: { type: String, default: 'Unknown' },
    validFrom: { type: String, default: 'Unknown' },
    validUntil: { type: String, default: 'Unknown' }
  },
  pqcSupport: {
    isQuantumSafe: { type: Boolean, default: false },
    supportedAlgorithms: { type: [String], default: [] },
    partiallySupportedAlgorithms: { type: [String], default: [] },
    rejectedAlgorithms: { type: [String], default: [] },
    statusLabel: { type: String, default: 'Non-PQC Ready' },
    rawResults: { type: Object, default: {} }
  },
  recommendations: { type: [String], default: [] },
  securityScore: {
    type: Number,
    required: true,
  },
  cyberRating: {
    tier: { type: String, default: '' },
    securityLevel: { type: String, default: '' },
    complianceCriteria: { type: String, default: '' },
    priorityAction: { type: String, default: '' },
    status: { type: String, default: '' }
  },
  aiRecommendations: {
    type: String,
    default: ''
  },
  asset_inventory: {
    type: Object,
    default: {}
  },
  rawScannerOutput: {
    type: Object,
    default: {}
  }
});

module.exports = mongoose.model('ScanReport', scanReportSchema);
