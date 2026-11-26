import { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, useMap, useMapEvents, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { geofenceAPI, violationAPI, apiErrorMessage } from "../api";
import { useAuth } from "../context/AuthContext";
import ErrorState from "../components/ErrorState";
import toast from "react-hot-toast";
import { Hexagon, Layers, Trash2, CheckCircle, XCircle, MousePointer2 } from "lucide-react";

const CATEGORIES = ["restricted_zone","delivery_zone","toll_zone","customer_area"];
const CAT_COLOR = { restricted_zone:"badge-red", delivery_zone:"badge-green", toll_zone:"badge-amber", customer_area:"badge-blue" };

// Single source of truth for zone colours (map polygons, list dots, legend)
const ZONE_COLORS = {
  restricted_zone: "#DC2626",
  toll_zone:       "#D97706",
  customer_area:   "#2563EB",
  parking:         "#0EA5E9",
  warehouse:       "#7C3AED",
  delivery_zone:   "#16A34A",
};
const ZONE_LABELS = {
  restricted_zone: "Restricted",
  toll_zone:       "Toll",
  customer_area:   "Customer area",
  parking:         "Parking",
  warehouse:       "Warehouse",
  delivery_zone:   "Delivery",
};
const polyColor = cat => ZONE_COLORS[cat] || "#94A3B8";
const zoneName = g => g.name || g.geofence_name || g.zone_name || "Unnamed zone";

// Click handler component
function ClickHandler({ drawing, onPoint }) {
  useMapEvents({ click: e => { if (drawing) onPoint(e.latlng); } });
  return null;
}

// Labels appear from this zoom level upward; below it they would overlap.
const LABEL_MIN_ZOOM = 12;

// A point guaranteed to lie inside the polygon (coords are [lat, lng]): take the area
// centroid's latitude, cut the polygon with that horizontal line and use the middle of the
// widest inside span. Falls back to the vertex average for degenerate shapes.
function labelPoint(coords) {
  const n = coords.length;
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const [y1, x1] = coords[i], [y2, x2] = coords[(i + 1) % n];
    const f = x1 * y2 - x2 * y1;
    a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  const avg = [coords.reduce((s, c) => s + c[0], 0) / n, coords.reduce((s, c) => s + c[1], 0) / n];
  if (Math.abs(a) < 1e-12) return avg;
  const lat = cy / (3 * a);
  const xs = [];
  for (let i = 0; i < n; i++) {
    const [y1, x1] = coords[i], [y2, x2] = coords[(i + 1) % n];
    if ((y1 > lat) !== (y2 > lat)) xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
  }
  xs.sort((p, q) => p - q);
  let best = null;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (!best || xs[i + 1] - xs[i] > best[1] - best[0]) best = [xs[i], xs[i + 1]];
  }
  return best ? [lat, (best[0] + best[1]) / 2] : avg;
}

// Zone names, shown only when zoomed in. Each label sits on a point inside its polygon,
// is clipped to one line (full name on hover via title) and rises above neighbours on hover.
function ZoneLabels({ zones }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  if (zoom < LABEL_MIN_ZOOM) return null;
  return zones.map(z => (
    <CircleMarker key={z.id} center={z.at} radius={0} interactive={false}
      pathOptions={{ opacity: 0, fillOpacity: 0 }}>
      <Tooltip permanent interactive direction="center" className="zone-tip">
        <span className="zone-tip-text" title={z.name} style={{ color: z.color }}>{z.name}</span>
      </Tooltip>
    </CircleMarker>
  ));
}

