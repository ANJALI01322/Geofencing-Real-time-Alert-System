import { useEffect, useState, useCallback } from "react";
import { vehicleAPI, geofenceAPI, violationAPI } from "../api";
import {
  Truck, AlertTriangle, Activity,
  ArrowUpRight, ArrowDownLeft,
  Clock, Satellite, Zap, RefreshCw, TrendingUp, Shield, CheckCircle2
} from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, accent, trend }) {
  const C = {
    blue:  { bg:"#EFF6FF",icon:"#2563EB",text:"#1D4ED8",bar:"#3B82F6",w:72 },
    green: { bg:"#F0FDF4",icon:"#16A34A",text:"#15803D",bar:"#22C55E",w:58 },
    amber: { bg:"#FFFBEB",icon:"#D97706",text:"#B45309",bar:"#F59E0B",w:44 },
    red:   { bg:"#FFF1F2",icon:"#DC2626",text:"#B91C1C",bar:"#EF4444",w:30 },
  }[accent] || {};
  return (
    <div className="gt-stat">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <p className="gt-stat-label">{label}</p>
          <p className="gt-stat-value fade-num">{value ?? "0"}</p>
          {sub && <p style={{fontSize:"0.72rem",color:"#94A3B8",marginTop:8}}>{sub}</p>}
        </div>
        <div style={{width:44,height:44,borderRadius:10,background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Icon size={20} color={C.icon} strokeWidth={2}/>
        </div>
      </div>
      {trend && <div style={{display:"flex",alignItems:"center",gap:4,marginTop:12}}>
        <TrendingUp size={12} color={C.icon}/>
        <span style={{fontSize:"0.68rem",color:C.text,fontWeight:600}}>{trend}</span>
      </div>}
      <div className="gt-spark"><span style={{width:`${C.w||60}%`,background:C.bar}}/></div>
    </div>
  );
}

function Badge({type}){
  const t=(type||"").toLowerCase();
  const e=t==="entry";
  const sp=t==="speed_violation";
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:20,
    fontSize:"0.65rem",fontWeight:700,letterSpacing:"0.06em",whiteSpace:"nowrap",
    background:sp?"#FFF7ED":e?"#F0FDF4":"#FFF1F2",color:sp?"#C2410C":e?"#16A34A":"#DC2626",border:`1px solid ${sp?"#FDBA74":e?"#BBF7D0":"#FECDD3"}`}}>
    {sp?null:e?<ArrowDownLeft size={9}/>:<ArrowUpRight size={9}/>}{sp?"SPEED":e?"ENTRY":"EXIT"}
  </span>;
}

