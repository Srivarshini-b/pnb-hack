import React, { useRef, useEffect, useState, useCallback } from 'react';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const NODE_TYPES = {
  HUB:     { color: '#a855f7', border: '#c084fc', icon: '🏦', label: 'HUB' },
  DOMAIN:  { color: '#10b981', border: '#34d399', icon: '🌐', label: 'WWW' },
  IP:      { color: '#3b82f6', border: '#60a5fa', icon: '📡', label: 'IP' },
  SSL:     { color: '#f59e0b', border: '#fbbf24', icon: '🔒', label: 'SSL' },
  TAG_SAFE:{ color: '#10b981', border: '#6ee7b7', icon: '🛡️', label: 'TAG' },
  TAG_RISK:{ color: '#ef4444', border: '#f87171', icon: '⚠️', label: 'TAG' },
  PORT:    { color: '#8b5cf6', border: '#a78bfa', icon: '🔌', label: 'PORT'},
  SSH:     { color: '#6366f1', border: '#818cf8', icon: '🔑', label: 'SSH' },
};

const PHYSICS = {
  repulsion: 8000,
  springLength: 220,
  springStrength: 0.003,
  damping: 0.85,
  centerGravity: 0.003,
  maxVelocity: 6,
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function radialPos(index, total, ring, jitter = 30) {
  const angle = (2 * Math.PI * index) / Math.max(total, 1) - Math.PI / 2;
  return {
    x: Math.cos(angle) * ring + (Math.random() - 0.5) * jitter,
    y: Math.sin(angle) * ring + (Math.random() - 0.5) * jitter,
  };
}

function buildGraphData(assetData, target) {
  const nodes = [];
  const edges = [];
  const edgeSet = new Set(); // prevent duplicate edges
  let id = 0;

  const addEdge = (src, tgt) => {
    const key = `${Math.min(src, tgt)}-${Math.max(src, tgt)}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push({ source: src, target: tgt });
    }
  };

  // Central hub
  const hubId = id++;
  nodes.push({
    id: hubId,
    type: NODE_TYPES.HUB,
    label: target || 'Scanning Target',
    sublabel: 'Tag: Scanning Target',
    x: 0, y: 0, vx: 0, vy: 0, pinned: false,
    radius: 36,
  });

  const domains = assetData?.domains || [];
  const certificates = assetData?.certificates || [];
  const ips = assetData?.ips || [];

  const domainNodeMap = {};
  const ipNodeMap = {};
  const tagNodeMap = {};   // shared TAG nodes by pqcStatus label
  const portNodeMap = {};  // shared PORT nodes by port number

  // Helper to get or create a shared TAG node
  const getTagNode = (pqcStatus, ring) => {
    const key = pqcStatus || 'Unknown';
    if (tagNodeMap[key] !== undefined) return tagNodeMap[key];
    const isSafe = key.toLowerCase().includes('fully') || key.toLowerCase().includes('quantum safe');
    const tagCount = Object.keys(tagNodeMap).length;
    const pos = radialPos(tagCount, 4, ring, 50);
    const nid = id++;
    nodes.push({
      id: nid,
      type: isSafe ? NODE_TYPES.TAG_SAFE : NODE_TYPES.TAG_RISK,
      label: key,
      sublabel: `PQC: ${key}`,
      detail: `Status: ${key}`,
      x: pos.x, y: pos.y, vx: 0, vy: 0, pinned: false,
      radius: 20,
    });
    tagNodeMap[key] = nid;
    return nid;
  };

  // Helper to get or create a shared PORT node
  const getPortNode = (portStr, parentX, parentY) => {
    if (portNodeMap[portStr] !== undefined) return portNodeMap[portStr];
    const portCount = Object.keys(portNodeMap).length;
    const pos = radialPos(portCount, 6, 120, 40);
    const nid = id++;
    nodes.push({
      id: nid,
      type: NODE_TYPES.PORT,
      label: portStr,
      sublabel: `Port: ${portStr}`,
      detail: `Open port ${portStr}`,
      x: parentX + pos.x * 0.5,
      y: parentY + pos.y * 0.5,
      vx: 0, vy: 0, pinned: false,
      radius: 14,
    });
    portNodeMap[portStr] = nid;
    return nid;
  };

  // ── Domain nodes (Ring 1) ──
  domains.forEach((d, idx) => {
    const pos = radialPos(idx, domains.length, 280);
    const nid = id++;
    nodes.push({
      id: nid,
      type: NODE_TYPES.DOMAIN,
      label: d.domain,
      sublabel: `Domain: ${d.domain}`,
      detail: `Registrar: ${d.registrar || 'N/A'}\nCompany: ${d.company || 'N/A'}\nPQC: ${d.pqcStatus || 'N/A'}`,
      x: pos.x, y: pos.y,
      vx: 0, vy: 0, pinned: false,
      radius: 24,
    });
    domainNodeMap[d.domain] = nid;
    addEdge(hubId, nid);

    // Shared PQC Tag
    const tagId = getTagNode(d.pqcStatus, 500);
    addEdge(nid, tagId);
  });

  // ── Certificate nodes (Ring 2) ──
  certificates.forEach((c, idx) => {
    const pos = radialPos(idx, certificates.length, 380, 60);
    const nid = id++;
    const fp = c.fingerprint ? c.fingerprint.substring(0, 12) + '…' : 'N/A';
    nodes.push({
      id: nid,
      type: NODE_TYPES.SSL,
      label: fp,
      sublabel: `SSL: ${fp}`,
      detail: `CN: ${c.commonName || 'N/A'}\nCA: ${c.ca || 'N/A'}\nValid: ${c.validFrom || 'N/A'}`,
      x: pos.x, y: pos.y,
      vx: 0, vy: 0, pinned: false,
      radius: 20,
    });
    // Connect SSL to matching domains
    let connected = false;
    if (c.commonName) {
      const cn = c.commonName.replace(/^CN=/, '');
      domains.forEach((d) => {
        if (d.domain === cn || cn.includes(d.domain) || d.domain.includes(cn)) {
          if (domainNodeMap[d.domain] !== undefined) {
            addEdge(domainNodeMap[d.domain], nid);
            connected = true;
          }
        }
      });
    }
    if (!connected) {
      addEdge(hubId, nid);
    }
  });

  // ── IP nodes (Ring 3) ──
  ips.forEach((ipData, idx) => {
    const pos = radialPos(idx, ips.length, 460, 80);
    const nid = id++;
    nodes.push({
      id: nid,
      type: NODE_TYPES.IP,
      label: ipData.ip,
      sublabel: `IP: ${ipData.ip}`,
      detail: `Ports: ${ipData.ports || 'N/A'}\nASN: ${ipData.asn || 'N/A'}\nLocation: ${ipData.location || 'N/A'}\nCompany: ${ipData.company || 'N/A'}`,
      x: pos.x, y: pos.y,
      vx: 0, vy: 0, pinned: false,
      radius: 24,
    });
    ipNodeMap[ipData.ip] = nid;

    // Connect IP to hub directly
    addEdge(hubId, nid);

    // Connect IP to domains that resolve to it (heuristic: connect to first domain)
    if (domains.length > 0) {
      // Connect to at most 2 domains to avoid over-linking
      const maxLinks = Math.min(2, domains.length);
      for (let di = 0; di < maxLinks; di++) {
        const d = domains[di];
        if (domainNodeMap[d.domain] !== undefined) {
          addEdge(domainNodeMap[d.domain], nid);
        }
      }
    }

    // Shared PORT nodes
    if (ipData.ports) {
      ipData.ports.split(',').forEach((port) => {
        const portStr = port.trim();
        if (!portStr) return;
        const portId = getPortNode(portStr, pos.x, pos.y);
        addEdge(nid, portId);
      });
    }

    // Shared PQC Tag
    const tagId = getTagNode(ipData.pqcStatus, 600);
    addEdge(nid, tagId);
  });

  return { nodes, edges };
}

// ─── FORCE SIMULATION ────────────────────────────────────────────────────────
function applyForces(nodes, edges) {
  const { repulsion, springLength, springStrength, damping, centerGravity, maxVelocity } = PHYSICS;

  // Repulsion between all nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = repulsion / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
      if (!b.pinned) { b.vx += fx; b.vy += fy; }
    }
  }

  // Spring attraction along edges
  edges.forEach(({ source, target }) => {
    const a = nodes[source], b = nodes[target];
    if (!a || !b) return;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const displacement = dist - springLength;
    const force = springStrength * displacement;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    if (!a.pinned) { a.vx += fx; a.vy += fy; }
    if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
  });

  // Center gravity
  nodes.forEach((n) => {
    if (n.pinned) return;
    n.vx -= n.x * centerGravity;
    n.vy -= n.y * centerGravity;
  });

  // Apply velocity with damping & clamp
  nodes.forEach((n) => {
    if (n.pinned) return;
    n.vx *= damping;
    n.vy *= damping;
    const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
    if (speed > maxVelocity) {
      n.vx = (n.vx / speed) * maxVelocity;
      n.vy = (n.vy / speed) * maxVelocity;
    }
    n.x += n.vx;
    n.y += n.vy;
  });
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
const AssetDiscovery = ({ assetData, target = '' }) => {
  const canvasRef = useRef(null);
  const graphRef = useRef({ nodes: [], edges: [] });
  const animRef = useRef(null);
  const viewRef = useRef({ offsetX: 0, offsetY: 0, scale: 1 });
  const dragRef = useRef({ dragging: false, nodeIdx: -1, panStartX: 0, panStartY: 0, isPanning: false });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const particlesRef = useRef([]);
  const tickRef = useRef(0);

  // Build graph when data changes
  useEffect(() => {
    const g = buildGraphData(assetData, target);
    graphRef.current = g;
    // Seed particles on edges
    const particles = [];
    g.edges.forEach((e, idx) => {
      particles.push({ edgeIdx: idx, t: Math.random(), speed: 0.002 + Math.random() * 0.003 });
    });
    particlesRef.current = particles;
    setSelectedNode(null);
    setHoveredNode(null);
  }, [assetData, target]);

  // Canvas to world coords
  const screenToWorld = useCallback((sx, sy) => {
    const v = viewRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    return {
      x: (sx - canvas.width / 2 - v.offsetX) / v.scale,
      y: (sy - canvas.height / 2 - v.offsetY) / v.scale,
    };
  }, []);

  const findNodeAt = useCallback((wx, wy) => {
    const nodes = graphRef.current.nodes;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = wx - n.x, dy = wy - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) return i;
    }
    return -1;
  }, []);

  // Mouse handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x: wx, y: wy } = screenToWorld(sx, sy);
      const idx = findNodeAt(wx, wy);
      if (idx >= 0) {
        dragRef.current = { dragging: true, nodeIdx: idx, isPanning: false };
        graphRef.current.nodes[idx].pinned = true;
      } else {
        dragRef.current = { dragging: false, nodeIdx: -1, panStartX: sx - viewRef.current.offsetX, panStartY: sy - viewRef.current.offsetY, isPanning: true };
      }
    };

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      setMousePos({ x: e.clientX, y: e.clientY });

      if (dragRef.current.dragging) {
        const { x: wx, y: wy } = screenToWorld(sx, sy);
        const n = graphRef.current.nodes[dragRef.current.nodeIdx];
        if (n) { n.x = wx; n.y = wy; n.vx = 0; n.vy = 0; }
      } else if (dragRef.current.isPanning) {
        viewRef.current.offsetX = sx - dragRef.current.panStartX;
        viewRef.current.offsetY = sy - dragRef.current.panStartY;
      } else {
        const { x: wx, y: wy } = screenToWorld(sx, sy);
        const idx = findNodeAt(wx, wy);
        setHoveredNode(idx >= 0 ? graphRef.current.nodes[idx] : null);
        canvas.style.cursor = idx >= 0 ? 'pointer' : 'default';
      }
    };

    const onMouseUp = (e) => {
      if (dragRef.current.dragging) {
        const n = graphRef.current.nodes[dragRef.current.nodeIdx];
        if (n) {
          // Click detection (same position means click)
          setSelectedNode((prev) => prev?.id === n.id ? null : n);
        }
      }
      dragRef.current = { dragging: false, nodeIdx: -1, isPanning: false };
    };

    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const v = viewRef.current;
      v.scale = Math.max(0.15, Math.min(4, v.scale * factor));
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [screenToWorld, findNodeAt]);

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const { nodes, edges } = graphRef.current;
      const v = viewRef.current;
      const w = canvas.width, h = canvas.height;
      tickRef.current++;

      // Physics step
      applyForces(nodes, edges);

      // Update particles
      particlesRef.current.forEach((p) => {
        p.t += p.speed;
        if (p.t > 1) p.t -= 1;
      });

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Draw background grid
      ctx.save();
      ctx.translate(w / 2 + v.offsetX, h / 2 + v.offsetY);
      ctx.scale(v.scale, v.scale);

      // Grid
      const gridSize = 80;
      const gridExtent = 2000;
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.04)';
      ctx.lineWidth = 0.5;
      for (let gx = -gridExtent; gx <= gridExtent; gx += gridSize) {
        ctx.beginPath(); ctx.moveTo(gx, -gridExtent); ctx.lineTo(gx, gridExtent); ctx.stroke();
      }
      for (let gy = -gridExtent; gy <= gridExtent; gy += gridSize) {
        ctx.beginPath(); ctx.moveTo(-gridExtent, gy); ctx.lineTo(gridExtent, gy); ctx.stroke();
      }

      // Draw edges
      edges.forEach((e) => {
        const a = nodes[e.source], b = nodes[e.target];
        if (!a || !b) return;
        const isHighlighted = selectedNode && (selectedNode.id === a.id || selectedNode.id === b.id);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = isHighlighted
          ? 'rgba(16, 185, 129, 0.7)'
          : 'rgba(59, 130, 246, 0.15)';
        ctx.lineWidth = isHighlighted ? 2 : 1;
        ctx.stroke();
      });

      // Draw particles on edges
      particlesRef.current.forEach((p) => {
        const e = edges[p.edgeIdx];
        if (!e) return;
        const a = nodes[e.source], b = nodes[e.target];
        if (!a || !b) return;
        const px = a.x + (b.x - a.x) * p.t;
        const py = a.y + (b.y - a.y) * p.t;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.6)';
        ctx.fill();
      });

      // Draw nodes
      nodes.forEach((n) => {
        const isHovered = hoveredNode?.id === n.id;
        const isSelected = selectedNode?.id === n.id;
        const r = n.radius + (isHovered ? 4 : 0);

        // Glow
        if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
          const glow = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r + 12);
          glow.addColorStop(0, n.type.color + '60');
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Outer ring
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, r * 0.1, n.x, n.y, r);
        grad.addColorStop(0, n.type.border);
        grad.addColorStop(1, n.type.color);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#ffffff' : n.type.border;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();

        // Inner dark circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 0.72, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.strokeStyle = n.type.color + '80';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Icon/Label inside node
        ctx.fillStyle = n.type.border;
        ctx.font = `bold ${Math.max(9, r * 0.55)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.type.label, n.x, n.y);

        // Label below node
        ctx.fillStyle = '#e2e8f0';
        ctx.font = `${Math.max(8, 10)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        const labelText = n.label.length > 22 ? n.label.substring(0, 20) + '…' : n.label;
        ctx.fillText(labelText, n.x, n.y + r + 14);

        // Sublabel
        ctx.fillStyle = '#94a3b8';
        ctx.font = `${Math.max(7, 8)}px Inter, sans-serif`;
        ctx.fillText(n.sublabel?.substring(0, 28) || '', n.x, n.y + r + 26);
      });

      ctx.restore();

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [hoveredNode, selectedNode]);

  const hasData = assetData && (assetData.domains?.length || assetData.ips?.length || assetData.certificates?.length);

  return (
    <div className="flex flex-col gap-6 pb-10 h-full">
      {/* Header */}
      <div className="glass-panel p-6 flex flex-col md:flex-row items-center justify-between border-t-2 border-t-secondary gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="text-3xl">🕸️</span>
            Asset Discovery — Network Topology
          </h2>
          <p className="text-textMuted mt-1">Interactive force-directed graph of discovered infrastructure assets.</p>
        </div>
        {target && (
          <div className="bg-[#1f2937]/50 px-4 py-3 rounded-lg border border-secondary/30 flex items-center gap-3">
            <span className="text-xs uppercase font-bold text-textMuted tracking-wider">Target:</span>
            <span className="font-mono text-secondary font-bold">{target}</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="glass-panel px-5 py-3 flex flex-wrap gap-5 items-center text-xs">
        <span className="text-textMuted font-semibold uppercase tracking-wider mr-2">Legend:</span>
        {Object.entries(NODE_TYPES).map(([key, val]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: val.color, boxShadow: `0 0 6px ${val.color}60` }}></span>
            <span className="text-textMuted">{val.label}</span>
          </span>
        ))}
        <span className="ml-auto text-textMuted opacity-70">Scroll to zoom · Drag nodes · Click to select · Drag canvas to pan</span>
      </div>

      {/* Graph Canvas */}
      <div className="glass-panel p-0 overflow-hidden relative" style={{ minHeight: '600px', flexGrow: 1 }}>
        {!hasData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-textMuted gap-3">
            <span className="text-5xl opacity-40">🕸️</span>
            <p className="text-lg font-medium">No asset data available</p>
            <p className="text-sm opacity-70">Run a scan from the Dashboard first, then return here.</p>
          </div>
        )}
        <div className="w-full h-full" style={{ minHeight: '600px' }}>
          <canvas ref={canvasRef} className="w-full h-full block" style={{ background: 'radial-gradient(ellipse at center, #111827 0%, #0a0e17 100%)' }} />
        </div>
      </div>

      {/* Hover Tooltip — rendered OUTSIDE overflow:hidden container */}
      {hoveredNode && (
        <div
          className="fixed pointer-events-none"
          style={{
            left: mousePos.x > window.innerWidth - 300 ? mousePos.x - 280 : mousePos.x + 16,
            top: mousePos.y > window.innerHeight - 180 ? mousePos.y - 140 : mousePos.y - 10,
            zIndex: 99999,
          }}
        >
          <div className="bg-[#1e293b]/95 backdrop-blur-sm border border-[#334155] rounded-lg shadow-2xl px-4 py-3 max-w-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: hoveredNode.type.color }}></span>
              <span className="font-bold text-sm text-white">{hoveredNode.type.label}</span>
            </div>
            <p className="text-secondary text-sm font-medium mb-1">{hoveredNode.label}</p>
            {hoveredNode.detail && (
              <pre className="text-textMuted text-xs whitespace-pre-wrap leading-relaxed">{hoveredNode.detail}</pre>
            )}
          </div>
        </div>
      )}

      {/* Selected Node Detail Panel */}
      {selectedNode && (
        <div className="glass-panel p-5 border-t-2 border-t-primary animate-pulse-once">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-4 h-4 rounded-full" style={{ background: selectedNode.type.color, boxShadow: `0 0 10px ${selectedNode.type.color}` }}></span>
            <h3 className="text-lg font-bold">{selectedNode.type.label}: {selectedNode.label}</h3>
            <button onClick={() => setSelectedNode(null)} className="ml-auto text-textMuted hover:text-white text-xs px-2 py-1 rounded border border-border hover:border-primary/50 transition-colors">✕ Close</button>
          </div>
          {selectedNode.sublabel && <p className="text-secondary text-sm mb-1">{selectedNode.sublabel}</p>}
          {selectedNode.detail && <pre className="text-textMuted text-sm whitespace-pre-wrap leading-relaxed bg-[#0f172a] rounded-lg p-3 mt-2">{selectedNode.detail}</pre>}
        </div>
      )}
    </div>
  );
};

export default AssetDiscovery;
