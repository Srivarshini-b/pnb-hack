import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { BarChart as BarChartIcon, Download, FileText, TrendingUp, Shield, AlertTriangle, Calendar, ArrowLeft, Briefcase, ClipboardCheck, Activity } from 'lucide-react';

const API_URL = 'http://localhost:5001/api';
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

const REPORT_TYPES = [
  {
    id: 'executive',
    title: 'Executive Summary',
    subtitle: 'High-level overview for leadership & stakeholders',
    description: 'Business-focused report with key metrics, risk posture, and strategic recommendations. Ideal for board presentations and management briefings.',
    icon: Briefcase,
    color: 'primary',
    gradient: 'from-primary/20 to-primary/5',
  },
  {
    id: 'technical',
    title: 'Technical Deep Dive',
    subtitle: 'Detailed technical analysis for security teams',
    description: 'In-depth cryptographic analysis including cipher suites, protocol versions, algorithm distribution, and score trends over time.',
    icon: Activity,
    color: 'secondary',
    gradient: 'from-secondary/20 to-secondary/5',
  },
  {
    id: 'compliance',
    title: 'Compliance & Audit Report',
    subtitle: 'Regulatory compliance assessment & audit trail',
    description: 'Compliance-focused report mapping scan results to NIST PQC migration mandates, CNSA 2.0, and enterprise readiness standards.',
    icon: ClipboardCheck,
    color: '[#d97706]',
    gradient: 'from-[#d97706]/20 to-[#d97706]/5',
  }
];