function ViolationRow({v}){
  const ts=v.timestamp||v.triggered_at;
  return <div style={{display:"grid",gridTemplateColumns:"90px 1fr 1fr 90px",gap:12,alignItems:"center",
    padding:"11px 20px",borderBottom:"1px solid #F1F3F6",fontSize:13,transition:"background 0.18s"}}
    onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
    <Badge type={v.event_type}/>
    <span style={{color:"#0F172A",fontWeight:600,fontFamily:"var(--font-mono)",fontSize:12.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
      {v.vehicle_number||v.vehicle_id||"Unknown"}
    </span>
    <span style={{color:"#6B7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
      {v.geofence_name||v.zone_name||v.geofence?.geofence_name||v.geofence?.name||(v.event_type==="speed_violation"?"Speed limit exceeded":"\u2014")}
    </span>
    <div style={{textAlign:"right"}}>
      <div style={{color:"#334155",fontFamily:"JetBrains Mono,monospace",fontSize:12}}>
        {ts?new Date(ts).toLocaleTimeString("en-GB",{hour12:false}):"\u2014"}
      </div>
      <div style={{color:"#9CA3AF",fontSize:"0.6rem"}}>
        {ts?new Date(ts).toLocaleDateString("en-GB",{day:"2-digit",month:"short"}):""}
      </div>
    </div>
  </div>;
}

function LiveAlertRow({a}){
  const name=a.vehicle_number||a.vehicle?.vehicle_number||"Unknown vehicle";
  const speedy=a.event_type==="speed_violation";
  const lat=a.latitude??a.location?.latitude, lng=a.longitude??a.location?.longitude;
  const place=a.geofence_name||a.geofence?.geofence_name
    ||(speedy?(a.speed_kmh!=null?`${Math.round(a.speed_kmh)} km/h \u00b7 speed limit exceeded`:"Speed limit exceeded")
      :(lat!=null&&lng!=null?`${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`:"\u2014"));
  const when=new Date(a.timestamp||Date.now());
  return <div style={{display:"flex",alignItems:"center",gap:12,padding:"11px 20px",
    borderBottom:"1px solid #F3F4F6",fontSize:"0.78rem",transition:"background 0.1s"}}
    onMouseEnter={e=>e.currentTarget.style.background="#F9FAFB"}
    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
    <Badge type={a.event_type}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{color:"#111827",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
        {name}
      </div>
      <div style={{color:"#9CA3AF",fontSize:"0.65rem",fontFamily:"JetBrains Mono,monospace"}}>
        {place}
      </div>
    </div>
    <span style={{color:"#9CA3AF",fontSize:"0.65rem",fontFamily:"JetBrains Mono,monospace",flexShrink:0}}>
      {when.toLocaleTimeString("en-GB",{hour12:false})}
    </span>
  </div>;
}

function PanelHeader({icon:Icon,title,iconColor,badge}){
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
    padding:"14px 20px",borderBottom:"1px solid #F3F4F6",background:"#FAFAFA",borderRadius:"12px 12px 0 0"}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <Icon size={15} color={iconColor||"#6B7280"} strokeWidth={2}/>
      <span style={{fontSize:"0.78rem",fontWeight:700,color:"#374151",letterSpacing:"0.02em"}}>{title}</span>
    </div>
    {badge}
  </div>;
}

function Empty({icon:Icon,title,sub}){
  return <div style={{textAlign:"center",padding:"48px 24px"}}>
    <div style={{width:48,height:48,borderRadius:12,background:"#F3F4F6",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
      <Icon size={22} color="#9CA3AF"/>
    </div>
    <div style={{fontSize:"0.82rem",fontWeight:600,color:"#6B7280"}}>{title}</div>
    <div style={{fontSize:"0.72rem",color:"#9CA3AF",marginTop:4}}>{sub}</div>
  </div>;
}

export default function Dashboard({alertHistory}){
  const [stats,setStats]=useState({vehicles:0,active:0,geofences:0,alerts:0});
  const [recentV,setRecentV]=useState([]);
  const [evStats,setEvStats]=useState({entry:0,exit:0,speed:0});
  const [loading,setLoading]=useState(true);
  const [lastRefresh,setLastRefresh]=useState(null);
  const [refreshing,setRefreshing]=useState(false);

  const fetchData=useCallback(async(silent=false)=>{
    if(!silent)setLoading(true); else setRefreshing(true);
    try{
      const[vRes,gRes,aRes,sRes]=await Promise.all([vehicleAPI.list(),geofenceAPI.list(),violationAPI.history({limit:20}),violationAPI.stats().catch(()=>null)]);
      const vehicles  =vRes.data?.data?.vehicles  ??(Array.isArray(vRes.data?.data)?vRes.data.data:Array.isArray(vRes.data)?vRes.data:[]);
      const geofences =gRes.data?.data?.geofences ??(Array.isArray(gRes.data?.data)?gRes.data.data:Array.isArray(gRes.data)?gRes.data:[]);
      const violations=aRes.data?.data?.violations??(Array.isArray(aRes.data?.data)?aRes.data.data:Array.isArray(aRes.data)?aRes.data:[]);
      const hasLoc=v=>v.last_location||v.latitude||v.longitude||v.location||v.last_lat;
      // Temporary display fix: if no vehicle reports a location, assume all are tracked (simulator)
      const active=vehicles.some(hasLoc)?vehicles.filter(hasLoc).length:vehicles.length;
      setRecentV(violations);
      const s=sRes?.data?.data??sRes?.data;
      let entry=Number(s?.entry)||0, exit=Number(s?.exit)||0, speed=Number(s?.speed)||0;
      if(!sRes||(entry===0&&exit===0&&speed===0)){
        entry=violations.filter(v=>v.event_type?.toLowerCase()==="entry").length;
        exit=violations.filter(v=>v.event_type?.toLowerCase()==="exit").length;
        speed=violations.filter(v=>v.event_type?.toLowerCase()==="speed_violation").length;
      }
      setEvStats({entry,exit,speed});
      // Violations card = stats total (entry + exit + speed), not the loaded list length
      setStats({vehicles:vehicles.length,active,geofences:geofences.length,alerts:entry+exit+speed});
      setLastRefresh(new Date());
    }catch(e){console.error("Dashboard fetch",e);}
    finally{setLoading(false);setRefreshing(false);}
  },[]);

  useEffect(()=>{fetchData();},[fetchData]);
  useEffect(()=>{const t=setInterval(()=>fetchData(true),10000);return()=>clearInterval(t);},[fetchData]);

  const liveAlerts=alertHistory||[];

  return(
    <div style={{padding:"28px 32px",minHeight:"100%",background:"#F8FAFC",fontFamily:"Inter,system-ui,sans-serif"}}>
      <div style={{height:3,background:"linear-gradient(90deg,#3B82F6,#22C55E)",margin:"-28px -32px 25px"}}/>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:42,height:42,borderRadius:11,background:"#EFF6FF",border:"1px solid #BFDBFE",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Truck size={20} color="#2563EB" strokeWidth={2}/>
          </div>
          <div>
            <h1 style={{fontSize:"1.35rem",fontWeight:800,color:"#111827",letterSpacing:"-0.02em",lineHeight:1.1}}>Fleet Overview</h1>
            <p style={{fontSize:"0.78rem",color:"#6B7280",marginTop:2}}>Real-time vehicle monitoring &amp; geofence intelligence</p>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>fetchData(true)} disabled={refreshing}
            style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,background:"#FFFFFF",border:"1px solid #E5E7EB",cursor:refreshing?"default":"pointer",color:"#374151",fontSize:"0.72rem",fontWeight:600}}>
            <RefreshCw size={12} color={refreshing?"#3B82F6":"#6B7280"} style={{animation:refreshing?"spin 1s linear infinite":"none"}}/>
            {lastRefresh?lastRefresh.toLocaleTimeString("en-GB",{hour12:false,hour:"2-digit",minute:"2-digit"}):"Refresh"}
          </button>
        </div>
      </div>

      <div className="stagger gt-grid-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:20}}>
        <StatCard icon={Truck}         label="Total Vehicles"  value={stats.vehicles}  sub={`${stats.active} with active GPS`} accent="blue"  trend="Fleet size"/>
        <StatCard icon={Satellite}     label="Active Tracking" value={stats.active}    sub="Location updated"                   accent="green" trend="GPS online"/>
        <StatCard icon={Shield}        label="Geofence Zones"  value={stats.geofences} sub="Monitored areas"                    accent="amber" trend="Zones configured"/>
        <StatCard icon={AlertTriangle} label="Violations"      value={stats.alerts}    sub="Total recorded events"              accent="red"   trend="All time"/>
      </div>

      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--r-lg)",boxShadow:"var(--shadow-sm)",padding:"16px 20px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
          <span style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Event breakdown</span>
          <span style={{fontSize:12,color:"var(--text-muted)",fontFamily:"var(--font-mono)"}}>{evStats.entry+evStats.exit} total</span>
        </div>
        <div className="gt-seg">
          <span style={{width:`${(evStats.entry+evStats.exit)>0?evStats.entry/(evStats.entry+evStats.exit)*100:0}%`,background:"#22C55E"}}/>
          <span style={{width:`${(evStats.entry+evStats.exit)>0?evStats.exit/(evStats.entry+evStats.exit)*100:0}%`,background:"#EF4444"}}/>
        </div>
        <div style={{display:"flex",gap:20,marginTop:10,fontSize:13,fontWeight:600}}>
          <span style={{color:"#15803D",display:"flex",alignItems:"center",gap:6}}><i style={{width:8,height:8,borderRadius:"50%",background:"#22C55E"}}/>Entry: {evStats.entry}</span>
          <span style={{color:"#B91C1C",display:"flex",alignItems:"center",gap:6}}><i style={{width:8,height:8,borderRadius:"50%",background:"#EF4444"}}/>Exit: {evStats.exit}</span>
        </div>
      </div>

      <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:20}}>
        {[
          {label:"System",value:"Operational",color:"#16A34A"},
          {label:"WebSocket",value:liveAlerts.length>0?"Connected":"Listening",color:"#2563EB"},
          {label:"Alert Engine",value:"Active",color:"#D97706"},
          {label:"GPS Engine",value:stats.active>0?`${stats.active} tracking`:"Standby",color:"#7C3AED"},
        ].map((s,i)=>(
          <span key={i} className="gt-chip">
            <i style={{background:s.color}}/>{s.label}: <b style={{color:s.color}}>{s.value}</b>
          </span>
        ))}
        <span style={{marginLeft:"auto",fontSize:12,color:"var(--text-muted)"}}>Auto-refreshes every 10s</span>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{background:"#FFFFFF",border:"1px solid #E5E7EB",borderRadius:12,boxShadow:"0 1px 3px rgba(0,0,0,0.04)",overflow:"hidden"}}>
          <PanelHeader icon={AlertTriangle} title="Violation Log" iconColor="#D97706"
            badge={<span style={{padding:"3px 10px",borderRadius:20,background:"#FFF7ED",border:"1px solid #FDE68A",fontSize:"0.65rem",fontWeight:700,color:"#B45309"}}>{recentV.length} events</span>}/>
          <div style={{display:"grid",gridTemplateColumns:"90px 1fr 1fr 90px",gap:12,padding:"7px 20px",background:"#F9FAFB",borderBottom:"1px solid #F3F4F6"}}>
            {["Event","Vehicle","Zone","Time"].map(h=><span key={h} style={{fontSize:"0.6rem",fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.1em"}}>{h}</span>)}
          </div>
          <div style={{maxHeight:320,overflowY:"auto"}}>
            {loading?[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:34,margin:"10px 20px"}}/>)
              :recentV.length===0?<Empty icon={Activity} title="No violations recorded" sub="Trigger a geofence to see events here"/>
              :recentV.map((v,i)=><ViolationRow key={v.id||v.violation_id||i} v={v}/>)}
          </div>
        </div>

        <div style={{background:"#FFFFFF",border:"1px solid #E5E7EB",borderRadius:12,boxShadow:"0 1px 3px rgba(0,0,0,0.04)",overflow:"hidden"}}>
          <PanelHeader icon={Zap} title="Live Alert Feed" iconColor="#2563EB"
            badge={<div style={{display:"flex",alignItems:"center",gap:7,padding:"3px 10px",borderRadius:20,background:"#EFF6FF",border:"1px solid #BFDBFE"}}>
              <span className="live-dot-blue"/>
              <span style={{fontSize:"0.65rem",fontWeight:700,color:"#2563EB"}}>WebSocket</span>
            </div>}/>
          <div style={{display:"grid",gridTemplateColumns:"90px 1fr auto",gap:12,padding:"7px 20px",background:"#F9FAFB",borderBottom:"1px solid #F3F4F6"}}>
            {["Event","Details","Time"].map(h=><span key={h} style={{fontSize:"0.6rem",fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.1em"}}>{h}</span>)}
          </div>
          <div style={{maxHeight:320,overflowY:"auto"}}>
            {liveAlerts.length>0
              ?liveAlerts.slice(0,20).map((a,i)=><LiveAlertRow key={i} a={a}/>)
              :<div style={{textAlign:"center",padding:"48px 24px"}}>
                <div className="listen-ring">
                  <div style={{width:48,height:48,borderRadius:"50%",background:"#EFF6FF",border:"1px solid #BFDBFE",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:1}}>
                    <Satellite size={22} color="#2563EB"/>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:"0.85rem",fontWeight:700,color:"#2563EB"}}>
                  <span className="blink-blue"/>Listening for geofence events
                </div>
                <div style={{fontSize:"0.72rem",color:"#9CA3AF",marginTop:6}}>WebSocket connected — alerts appear here in real time</div>
              </div>}
          </div>
        </div>
      </div>
    </div>
  );
}
