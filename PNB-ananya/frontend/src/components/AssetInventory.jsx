import React from 'react';
import { Globe, Lock, Server, Link, Shield, MapPin, Hash } from 'lucide-react';

const AssetInventory = ({ target = '', assetData }) => {

  // STRICTLY use data passed from the backend scan engine.
  const domains = assetData?.domains || [];
  const certificates = assetData?.certificates || [];
  const ips = assetData?.ips || [];

  return (
    <div className="flex flex-col gap-8 pb-10">

      <div className="glass-panel p-6 flex flex-col md:flex-row items-center justify-between border-t-2 border-t-primary gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Server className="text-primary w-8 h-8" />
            External Attack Surface & Asset Discovery
          </h2>
          <p className="text-textMuted mt-1">Found linked assets & telemetry for target infrastructure.</p>
        </div>

        {target && (
          <div className="bg-[#1f2937]/50 px-4 py-3 rounded-lg border border-primary/30 flex items-center gap-3">
            <span className="text-xs uppercase font-bold text-textMuted tracking-wider">Filtered By:</span>
            <span className="font-mono text-primary font-bold">{target}</span>
          </div>
        )}
      </div>

      {/* Domain Table */}
      <div className="glass-panel p-6 overflow-hidden flex flex-col gap-4">
        <h3 className="text-lg font-bold flex items-center gap-2 border-b border-border pb-3">
          <Globe className="text-secondary" /> Discovered Domains & Subdomains
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-textMuted text-xs uppercase tracking-wider border-b border-border bg-[#1f2937]/50">
                <th className="py-3 px-4 font-medium rounded-tl-lg">Detection Date</th>
                <th className="py-3 px-4 font-medium">Domain Name</th>
                <th className="py-3 px-4 font-medium">Registration Date</th>
                <th className="py-3 px-4 font-medium">Registrar</th>
                <th className="py-3 px-4 font-medium rounded-tr-lg">Company Name</th>
              </tr>
            </thead>
            <tbody>
              {domains.length > 0 ? domains.map((row, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-[#1f2937]/30 transition-colors text-sm">
                  <td className="py-3 px-4 text-textMuted whitespace-nowrap">{row.detectionDate}</td>
                  <td className="py-3 px-4 font-medium text-textMain flex items-center gap-2">
                    <Link size={14} className="text-primary/70" /> {row.domain}
                  </td>
                  <td className="py-3 px-4 text-textMuted whitespace-nowrap">{row.regDate}</td>
                  <td className="py-3 px-4 text-textMuted">{row.registrar}</td>
                  <td className="py-3 px-4 font-medium text-secondary">{row.company}</td>
                </tr>
              )) : (
                <tr><td colSpan="5" className="py-8 text-center text-textMuted">Data is still generating or no domains discovered.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Certificate Table */}
      <div className="glass-panel p-6 overflow-hidden flex flex-col gap-4">
        <h3 className="text-lg font-bold flex items-center gap-2 border-b border-border pb-3">
          <Lock className="text-warning" /> Associated SSL Certificates
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-textMuted text-xs uppercase tracking-wider border-b border-border bg-[#1f2937]/50">
                <th className="py-3 px-4 font-medium rounded-tl-lg">Detection Date</th>
                <th className="py-3 px-4 font-medium">SSL SHA Fingerprint</th>
                <th className="py-3 px-4 font-medium">Valid From</th>
                <th className="py-3 px-4 font-medium">Common Name</th>
                <th className="py-3 px-4 font-medium">Company Name</th>
                <th className="py-3 px-4 font-medium rounded-tr-lg">Certificate Authority</th>
              </tr>
            </thead>
            <tbody>
              {certificates.length > 0 ? certificates.map((row, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-[#1f2937]/30 transition-colors text-sm">
                  <td className="py-3 px-4 text-textMuted whitespace-nowrap">{row.detectionDate}</td>
                  <td className="py-3 px-4 font-mono text-xs text-primary/80 truncate max-w-[200px]" title={row.fingerprint}>
                    {row.fingerprint}
                  </td>
                  <td className="py-3 px-4 text-textMuted whitespace-nowrap">{row.validFrom}</td>
                  <td className="py-3 px-4 text-textMain font-medium">{row.commonName}</td>
                  <td className="py-3 px-4 text-textMuted">{row.company}</td>
                  <td className="py-3 px-4 font-medium text-warning flex items-center gap-1">
                    <Shield size={14} /> {row.ca}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="6" className="py-8 text-center text-textMuted">Data is still generating or no certificates discovered.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* IPs/Ports Table */}
      <div className="glass-panel p-6 overflow-hidden flex flex-col gap-4">
        <h3 className="text-lg font-bold flex items-center gap-2 border-b border-border pb-3">
          <Hash className="text-danger" /> Discovered IP Addresses & Open Ports
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-textMuted text-xs uppercase tracking-wider border-b border-border bg-[#1f2937]/50">
                <th className="py-3 px-4 font-medium rounded-tl-lg">Detection Date</th>
                <th className="py-3 px-4 font-medium">IP Address</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Ports</th>
                <th className="py-3 px-4 font-medium">Subnet</th>
                <th className="py-3 px-4 font-medium">ASN</th>
                <th className="py-3 px-4 font-medium">Netname</th>
                <th className="py-3 px-4 font-medium">Location</th>
                <th className="py-3 px-4 font-medium rounded-tr-lg">Company</th>
              </tr>
            </thead>
            <tbody>
              {ips.length > 0 ? ips.map((row, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-[#1f2937]/30 transition-colors text-sm">
                  <td className="py-3 px-4 text-textMuted whitespace-nowrap">{row.detectionDate}</td>
                  <td className="py-3 px-4 font-mono font-medium text-textMain">
                    {row.ip}
                  </td>
                  <td className="py-3 px-4">
                    {row.ip && row.ip.includes(':') ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide bg-purple-500/15 text-purple-400 border border-purple-500/30">
                        IPv6
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        IPv4
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1 flex-wrap">
                      {row.ports ? row.ports.split(',').map(port => (
                        <span key={port} className="bg-black/5 dark:bg-[#1f2937] text-textMain px-2 py-0.5 rounded text-xs border border-border">
                          {port.trim()}
                        </span>
                      )) : 'N/A'}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-textMuted">{row.subnet}</td>
                  <td className="py-3 px-4 text-secondary font-medium">{row.asn}</td>
                  <td className="py-3 px-4 text-textMuted">{row.netname}</td>
                  <td className="py-3 px-4 text-textMuted flex items-center gap-1 whitespace-nowrap">
                    {row.location !== '-' && row.location !== 'Unknown' && <MapPin size={12} className="text-primary/60" />}
                    {row.location}
                  </td>
                  <td className="py-3 px-4 text-textMuted">{row.company}</td>
                </tr>
              )) : (
                <tr><td colSpan="9" className="py-8 text-center text-textMuted">Data is still generating or no IPs discovered.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
};

export default AssetInventory;