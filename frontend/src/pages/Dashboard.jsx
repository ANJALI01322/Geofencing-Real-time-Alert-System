import { useEffect, useState, useCallback } from "react";
import { vehicleAPI, geofenceAPI, violationAPI } from "../api";
import {
  Truck, AlertTriangle, Activity,
  ArrowUpRight, ArrowDownLeft,
  Clock, Satellite, Zap, RefreshCw, TrendingUp, Shield, CheckCircle2
} from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, accent, trend }) {
  const C = {
    blue:  { bg:"#EFF6FF",border:"#BFDBFE",icon:"#2563EB",text:"#1D4ED8",bar:"#3B82F6" },
    green: { bg:"#F0FDF4",border:"#BBF7D0",icon:"#16A34A",text:"#15803D",bar:"#22C55E" },
    amber: { bg:"#FFFBEB",border:"#FDE68A",icon:"#D97706",text:"#B45309",bar:"#F59E0B" },
    red:   { bg:"#FFF1F2",border:"#FECDD3",icon:"#DC2626",text:"#B91C1C",bar:"#EF4444" },
  }[accent] || {};
  return (
    <div style={{ background:"#FFF", border:`1px solid ${C.border}`, borderRadius:12,
      padding:"20px 24px", position:"relative", overflow:"hidden",
      boxShadow:"0 1px 3px rgba(0,0,0,0.06)", transition:"box-shadow 0.2s, transform 0.15s" }}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.1)";e.currentTarget.style.transform="translateY(-2px)"}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.06)";e.currentTarget.style.transform="translateY(0)"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:C.bar,borderRadius:"12px 12px 0 0"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <p style={{fontSize:"0.68rem",fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>{label}</p>
          <p style={{fontSize:"2.4rem",fontWeight:800,color:"#111827",lineHeight:1,letterSpacing:"-0.04em"}}>{value ?? "0"}</p>
          {sub && <p style={{fontSize:"0.72rem",color:"#9CA3AF",marginTop:8}}>{sub}</p>}
        </div>
        <div style={{width:44,height:44,borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Icon size={20} color={C.icon} strokeWidth={2}/>
        </div>
      </div>
      {trend && <div style={{display:"flex",alignItems:"center",gap:4,marginTop:12}}>
        <TrendingUp size={12} color={C.icon}/>
        <span style={{fontSize:"0.68rem",color:C.text,fontWeight:600}}>{trend}</span>
      </div>}
    </div>
  );
}

function Badge({type}){
  const e=type==="entry";
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:20,
    fontSize:"0.65rem",fontWeight:700,letterSpacing:"0.06em",whiteSpace:"nowrap",
    background:e?"#F0FDF4":"#FFF1F2",color:e?"#16A34A":"#DC2626",border:`1px solid ${e?"#BBF7D0":"#FECDD3"}`}}>
    {e?<ArrowDownLeft size={9}/>:<ArrowUpRight size={9}/>}{e?"ENTRY":"EXIT"}
  </span>;
}

function ViolationRow({v}){
  const ts=v.timestamp||v.triggered_at;
  return <div style={{display:"grid",gridTemplateColumns:"90px 1fr 1fr 90px",gap:12,alignItems:"center",
    padding:"11px 20px",borderBottom:"1px solid #F3F4F6",fontSize:"0.78rem",transition:"background 0.1s"}}
    onMouseEnter={e=>e.currentTarget.style.background="#F9FAFB"}
    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
    <Badge type={v.event_type}/>
    <span style={{color:"#111827",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
      {v.vehicle_number||v.vehicle_id||"Unknown"}
    </span>
    <span style={{color:"#6B7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
      {v.geofence_name||"\u2014"}
    </span>
    <div style={{textAlign:"right"}}>
      <div style={{color:"#374151",fontFamily:"JetBrains Mono,monospace",fontSize:"0.68rem"}}>
        {ts?new Date(ts).toLocaleTimeString("en-GB",{hour12:false}):"\u2014"}
      </div>
      <div style={{color:"#9CA3AF",fontSize:"0.6rem"}}>
        {ts?new Date(ts).toLocaleDateString("en-GB",{day:"2-digit",month:"short"}):""}
      </div>
    </div>
  </div>;
}

function LiveAlertRow({a}){
  return <div style={{display:"flex",alignItems:"center",gap:12,padding:"11px 20px",
    borderBottom:"1px solid #F3F4F6",fontSize:"0.78rem",transition:"background 0.1s"}}
    onMouseEnter={e=>e.currentTarget.style.background="#F9FAFB"}
    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
    <Badge type={a.event_type}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{color:"#111827",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
        {a.vehicle_number||a.vehicle_id||"Vehicle"}
      </div>
      <div style={{color:"#9CA3AF",fontSize:"0.65rem",fontFamily:"JetBrains Mono,monospace"}}>
        {a.geofence_name||`${a.latitude?.toFixed(4)??"??"},${a.longitude?.toFixed(4)??"??"}`}
      </div>
    </div>
    <span style={{color:"#9CA3AF",fontSize:"0.65rem",fontFamily:"JetBrains Mono,monospace",flexShrink:0}}>
      {new Date().toLocaleTimeString("en-GB",{hour12:false})}
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
  const [loading,setLoading]=useState(true);
  const [lastRefresh,setLastRefresh]=useState(null);
  const [refreshing,setRefreshing]=useState(false);
  const [now,setNow]=useState(new Date());

  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);

  const fetchData=useCallback(async(silent=false)=>{
    if(!silent)setLoading(true); else setRefreshing(true);
    try{
      const[vRes,gRes,aRes]=await Promise.all([vehicleAPI.list(),geofenceAPI.list(),violationAPI.history({limit:20})]);
      const vehicles  =vRes.data?.data?.vehicles  ??(Array.isArray(vRes.data?.data)?vRes.data.data:Array.isArray(vRes.data)?vRes.data:[]);
      const geofences =gRes.data?.data?.geofences ??(Array.isArray(gRes.data?.data)?gRes.data.data:Array.isArray(gRes.data)?gRes.data:[]);
      const violations=aRes.data?.data?.violations??(Array.isArray(aRes.data?.data)?aRes.data.data:Array.isArray(aRes.data)?aRes.data:[]);
      const active=vehicles.filter(v=>v.last_location||v.latitude).length;
      setStats({vehicles:vehicles.length,active,geofences:geofences.length,alerts:violations.length});
      setRecentV(violations);
      setLastRefresh(new Date());
    }catch(e){console.error("Dashboard fetch",e);}
    finally{setLoading(false);setRefreshing(false);}
  },[]);

  useEffect(()=>{fetchData();},[fetchData]);
  useEffect(()=>{const t=setInterval(()=>fetchData(true),10000);return()=>clearInterval(t);},[fetchData]);

  const liveAlerts=alertHistory||[];

  return(
    <div style={{padding:"28px 32px",minHeight:"100%",background:"#F8FAFC",fontFamily:"Inter,system-ui,sans-serif"}}>

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
          <div style={{display:"flex",alignItems:"center",gap:7,padding:"7px 14px",borderRadius:8,background:"#F0FDF4",border:"1px solid #BBF7D0"}}>
            <span className="live-dot-green"/>
            <span style={{fontSize:"0.68rem",fontWeight:700,color:"#16A34A",letterSpacing:"0.08em"}}>LIVE</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,background:"#FFFFFF",border:"1px solid #E5E7EB"}}>
            <Clock size={12} color="#6B7280"/>
            <span style={{fontSize:"0.72rem",color:"#374151",fontFamily:"JetBrains Mono,monospace",fontWeight:500}}>
              {now.toLocaleTimeString("en-GB",{hour12:false})}
            </span>
          </div>
          <button onClick={()=>fetchData(true)} disabled={refreshing}
            style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,background:"#FFFFFF",border:"1px solid #E5E7EB",cursor:refreshing?"default":"pointer",color:"#374151",fontSize:"0.72rem",fontWeight:600}}>
            <RefreshCw size={12} color={refreshing?"#3B82F6":"#6B7280"} style={{animation:refreshing?"spin 1s linear infinite":"none"}}/>
            {lastRefresh?lastRefresh.toLocaleTimeString("en-GB",{hour12:false,hour:"2-digit",minute:"2-digit"}):"Refresh"}
          </button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:20}}>
        <StatCard icon={Truck}         label="Total Vehicles"  value={stats.vehicles}  sub={`${stats.active} with active GPS`} accent="blue"  trend="Fleet size"/>
        <StatCard icon={Satellite}     label="Active Tracking" value={stats.active}    sub="Location updated"                   accent="green" trend="GPS online"/>
        <StatCard icon={Shield}        label="Geofence Zones"  value={stats.geofences} sub="Monitored areas"                    accent="amber" trend="Zones configured"/>
        <StatCard icon={AlertTriangle} label="Violations"      value={stats.alerts}    sub="Total recorded events"              accent="red"   trend="All time"/>
      </div>

      <div style={{display:"flex",alignItems:"center",padding:"10px 18px",borderRadius:10,background:"#FFFFFF",border:"1px solid #E5E7EB",marginBottom:20,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
        {[
          {icon:CheckCircle2,label:"System",value:"Operational",color:"#16A34A"},
          {icon:Activity,label:"WebSocket",value:liveAlerts.length>0?"Connected":"Listening",color:"#2563EB"},
          {icon:Zap,label:"Alert Engine",value:"Active",color:"#D97706"},
          {icon:Shield,label:"GPS Engine",value:stats.active>0?`${stats.active} tracking`:"Standby",color:"#7C3AED"},
        ].map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:7,marginRight:20}}>
            {i>0&&<div style={{width:1,height:18,background:"#E5E7EB",marginRight:13}}/>}
            <s.icon size={13} color={s.color}/>
            <span style={{fontSize:"0.68rem",color:"#6B7280"}}>{s.label}:</span>
            <span style={{fontSize:"0.68rem",fontWeight:700,color:s.color}}>{s.value}</span>
          </div>
        ))}
        <div style={{marginLeft:"auto",fontSize:"0.65rem",color:"#9CA3AF",fontStyle:"italic"}}>Auto-refreshes every 10s</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{background:"#FFFFFF",border:"1px solid #E5E7EB",borderRadius:12,boxShadow:"0 1px 3px rgba(0,0,0,0.04)",overflow:"hidden"}}>
          <PanelHeader icon={AlertTriangle} title="Violation Log" iconColor="#D97706"
            badge={<span style={{padding:"3px 10px",borderRadius:20,background:"#FFF7ED",border:"1px solid #FDE68A",fontSize:"0.65rem",fontWeight:700,color:"#B45309"}}>{recentV.length} events</span>}/>
          <div style={{display:"grid",gridTemplateColumns:"90px 1fr 1fr 90px",gap:12,padding:"7px 20px",background:"#F9FAFB",borderBottom:"1px solid #F3F4F6"}}>
            {["Event","Vehicle","Zone","Time"].map(h=><span key={h} style={{fontSize:"0.6rem",fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.1em"}}>{h}</span>)}
          </div>
          <div style={{maxHeight:320,overflowY:"auto"}}>
            {loading?[1,2,3,4].map(i=><div key={i} style={{height:46,borderBottom:"1px solid #F3F4F6",background:i%2===0?"#FAFAFA":"#FFF"}}/>)
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
              :<Empty icon={Satellite} title="Awaiting live events..." sub="Move a vehicle into a geofence zone to trigger"/>}
          </div>
        </div>
      </div>
    </div>
  );
}
