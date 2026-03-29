import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Shield, ShieldAlert, ShieldCheck, Activity, Globe, RefreshCcw, Server, AlertTriangle, Lock, Key, FileText, CheckCircle, Info, Sparkles, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

const API_URL = 'http://localhost:5001/api';

const Dashboard = ({ setGlobalScanData }) => {
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentScan, setCurrentScan] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/scans`);
      setHistory(res.data);
      if (res.data.length > 0 && !currentScan) {
        // Load latest scan with full details (no polling)
        try {
          const detail = await axios.get(`${API_URL}/scans/${res.data[0]._id}`);
          setCurrentScan(detail.data);
          if (setGlobalScanData) setGlobalScanData(detail.data);
        } catch {
          setCurrentScan(res.data[0]);
          if (setGlobalScanData) setGlobalScanData(res.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  // Poll for AI recommendations (only after a NEW scan, max 10 retries)
  const pollForAI = useCallback(async (scanId, attempt = 0) => {
    if (!scanId || attempt >= 10) {
      setAiLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${API_URL}/scans/${scanId}`);
      if (res.data.aiRecommendations) {
        setCurrentScan(res.data);
        if (setGlobalScanData) setGlobalScanData(res.data);
        setAiLoading(false);
      } else {
        setTimeout(() => pollForAI(scanId, attempt + 1), 3000);
      }
    } catch (err) {
      console.error('Failed to fetch scan details', err);
      setAiLoading(false);
    }
  }, []);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!target) return;

    setLoading(true);
    setError(null);
    setAiLoading(true);
    try {
      const res = await axios.post(`${API_URL}/scan`, { target });
      setCurrentScan(res.data);
      if (setGlobalScanData) setGlobalScanData(res.data);
      fetchHistory();
      // Start polling for AI recommendations
      pollForAI(res.data._id);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'An error occurred during scanning');
      setAiLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectScan = async (record) => {
    // First set the record from history (instant UI update)
    setCurrentScan(record);
    setAiLoading(false); // Stop any existing polling
    // Then fetch full details (which includes AI recommendations)
    try {
      const res = await axios.get(`${API_URL}/scans/${record._id}`);
      setCurrentScan(res.data);
      if (setGlobalScanData) setGlobalScanData(res.data);
    } catch (err) {
      console.error('Failed to load scan details', err);
    }
  };

  // Stats for Top Bar
  const totalScans = history.length;
  const pqcReadyCount = history.filter(h => h.pqcSupport?.statusLabel !== 'Non-PQC Ready').length;
  const highRiskCount = totalScans - pqcReadyCount;

  // Chart Data format
  const getPieData = () => {
    if (!currentScan || !currentScan.pqcSupport) return [];

    if (currentScan.pqcSupport.rawResults && Object.keys(currentScan.pqcSupport.rawResults).length > 0) {
      let purePq = 0, hybridPq = 0, classical = 0, rejected = 0;
      Object.values(currentScan.pqcSupport.rawResults).forEach(v => {
        if (v.includes('FULLY SUPPORTED') || v.includes('PARTIALLY SUPPORTED')) {
          if (v.includes('PURE PQ')) purePq++;
          else if (v.includes('HYBRID PQ')) hybridPq++;
          else classical++;
        } else {
          rejected++;
        }
      });
      return [
        { name: 'Pure PQ', value: purePq, color: '#c084fc' },
        { name: 'Hybrid PQ', value: hybridPq, color: '#3b82f6' },
        { name: 'Classical', value: classical, color: '#10b981' },
        { name: 'Rejected', value: rejected, color: '#ef4444' }
      ].filter(d => d.value > 0);
    }

    return [
      { name: 'Supported', value: currentScan.pqcSupport.supportedAlgorithms.length, color: '#10b981' },
      { name: 'Partial', value: currentScan.pqcSupport.partiallySupportedAlgorithms?.length || 0, color: '#f59e0b' },
      { name: 'Rejected', value: currentScan.pqcSupport.rejectedAlgorithms.length, color: '#ef4444' }
    ].filter(d => d.value > 0);
  };

  const getRiskData = () => {
    const counts = { 'Fully Quantum Safe': 0, 'PQC Ready': 0, 'Non-PQC Ready': 0 };
    history.forEach(h => {
      if (h.pqcSupport && counts[h.pqcSupport.statusLabel] !== undefined) {
        counts[h.pqcSupport.statusLabel]++;
      }
    });
    return [
      { name: 'Fully Safe', count: counts['Fully Quantum Safe'], fill: '#3b82f6' },
      { name: 'PQC Ready', count: counts['PQC Ready'], fill: '#10b981' },
      { name: 'At Risk', count: counts['Non-PQC Ready'], fill: '#ef4444' }
    ];
  };

  const pieData = getPieData();
  const riskData = getRiskData();

  const getFallbackTier = (record) => {
    if (record?.cyberRating?.tier) return record.cyberRating.tier;
    const score = record?.securityScore || 0;
    if (score > 750) return 'Tier-1 Elite';
    if (score >= 500 && score <= 750) return 'Tier-2 Standard';
    if (score > 0 && score < 500) return 'Tier-3 Legacy';
    return 'Critical';
  };

  const getFallbackStatus = (record) => {
    if (record?.cyberRating?.status) return record.cyberRating.status;
    const score = record?.securityScore || 0;
    if (score > 750) return 'Elite-PQC';
    if (score >= 500 && score <= 750) return 'Standard';
    if (score > 0 && score < 500) return 'Legacy';
    return 'Critical';
  };

  const getLabelColor = (label) => {
    if (label === 'Fully Quantum Safe') return 'text-primary border-primary';
    if (label === 'PQC Ready') return 'text-secondary border-secondary';
    return 'text-danger border-danger';
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  // Simple markdown renderer for AI recommendations
  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];
    let inList = false;

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inList) inList = false;
        elements.push(<br key={`br-${i}`} />);
        return;
      }

      // Headers
      if (trimmed.startsWith('### ')) {
        elements.push(<h4 key={i} className="text-md font-bold text-white mt-4 mb-2">{renderInline(trimmed.slice(4))}</h4>);
      } else if (trimmed.startsWith('## ')) {
        elements.push(<h3 key={i} className="text-lg font-bold text-white mt-4 mb-2">{renderInline(trimmed.slice(3))}</h3>);
      } else if (trimmed.startsWith('# ')) {
        elements.push(<h2 key={i} className="text-xl font-bold text-white mt-4 mb-2">{renderInline(trimmed.slice(2))}</h2>);
      }
      // Bullet points
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        inList = true;
        elements.push(
          <div key={i} className="flex gap-2 ml-4 mb-1">
            <span className="text-primary mt-1.5 flex-shrink-0">•</span>
            <span className="text-gray-300 text-sm">{renderInline(trimmed.slice(2))}</span>
          </div>
        );
      }
      // Numbered list
      else if (/^\d+\.\s/.test(trimmed)) {
        const content = trimmed.replace(/^\d+\.\s/, '');
        elements.push(
          <div key={i} className="flex gap-2 ml-4 mb-1">
            <span className="text-primary font-mono text-sm flex-shrink-0">{trimmed.match(/^\d+/)[0]}.</span>
            <span className="text-gray-300 text-sm">{renderInline(content)}</span>
          </div>
        );
      }
      // Regular paragraph
      else {
        elements.push(<p key={i} className="text-gray-300 text-sm mb-1">{renderInline(trimmed)}</p>);
      }
    });

    return elements;
  };

  const renderInline = (text) => {
    // Bold text
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
      }
      // Inline code 
      const codeParts = part.split(/(`.*?`)/g);
      return codeParts.map((cp, j) => {
        if (cp.startsWith('`') && cp.endsWith('`')) {
          return <code key={`${i}-${j}`} className="bg-[#1f2937] text-primary px-1 py-0.5 rounded text-xs font-mono">{cp.slice(1, -1)}</code>;
        }
        return cp;
      });
    });
  };

  const renderCiphers = (ciphers, isRejected) => {
    if (!ciphers || ciphers.length === 0) return <p className="text-sm text-textMuted italic">No groups {isRejected ? 'detected' : 'supported'}.</p>;

    return (
      <ul className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
        {ciphers.map((group, idx) => {
          let badge = '';
          let badgeClass = "text-gray-400 border-gray-600 bg-gray-600/10";

          if (currentScan.pqcSupport.rawResults && currentScan.pqcSupport.rawResults[group]) {
            const resultStr = currentScan.pqcSupport.rawResults[group];
            if (resultStr.includes('PURE PQ')) { badge = 'Pure PQ'; badgeClass = 'text-purple-400 border-purple-400/30 bg-purple-400/10'; }
            else if (resultStr.includes('HYBRID PQ')) { badge = 'Hybrid'; badgeClass = 'text-blue-400 border-blue-400/30 bg-blue-400/10'; }
            else if (resultStr.includes('CLASSICAL')) { badge = 'Classical'; badgeClass = 'text-green-400 border-green-400/30 bg-green-400/10'; }

            if (resultStr.includes('NOT SUPPORTED') || resultStr.includes('ERROR')) {
              badge += ' (Rejected)';
              badgeClass = 'text-danger border-danger/30 bg-danger/10';
            }
          }

          return (
            <li key={idx} className={`px-3 py-2 rounded text-sm font-mono border flex items-center justify-between transition-colors ${isRejected ? 'bg-[#1f2937]/30 border-border/30 opacity-80' : 'bg-[#1f2937]/50 border-border/50 text-gray-300'}`}>
              <span className="truncate mr-2">{group}</span>
              {badge && <span className={`text-[10px] px-2 py-0.5 rounded border whitespace-nowrap ${badgeClass}`}>{badge}</span>}
            </li>
          );
        })}
      </ul>
    );
  };

  const isExpired = (dateStr) => {
    if (!dateStr || dateStr === 'Unknown') return false;
    try {
      return new Date(dateStr) < new Date();
    } catch { return false; }
  };

  return (
    <div className="flex flex-col gap-6">

      {/* Top Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 flex items-center justify-between border-t-2 border-t-primary">
          <div>
            <p className="text-textMuted text-sm font-medium uppercase tracking-wider">Total Scans</p>
            <p className="text-3xl font-bold mt-1 text-white">{totalScans}</p>
          </div>
          <Activity className="text-primary/50 w-10 h-10" />
        </div>
        <div className="glass-panel p-4 flex items-center justify-between border-t-2 border-t-secondary">
          <div>
            <p className="text-textMuted text-sm font-medium uppercase tracking-wider">PQC Ready Assets</p>
            <p className="text-3xl font-bold mt-1 text-white">{pqcReadyCount}</p>
          </div>
          <ShieldCheck className="text-secondary/50 w-10 h-10" />
        </div>
        <div className="glass-panel p-4 flex items-center justify-between border-t-2 border-t-warning">
          <div>
            <p className="text-textMuted text-sm font-medium uppercase tracking-wider">Avg Security Score</p>
            <p className="text-3xl font-bold mt-1 text-white">
              {history.length > 0 ? Math.round(history.reduce((acc, curr) => acc + curr.securityScore, 0) / history.length) : 0} / 1000
            </p>
          </div>
          <Server className="text-warning/50 w-10 h-10" />
        </div>
        <div className="glass-panel p-4 flex items-center justify-between border-t-2 border-t-danger">
          <div>
            <p className="text-textMuted text-sm font-medium uppercase tracking-wider">High Risk Assets</p>
            <p className="text-3xl font-bold mt-1 text-white">{highRiskCount}</p>
          </div>
          <AlertTriangle className="text-danger/50 w-10 h-10" />
        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form & Current Scan Result */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="glass-panel p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Globe className="text-primary" /> Target Scan
            </h2>
            <form onSubmit={handleScan} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-textMuted mb-2">Domain or IP Address</label>
                <div className="relative">
                  <input
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="e.g., example.com"
                    className="w-full bg-[#1f2937] border border-border rounded-lg px-4 py-3 text-white neon-border-focus focus:outline-none transition-all placeholder:text-textMuted/50"
                    required
                  />
                  {loading && (
                    <RefreshCcw className="absolute right-3 top-3 w-5 h-5 text-primary animate-spin" />
                  )}
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary/20 border border-primary text-primary font-semibold py-3 rounded-lg hover:bg-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#0a0e17] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Scanning via OpenSSL...' : 'Initiate PQC Scan'}
              </button>
              {error && <p className="text-danger text-sm mt-2 font-medium">{error}</p>}
            </form>
          </div>

          {currentScan && currentScan.pqcSupport && (
            <div className={`glass-panel p-6 border-l-4 ${currentScan.pqcSupport.statusLabel === 'Non-PQC Ready' ? 'border-l-danger' :
              currentScan.pqcSupport.statusLabel === 'PQC Ready' ? 'border-l-secondary' : 'border-l-primary'
              }`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold"> PQC  Score </h3>
                  <p className="text-sm text-textMuted mt-1">{currentScan.target}</p>
                </div>
                {currentScan.pqcSupport.statusLabel === 'Fully Quantum Safe' ? <ShieldCheck className="text-primary w-8 h-8" /> :
                  currentScan.pqcSupport.statusLabel === 'PQC Ready' ? <Shield className="text-secondary w-8 h-8" /> :
                    <ShieldAlert className="text-danger w-8 h-8" />}
              </div>

              <div className="mb-6 flex flex-col items-center justify-center p-6 bg-[#1f2937]/50 rounded-xl border border-border">
                <p className="text-base text-textMuted mb-2 uppercase tracking-widest border-b border-border pb-2 w-full text-center">Consolidated Enterprise-Level Cyber-Rating Score</p>
                <div className="flex items-center gap-4 mt-4 bg-primary/20 px-6 py-4 rounded-lg border border-primary/30 w-full justify-center">
                  <p className="text-5xl font-extrabold text-white">{currentScan.securityScore}<span className="text-3xl text-textMuted">/1000</span></p>
                  <div className="flex flex-col ml-4">
                    <span className="text-xl font-bold text-primary">{getFallbackTier(currentScan)}</span>
                    <span className="text-sm text-textMuted">Status: {getFallbackStatus(currentScan)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#1f2937]/30 p-2 rounded-lg border border-border">
                  <p className="text-[10px] text-textMuted uppercase tracking-wider">Supported</p>
                  <p className="text-lg font-bold text-secondary mt-1">{currentScan.pqcSupport.supportedAlgorithms.length}</p>
                </div>
                <div className="bg-[#1f2937]/30 p-2 rounded-lg border border-border">
                  <p className="text-[10px] text-textMuted uppercase tracking-wider">Partial</p>
                  <p className="text-lg font-bold text-amber-500 mt-1">{currentScan.pqcSupport.partiallySupportedAlgorithms?.length || 0}</p>
                </div>
                <div className="bg-[#1f2937]/30 p-2 rounded-lg border border-border">
                  <p className="text-[10px] text-textMuted uppercase tracking-wider">Rejected</p>
                  <p className="text-lg font-bold text-danger mt-1">{currentScan.pqcSupport.rejectedAlgorithms.length}</p>
                </div>
              </div>
            </div>
          )}

          {currentScan && currentScan.assetInventory?.domains?.length > 0 && (
            <div className="glass-panel p-6 border-t-2 border-t-blue-500">
              <h3 className="text-md font-bold mb-4 flex items-center gap-2">
                <Globe className="text-blue-500 w-5 h-5" /> Top Domains & Ciphers
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {currentScan.assetInventory.domains.slice(0, 5).map((d, i) => (
                  <div key={i} className="bg-[#1f2937]/50 rounded-lg p-3 border border-border flex flex-col gap-2 transition-colors hover:bg-[#1f2937]">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-sm text-white truncate pr-2 flex items-center gap-1.5"><Globe size={12} className="text-textMuted" /> {d.domain}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap flex-shrink-0 ${d.pqcStatus === 'Fully PQC Ready' ? 'bg-primary/20 text-primary border border-primary/30' :
                        d.pqcStatus === 'PQC Ready' ? 'bg-secondary/20 text-secondary border border-secondary/30' :
                          'bg-danger/20 text-danger border border-danger/30'
                        }`}>
                        {d.pqcStatus || 'N/A'} {d.pqcSupported !== undefined ? `(${d.pqcSupported}/6)` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-[#111827]/50 px-2 py-1.5 rounded border border-border/50 overflow-hidden">
                      <span className="text-[10px] text-textMuted uppercase tracking-wider flex-shrink-0">Best Cipher</span>
                      <span className="font-mono text-xs text-blue-400 truncate ml-2 text-right" title={d.cipherSuite || 'N/A'}>{d.cipherSuite || 'N/A'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Charts & Details */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Chart 1: Current Scan Distribution */}
            <div className="glass-panel p-6 min-h-[300px] flex flex-col">
              <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4">Algorithm Distribution</h3>
              <div className="flex-1 w-full relative">
                {currentScan && currentScan.pqcSupport ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', borderRadius: '0.5rem', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-textMuted">No scan data available</div>
                )}
                {/* Center text for Donut */}
                {currentScan && currentScan.pqcSupport && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none -mt-8">
                    <span className="text-2xl font-bold">{
                      currentScan.pqcSupport.rawResults ? Object.keys(currentScan.pqcSupport.rawResults).length : (currentScan.pqcSupport.supportedAlgorithms.length + (currentScan.pqcSupport.partiallySupportedAlgorithms?.length || 0) + currentScan.pqcSupport.rejectedAlgorithms.length)
                    }</span>
                  </div>
                )}
              </div>

              {/* Detailed Breakdown Row */}
              {currentScan && currentScan.pqcSupport && (
                <div className="mt-4 grid grid-cols-4 gap-2 text-center border-t border-border/50 pt-4">
                  <div className="bg-[#1f2937]/30 rounded p-1 overflow-hidden">
                    <p className="text-[9px] text-textMuted uppercase font-semibold truncate">Total</p>
                    <p className="text-sm font-bold text-white mt-0.5">{currentScan.pqcSupport.rawResults ? Object.keys(currentScan.pqcSupport.rawResults).length : 43}</p>
                  </div>
                  <div className="bg-[#1f2937]/30 rounded p-1 overflow-hidden">
                    <p className="text-[9px] text-textMuted uppercase font-semibold truncate">Full</p>
                    <p className="text-sm font-bold text-primary mt-0.5">{currentScan.pqcSupport.supportedAlgorithms?.length || 0}</p>
                  </div>
                  <div className="bg-[#1f2937]/30 rounded p-1 overflow-hidden">
                    <p className="text-[9px] text-textMuted uppercase font-semibold truncate">Partial</p>
                    <p className="text-sm font-bold text-amber-500 mt-0.5">{currentScan.pqcSupport.partiallySupportedAlgorithms?.length || 0}</p>
                  </div>
                  <div className="bg-[#1f2937]/30 rounded p-1 overflow-hidden">
                    <p className="text-[9px] text-textMuted uppercase font-semibold truncate">Reject</p>
                    <p className="text-sm font-bold text-danger mt-0.5">{currentScan.pqcSupport.rejectedAlgorithms?.length || 0}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Certificate & TLS Info Panel */}
            {currentScan && currentScan.certificateDetails && (
              <div className="glass-panel p-6 flex flex-col">
                <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4 flex items-center gap-2"><Lock size={16} /> TLS & Certificate</h3>
                <div className="flex-1 space-y-3">
                  {/* Key Length - most prominent */}
                  <div className="bg-[#1f2937]/30 p-3 rounded-lg border border-border flex items-center justify-between">
                    <div>
                      <p className="text-xs text-textMuted uppercase tracking-wider">Key Length</p>
                      <p className={`text-2xl font-extrabold mt-0.5 ${parseInt(currentScan.certificateDetails.publicKeySize || '0') >= 2048 ? 'text-secondary' : 'text-danger'
                        }`}>
                        {currentScan.certificateDetails.publicKeySize ? `${currentScan.certificateDetails.publicKeySize}-bit` : 'N/A'}
                      </p>
                    </div>
                    <Key className="text-textMuted/50 w-7 h-7" />
                  </div>
                  {/* Cipher Suite */}
                  <div className="bg-[#1f2937]/30 p-3 rounded-lg border border-border">
                    <p className="text-xs text-textMuted uppercase tracking-wider">Cipher Suite</p>
                    <p className="text-xs font-mono text-white mt-1 break-all">{currentScan.tlsConfiguration?.cipherSuite || 'N/A'}</p>
                    <p className="text-xs text-textMuted mt-0.5">{currentScan.tlsConfiguration?.protocol}</p>
                  </div>
                  {/* Certificate Authority */}
                  <div className="bg-[#1f2937]/30 p-3 rounded-lg border border-border">
                    <p className="text-xs text-textMuted uppercase tracking-wider">Certificate Authority</p>
                    <p className="text-sm font-semibold text-white mt-1 truncate" title={currentScan.certificateDetails.issuer}>
                      {(() => {
                        const cnMatch = (currentScan.certificateDetails.issuer || '').match(/CN=([^,]+)/);
                        return cnMatch ? cnMatch[1].trim() : currentScan.certificateDetails.issuer;
                      })()}
                    </p>
                    <p className="text-xs text-textMuted mt-0.5">Sig: {currentScan.certificateDetails.signatureAlgorithm}</p>
                  </div>
                  {/* Validity */}
                  <div className="bg-[#1f2937]/30 p-3 rounded-lg border border-border">
                    <p className="text-xs text-textMuted uppercase tracking-wider">Validity Period</p>
                    <p className="text-xs font-mono text-gray-400 mt-1">From: {currentScan.certificateDetails.validFrom}</p>
                    <p className={`text-xs font-mono ${isExpired(currentScan.certificateDetails.validUntil) ? 'text-danger font-bold' : 'text-gray-400'}`}>
                      Until: {isExpired(currentScan.certificateDetails.validUntil) ? 'EXPIRED' : currentScan.certificateDetails.validUntil}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* TLS Version Support Panel */}
          {currentScan && currentScan.tlsConfiguration?.tlsVersions && Object.keys(currentScan.tlsConfiguration.tlsVersions).length > 0 && (
            <div className="glass-panel p-6">
              <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4 flex items-center gap-2">
                <Shield size={16} /> Supported TLS Versions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {['SSLv3', 'TLSv1.0', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'].map((ver) => {
                  const data = currentScan.tlsConfiguration.tlsVersions[ver];
                  if (!data) return null;
                  const isSupported = data.supported;
                  const isDeprecated = ['SSLv3', 'TLSv1.0', 'TLSv1.1'].includes(ver);
                  return (
                    <div
                      key={ver}
                      className={`p-4 rounded-lg border text-center transition-all ${
                        isSupported
                          ? isDeprecated
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-secondary/10 border-secondary/30'
                          : 'bg-[#1f2937]/30 border-border'
                      }`}
                    >
                      <p className="text-xs text-textMuted uppercase tracking-wider mb-2">{data.label}</p>
                      <div className="flex items-center justify-center gap-1.5">
                        {isSupported ? (
                          isDeprecated ? (
                            <>
                              <AlertTriangle size={14} className="text-amber-500" />
                              <span className="text-sm font-bold text-amber-500">Supported</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle size={14} className="text-secondary" />
                              <span className="text-sm font-bold text-secondary">Supported</span>
                            </>
                          )
                        ) : (
                          <>
                            <ShieldAlert size={14} className="text-textMuted/50" />
                            <span className="text-sm font-medium text-textMuted/50">Not Supported</span>
                          </>
                        )}
                      </div>
                      {isSupported && isDeprecated && (
                        <p className="text-[10px] text-amber-400/70 mt-1.5">⚠ Deprecated</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI-Powered Recommendations */}
          {currentScan && (
            <div className="glass-panel p-6 border border-purple-500/20 bg-gradient-to-br from-[#0f1729] to-[#1a1040]/30">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">AI-Powered Security Analysis</span>
                <span className="ml-auto text-xs text-textMuted font-normal italic">Powered by Gemini</span>
              </h3>

              {currentScan.aiRecommendations ? (
                <div className="prose prose-invert max-w-none">
                  {renderMarkdown(currentScan.aiRecommendations)}
                </div>
              ) : aiLoading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  <p className="text-sm text-textMuted">Generating AI security analysis...</p>
                </div>
              ) : currentScan.recommendations && currentScan.recommendations.length > 0 ? (
                <div>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-2">
                    {currentScan.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-textMuted italic">No recommendations available. Run a scan to generate AI analysis.</p>
              )}
            </div>
          )}

          {/* Cipher Suites Table */}
          {currentScan && currentScan.pqcSupport && (
            <div className="glass-panel p-6 flex-1">
              <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4 flex items-center gap-2"><FileText size={16} /> Cryptographic Bill of Materials (CBOM)</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {/* Supported */}
                <div>
                  <h4 className="text-secondary font-medium mb-3 flex items-center gap-2 border-b border-border pb-2">
                    <CheckCircle size={16} /> Validated PQC Groups
                  </h4>
                  {renderCiphers(currentScan.pqcSupport.supportedAlgorithms, false)}
                </div>

                {/* Rejected */}
                <div>
                  <h4 className="text-danger font-medium mb-3 flex items-center gap-2 border-b border-border pb-2">
                    <AlertTriangle size={16} /> Vulnerable / Legacy Groups
                  </h4>
                  {renderCiphers(currentScan.pqcSupport.rejectedAlgorithms, true)}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Historical Scans Table */}
      <div className="glass-panel p-6 mt-4 overflow-hidden">
        <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4 border-b border-border pb-4">Asset Inventory & History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-textMuted text-sm border-b border-border">
                <th className="py-3 px-4 font-medium">Target Asset</th>
                <th className="py-3 px-4 font-medium">Scan Date</th>
                <th className="py-3 px-4 font-medium">Security Score</th>
                <th className="py-3 px-4 font-medium">Readiness Status</th>
                <th className="py-3 px-4 font-medium text-right">PQC Groups</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr
                  key={record._id}
                  className={`border-b border-border/50 hover:bg-[#1f2937]/50 transition-colors cursor-pointer ${currentScan && currentScan._id === record._id ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                    }`}
                  onClick={() => handleSelectScan(record)}
                >
                  <td className="py-3 px-4 font-medium text-white hover:text-primary transition-colors">{record.target}</td>
                  <td className="py-3 px-4 text-sm text-textMuted">{formatDate(record.scanDate)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-[#1f2937] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${record.securityScore > 700 ? 'bg-primary' : (record.securityScore >= 400 ? 'bg-warning' : 'bg-danger')}`}
                          style={{ width: `${Math.min(100, record.securityScore / 10)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-mono">{record.securityScore}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${record.pqcSupport?.statusLabel === 'Fully Quantum Safe' ? 'bg-primary/20 text-primary border border-primary/30' :
                      record.pqcSupport?.statusLabel === 'PQC Ready' ? 'bg-secondary/20 text-secondary border border-secondary/30' :
                        'bg-danger/20 text-danger border border-danger/30'
                      }`}>
                      {record.pqcSupport?.statusLabel || 'Unknown'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm text-secondary font-medium mr-2" title="Supported">{record.pqcSupport?.supportedAlgorithms?.length || 0}</span>
                    <span className="text-sm text-textMuted">/</span>
                    <span className="text-sm text-danger font-medium ml-2" title="Rejected">{record.pqcSupport?.rejectedAlgorithms?.length || 0}</span>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-textMuted">No previous scans found. Run a scan to populate the inventory.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