const Reporting = () => {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const reportRef = useRef(null);

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

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-textMuted">Loading Report data...</div>;
  }

  if (scans.length === 0) {
    return <div className="flex items-center justify-center h-64 text-textMuted">No scan data available. Run a scan first.</div>;
  }

  // --- Analytics ---
  const totalScans = scans.length;
  const uniqueDomains = new Set(scans.map(s => s.target)).size;
  const avgScore = Math.round(scans.reduce((acc, s) => acc + (s.securityScore || 0), 0) / totalScans);
  const pqcReadyCount = scans.filter(s => s.pqcSupport?.statusLabel !== 'Non-PQC Ready').length;
  const highRiskCount = totalScans - pqcReadyCount;

  const getFallbackTier = (record) => {
    if (record?.cyberRating?.tier) return record.cyberRating.tier;
    const score = record?.securityScore || 0;
    if (score > 700) return 'Tier-1 Elite';
    if (score >= 400 && score <= 700) return 'Tier-2 Standard';
    if (score > 0 && score < 400) return 'Tier-3 Legacy';
    return 'Critical';
  };

  // Score distribution
  const scoreRanges = [
    { range: '0', count: 0 },
    { range: '1-399', count: 0 },
    { range: '400-700', count: 0 },
    { range: '701-1000', count: 0 },
  ];
  scans.forEach(s => {
    const sc = s.securityScore || 0;
    if (sc === 0) scoreRanges[0].count++;
    else if (sc < 400) scoreRanges[1].count++;
    else if (sc <= 700) scoreRanges[2].count++;
    else scoreRanges[3].count++;
  });

  // PQC status distribution
  const statusCounts = {};
  scans.forEach(s => {
    const label = s.pqcSupport?.statusLabel || 'Unknown';
    statusCounts[label] = (statusCounts[label] || 0) + 1;
  });
  const statusPieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Score trend
  const trendData = scans
    .slice()
    .sort((a, b) => new Date(a.scanDate) - new Date(b.scanDate))
    .map((s, i) => ({
      scan: i + 1,
      score: s.securityScore || 0,
      domain: s.target,
    }));

  // Cipher distribution
  const cipherCounts = {};
  scans.forEach(s => {
    const c = s.tlsConfiguration?.cipherSuite || 'Unknown';
    cipherCounts[c] = (cipherCounts[c] || 0) + 1;
  });
  const topCiphers = Object.entries(cipherCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Protocol distribution
  const protocolCounts = {};
  scans.forEach(s => {
    const p = s.tlsConfiguration?.protocol || 'Unknown';
    protocolCounts[p] = (protocolCounts[p] || 0) + 1;
  });

  // Tier distribution
  const tierCounts = { 'Tier-1 Elite': 0, 'Tier-2 Standard': 0, 'Tier-3 Legacy': 0, 'Critical': 0 };
  scans.forEach(s => { tierCounts[getFallbackTier(s)]++; });

  // Radar data for executive
  const radarData = [
    { metric: 'PQC Readiness', value: Math.round((pqcReadyCount / totalScans) * 100) },
    { metric: 'Cipher Strength', value: Math.min(100, Math.round(avgScore / 10)) },
    { metric: 'Protocol', value: protocolCounts['TLSv1.3'] ? Math.round((protocolCounts['TLSv1.3'] / totalScans) * 100) : (protocolCounts['TLSv1.2'] ? Math.round((protocolCounts['TLSv1.2'] / totalScans) * 80) : 20) },
    { metric: 'Key Strength', value: Math.round(scans.filter(s => parseInt(s.certificateDetails?.publicKeySize || '0') >= 2048).length / totalScans * 100) },
    { metric: 'Coverage', value: Math.min(100, uniqueDomains * 10) },
  ];

  const handlePrint = () => { window.print(); };

  // ========================
  // REPORT SELECTION SCREEN
  // ========================
  if (!selectedReport) {
    return (
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#d97706]/20 flex items-center justify-center border border-[#d97706]/30">
            <BarChartIcon className="text-[#d97706] w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-textMain">Security Reports</h1>
            <p className="text-sm text-textMuted">Select a report type to generate</p>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4 flex items-center justify-between border-t-2 border-t-primary">
            <div>
              <p className="text-textMuted text-xs font-medium uppercase tracking-wider">Total Scans</p>
              <p className="text-2xl font-bold mt-1 text-textMain">{totalScans}</p>
            </div>
            <FileText className="w-6 h-6 text-primary/50" />
          </div>
          <div className="glass-panel p-4 flex items-center justify-between border-t-2 border-t-secondary">
            <div>
              <p className="text-textMuted text-xs font-medium uppercase tracking-wider">Unique Domains</p>
              <p className="text-2xl font-bold mt-1 text-textMain">{uniqueDomains}</p>
            </div>
            <Shield className="w-6 h-6 text-secondary/50" />
          </div>
          <div className="glass-panel p-4 flex items-center justify-between border-t-2 border-t-[#d97706]">
            <div>
              <p className="text-textMuted text-xs font-medium uppercase tracking-wider">Avg Score</p>
              <p className="text-2xl font-bold mt-1 text-textMain">{avgScore}/1000</p>
            </div>
            <TrendingUp className="w-6 h-6 text-[#d97706]/50" />
          </div>
          <div className="glass-panel p-4 flex items-center justify-between border-t-2 border-t-danger">
            <div>
              <p className="text-textMuted text-xs font-medium uppercase tracking-wider">High Risk</p>
              <p className="text-2xl font-bold mt-1 text-textMain">{highRiskCount}</p>
            </div>
            <AlertTriangle className="w-6 h-6 text-danger/50" />
          </div>
        </div>

        {/* Report Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {REPORT_TYPES.map((report) => {
            const Icon = report.icon;
            return (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={`glass-panel p-6 text-left group hover:scale-[1.02] transition-all duration-300 border-t-2 border-t-${report.color} relative overflow-hidden`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${report.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                <div className="relative z-10">
                  <div className={`w-12 h-12 rounded-xl bg-${report.color}/20 flex items-center justify-center border border-${report.color}/30 mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className={`text-${report.color} w-6 h-6`} />
                  </div>
                  <h3 className="text-lg font-bold text-textMain mb-1">{report.title}</h3>
                  <p className={`text-sm text-${report.color} font-medium mb-3`}>{report.subtitle}</p>
                  <p className="text-xs text-textMuted leading-relaxed">{report.description}</p>
                  <div className={`mt-4 flex items-center gap-2 text-xs font-semibold text-${report.color} uppercase tracking-wider`}>
                    Generate Report →
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ========================
  // GENERATED REPORT VIEW
  // ========================
  const currentReportConfig = REPORT_TYPES.find(r => r.id === selectedReport);

  return (
    <div className="flex flex-col gap-6" ref={reportRef}>
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedReport(null)} className="w-10 h-10 rounded-lg bg-[#1f2937]/80 flex items-center justify-center border border-border hover:bg-[#1f2937] transition-colors">
            <ArrowLeft className="text-textMuted w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-textMain">{currentReportConfig.title}</h1>
            <p className="text-sm text-textMuted">{currentReportConfig.subtitle} • Generated {new Date().toLocaleDateString()}</p>
          </div>
        </div>
        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors text-sm font-medium">
          <Download size={16} /> Export Report
        </button>
      </div>

      {/* =================== EXECUTIVE SUMMARY =================== */}
      {selectedReport === 'executive' && (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Scans', value: totalScans, border: 'border-t-blue-400' },
              { label: 'Unique Domains', value: uniqueDomains, border: 'border-t-secondary' },
              { label: 'Avg Score', value: `${avgScore}/1000`, border: 'border-t-primary' },
              { label: 'PQC Ready', value: `${Math.round((pqcReadyCount / totalScans) * 100)}%`, border: 'border-t-secondary' },
              { label: 'High Risk', value: highRiskCount, border: 'border-t-danger' },
            ].map((stat, i) => (
              <div key={i} className={`glass-panel p-4 border-t-2 ${stat.border}`}>
                <p className="text-textMuted text-xs font-medium uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold mt-1 text-textMain">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Risk Posture Radar + Tier Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel p-6">
              <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4">Organization Risk Posture</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1f2937" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 9 }} />
                  <Radar name="Score" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-panel p-6">
              <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4">Cyber Rating Tier Distribution</h3>
              <div className="space-y-4 mt-6">
                {Object.entries(tierCounts).map(([tier, count], i) => {
                  const colors = ['bg-primary', 'bg-secondary', 'bg-warning', 'bg-danger'];
                  const textColors = ['text-primary', 'text-secondary', 'text-warning', 'text-danger'];
                  return (
                    <div key={tier}>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-medium ${textColors[i]}`}>{tier}</span>
                        <span className="text-sm font-mono text-textMain">{count} <span className="text-textMuted">({totalScans > 0 ? Math.round((count / totalScans) * 100) : 0}%)</span></span>
                      </div>
                      <div className="w-full h-3 bg-[#1f2937] rounded-full overflow-hidden">
                        <div className={`h-full ${colors[i]} rounded-full transition-all duration-500`} style={{ width: `${totalScans > 0 ? (count / totalScans) * 100 : 0}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Executive Recommendations */}
          <div className="glass-panel p-6">
            <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4">Strategic Recommendations</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#1f2937]/30 p-4 rounded-lg border border-danger/20">
                <p className="text-xs text-danger uppercase font-bold mb-2">🔴 Immediate Action</p>
                <p className="text-sm text-textMuted">{highRiskCount > 0 ? `${highRiskCount} assets classified as Non-PQC Ready require urgent cryptographic upgrades to mitigate HNDL attack vectors.` : 'All assets meet minimum PQC readiness. Continue monitoring.'}</p>
              </div>
              <div className="bg-[#1f2937]/30 p-4 rounded-lg border border-warning/20">
                <p className="text-xs text-warning uppercase font-bold mb-2">🟡 Short-term (0-6 months)</p>
                <p className="text-sm text-textMuted">Implement hybrid key exchange (X25519+ML-KEM) across {tierCounts['Tier-2 Standard'] + tierCounts['Tier-3 Legacy']} standard/legacy-tier assets to achieve baseline PQ safety.</p>
              </div>
              <div className="bg-[#1f2937]/30 p-4 rounded-lg border border-secondary/20">
                <p className="text-xs text-secondary uppercase font-bold mb-2">🟢 Long-term (6-18 months)</p>
                <p className="text-sm text-textMuted">Complete NIST PQC migration across all {uniqueDomains} domains. Target Tier-1 Elite rating (score &gt;700) for all public-facing assets.</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =================== TECHNICAL DEEP DIVE =================== */}
      {selectedReport === 'technical' && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Scans', value: totalScans, icon: <FileText className="w-6 h-6 text-blue-400/50" />, border: 'border-t-blue-400' },
              { label: 'Unique Domains', value: uniqueDomains, icon: <Shield className="w-6 h-6 text-secondary/50" />, border: 'border-t-secondary' },
              { label: 'Avg Score', value: `${avgScore}/1000`, icon: <TrendingUp className="w-6 h-6 text-primary/50" />, border: 'border-t-primary' },
              { label: 'PQC Ready', value: pqcReadyCount, icon: <Shield className="w-6 h-6 text-secondary/50" />, border: 'border-t-secondary' },
              { label: 'High Risk', value: highRiskCount, icon: <AlertTriangle className="w-6 h-6 text-danger/50" />, border: 'border-t-danger' },
            ].map((stat, i) => (
              <div key={i} className={`glass-panel p-4 flex items-center justify-between border-t-2 ${stat.border}`}>
                <div>
                  <p className="text-textMuted text-xs font-medium uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 text-textMain">{stat.value}</p>
                </div>
                {stat.icon}
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel p-6">
              <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4">Score Distribution (0–1000)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={scoreRanges} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="range" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', color: '#fff' }} />
                  <Bar dataKey="count" name="Scans">
                    {scoreRanges.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-panel p-6">
              <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4">PQC Readiness Status</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                    {statusPieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Score Trend */}
          <div className="glass-panel p-6">
            <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4">Score Trend Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="scan" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Scan #', position: 'insideBottomRight', offset: -5, fill: '#6b7280' }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 1000]} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', color: '#fff' }}
                  formatter={(value, name, props) => [`${value}/1000`, props.payload.domain]}
                />
                <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top Cipher Suites */}
          <div className="glass-panel p-6">
            <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4">Top Cipher Suites Used</h3>
            <div className="space-y-3">
              {topCiphers.map(([cipher, count], i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 bg-[#1f2937]/50 rounded-lg overflow-hidden h-8 relative border border-border/50">
                    <div className="h-full rounded-lg" style={{ width: `${(count / totalScans) * 100}%`, backgroundColor: COLORS[i % COLORS.length] + '40' }}></div>
                    <span className="absolute inset-0 flex items-center px-3 text-xs font-mono text-textMuted truncate">{cipher}</span>
                  </div>
                  <span className="text-sm font-bold text-textMain w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Full Scan Log */}
          <div className="glass-panel p-6">
            <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4 border-b border-border pb-3 flex items-center gap-2"><Calendar size={14} /> Complete Scan Log</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-textMuted text-xs border-b border-border">
                    <th className="py-2 px-3 font-medium">#</th>
                    <th className="py-2 px-3 font-medium">Domain</th>
                    <th className="py-2 px-3 font-medium">Date</th>
                    <th className="py-2 px-3 font-medium">Score</th>
                    <th className="py-2 px-3 font-medium">Cipher Suite</th>
                    <th className="py-2 px-3 font-medium">Protocol</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan, i) => (
                    <tr key={scan._id} className="border-b border-border/40 hover:bg-[#1f2937]/30 transition-colors">
                      <td className="py-2 px-3 text-sm text-textMuted">{i + 1}</td>
                      <td className="py-2 px-3 text-sm font-medium text-textMain">{scan.target}</td>
                      <td className="py-2 px-3 text-xs text-textMuted">{new Date(scan.scanDate).toLocaleDateString()}</td>
                      <td className="py-2 px-3">
                        <span className={`text-sm font-mono font-bold ${scan.securityScore > 700 ? 'text-primary' : scan.securityScore >= 400 ? 'text-warning' : 'text-danger'}`}>
                          {scan.securityScore}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs font-mono text-textMuted">{scan.tlsConfiguration?.cipherSuite || 'N/A'}</td>
                      <td className="py-2 px-3 text-xs text-textMuted">{scan.tlsConfiguration?.protocol || 'N/A'}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          scan.pqcSupport?.statusLabel === 'Fully Quantum Safe' ? 'bg-primary/20 text-primary border border-primary/30' :
                          scan.pqcSupport?.statusLabel === 'PQC Ready' ? 'bg-secondary/20 text-secondary border border-secondary/30' :
                          'bg-danger/20 text-danger border border-danger/30'
                        }`}>
                          {scan.pqcSupport?.statusLabel || 'Unknown'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* =================== COMPLIANCE & AUDIT =================== */}
      {selectedReport === 'compliance' && (
        <>
          {/* Compliance Summary Header */}
          <div className="glass-panel p-6 border-l-4 border-l-[#d97706]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-textMain">Compliance Assessment Summary</h3>
                <p className="text-sm text-textMuted mt-1">Report Period: {new Date(scans[scans.length - 1]?.scanDate).toLocaleDateString()} — {new Date(scans[0]?.scanDate).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-textMuted uppercase">Overall Compliance</p>
                <p className={`text-3xl font-bold ${pqcReadyCount / totalScans >= 0.7 ? 'text-secondary' : pqcReadyCount / totalScans >= 0.4 ? 'text-warning' : 'text-danger'}`}>
                  {Math.round((pqcReadyCount / totalScans) * 100)}%
                </p>
              </div>
            </div>
          </div>

          {/* NIST / CNSA Compliance Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel p-6">
              <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4">NIST PQC Migration Readiness</h3>
              <div className="space-y-4">
                {[
                  { standard: 'FIPS 203 (ML-KEM)', status: pqcReadyCount > 0, desc: 'Key Encapsulation Mechanism' },
                  { standard: 'FIPS 204 (ML-DSA)', status: pqcReadyCount > 0, desc: 'Digital Signature Algorithm' },
                  { standard: 'FIPS 205 (SLH-DSA)', status: false, desc: 'Stateless Hash-Based Signatures' },
                  { standard: 'CNSA 2.0 Timeline', status: avgScore > 400, desc: 'NSA Commercial Suite compliance' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[#1f2937]/30 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium text-textMain">{item.standard}</p>
                      <p className="text-xs text-textMuted">{item.desc}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.status ? 'bg-secondary/20 text-secondary border border-secondary/30' : 'bg-danger/20 text-danger border border-danger/30'}`}>
                      {item.status ? 'COMPLIANT' : 'NON-COMPLIANT'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-6">
              <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4">Asset Compliance Breakdown</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                    {statusPieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Audit Trail / Full Log */}
          <div className="glass-panel p-6">
            <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4 border-b border-border pb-3 flex items-center gap-2"><ClipboardCheck size={14} /> Audit Trail — Complete Scan History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-textMuted text-xs border-b border-border">
                    <th className="py-2 px-3 font-medium">#</th>
                    <th className="py-2 px-3 font-medium">Domain</th>
                    <th className="py-2 px-3 font-medium">Scan Date</th>
                    <th className="py-2 px-3 font-medium">Score</th>
                    <th className="py-2 px-3 font-medium">Cyber Tier</th>
                    <th className="py-2 px-3 font-medium">Protocol</th>
                    <th className="py-2 px-3 font-medium">Key Size</th>
                    <th className="py-2 px-3 font-medium">Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan, i) => {
                    const tier = getFallbackTier(scan);
                    const isCompliant = scan.pqcSupport?.statusLabel !== 'Non-PQC Ready';
                    return (
                      <tr key={scan._id} className="border-b border-border/40 hover:bg-[#1f2937]/30 transition-colors">
                        <td className="py-2 px-3 text-sm text-textMuted">{i + 1}</td>
                        <td className="py-2 px-3 text-sm font-medium text-textMain">{scan.target}</td>
                        <td className="py-2 px-3 text-xs text-textMuted">{new Date(scan.scanDate).toLocaleString()}</td>
                        <td className="py-2 px-3">
                          <span className={`text-sm font-mono font-bold ${scan.securityScore > 700 ? 'text-primary' : scan.securityScore >= 400 ? 'text-warning' : 'text-danger'}`}>
                            {scan.securityScore}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs text-textMuted">{tier}</td>
                        <td className="py-2 px-3 text-xs text-textMuted">{scan.tlsConfiguration?.protocol || 'N/A'}</td>
                        <td className="py-2 px-3 text-xs font-mono text-textMuted">{scan.certificateDetails?.publicKeySize ? `${scan.certificateDetails.publicKeySize}-bit` : 'N/A'}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${isCompliant ? 'bg-secondary/20 text-secondary' : 'bg-danger/20 text-danger'}`}>
                            {isCompliant ? '✓ PASS' : '✗ FAIL'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Compliance Action Items */}
          <div className="glass-panel p-6">
            <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4">Remediation Action Items</h3>
            <div className="space-y-3">
              {highRiskCount > 0 && (
                <div className="flex gap-3 p-3 bg-danger/5 rounded-lg border border-danger/20">
                  <span className="text-danger font-bold text-lg">1.</span>
                  <div>
                    <p className="text-sm font-medium text-textMain">Upgrade {highRiskCount} Non-PQC Ready assets</p>
                    <p className="text-xs text-textMuted">Deploy oqsprovider with OpenSSL to enable ML-KEM and hybrid key exchange support on all legacy-tier assets.</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3 p-3 bg-warning/5 rounded-lg border border-warning/20">
                <span className="text-warning font-bold text-lg">{highRiskCount > 0 ? '2' : '1'}.</span>
                <div>
                  <p className="text-sm font-medium text-textMain">Establish continuous monitoring</p>
                  <p className="text-xs text-textMuted">Schedule automated weekly scans for all {uniqueDomains} domains to track PQC migration progress and detect regressions.</p>
                </div>
              </div>
              <div className="flex gap-3 p-3 bg-secondary/5 rounded-lg border border-secondary/20">
                <span className="text-secondary font-bold text-lg">{highRiskCount > 0 ? '3' : '2'}.</span>
                <div>
                  <p className="text-sm font-medium text-textMain">Certificate rotation plan</p>
                  <p className="text-xs text-textMuted">Plan certificate re-issuance with PQ-safe signature algorithms (ML-DSA) before current certificates expire.</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Reporting;
