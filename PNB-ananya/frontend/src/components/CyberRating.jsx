import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

const API_URL = 'http://localhost:5001/api';

const tierConfig = {
  'Tier-1 Elite': { color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30', icon: ShieldCheck, badge: '🛡️' },
  'Tier-2 Standard': { color: 'text-secondary', bg: 'bg-secondary/10', border: 'border-secondary/30', icon: Shield, badge: '✅' },
  'Tier-3 Legacy': { color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', icon: AlertTriangle, badge: '⚠️' },
  'Critical': { color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/30', icon: ShieldAlert, badge: '🚨' },
};

const CyberRating = () => {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState(null);

  useEffect(() => {
    const fetchScans = async () => {
      try {
        const res = await axios.get(`${API_URL}/scans`);
        setScans(res.data);
        if (res.data.length > 0) setSelectedScan(res.data[0]);
      } catch (err) {
        console.error('Failed to fetch scans', err);
      } finally {
        setLoading(false);
      }
    };
    fetchScans();
  }, []);

  const getFallbackTier = (record) => {
    if (record?.cyberRating?.tier) return record.cyberRating.tier;
    const score = record?.securityScore || 0;
    if (score > 750) return 'Tier-1 Elite';
    if (score >= 500 && score <= 750) return 'Tier-2 Standard';
    if (score > 0 && score < 500) return 'Tier-3 Legacy';
    return 'Critical';
  };

  const getFallbackRating = (record) => {
    if (record?.cyberRating?.tier) return record.cyberRating;
    const score = record?.securityScore || 0;
    if (score > 750) return { tier: 'Tier-1 Elite', securityLevel: 'Modern best-practise crypto posture', complianceCriteria: 'TLS 1.2 / TLS 1.3 only; Strong Ciphers; Forward Secrecy; certificate >2048-bit', priorityAction: 'Maintain Configuration; periodic monitoring', status: 'Elite-PQC' };
    if (score >= 500) return { tier: 'Tier-2 Standard', securityLevel: 'Acceptable enterprise configuration', complianceCriteria: 'TLS 1.2 supported but legacy protocols allowed; Key>2048-bit', priorityAction: 'Improve gradually; disable legacy protocols', status: 'Standard' };
    if (score > 0) return { tier: 'Tier-3 Legacy', securityLevel: 'Weak but still operational', complianceCriteria: 'TLS 1.0/1.1 enabled; weak ciphers; Forward secrecy missing', priorityAction: 'Remediation required; upgrade TLS stack', status: 'Legacy' };
    return { tier: 'Critical', securityLevel: 'Insecure / exploitable', complianceCriteria: 'SSL v2/v3 enabled; Key <1024-bit; weak cipher suites', priorityAction: 'Immediate action; block or isolate service', status: 'Critical' };
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-textMuted">Loading Cyber Rating data...</div>;
  }

  if (scans.length === 0) {
    return <div className="flex items-center justify-center h-64 text-textMuted">No scan data available. Run a scan first.</div>;
  }

  const rating = getFallbackRating(selectedScan);
  const tier = getFallbackTier(selectedScan);
  const config = tierConfig[tier] || tierConfig['Critical'];
  const TierIcon = config.icon;

  // Aggregate tier distribution
  const tierCounts = { 'Tier-1 Elite': 0, 'Tier-2 Standard': 0, 'Tier-3 Legacy': 0, 'Critical': 0 };
  scans.forEach(s => { tierCounts[getFallbackTier(s)]++; });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center border border-warning/30">
          <Shield className="text-warning w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-textMain">Enterprise Cyber Rating</h1>
          <p className="text-sm text-textMuted">4-Tier Classification based on PQC Readiness Score (0–1000)</p>
        </div>
      </div>

      {/* Tier Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(tierConfig).map(([name, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={name} className={`glass-panel p-4 flex items-center justify-between border-t-2 ${cfg.border}`}>
              <div>
                <p className="text-textMuted text-xs font-medium uppercase tracking-wider">{name}</p>
                <p className="text-3xl font-bold mt-1 text-textMain">{tierCounts[name]}</p>
                <p className="text-xs text-textMuted">scans</p>
              </div>
              <Icon className={`${cfg.color} w-8 h-8 opacity-50`} />
            </div>
          );
        })}
      </div>

      {/* Detailed Rating for Selected Scan */}
      {selectedScan && (
        <div className={`glass-panel p-6 border-l-4 ${config.border}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-textMain">{selectedScan.target}</h3>
              <p className="text-sm text-textMuted mt-1">Scanned {new Date(selectedScan.scanDate).toLocaleString()}</p>
            </div>
            <div className={`flex items-center gap-3 px-4 py-2 rounded-lg ${config.bg} border ${config.border}`}>
              <TierIcon className={`${config.color} w-6 h-6`} />
              <div>
                <p className={`text-lg font-bold ${config.color}`}>{tier}</p>
                <p className="text-xs text-textMuted">{rating.status}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center mb-6 p-6 bg-[#1f2937]/50 rounded-xl border border-border">
            <p className="text-5xl font-extrabold text-textMain">{selectedScan.securityScore}<span className="text-3xl text-textMuted">/1000</span></p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1f2937]/30 p-4 rounded-lg border border-border">
              <p className="text-xs text-textMuted uppercase tracking-wider mb-2 flex items-center gap-1"><Info size={12} /> Security Level</p>
              <p className="text-sm text-textMain font-medium">{rating.securityLevel}</p>
            </div>
            <div className="bg-[#1f2937]/30 p-4 rounded-lg border border-border">
              <p className="text-xs text-textMuted uppercase tracking-wider mb-2 flex items-center gap-1"><CheckCircle size={12} /> Compliance Criteria</p>
              <p className="text-sm text-textMain font-medium">{rating.complianceCriteria}</p>
            </div>
            <div className="bg-[#1f2937]/30 p-4 rounded-lg border border-border">
              <p className="text-xs text-textMuted uppercase tracking-wider mb-2 flex items-center gap-1"><AlertTriangle size={12} /> Priority Action</p>
              <p className="text-sm text-textMain font-medium">{rating.priorityAction}</p>
            </div>
          </div>
        </div>
      )}

      {/* All Scans Tier Table */}
      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4 border-b border-border pb-3">All Scans — Cyber Rating Classification</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-textMuted text-xs border-b border-border">
                <th className="py-2 px-3 font-medium">Domain</th>
                <th className="py-2 px-3 font-medium">Score</th>
                <th className="py-2 px-3 font-medium">Tier</th>
                <th className="py-2 px-3 font-medium">Security Level</th>
                <th className="py-2 px-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => {
                const t = getFallbackTier(scan);
                const r = getFallbackRating(scan);
                const c = tierConfig[t] || tierConfig['Critical'];
                return (
                  <tr
                    key={scan._id}
                    className={`border-b border-border/40 hover:bg-[#1f2937]/30 transition-colors cursor-pointer ${selectedScan?._id === scan._id ? 'bg-[#1f2937]/50' : ''}`}
                    onClick={() => setSelectedScan(scan)}
                  >
                    <td className="py-2 px-3 text-sm font-medium text-textMain">{scan.target}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-[#1f2937] rounded-full overflow-hidden">
                          <div className={`h-full ${c.bg.replace('/10', '')}`} style={{ width: `${Math.min(100, scan.securityScore / 10)}%` }}></div>
                        </div>
                        <span className="text-sm font-mono text-textMain">{scan.securityScore}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${c.bg} ${c.color} border ${c.border}`}>{t}</span>
                    </td>
                    <td className="py-2 px-3 text-sm text-textMuted">{r.securityLevel}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs font-semibold ${c.color}`}>{r.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tier Reference Table */}
      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4 border-b border-border pb-3">Cyber Rating Reference Guide</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-textMuted text-xs border-b border-border">
                <th className="py-2 px-3 font-medium">Tier</th>
                <th className="py-2 px-3 font-medium">Score Range</th>
                <th className="py-2 px-3 font-medium">Security Level</th>
                <th className="py-2 px-3 font-medium">Compliance Criteria</th>
                <th className="py-2 px-3 font-medium">Priority Action</th>
              </tr>
            </thead>
            <tbody>
              {[
                { tier: 'Tier-1 Elite', range: '751 – 1000', level: 'Modern best-practise crypto posture', criteria: 'TLS 1.2/1.3 only; AES-GCM/ChaCha20; ECDHE; >2048-bit keys', action: 'Maintain; periodic monitoring' },
                { tier: 'Tier-2 Standard', range: '500 – 750', level: 'Acceptable enterprise config', criteria: 'TLS 1.2; mostly strong ciphers; backward compat allowed', action: 'Improve gradually; disable legacy' },
                { tier: 'Tier-3 Legacy', range: '1 – 499', level: 'Weak but operational', criteria: 'TLS 1.0/1.1; weak ciphers (CBC, 3DES); no FS', action: 'Remediation required; upgrade TLS' },
                { tier: 'Critical', range: '0', level: 'Insecure / exploitable', criteria: 'SSL v2/v3; <1024-bit keys; known vulns', action: 'Immediate: block/isolate service' },
              ].map((row, i) => {
                const c = tierConfig[row.tier] || tierConfig['Critical'];
                return (
                  <tr key={i} className="border-b border-border/40">
                    <td className="py-2 px-3"><span className={`px-2 py-1 rounded text-xs font-semibold ${c.bg} ${c.color} border ${c.border}`}>{row.tier}</span></td>
                    <td className="py-2 px-3 text-sm text-textMain font-mono">{row.range}</td>
                    <td className="py-2 px-3 text-sm text-textMuted">{row.level}</td>
                    <td className="py-2 px-3 text-xs text-textMuted">{row.criteria}</td>
                    <td className="py-2 px-3 text-xs text-textMuted">{row.action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CyberRating;
