import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { FileText, Key, Shield, ShieldAlert, Lock, Award, AlertTriangle, Trash2 } from 'lucide-react';

const API_URL = 'http://localhost:5001/api';

const COLORS = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#f97316'];

const CbomPage = () => {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScans = async () => {
      try {
        const res = await axios.get(`${API_URL}/scans`);
        setScans(res.data);
      } catch (err) {
        console.error('Failed to fetch scans', err);
      } finally {
        setLoading(false);
      }
    };
    fetchScans();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this scan?')) return;
    try {
      await axios.delete(`${API_URL}/scans/${id}`);
      setScans(scans.filter(s => s._id !== id));
    } catch (err) {
      console.error('Failed to delete scan', err);
      alert('Failed to delete scan');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-textMuted">
        Loading CBOM data...
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-textMuted">
        No scan data available. Run a scan to populate the CBOM.
      </div>
    );
  }

  // --- Aggregations ---

  // Key length distribution
  const keyLengthCounts = {};
  scans.forEach(s => {
    const k = s.certificateDetails?.publicKeySize || 'Unknown';
    keyLengthCounts[k] = (keyLengthCounts[k] || 0) + 1;
  });
  const keyLengthData = Object.entries(keyLengthCounts)
    .map(([key, count]) => ({ key: `${key}-bit`, count }))
    .sort((a, b) => b.count - a.count);

  // Cipher usage
  const cipherCounts = {};
  scans.forEach(s => {
    const c = s.tlsConfiguration?.cipherSuite || 'Unknown';
    cipherCounts[c] = (cipherCounts[c] || 0) + 1;
  });
  const cipherData = Object.entries(cipherCounts)
    .map(([cipher, count]) => ({ cipher, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Top Certificate Authorities
  const caCounts = {};
  scans.forEach(s => {
    const issuer = s.certificateDetails?.issuer || 'Unknown';
    // Extract just the CN= part for brevity
    const cnMatch = issuer.match(/CN=([^,]+)/);
    const ca = cnMatch ? cnMatch[1].trim() : issuer.split(',')[0].trim();
    caCounts[ca] = (caCounts[ca] || 0) + 1;
  });
  const caData = Object.entries(caCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Protocol distribution
  const protocolCounts = {};
  scans.forEach(s => {
    const p = s.tlsConfiguration?.protocol || 'Unknown';
    protocolCounts[p] = (protocolCounts[p] || 0) + 1;
  });
  const protocolData = Object.entries(protocolCounts)
    .map(([name, value]) => ({ name, value }));

  // Stats
  const totalApps = scans.length;
  const uniqueDomains = new Set(scans.map(s => s.target)).size;
  const weakCrypto = scans.filter(s => {
    const keySize = parseInt(s.certificateDetails?.publicKeySize || '4096');
    return keySize < 2048 || (s.tlsConfiguration?.cipherSuite || '').includes('DES') ||
      (s.tlsConfiguration?.cipherSuite || '').includes('RC4');
  }).length;
  const certIssues = scans.filter(s => {
    const until = s.certificateDetails?.validUntil;
    if (!until) return false;
    return new Date(until) < new Date();
  }).length;

  const isWeakCipher = (cipher) => {
    return cipher && (cipher.includes('DES') || cipher.includes('RC4') || cipher.includes('NULL') || cipher.includes('EXPORT'));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
          <FileText className="text-purple-400 w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-textMain">Cryptographic Bill of Materials</h1>
          <p className="text-sm text-textMuted">Inventory of all cryptographic assets across scanned domains</p>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Scans', value: totalApps, icon: <FileText className="w-6 h-6 text-blue-400/50" />, border: 'border-t-blue-400' },
          { label: 'Unique Domains', value: uniqueDomains, icon: <Shield className="w-6 h-6 text-secondary/50" />, border: 'border-t-secondary' },
          { label: 'Weak Cryptography', value: weakCrypto, icon: <AlertTriangle className="w-6 h-6 text-warning/50" />, border: 'border-t-warning' },
          { label: 'Expired Certs', value: certIssues, icon: <ShieldAlert className="w-6 h-6 text-danger/50" />, border: 'border-t-danger' },
        ].map((stat, i) => (
          <div key={i} className={`glass-panel p-4 flex items-center justify-between border-t-2 ${stat.border}`}>
            <div>
              <p className="text-textMuted text-xs font-medium uppercase tracking-wider">{stat.label}</p>
              <p className="text-3xl font-bold mt-1 text-textMain">{stat.value}</p>
            </div>
            {stat.icon}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Key Length Distribution */}
        <div className="glass-panel p-6">
          <h3 className="text-sm font-bold text-textMain uppercase tracking-wider mb-4 flex items-center gap-2">
            <Key size={14} /> Key Length Distribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={keyLengthData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="key" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <RechartsTooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', color: '#fff' }} />
              <Bar dataKey="count" name="Scans">
                {keyLengthData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cipher Usage */}
        <div className="glass-panel p-6">
          <h3 className="text-sm font-bold text-textMain uppercase tracking-wider mb-4 flex items-center gap-2">
            <Lock size={14} /> Cipher Usage
          </h3>
          <div className="space-y-2 mt-2">
            {cipherData.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`flex-1 text-xs font-mono px-2 py-1.5 rounded truncate ${isWeakCipher(item.cipher) ? 'bg-danger/20 text-danger border border-danger/30' : 'bg-black/5 dark:bg-[#1f2937] text-textMain border border-border/50'}`}
                  title={item.cipher}
                >
                  {item.cipher}
                </div>
                <span className="text-sm font-bold text-textMain w-6 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Certificate Authorities + Protocol */}
        <div className="flex flex-col gap-4">
          <div className="glass-panel p-6 flex-1">
            <h3 className="text-sm font-bold text-textMain uppercase tracking-wider mb-3 flex items-center gap-2">
              <Award size={14} /> Top Certificate Authorities
            </h3>
            <div className="space-y-2">
              {caData.map((ca, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 bg-black/5 dark:bg-[#1f2937]/50 px-3 py-1.5 rounded border border-border/50">
                    <span className="text-sm text-textMain truncate block" title={ca.name}>{ca.name}</span>
                  </div>
                  <span
                    className="text-sm font-bold w-8 text-right"
                    style={{ color: COLORS[i % COLORS.length] }}
                  >{ca.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-panel p-4">
            <h3 className="text-xs font-bold text-textMain uppercase tracking-wider mb-2">Encryption Protocols</h3>
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={protocolData} cx="40%" cy="50%" outerRadius={40} dataKey="value" nameKey="name">
                  {protocolData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* CBOM Detail Table */}
      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-textMain uppercase tracking-wider mb-4 border-b border-border pb-3">
          Asset Cryptographic Inventory
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-textMain text-xs border-b border-border">
                <th className="py-2 px-3 font-medium">Application</th>
                <th className="py-2 px-3 font-medium">Key Length</th>
                <th className="py-2 px-3 font-medium">Cipher Suite</th>
                <th className="py-2 px-3 font-medium">Certificate Authority</th>
                <th className="py-2 px-3 font-medium">Sig Algorithm</th>
                <th className="py-2 px-3 font-medium">Protocol</th>
                <th className="py-2 px-3 font-medium text-right">PQC Score</th>
                <th className="py-2 px-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => {
                const cnMatch = (scan.certificateDetails?.issuer || '').match(/CN=([^,]+)/);
                const caShort = cnMatch ? cnMatch[1].trim() : (scan.certificateDetails?.issuer || 'Unknown').split(',')[0];
                const isWeak = isWeakCipher(scan.tlsConfiguration?.cipherSuite || '');
                const keySize = parseInt(scan.certificateDetails?.publicKeySize || '0');
                const isSmallKey = keySize > 0 && keySize < 2048;

                return (
                  <tr key={scan._id} className="border-b border-border/40 hover:bg-black/5 dark:bg-[#1f2937]/30 transition-colors">
                    <td className="py-2 px-3 text-sm font-medium text-textMain">{scan.target}</td>
                    <td className="py-2 px-3">
                      <span className={`text-sm font-mono font-semibold ${isSmallKey ? 'text-danger' : 'text-secondary'}`}>
                        {scan.certificateDetails?.publicKeySize ? `${scan.certificateDetails.publicKeySize}-Bit` : 'N/A'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${isWeak ? 'bg-danger/20 text-danger border border-danger/30' : 'bg-black/5 dark:bg-[#1f2937] text-textMain'}`}>
                        {scan.tlsConfiguration?.cipherSuite || 'N/A'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm text-textMain">{caShort}</td>
                    <td className="py-2 px-3 text-xs text-textMain font-mono">{scan.certificateDetails?.signatureAlgorithm || 'N/A'}</td>
                    <td className="py-2 px-3 text-xs text-textMain">{scan.tlsConfiguration?.protocol || 'N/A'}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`text-sm font-bold ${scan.securityScore >= 50 ? 'text-secondary' : 'text-danger'}`}>
                        {scan.securityScore}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleDelete(scan._id)}
                        className="p-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                        title="Delete Scan"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
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

export default CbomPage;