export default function Geofences() {
  const { canWrite } = useAuth(); // viewers cannot draw or create zones
  const [geofences, setGeofences] = useState([]);
  const [form, setForm] = useState({ name: "", category: "restricted_zone", description: "" });
  const [points, setPoints] = useState([]);   // current drawing points
  const [drawing, setDrawing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [violationCounts, setViolationCounts] = useState({});

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);

  const load = () => {
    setListError(false);
    geofenceAPI.list().then(r => {
      const d = r.data?.data?.geofences ?? r.data?.data ?? r.data;
      const list = Array.isArray(d) ? d : [];
      setGeofences(list);
      // Per-zone totals over ALL violations (the history endpoint is paginated)
      violationAPI.summary().then(sr => {
        const counts = {};
        (sr.data?.data?.by_zone ?? []).forEach(z => { counts[z.geofence_id] = z.count; });
        setViolationCounts(counts);
      }).catch(() => setViolationCounts({}));
    }).catch(() => { setGeofences([]); setListError(true); }).finally(() => setListLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startDrawing = () => {
    setPoints([]);
    setDrawing(true);
    toast("Click on the map to place polygon points", { icon: "📍" });
  };

  const addPoint = useCallback((latlng) => {
    setPoints(p => [...p, { lat: latlng.lat, lng: latlng.lng }]);
  }, []);

  const undoPoint = () => setPoints(p => p.slice(0, -1));

  const cancelDrawing = () => { setDrawing(false); setPoints([]); };

  const save = async e => {
    e.preventDefault();
    if (points.length < 3) return toast.error("Draw at least 3 points on the map");
    if (!form.name.trim()) return toast.error("Zone name required");
    setLoading(true);
    try {
      const rawPoints = points.map(p => [p.lat, p.lng]);
      const closedPoints = [...rawPoints, rawPoints[0]];
      await geofenceAPI.create({ ...form, coordinates: closedPoints });
      toast.success(`Zone "${form.name}" created`);
      setForm({ name: "", category: "restricted_zone", description: "" });
      setPoints([]);
      setDrawing(false);
      load();
    } catch (err) { toast.error(apiErrorMessage(err, "Failed to create zone")); }
    finally { setLoading(false); }
  };

  return (
    <div className="gt-geo-root" style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--bg-base)", overflow:"hidden" }}>

      {/* Top bar */}
      <div className="gt-geo-head" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 24px 4px", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:11, background:"#EFF6FF", border:"1px solid #BFDBFE", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Hexagon size={20} color="#2563EB" strokeWidth={2} />
          </div>
          <div>
            <h1 style={{ fontFamily:"Inter", fontSize:24, fontWeight:600, color:"var(--text-1)", lineHeight:1.15, letterSpacing:"-0.02em", margin:0 }}>Geofence Zones</h1>
            <p style={{ fontSize:13, color:"var(--text-3)", margin:"2px 0 0" }}>{geofences.length} zone{geofences.length!==1?"s":""} · click map to draw polygons</p>
          </div>
        </div>
        <div className="gt-geo-actions" style={{ display:"flex", gap:8, alignItems:"center" }}>
          {!canWrite ? null : !drawing ? (
            <button className="btn-primary" onClick={startDrawing}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", borderRadius:"var(--r-md)", fontSize:13, fontWeight:600 }}>
              <MousePointer2 size={14} /> Start Drawing
            </button>
          ) : (
            <>
              <span className="badge badge-green" style={{ padding:"6px 10px" }}>{points.length} points</span>
              {points.length > 0 && <button className="btn-ghost" onClick={undoPoint} style={{ display:"flex", alignItems:"center", gap:6 }}><Trash2 size={12}/> Undo</button>}
              <button onClick={cancelDrawing}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", borderRadius:"var(--r-md)", border:"none", background:"var(--danger)", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                <XCircle size={14}/> Cancel Drawing
              </button>
            </>
          )}
        </div>
      </div>

      <div className="gt-geo-body" style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* Map */}
        <div className="gt-geo-map" style={{ flex:1, padding:16, minWidth:0 }}>
        <div style={{ position:"relative", height:"100%", borderRadius:"var(--r-lg)", overflow:"hidden", border:"1px solid var(--border)", boxShadow:"var(--shadow-sm)", cursor: drawing ? "crosshair" : "default" }}>
          <div className="gt-float">
            {geofences.length} zone{geofences.length!==1?"s":""} · {geofences.filter(g=>g.category==="restricted_zone").length} restricted
          </div>
          <MapContainer center={[28.6139, 77.2090]} zoom={12} style={{ width:"100%", height:"100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; CartoDB" />
            <ClickHandler drawing={drawing} onPoint={addPoint} />

            {/* Drawing preview */}
            {points.length >= 2 && (
              <Polyline
                positions={points.map(p => [p.lat, p.lng])}
                pathOptions={{ color:"#0ea5e9", weight:2, dashArray:"6 4" }}
              />
            )}
            {points.length >= 3 && (
              <Polygon
                positions={points.map(p => [p.lat, p.lng])}
                pathOptions={{ color:"#0ea5e9", fillColor:"#0ea5e9", fillOpacity:0.12, weight:2 }}
              />
            )}
            {points.map((p, i) => (
              <CircleMarker key={i} center={[p.lat, p.lng]} radius={5}
                pathOptions={{ color:"#0ea5e9", fillColor:"#0ea5e9", fillOpacity:1, weight:1.5 }}
              />
            ))}

            {/* Saved geofences */}
            {geofences.map(g => {
              const coords = g.coordinates?.map?.(c => Array.isArray(c) ? [c[0], c[1]] : [c.lat, c.lng]);
              if (!coords?.length) return null;
              const color = polyColor(g.category);
              return (
                <Polygon key={g.geofence_id||g.id} positions={coords}
                  pathOptions={{ color, fillColor:color, fillOpacity:0.1, weight:2 }} />
              );
            })}

            <ZoneLabels zones={geofences.flatMap(g => {
              const coords = g.coordinates?.map?.(c => Array.isArray(c) ? [c[0], c[1]] : [c.lat, c.lng]);
              return coords?.length >= 3
                ? [{ id: g.geofence_id||g.id, name: zoneName(g), color: polyColor(g.category), at: labelPoint(coords) }]
                : [];
            })} />
          </MapContainer>

          {/* Drawing hint overlay */}
          {drawing && (
            <div style={{ position:"absolute", bottom:16, left:"50%", transform:"translateX(-50%)", zIndex:1000,
              padding:"8px 16px", background:"rgba(3,7,18,0.9)", border:"1px solid var(--border-blue)",
              borderRadius:8, backdropFilter:"blur(8px)", pointerEvents:"none" }}>
              <span style={{ fontSize:"0.72rem", fontFamily:"JetBrains Mono", color:"var(--blue)" }}>
                {points.length < 3
                  ? `Click to add point · ${points.length}/3 minimum`
                  : `${points.length} pts · fill form & save zone →`}
              </span>
            </div>
          )}
        </div>
        </div>

        {/* Right panel */}
        <div className="gt-geo-panel" style={{ width:360, margin:"16px 16px 16px 0", border:"1px solid var(--border)", borderRadius:"var(--r-lg)", boxShadow:"var(--shadow-sm)", display:"flex", flexDirection:"column", background:"var(--surface)", overflow:"hidden" }}>

          {/* Create form — shown when drawing or has points */}
          {(drawing || points.length > 0) && (
            <div style={{ padding:16, borderBottom:"1px solid var(--border)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:14 }}>
                <Hexagon size={13} color="var(--amber)" />
                <span style={{ fontSize:"0.75rem", fontWeight:700, color:"var(--text-2)", fontFamily:"Inter", textTransform:"uppercase", letterSpacing:"0.08em" }}>New Zone</span>
              </div>
              <form onSubmit={save} style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div>
                  <label className="form-label">Zone Name *</label>
                  <input className="form-input" placeholder="e.g. Warehouse A"
                    value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required />
                </div>
                <div>
                  <label className="form-label">Category</label>
                  <select className="form-input" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Description</label>
                  <input className="form-input" placeholder="Optional note"
                    value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} />
                </div>
                {points.length > 0 && (
                  <div style={{ padding:"8px 10px", background:"rgba(14,165,233,0.06)", border:"1px solid rgba(14,165,233,0.15)", borderRadius:6 }}>
                    <span style={{ fontSize:"0.68rem", color:"var(--blue)", fontFamily:"JetBrains Mono" }}>
                      ✓ {points.length} vertices captured
                    </span>
                  </div>
                )}
                <button type="submit" className="btn-primary" disabled={loading || points.length < 3}>
                  {loading ? "Saving…" : <><CheckCircle size={13}/> Save Zone</>}
                </button>
              </form>
            </div>
          )}

          {/* Zone list */}
          <div style={{ flex:1, overflowY:"auto" }}>
            <div style={{ position:"sticky", top:0, zIndex:2, background:"var(--surface)", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <Layers size={13} color="var(--text-3)" />
                <span style={{ fontSize:"0.68rem", fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"Inter" }}>
                  Zones ({geofences.length})
                </span>
              </div>
            </div>
            {listLoading && geofences.length === 0 ? (
              <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:48 }} />)}
              </div>
            ) : listError && geofences.length === 0 ? (
              <ErrorState title="Couldn't load zones" message="The server didn't respond. Please try again." onRetry={load} />
            ) : geofences.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 20px" }}>
                <Hexagon size={28} color="var(--text-3)" style={{ margin:"0 auto 10px" }} />
                <div style={{ fontSize:"0.78rem", color:"var(--text-3)" }}>No zones yet</div>
                <div style={{ fontSize:"0.68rem", color:"var(--text-3)", opacity:0.6, marginTop:4 }}>Click "Start Drawing" then click on map</div>
              </div>
            ) : geofences.map(g => {
              const color = polyColor(g.category);
              return (
                <div key={g.geofence_id||g.id} className="zone-row">
                  <div style={{ width:10, height:10, borderRadius:"50%", background:color, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div title={zoneName(g)} style={{ fontSize:13.5, fontWeight:700, color:"var(--text-1)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{zoneName(g)}</div>
                    <div style={{ fontSize:12, color:"var(--text-3)", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{g.coordinates?.length||0} vertices · {g.category}</div>
                  </div>
                  {violationCounts[g.geofence_id||g.id] > 0 && (
                    <span style={{ flexShrink:0, minWidth:20, textAlign:"center", padding:"1px 7px", borderRadius:10, background:"#FEE2E2", color:"#B91C1C", fontSize:11, fontWeight:700 }}>{violationCounts[g.geofence_id||g.id]}</span>
                  )}
                  <span className={`badge ${CAT_COLOR[g.category]||"badge-gray"}`} style={{ flexShrink:0 }}>{ZONE_LABELS[g.category]||g.category}</span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ padding:"12px 16px", borderTop:"1px solid var(--border)" }}>
            <div style={{ fontSize:"0.6rem", fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8, fontFamily:"Inter" }}>Zone Types</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {Object.entries(ZONE_COLORS).map(([k,c])=>(
                <div key={k} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background:c }} />
                  <span style={{ fontSize:12, color:"var(--text-2)" }}>{ZONE_LABELS[k]} <span style={{ color:"var(--text-3)", fontFamily:"var(--font-mono)", fontSize:11 }}>{k}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
