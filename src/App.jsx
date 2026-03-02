import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";

/* ══════════ UTILS ══════════ */
const uid = () => Math.random().toString(36).substr(2, 9);
const shuf = (a) => { const s=[...a]; for(let i=s.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[s[i],s[j]]=[s[j],s[i]];} return s; };

const compressPhoto=(dataUrl,maxW=200,q=0.7)=>new Promise(r=>{const img=new Image();img.onload=()=>{const c=document.createElement("canvas");const ratio=Math.min(maxW/img.width,maxW/img.height,1);c.width=img.width*ratio;c.height=img.height*ratio;const ctx=c.getContext("2d");ctx.drawImage(img,0,0,c.width,c.height);r(c.toDataURL("image/webp",q));};img.onerror=()=>r(dataUrl);img.src=dataUrl;});
const POS = ["Goleiro","Jogador de Linha"];
const TC = [{bg:"#8B1538",t:"#fff"},{bg:"#1B4D8E",t:"#fff"},{bg:"#1D6F42",t:"#fff"},{bg:"#D4A017",t:"#0a0a0a"},{bg:"#6D28D9",t:"#fff"},{bg:"#C2410C",t:"#fff"},{bg:"#0E7490",t:"#fff"},{bg:"#BE185D",t:"#fff"},{bg:"#7C3AED",t:"#fff"},{bg:"#059669",t:"#fff"}];
const mk=(r,ph,h,a)=>({id:uid(),round:r,phase:ph,homeTeamId:h,awayTeamId:a,homeScore:null,awayScore:null,goals:[],played:false,hPen:null,aPen:null,scheduledTime:null});
const genRR=(ids)=>{const m=[],t=[...ids];if(t.length%2)t.push(null);const R=t.length-1,H=t.length/2;for(let i=0;i<R;i++){for(let j=0;j<H;j++){const a=t[j],b=t[t.length-1-j];if(a&&b)m.push(mk(i+1,"group",a,b));}t.splice(1,0,t.pop());}return m;};
const genKO=(ids)=>{const s=shuf(ids),m=[];for(let i=0;i<s.length;i+=2)if(i+1<s.length)m.push(mk(1,"knockout",s[i],s[i+1]));return m;};
const genTwoGroups=(ids)=>{const s=shuf(ids);const half=Math.ceil(s.length/2);const gA=s.slice(0,half),gB=s.slice(half);const mA=genRR(gA).map(m=>({...m,groupLabel:"A"}));const mB=genRR(gB).map(m=>({...m,groupLabel:"B"}));return{matches:[...mA,...mB],groups:{A:gA,B:gB}};};

const JOURNALIST_QUESTIONS=[
  "Qual seu maior objetivo neste torneio?",
  "O que você acha que sua equipe precisa melhorar?",
  "Quem é o jogador mais difícil de marcar?",
  "Como você se prepara antes de uma partida?",
  "Qual foi o momento mais marcante do campeonato até agora?",
  "O que você espera da próxima partida?",
  "Qual a maior qualidade do seu time?",
  "Quem você torce para ser artilheiro?",
  "O que o Futsabão significa para você?",
  "Qual dica você daria para quem está começando?"
];


/* ══════════ SOUND ENGINE (#12) ══════════ */
const SFX={
  goal:()=>{const ac=new(window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator();const g=ac.createGain();o.connect(g);g.connect(ac.destination);o.frequency.setValueAtTime(523,ac.currentTime);o.frequency.linearRampToValueAtTime(1047,ac.currentTime+0.15);g.gain.setValueAtTime(0.4,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.01,ac.currentTime+0.8);o.start();o.stop(ac.currentTime+0.8);
    setTimeout(()=>{const o2=ac.createOscillator();const g2=ac.createGain();o2.connect(g2);g2.connect(ac.destination);o2.type="triangle";o2.frequency.setValueAtTime(784,ac.currentTime);o2.frequency.linearRampToValueAtTime(1568,ac.currentTime+0.2);g2.gain.setValueAtTime(0.3,ac.currentTime);g2.gain.exponentialRampToValueAtTime(0.01,ac.currentTime+0.6);o2.start();o2.stop(ac.currentTime+0.6);},200);
    // Crowd roar noise
    setTimeout(()=>{const buf=ac.createBuffer(1,ac.sampleRate*1.5,ac.sampleRate);const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(ac.sampleRate*0.8));const s=ac.createBufferSource();const g3=ac.createGain();const f=ac.createBiquadFilter();f.type="bandpass";f.frequency.value=800;f.Q.value=0.5;s.buffer=buf;s.connect(f);f.connect(g3);g3.connect(ac.destination);g3.gain.setValueAtTime(0.15,ac.currentTime);g3.gain.exponentialRampToValueAtTime(0.01,ac.currentTime+1.5);s.start();},100);
    try{navigator.vibrate?.([200,100,200]);}catch(e){}
  },
  whistle:()=>{const ac=new(window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator();const g=ac.createGain();o.connect(g);g.connect(ac.destination);o.type="sine";o.frequency.setValueAtTime(2800,ac.currentTime);o.frequency.linearRampToValueAtTime(2400,ac.currentTime+0.3);o.frequency.linearRampToValueAtTime(2800,ac.currentTime+0.6);g.gain.setValueAtTime(0.2,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.01,ac.currentTime+0.7);o.start();o.stop(ac.currentTime+0.7);},
  end:()=>{const ac=new(window.AudioContext||window.webkitAudioContext)();[0,0.4,0.8].forEach(t=>{const o=ac.createOscillator();const g=ac.createGain();o.connect(g);g.connect(ac.destination);o.type="square";o.frequency.value=1200;g.gain.setValueAtTime(0.15,ac.currentTime+t);g.gain.exponentialRampToValueAtTime(0.01,ac.currentTime+t+0.3);o.start(ac.currentTime+t);o.stop(ac.currentTime+t+0.3);});}
};

/* ══════════ PERSISTENCE — SUPABASE CLOUD + REALTIME ══════════ */
const SYNC_CHANNEL="futsabao_sync";
const LOCAL_STORAGE_KEY="futsabao_app_state";
const DEFAULT_STATE={players:[],teams:[],tournament:null,matches:[],currentMatch:null,screen:"home",commentators:[],geminiKey:"",sponsors:[],votes:{},bets:{},fanChat:{},photos:{},journalists:[],athleteNews:[],tournamentStartAt:null,dailyHeadline:null,cartolaMessage:null,torcedorMessage:null,presidentMessage:null,refereeMessage:null,panjangoVotes:{},preTorneioFeed:[],lastFeedGenerationAt:null,matchStarRatings:{}};
function getPlayerStarRating(playerId,matchStarRatings){
  const arr=[];
  Object.values(matchStarRatings||{}).forEach(list=>list.forEach(r=>{if(r.playerId===playerId)arr.push(r.stars);}));
  return arr.length?Math.round((arr.reduce((a,b)=>a+b,0)/arr.length)*10)/10:null;
}

// Cloud save — debounced, strips transient fields. Returns { ok, error? } for UI feedback.
const TRANSIENT_KEYS=["screen","currentMatch","viewPlayerId"];
async function cloudSave(state){
  const toSave={...state};
  TRANSIENT_KEYS.forEach(k=>delete toSave[k]);
  if(supabase){
    try{
      await supabase.from("app_state").upsert({id:"main",state:toSave,updated_at:new Date().toISOString()});
      return { ok: true };
    }catch(e){console.warn("Cloud save failed:",e);return { ok: false, error: e?.message||"Falha ao salvar na nuvem" };}
  }
  try{
    localStorage.setItem(LOCAL_STORAGE_KEY,JSON.stringify(toSave));
    return { ok: true };
  }catch(e){console.warn("Local save failed:",e);return { ok: false, error: e?.message||"Falha ao salvar localmente" };}
}

// Cloud load — returns saved state or defaults (Supabase or localStorage fallback)
async function cloudLoad(defaults){
  if(supabase){
    try{
      const{data,error}=await supabase.from("app_state").select("state").eq("id","main").single();
      if(error||!data?.state)return defaults;
      return{...defaults,...data.state,screen:"home",currentMatch:null};
    }catch(e){console.warn("Cloud load failed:",e);return defaults;}
  }
  try{
    const raw=localStorage.getItem(LOCAL_STORAGE_KEY);
    if(!raw)return defaults;
    const data=JSON.parse(raw);
    return{...defaults,...data,screen:"home",currentMatch:null};
  }catch(e){console.warn("Local load failed:",e);return defaults;}
}

// BroadcastChannel kept for same-tab sync (goal notifications etc)
let _bc=null;
function getBroadcastChannel(){if(!_bc){try{_bc=new BroadcastChannel(SYNC_CHANNEL);}catch(e){}}return _bc;}

async function callGemini(prompt,gk){
  if(!gk)return null;
  try{
    const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gk}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
    const data=await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()||null;
  }catch(e){return null;}
}

const LOGO="data:image/webp;base64,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";

/* ══════════ DESIGN TOKENS ══════════ */
const DARK={bg:"#070B18",bg2:"#0D1225",bg3:"#131836",sf:"rgba(19,24,54,0.7)",sfh:"rgba(26,32,72,0.85)",bd:"rgba(196,165,97,0.1)",bdh:"rgba(196,165,97,0.25)",gold:"#C4A561",gBr:"#E8CE8B",gDm:"#8B7A4A",acc:"#8B1538",accL:"#B91C4D",tx:"#E8E2D4",txD:"#8B8574",txM:"#5A5647",grn:"#2ECC71",red:"#E74C3C",blu:"#3498DB",inp:"rgba(7,11,24,0.7)",tblH:"rgba(7,11,24,0.6)",row:"rgba(7,11,24,0.4)"};
const LIGHT={bg:"#F5F1EA",bg2:"#EDE8DE",bg3:"#E5DFD2",sf:"rgba(255,255,255,0.85)",sfh:"rgba(255,255,255,0.95)",bd:"rgba(139,21,56,0.15)",bdh:"rgba(139,21,56,0.3)",gold:"#7A5C10",gBr:"#6B4F0A",gDm:"#8B6914",acc:"#8B1538",accL:"#B91C4D",tx:"#1A1510",txD:"#4D443A",txM:"#7A7168",grn:"#1A7A3D",red:"#C0392B",blu:"#2471A3",inp:"rgba(255,255,255,0.8)",tblH:"rgba(220,214,202,0.7)",row:"rgba(237,232,222,0.5)"};
let K=DARK;
const ff="'Barlow',sans-serif",fH="'Oswald',sans-serif",fC="'Barlow Condensed',sans-serif";

/* ══════════ GLOBAL CSS ══════════ */
const GS=`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Barlow:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@600;700;800&display=swap');*{box-sizing:border-box;margin:0}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#8B7A4A40;border-radius:4px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}@keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes gw{0%,100%{box-shadow:0 0 20px rgba(196,165,97,0.06)}50%{box-shadow:0 0 50px rgba(196,165,97,0.15)}}@keyframes lp{0%,100%{box-shadow:0 0 0 0 rgba(46,204,113,0.4)}70%{box-shadow:0 0 0 10px rgba(46,204,113,0)}}@keyframes sh{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes confetti-fall{0%{transform:translateY(-100vh) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}@keyframes goal-flash{0%{opacity:1;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}100%{opacity:0;transform:scale(1.3)}}@keyframes crown{0%{transform:scale(0) rotate(-20deg);opacity:0}60%{transform:scale(1.2) rotate(5deg);opacity:1}100%{transform:scale(1) rotate(0deg);opacity:1}}body{scroll-behavior:smooth}.athlete-action-card{transition:transform .2s,box-shadow .2s}.athlete-action-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.12)}`;

/* ══════════ BG ══════════ */
function GeoBg({light}){
  if(light)return <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,background:`linear-gradient(160deg,#F5F1EA 0%,#EDE8DE 35%,#E5DFD2 65%,#F5F1EA 100%)`}}/>
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.06}}><defs><pattern id="dm" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 0L60 30L30 60L0 30Z" fill="none" stroke="#8B1538" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#dm)"/></svg>
    <style>{GS}</style>
  </div>;
  return <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,background:`linear-gradient(160deg,${DARK.bg} 0%,${DARK.bg2} 35%,#1A0A14 65%,${DARK.bg} 100%)`}}/>
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.025}}><defs><pattern id="dm" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 0L60 30L30 60L0 30Z" fill="none" stroke={DARK.gold} strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#dm)"/></svg>
    <div style={{position:"absolute",top:"-20%",right:"-10%",width:"60%",height:"60%",background:"radial-gradient(circle,rgba(139,21,56,0.1) 0%,transparent 70%)",borderRadius:"50%"}}/>
    <div style={{position:"absolute",bottom:"-10%",left:"-15%",width:"50%",height:"50%",background:"radial-gradient(circle,rgba(196,165,97,0.05) 0%,transparent 70%)",borderRadius:"50%"}}/>
    <style>{GS}</style>
  </div>;
}

/* ══════════ UI ATOMS ══════════ */
function G({children,style={},hover=false,...p}){const[h,sH]=useState(false);return <div {...p} role={hover?"button":undefined} tabIndex={hover?0:undefined} onKeyDown={hover?e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();p.onClick?.(e);}}:undefined} onMouseEnter={hover?()=>sH(true):undefined} onMouseLeave={hover?()=>sH(false):undefined} style={{background:h?K.sfh:K.sf,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderRadius:14,border:`1px solid ${h?K.bdh:K.bd}`,transition:"all 0.25s",...style}}>{children}</div>;}
const BB=({onClick,label="VOLTAR",crumb})=><nav aria-label="Navegação" style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
  <button onClick={onClick} aria-label={`Voltar para ${label}`} style={{display:"inline-flex",alignItems:"center",gap:6,background:K.gold+"08",border:`1px solid ${K.bd}`,color:K.gDm,cursor:"pointer",padding:"7px 16px",fontSize:10,fontWeight:700,borderRadius:8,fontFamily:fC,letterSpacing:"0.08em",textTransform:"uppercase",transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.color=K.gold;e.currentTarget.style.borderColor=K.bdh;}} onMouseLeave={e=>{e.currentTarget.style.color=K.gDm;e.currentTarget.style.borderColor=K.bd;}}>← {label}</button>
  {crumb&&<span style={{fontSize:10,color:K.txM,fontFamily:fC,fontWeight:600}}>/ {crumb}</span>}
</nav>;
function SH({icon,title,sub,color=K.gold}){return <section aria-label={title} style={{marginTop:16,marginBottom:sub?8:14}}><h2 style={{fontFamily:fH,fontSize:26,fontWeight:700,color,display:"flex",alignItems:"center",gap:10,letterSpacing:"0.02em",textTransform:"uppercase"}}>{icon} {title}</h2>{sub&&<p style={{fontFamily:ff,fontSize:12,color:K.txD,marginTop:3}}>{sub}</p>}</section>;}
function BT({onClick,children,disabled=false,v="gold",style={}}){const c={gold:{bg:`linear-gradient(135deg,${K.gold},${K.gBr})`,c:K.bg,sh:`0 4px 20px ${K.gold}30`},acc:{bg:`linear-gradient(135deg,${K.acc},${K.accL})`,c:"#fff",sh:`0 4px 20px ${K.acc}30`},grn:{bg:"linear-gradient(135deg,#2ECC71,#27AE60)",c:"#fff",sh:"0 4px 20px rgba(46,204,113,0.2)"},red:{bg:"linear-gradient(135deg,#E74C3C,#C0392B)",c:"#fff",sh:"none"},gh:{bg:K.gold+"0A",c:K.gold,sh:"none"}}[v]||{bg:K.gold,c:K.bg,sh:"none"};return <button onClick={onClick} disabled={disabled} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"11px 24px",borderRadius:10,border:v==="gh"?`1px solid ${K.bd}`:"none",fontFamily:fC,fontWeight:700,fontSize:13,letterSpacing:"0.06em",textTransform:"uppercase",cursor:disabled?"default":"pointer",background:disabled?K.row:c.bg,color:disabled?K.txM:c.c,boxShadow:disabled?"none":c.sh,transition:"all 0.2s",...style}}>{children}</button>;}
const IN=({style={},...p})=><input {...p} style={{padding:"11px 15px",borderRadius:9,border:`1px solid ${K.bd}`,background:K.inp,color:K.tx,fontSize:13,fontFamily:ff,outline:"none",width:"100%",boxSizing:"border-box",transition:"border 0.2s",...style}} onFocus={e=>e.target.style.borderColor=K.gold+"50"} onBlur={e=>e.target.style.borderColor=K.bd}/>;
const SL=({children,style={},...p})=><select {...p} style={{padding:"11px 15px",borderRadius:9,border:`1px solid ${K.bd}`,background:K.inp,color:K.tx,fontSize:13,fontFamily:ff,outline:"none",width:"100%",boxSizing:"border-box",...style}}>{children}</select>;
const LB=({children})=><label style={{fontSize:10,fontWeight:700,color:K.gDm,fontFamily:fC,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:5}}>{children}</label>;
function Badge({team,size=28}){if(!team)return null;if(team.logo)return <img src={team.logo} alt={team.name+" escudo"} style={{width:size,height:size,borderRadius:size*.24,objectFit:"cover",border:`1px solid ${K.bd}`}}/>;return <div style={{width:size,height:size,borderRadius:size*.24,background:team.color?.bg||K.txM,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:size*.38,color:team.color?.t||"#fff",flexShrink:0,fontFamily:fC}}>{team.name?.[0]||"?"}</div>;}
function Stars({value=0,onChange,ro=false,sz=18}){return <div style={{display:"flex",gap:1}} role="group" aria-label={`Nota: ${value} de 5`}>{[1,2,3,4,5].map(n=><button key={n} aria-label={`${n} estrela${n>1?"s":""}`} onClick={()=>!ro&&onChange?.(n)} style={{background:"none",border:"none",cursor:ro?"default":"pointer",padding:1,color:n<=value?K.gold:K.bd,fontSize:sz,lineHeight:1,transition:"color 0.15s"}}>★</button>)}</div>;}
function Modal({open,onClose,title,children}){if(!open)return null;return <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}><div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(8px)"}}/><G style={{position:"relative",padding:24,maxWidth:520,width:"100%",maxHeight:"85vh",overflowY:"auto",border:`1px solid ${K.bdh}`,animation:"fu 0.3s ease"}} onClick={e=>e.stopPropagation()}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}><h3 style={{fontFamily:fH,fontSize:18,fontWeight:700,color:K.gold,textTransform:"uppercase",letterSpacing:"0.04em"}}>{title}</h3><button onClick={onClose} aria-label="Fechar" style={{background:"none",border:"none",color:K.txD,cursor:"pointer",fontSize:20,padding:4}}>✕</button></div>{children}</G></div>;}

/* ══════════ CONFETTI ══════════ */
function Confetti({active}){
  if(!active)return null;
  const colors=["#C4A561","#E74C3C","#2ECC71","#3498DB","#F39C12","#8B5CF6","#E91E63","#00BCD4"];
  const pieces=Array.from({length:50},(_,i)=>({id:i,x:Math.random()*100,delay:Math.random()*2,dur:1.5+Math.random()*2,color:colors[Math.floor(Math.random()*colors.length)],size:6+Math.random()*8,rot:Math.random()*360}));
  return <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>{pieces.map(p=>
    <div key={p.id} style={{position:"absolute",left:`${p.x}%`,top:-20,width:p.size,height:p.size*0.6,background:p.color,borderRadius:2,animation:`confetti-fall ${p.dur}s ${p.delay}s ease-in forwards`,transform:`rotate(${p.rot}deg)`}}/>
  )}</div>;
}

/* ══════════ GOAL FLASH ══════════ */
function GoalFlash({show,team}){
  if(!show)return null;
  return <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",animation:"goal-flash 1.5s ease-out forwards"}}>
    <div style={{fontSize:120,textShadow:"0 0 60px rgba(196,165,97,0.5)"}}>⚽</div>
  </div>;
}

/* ══════════ CONFIRM DIALOG ══════════ */
function ConfirmDialog({open,onConfirm,onCancel,title="Confirmar",message="Tem certeza?",confirmLabel="CONFIRMAR",confirmColor="red",icon="⚠️"}){
  if(!open)return null;
  return <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(6px)"}}/>
    <G style={{position:"relative",padding:28,maxWidth:380,width:"100%",textAlign:"center",border:`1px solid ${K.bdh}`,animation:"fu 0.2s ease"}} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:40,marginBottom:12}}>{icon}</div>
      <h3 style={{fontFamily:fH,fontSize:18,fontWeight:700,color:K.tx,marginBottom:8}}>{title}</h3>
      <p style={{fontSize:13,color:K.txD,lineHeight:1.5,marginBottom:20}}>{message}</p>
      <div style={{display:"flex",gap:8,justifyContent:"center"}}>
        <BT onClick={onCancel} v="gh" style={{flex:1,justifyContent:"center"}}>CANCELAR</BT>
        <BT onClick={onConfirm} v={confirmColor} style={{flex:1,justifyContent:"center"}}>{confirmLabel}</BT>
      </div>
    </G>
  </div>;
}


const PlayerPhoto=React.memo(function PlayerPhoto({src,name,size=44,radius=11}){
  return src
    ? <img src={src} alt={name} loading="lazy" style={{width:size,height:size,borderRadius:radius,objectFit:"cover"}}/>
    : <span style={{fontFamily:fH,fontSize:size*0.4,fontWeight:700,color:K.gold+"35"}}>{(name||"?")[0]}</span>;
});

/* ══════════ PLAYER FORM ══════════ */
function PF({onSubmit,label="CADASTRAR",initial={},showRating=false}){
  const[f,sF]=useState({name:initial.name||"",nickname:initial.nickname||"",position:initial.position||"",birthYear:initial.birthYear||"",number:initial.number||"",phrase:initial.phrase||"",photo:initial.photo||null,rating:initial.rating||0,pin:initial.pin||""});
  const fr=useRef(null);
  const hp=e=>{const file=e.target.files?.[0];if(file){const r=new FileReader();r.onload=async ev=>{const compressed=await compressPhoto(ev.target.result,200,0.7);sF(p=>({...p,photo:compressed}));};r.readAsDataURL(file);}};
  const[errs,sErrs]=useState({});
  const validate=()=>{const e={};if(!f.name.trim())e.name="Nome é obrigatório";if(f.pin&&(!/^\d{4}$/.test(f.pin)))e.pin="PIN deve ter 4 números";if(f.birthYear&&(+f.birthYear<1950||+f.birthYear>2015))e.birthYear="Ano inválido";if(f.number&&(+f.number<1||+f.number>99))e.number="1 a 99";return e;};
  const sub=()=>{const e=validate();sErrs(e);if(Object.keys(e).length)return;onSubmit({...f,name:f.name.trim(),nickname:f.nickname.trim(),phrase:f.phrase.trim(),pin:f.pin||""});if(!initial.id)sF({name:"",nickname:"",position:"",birthYear:"",number:"",phrase:"",photo:null,rating:0,pin:""});};
  const fd=(l,k,ph,ex={},req=false)=><div style={{marginBottom:10}}><LB>{l}{req&&<span style={{color:K.red,marginLeft:3}}>*</span>}</LB><IN value={f[k]} onChange={e=>{sF(p=>({...p,[k]:e.target.value}));if(errs[k])sErrs(p=>({...p,[k]:undefined}));}} placeholder={ph} {...ex} style={{...ex.style,borderColor:errs[k]?K.red+"70":undefined}}/>{errs[k]&&<span style={{fontSize:10,color:K.red,marginTop:3,display:"block"}}>{errs[k]}</span>}</div>;
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
      <div style={{gridColumn:"1/-1"}}>{fd("Nome Completo","name","João da Silva",{},true)}</div>
      {fd("Nome de Boleiro","nickname","Pelézinho")}
      <div style={{marginBottom:10}}><LB>Posição</LB><SL value={f.position} onChange={e=>sF(p=>({...p,position:e.target.value}))}><option value="">Selecione...</option>{POS.map(p=><option key={p} value={p}>{p}</option>)}</SL></div>
      {fd("Ano de Nascimento","birthYear","1995",{type:"number",inputMode:"numeric",min:1950,max:2015})}
      {fd("Número da Camisa","number","10",{type:"number",inputMode:"numeric",min:1,max:99})}
      {fd("Crie uma senha de ACESSO (4 números)","pin","1234",{type:"password",maxLength:4,pattern:"[0-9]*",inputMode:"numeric"})}
      <div style={{gridColumn:"1/-1"}}>{fd("Frase do Futebol","phrase","Habilidade pura!")}</div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
      <input ref={fr} type="file" accept="image/*" onChange={hp} style={{display:"none"}}/>
      <button onClick={()=>fr.current?.click()} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 18px",borderRadius:9,border:`1px solid ${f.photo?K.gold+"40":K.bd}`,background:f.photo?K.gold+"08":K.inp,color:f.photo?K.gold:K.txD,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:ff}}>📷 {f.photo?"Foto ✓":"Adicionar Foto"}</button>
      {f.photo&&<img src={f.photo} alt="" style={{width:40,height:40,borderRadius:10,objectFit:"cover",border:`2px solid ${K.gold}25`}}/>}
      {showRating&&<div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:10,color:K.gDm,fontFamily:fC,fontWeight:700}}>NOTA:</span><Stars value={f.rating} onChange={v=>sF(p=>({...p,rating:v}))}/></div>}
    </div>
    <BT onClick={sub} disabled={!f.name.trim()}>+ {label}</BT>
  </div>;
}

/* ══════════ MAIN APP ══════════ */
export default function App(){
  const REFEREE={name:"Rodolfo Gerd Seifert",bio:"Árbitro filiado à FIFS — Federação Internacional de FutSabão · 4º Campeonato Nacional · 47 anos"};
  const STADIUM={name:"Arena Sabão",location:"Campinas, SP"};
  const BROADCASTERS=[{id:"b1",name:"Cazé TV",icon:"📺",color:"#FF4654"},{id:"b2",name:"SporTV",icon:"📡",color:"#E8CE8B"},{id:"b3",name:"ESPN",icon:"🏅",color:"#D32F2F"},{id:"b4",name:"Amazon Prime",icon:"▶️",color:"#00A8E1"}];
  const defaultNarrators=[
    {id:"n1",name:"Galvão Bueno",type:"narrator",style:"Narre como Galvão Bueno em final de Copa do Mundo. Comece construindo tensão, aumentando o volume progressivamente. Use repetições dramáticas como 'Olha o que ele fez!' e 'Quem é que sobe?'. Faça comentários emocionados como 'A física não permite isso!'. No momento do gol, estoure em um 'GOOOOOOOOOOOOOL' extremamente longo, seguido de frases patrióticas e emocionais. Tudo deve soar histórico e épico."},
    {id:"n2",name:"Luís Roberto",type:"narrator",style:"Narre como Luís Roberto em jogo decisivo. Ritmo acelerado do início ao fim. Narração contínua, vibrante, sem pausas longas. Quando sair o gol, solte um 'Guuuuuuoooooooollllll' potente e prolongado. Após o grito, enfatize o nome do jogador com força e repetição. A energia deve ser elétrica e contagiante."},
    {id:"n3",name:"Cléber Machado",type:"narrator",style:"Narre como Cléber Machado em jogo grande. Tom conversado, natural, como se estivesse explicando o lance ao telespectador. Inclua pequenas pausas e um 'éééé…' antes de confirmar jogadas decisivas. No gol, aumente a intensidade de forma elegante, sem exagero extremo. Volte rapidamente ao tom analítico."},
    {id:"n4",name:"Milton Leite",type:"narrator",style:"Narre como Milton Leite em jogo imprevisível. Misture emoção com leve ironia. Demonstre surpresa real em lances inesperados, usando frases como 'Olha isso!' ou 'Que beleza!'. Inclua pequenas reações humanas no meio da jogada. O gol deve ser vibrante, mas com um toque de carisma e humor."},
    {id:"n5",name:"Silvio Luiz",type:"narrator",style:"Narre como Silvio Luiz em um jogo caótico. Use teatralidade exagerada e humor espontâneo. Inclua expressões como 'Minha nossa senhora!', 'Tá lá no fundo da rede!' e alongue o 'Ééééééééééééé do…'. A narração deve soar imprevisível, divertida e com energia de rádio clássico."}
  ];
  const defaultAnalysts=[
    {id:"a1",name:"Neto",type:"analyst",style:"Comente como Neto em debate ao vivo. Seja explosivo, direto e indignado. Fale com convicção absoluta, como se sua opinião fosse irrefutável. Use frases como 'Tá de brincadeira!', 'Cês tão malucos?' e mencione experiência prática como autoridade ('Eu joguei bola!'). Interrompa ideias com energia e demonstre paixão intensa pelo tema."},
    {id:"a2",name:"PVC (Paulo Vinícius Coelho)",type:"analyst",style:"Comente como PVC em programa analítico. Seja técnico, estruturado e fundamentado em dados históricos. Traga estatísticas, datas e comparações com temporadas passadas. Argumente com lógica clara e sequência racional. O tom deve ser seguro, didático e embasado."},
    {id:"a3",name:"Caio Ribeiro",type:"analyst",style:"Comente como Caio Ribeiro em transmissão ao vivo. Analise a parte tática do jogo com clareza didática. Explique movimentações sem bola, posicionamento e leitura de espaço. O tom deve ser calmo, racional e organizado. Transforme o lance em uma aula rápida de futebol."},
    {id:"a4",name:"Casagrande",type:"analyst",style:"Comente como Casagrande em análise pós-jogo. Vá além do lance técnico. Fale sobre mentalidade, pressão psicológica e comportamento dos jogadores. Use tom grave, reflexivo e crítico. Relacione o futebol com aspectos humanos e emocionais."},
    {id:"a5",name:"Mauro Cezar Pereira",type:"analyst",style:"Comente como Mauro Cezar Pereira em debate esportivo. Seja firme e crítico, combatendo exageros e narrativas emocionais. Questione argumentos frágeis e exija coerência. Use lógica e análise racional. O tom deve ser direto, incisivo e pouco tolerante com achismos."}
  ];
  const defaultJournalists=[
    {id:"j1",name:"Eric Faria",style:"Entreviste como Eric Faria após um jogo decisivo. Seja direto, objetivo e provoque o jogador com perguntas que exigem posicionamento. Use frases como 'Você sabia que ia ser assim?' e 'O que passou na sua cabeça naquele momento?'. Tom firme mas respeitoso, buscando a manchete."},
    {id:"j2",name:"Mauro Naves",style:"Entreviste como Mauro Naves no pós-jogo. Seja elegante, com perguntas elaboradas e contextualizadas. Mencione dados do jogo (gols, posse) e peça reflexão do jogador. Use tom pausado, cordial e profissional. Valorize o momento emocional do atleta."}
  ];
  const initState={...DEFAULT_STATE,commentators:[...defaultNarrators,...defaultAnalysts],journalists:[...defaultJournalists]};
  const[role,sRole]=useState(null);
  const[light,sLight]=useState(()=>{try{return localStorage.getItem("futsabao_theme")!=="dark";}catch(e){return true;}});
  const[loggedPlayer,sLoggedPlayer]=useState(null);
  const[loading,sLoading]=useState(true);
  const[saveError,sSetSaveError]=useState(null);
  K=light?LIGHT:DARK;
  const[S,sS]=useState(initState);
  const saveTimer=useRef(null);
  const isExternalUpdate=useRef(false);

  // Load from Supabase on mount
  useEffect(()=>{
    cloudLoad(initState).then(loaded=>{sS(loaded);sLoading(false);});
  },[]);

  // Debounced cloud save on every state change
  useEffect(()=>{
    if(loading)return;
    if(isExternalUpdate.current){isExternalUpdate.current=false;return;}
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      cloudSave(S).then(result=>{
        if(result&&!result.ok&&result.error)sSetSaveError(result.error);
        else sSetSaveError(null);
      });
      const bc=getBroadcastChannel();
      if(bc)bc.postMessage({type:"state_update",state:S,ts:Date.now()});
    },400);
  },[S,loading]);

  // Supabase Realtime — listen for changes from other devices
  useEffect(()=>{
    if(!supabase)return;
    const channel=supabase.channel("app_state_changes")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"app_state",filter:"id=eq.main"},(payload)=>{
        if(payload.new?.state){
          isExternalUpdate.current=true;
          sS(prev=>({...prev,...payload.new.state,screen:prev.screen,currentMatch:prev.currentMatch}));
        }
      })
      .subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[]);

  // BroadcastChannel for same-browser tab sync (goal notifs)
  useEffect(()=>{
    const bc=getBroadcastChannel();
    if(!bc)return;
    const handler=(e)=>{
      if(e.data?.type==="state_update"&&e.data.state){
        isExternalUpdate.current=true;
        sS(prev=>({...prev,...e.data.state,screen:prev.screen,currentMatch:prev.currentMatch}));
      }
    };
    bc.addEventListener("message",handler);
    return()=>bc.removeEventListener("message",handler);
  },[]);

  // Save theme pref
  useEffect(()=>{try{localStorage.setItem("futsabao_theme",light?"light":"dark");}catch(e){}},[light]);

  // Sync meta theme-color with current theme (browser bar / PWA)
  useEffect(()=>{
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute("content",light?"#F5F1EA":"#070B18");
  },[light]);

  // Auto-clear save error toast after 5s
  useEffect(()=>{if(!saveError)return;const t=setTimeout(()=>sSetSaveError(null),5000);return()=>clearTimeout(t);},[saveError]);

  const SCREEN_NAMES={home:"Início",feed:"Hoje no Futsabão",players:"Jogadores",register:"Cadastro",teams:"Times",tournament:"Campeonato",match:"Partida Ao Vivo",standings:"Classificação",scorers:"Artilheiros",assists:"Assistências",commentators:"Transmissão",journalists:"Jornalistas",sumula:"Súmula",sponsors:"Patrocinadores",matchview:"Partida",gallery:"Galeria",bolao:"Bolão",dashboard:"Dashboard",tvmode:"Modo TV",playerstats:"Ficha do Jogador",moderation:"Moderação",recados:"Recados"};
  const go=useCallback((s,x={})=>{
    sS(p=>({...p,screen:s,...x}));
    try{const title=SCREEN_NAMES[s]||s;window.history.pushState({screen:s},"",`#${s}`);document.title=`Futsabão — ${title}`;}catch(e){}
  },[]);

  // Browser back button support
  useEffect(()=>{
    const onPop=(e)=>{
      const screen=e.state?.screen||"home";
      sS(p=>({...p,screen,currentMatch:null}));
    };
    window.addEventListener("popstate",onPop);
    return()=>window.removeEventListener("popstate",onPop);
  },[]);
  const up=useCallback(u=>sS(p=>({...p,...u})),[]);
  const toggleTheme=()=>sLight(l=>!l);

  // Export/Import backup
  const exportData=()=>{const d=JSON.stringify(S,null,2);const b=new Blob([d],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`futsabao-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(u);};
  const importData=(e)=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>{try{const d=JSON.parse(ev.target.result);sS(p=>({...p,...d,screen:"home",currentMatch:null}));}catch(err){alert("Arquivo inválido");}};r.readAsText(f);};

  const props={S,go,up,REFEREE,STADIUM,BROADCASTERS,role,light,toggleTheme,loggedPlayer,sLoggedPlayer,exportData,importData};
  // Loading screen while fetching from cloud
  if(loading)return <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:K.bg,fontFamily:ff,color:K.tx}}>
    <img src={LOGO} alt="" style={{maxWidth:180,width:"100%",marginBottom:20,opacity:0.8}}/>
    <div style={{fontFamily:fC,fontSize:14,fontWeight:700,color:K.gold,letterSpacing:"0.1em",animation:"tvpulse 1.5s ease-in-out infinite"}}>CARREGANDO...</div>
    <div style={{fontSize:11,color:K.txD,marginTop:8}}>Sincronizando com a nuvem ☁️</div>
  </div>;

  if(!role)return <div style={{minHeight:"100vh",fontFamily:ff,color:K.tx,position:"relative"}}><GeoBg light={light}/><div style={{position:"relative",zIndex:1,maxWidth:920,margin:"0 auto",padding:"0 16px"}}>{!supabase&&<div role="status" style={{padding:"10px 14px",marginTop:12,marginBottom:8,borderRadius:10,border:`1px solid ${K.gDm}40`,background:K.gDm+"0D",fontSize:12,color:K.gDm,fontFamily:ff}}>⚠️ Dados só neste dispositivo. Configure Supabase para salvar na nuvem.</div>}<LoginScreen onRole={sRole} light={light} toggleTheme={toggleTheme} S={S} sLoggedPlayer={sLoggedPlayer}/></div></div>;
  const athleteScreens={home:()=><AthleteDashboard {...props}/>,feed:()=><AthleteFeed {...props}/>,register:()=><Register {...props}/>,matchview:MatchView,gallery:Gallery,bolao:Bolao,assists:Assists,playerstats:()=><PlayerStats {...props} playerId={S.viewPlayerId}/>};
  const adminScreens={home:Home,players:Players,register:Register,teams:Teams,tournament:Tournament,match:Match,standings:Standings,scorers:Scorers,assists:Assists,commentators:Commentators,sumula:Sumula,dashboard:()=><AthleteDashboard {...props}/>,sponsors:Sponsors,matchview:MatchView,gallery:Gallery,tvmode:TVMode,playerstats:()=><PlayerStats {...props} playerId={S.viewPlayerId}/>,moderation:Moderation,recados:Recados};
  const SC=role==="admin"?adminScreens:athleteScreens;
  const C=SC[S.screen]||(role==="admin"?Home:()=><AthleteDashboard {...props}/>);
  const isAthleteFeed=role==="athlete"&&S.screen==="feed";
  return <div style={{minHeight:"100vh",fontFamily:ff,color:K.tx,position:"relative"}}><GeoBg light={light}/><div style={{position:"relative",zIndex:1,maxWidth:920,margin:"0 auto",padding:"0 16px"}}>
    {/* Role bar */}
    <header role="banner" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0"}}>
      <button onClick={()=>{sRole(null);go("home");}} aria-label="Sair e voltar ao login" style={{background:"none",border:"none",color:K.gDm,cursor:"pointer",fontSize:10,fontFamily:fC,fontWeight:700,letterSpacing:"0.08em"}}>← SAIR</button>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <button onClick={toggleTheme} style={{background:"none",border:`1px solid ${K.bd}`,borderRadius:6,cursor:"pointer",padding:"3px 8px",fontSize:12,color:K.txD}} title={light?"Modo escuro":"Modo claro"} aria-label={light?"Ativar modo escuro":"Ativar modo claro"}>{light?"🌙":"☀️"}</button>
        <span style={{fontSize:10,fontFamily:fC,fontWeight:700,letterSpacing:"0.08em",color:role==="admin"?K.accL:K.grn,background:role==="admin"?K.acc+"10":K.grn+"10",padding:"3px 10px",borderRadius:6}}>{role==="admin"?"🔒 ORGANIZADOR":"⚽ ATLETA"}</span>
      </div>
      {role==="admin"?<button onClick={()=>go("dashboard")} style={{background:"none",border:"none",color:K.blu,cursor:"pointer",fontSize:10,fontFamily:fC,fontWeight:700}}>📊 DASHBOARD</button>:isAthleteFeed?<button onClick={()=>go("home")} style={{background:"none",border:"none",color:K.grn,cursor:"pointer",fontSize:10,fontFamily:fC,fontWeight:700}}>← INÍCIO</button>:<div/>}
    </header>
    {!supabase&&<div role="status" style={{padding:"10px 14px",marginBottom:8,borderRadius:10,border:`1px solid ${K.gDm}40`,background:K.gDm+"0D",fontSize:12,color:K.gDm,fontFamily:ff}}>⚠️ Dados só neste dispositivo. Configure Supabase para salvar na nuvem.</div>}
    <main role="main"><C {...props}/></main>
    {saveError&&<div role="alert" style={{position:"fixed",bottom:16,left:16,right:16,maxWidth:400,margin:"0 auto",padding:"12px 16px",borderRadius:10,border:`1px solid ${K.red}50`,background:K.red+"15",color:K.red,fontSize:12,fontFamily:ff,zIndex:3000,boxShadow:"0 4px 20px rgba(0,0,0,0.2)"}}>Falha ao salvar: {saveError}</div>}
  </div></div>;
}

/* ══════════ LOGIN SCREEN ══════════ */
function LoginScreen({onRole,light,toggleTheme,S,sLoggedPlayer}){
  const[showPw,sShowPw]=useState(false);const[showAthleteLogin,sShowAthleteLogin]=useState(false);
  const[pw,sPw]=useState("");const[err,sErr]=useState(false);
  const[pin,sPin]=useState("");const[pinErr,sPinErr]=useState("");const[selPlayer,sSelPlayer]=useState("");
  const tryAdmin=()=>{if(pw==="9512"){onRole("admin");}else{sErr(true);setTimeout(()=>sErr(false),2000);}};
  const tryAthleteLogin=()=>{
    const p=S.players.find(x=>x.id===selPlayer);
    if(!p){sPinErr("Selecione um atleta");return;}
    if(!p.pin){sPinErr("Atleta sem PIN. Peça ao organizador.");return;}
    if(p.pin===pin){sLoggedPlayer({id:p.id,name:p.nickname||p.name});onRole("athlete");}
    else{sPinErr("PIN incorreto");setTimeout(()=>sPinErr(""),2000);}
  };
  return <div style={{paddingTop:60,paddingBottom:40,textAlign:"center"}}>
    <button onClick={toggleTheme} style={{position:"absolute",top:16,right:16,background:"none",border:`1px solid ${K.bd}`,borderRadius:8,cursor:"pointer",padding:"5px 10px",fontSize:14,color:K.txD}} title={light?"Modo escuro":"Modo claro"}>{light?"🌙":"☀️"}</button>
    <div style={{marginBottom:36,animation:"gw 4s ease-in-out infinite"}}>
      <img src={LOGO} alt="Campeonato Brasileiro de Futsabão" style={{maxWidth:280,width:"100%",height:"auto",display:"block",margin:"0 auto",filter:"drop-shadow(0 8px 30px rgba(196,165,97,0.15))"}}/>
    </div>
    <div style={{display:"inline-block",padding:"6px 24px",borderRadius:24,background:`linear-gradient(90deg,transparent,${K.gold}0D,transparent)`,border:`1px solid ${K.gold}15`,marginBottom:40}}>
      <span style={{fontFamily:fC,fontSize:11,fontWeight:700,color:K.gDm,letterSpacing:"0.18em"}}>CAMPEONATO BRASILEIRO DE FUTSABÃO</span>
    </div>
    {!showPw&&!showAthleteLogin?<div style={{display:"grid",gap:14,maxWidth:340,margin:"0 auto"}}>
      <G hover style={{cursor:"pointer",padding:"22px 24px"}} onClick={()=>onRole("athlete")}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:52,height:52,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",background:K.grn+"0D",fontSize:24,border:`1px solid ${K.grn}15`}}>⚽</div>
          <div style={{textAlign:"left"}}><div style={{fontFamily:fH,fontWeight:700,fontSize:18,color:K.grn}} aria-label="Entrar como atleta">SOU ATLETA</div><div style={{fontSize:12,color:K.txD,marginTop:2}}>Cadastro e acompanhar o torneio</div></div>
          <div style={{marginLeft:"auto",color:K.grn,fontSize:20}}>›</div>
        </div>
      </G>
      {S.players.length>0&&<G hover style={{cursor:"pointer",padding:"22px 24px"}} onClick={()=>sShowAthleteLogin(true)}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:52,height:52,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",background:"#8B5CF60D",fontSize:24,border:"1px solid #8B5CF615"}}>🏅</div>
          <div style={{textAlign:"left"}}><div style={{fontFamily:fH,fontWeight:700,fontSize:18,color:"#8B5CF6"}}>ÁREA DO ATLETA</div><div style={{fontSize:12,color:K.txD,marginTop:2}}>Votar MVP, bolão, chat e fotos</div></div>
          <div style={{marginLeft:"auto",color:"#8B5CF6",fontSize:20}}>›</div>
        </div>
      </G>}
      <G hover style={{cursor:"pointer",padding:"22px 24px"}} onClick={()=>sShowPw(true)}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:52,height:52,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",background:K.acc+"0D",fontSize:24,border:`1px solid ${K.acc}15`}}>🔒</div>
          <div style={{textAlign:"left"}}><div style={{fontFamily:fH,fontWeight:700,fontSize:18,color:K.accL}}>SOU ORGANIZADOR</div><div style={{fontSize:12,color:K.txD,marginTop:2}}>Acesso completo ao sistema</div></div>
          <div style={{marginLeft:"auto",color:K.accL,fontSize:20}}>›</div>
        </div>
      </G>
    </div>:showAthleteLogin?<div style={{maxWidth:340,margin:"0 auto"}}>
      <G style={{padding:24}}>
        <div style={{fontSize:22,marginBottom:16}}>🏅</div>
        <div style={{fontFamily:fH,fontSize:16,fontWeight:700,color:"#8B5CF6",marginBottom:4}}>ÁREA DO ATLETA</div>
        <p style={{fontSize:12,color:K.txD,marginBottom:16}}>Selecione seu nome e digite seu PIN</p>
        <SL value={selPlayer} onChange={e=>sSelPlayer(e.target.value)} style={{marginBottom:12}}>
          <option value="">Selecione seu nome...</option>
          {S.players.filter(p=>p.pin).map(p=><option key={p.id} value={p.id}>{p.nickname||p.name} {p.number?`(${p.number})`:""}</option>)}
        </SL>
        <IN type="password" value={pin} onChange={e=>{sPin(e.target.value);sPinErr("");}} placeholder="PIN (4 dígitos)" maxLength={4} onKeyDown={e=>e.key==="Enter"&&tryAthleteLogin()} style={{textAlign:"center",fontSize:24,letterSpacing:"0.4em",marginBottom:14}}/>
        {pinErr&&<p style={{fontSize:12,color:K.red,marginBottom:10}}>{pinErr}</p>}
        <div style={{display:"flex",gap:8}}><BT onClick={()=>{sShowAthleteLogin(false);sPin("");sSelPlayer("");}} v="gh" style={{flex:1}}>VOLTAR</BT><BT onClick={tryAthleteLogin} style={{flex:1,background:"linear-gradient(135deg,#8B5CF6,#6D28D9)",color:"#fff"}}>ENTRAR</BT></div>
      </G>
    </div>:<div style={{maxWidth:340,margin:"0 auto"}}>
      <G style={{padding:24}}>
        <div style={{fontSize:22,marginBottom:16}}>🔒</div>
        <div style={{fontFamily:fH,fontSize:16,fontWeight:700,color:K.accL,marginBottom:4}}>ACESSO ORGANIZADOR</div>
        <p style={{fontSize:12,color:K.txD,marginBottom:16}}>Digite a senha de acesso</p>
        <IN type="password" value={pw} onChange={e=>{sPw(e.target.value);sErr(false);}} placeholder="Senha" onKeyDown={e=>e.key==="Enter"&&tryAdmin()} style={{textAlign:"center",fontSize:18,letterSpacing:"0.2em",marginBottom:14,borderColor:err?"#E74C3C50":K.bd}}/>
        {err&&<p style={{fontSize:12,color:K.red,marginBottom:10}}>Senha incorreta</p>}
        <div style={{display:"flex",gap:8}}><BT onClick={()=>{sShowPw(false);sPw("");}} v="gh" style={{flex:1}}>VOLTAR</BT><BT onClick={tryAdmin} v="acc" style={{flex:1}}>ENTRAR</BT></div>
      </G>
    </div>}
  </div>;
}

/* ══════════ ATHLETE DASHBOARD (TOURNAMENT HOME) ══════════ */
function AthleteDashboard({S,go,up,REFEREE,STADIUM,BROADCASTERS,role,loggedPlayer}){
  const hasTournament=(S.matches||[]).length>0;
  const[justRegistered,sJustRegistered]=useState(()=>{try{const v=sessionStorage.getItem("futsabao_just_registered");if(v){sessionStorage.removeItem("futsabao_just_registered");return true;}return false;}catch(e){return false;}});
  const[goalNotif,sGoalNotif]=useState(null);
  const dailyHeadlineGeneratingRef=useRef(false);
  const cartolaGeneratingRef=useRef(false);
  const torcedorGeneratingRef=useRef(false);
  const[loadingFlashId,sLoadingFlashId]=useState(null);
  const[loadingMvpId,sLoadingMvpId]=useState(null);
  const[loadingHypeId,sLoadingHypeId]=useState(null);
  const[generatingDailyHeadline,sGeneratingDailyHeadline]=useState(false);
  const[generatingCartola,sGeneratingCartola]=useState(false);
  const[generatingTorcedor,sGeneratingTorcedor]=useState(false);
  const[collapseClassificacao,sCollapseClassificacao]=useState(false);
  const[collapseProximas,sCollapseProximas]=useState(false);
  const[collapseResultados,sCollapseResultados]=useState(false);
  const[feedScheduleTick,sFeedScheduleTick]=useState(0);
  const today=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;})();
  useEffect(()=>{
    if(!S.geminiKey||dailyHeadlineGeneratingRef.current)return;
    if(S.dailyHeadline&&S.dailyHeadline.date===today)return;
    dailyHeadlineGeneratingRef.current=true;
    sGeneratingDailyHeadline(true);
    const pl=S.players||[];
    const playerNames=pl.map(p=>p.nickname||p.name).filter(Boolean).slice(0,8).join(", ")||"atletas";
    const sponsorNames=(S.sponsors||[]).slice(0,5).map(s=>s.name).filter(Boolean).join(", ")||"patrocinadores";
    const commentatorsList=(S.commentators||[]).map(c=>`${c.name} (${c.type==="narrator"?"narrador":"comentarista"})`).slice(0,10).join("; ")||"Galvão Bueno (narrador), Neto (comentarista)";
    const todayFormatted=new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"});
    const tournamentDateStr=S.tournamentStartAt?new Date(S.tournamentStartAt).toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"}):"07 de março de 2026";
    const prompt=`Você é um editor SENSACIONALISTA e ZUEIRO de portal esportivo de fofoca. Gere a manchete do dia para o Futsabão (campeonato de futebol de sabão).
Contexto: Hoje é ${todayFormatted}. O torneio será em ${tournamentDateStr}.
Jogadores: ${playerNames}. Estádio: ${STADIUM.name} (${STADIUM.location}). Árbitro: ${REFEREE.name}${sponsorNames!=="patrocinadores"?`. Patrocinadores: ${sponsorNames}`:""}.
Comentaristas da transmissão: ${commentatorsList}.

ESTILO OBRIGATÓRIO:
- Pode e DEVE inventar fake news absurdas e engraçadas envolvendo os jogadores pelo nome (ex: "Fulano flagrado treinando com sabão importado da Suíça").
- Pode causar tumulto, criar rivalidades fictícias, inventar bastidores ("Fonte revela que...").
- Sensacionalismo total, estilo mesa redonda com gritaria, manchete clickbait.
- A disputa entre comentaristas deve ser ACALORADA: provocações, ironias pesadas, um zoando o outro.
- Tudo no espírito de zoeira entre amigos. Vale tudo na zueira (sem preconceito/discriminação).

Responda em EXATAMENTE 3 linhas, sem título extra:
Linha 1: MANCHETE curta, sensacionalista e impactante (máx 80 caracteres).
Linha 2: CORPO em 1 a 3 frases com detalhes inventados e zueiros (máx 200 caracteres).
Linha 3: DISPUTA: dois comentaristas discordam com provocação pesada. Use dois nomes reais da lista. Formato: "[Nome 1] dispara que... [Nome 2] rebate: ..." (máx 150 caracteres).`;
    callGemini(prompt,S.geminiKey).then(raw=>{
      let headline="Manchete do dia",body="",dispute="";
      if(raw){
        const lines=raw.split("\n").map(s=>s.trim()).filter(Boolean);
        if(lines.length>=1)headline=lines[0].replace(/^["']|["']$/g,"").slice(0,100);
        if(lines.length>=2)body=lines[1].replace(/^["']|["']$/g,"").slice(0,300);
        if(lines.length>=3)dispute=lines[2].replace(/^["']|["']$/g,"").slice(0,180);
      }
      up({dailyHeadline:{date:today,headline,body,dispute}});
    }).finally(()=>{dailyHeadlineGeneratingRef.current=false;sGeneratingDailyHeadline(false);});
  },[S.geminiKey,S.dailyHeadline,S.players,S.sponsors,S.commentators,S.tournamentStartAt,today]);
  useEffect(()=>{
    if(!S.geminiKey||cartolaGeneratingRef.current)return;
    if(S.cartolaMessage&&S.cartolaMessage.date===today)return;
    cartolaGeneratingRef.current=true;
    sGeneratingCartola(true);
    const todayFormatted=new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"});
    const tournamentDateStr=S.tournamentStartAt?new Date(S.tournamentStartAt).toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"}):"07 de março de 2026";
    const playerNames=(S.players||[]).map(p=>p.nickname||p.name).filter(Boolean).slice(0,5).join(", ")||"atletas";
    const prompt=`Você é um CARTOLA (dirigente de futebol) COMPLETAMENTE CARICATO, LOUCO e FOLCLÓRICO — estilo Eurico Miranda no auge. Está dando recado aos jogadores/atletas do Futsabão (campeonato de futebol de sabão). Hoje é ${todayFormatted}. O torneio será em ${tournamentDateStr}. Jogadores: ${playerNames}.

ESTILO OBRIGATÓRIO:
- Pode ameaçar multa, suspensão, demissão absurda ("Quem não treinar vai jogar de goleiro de costas").
- Pode fazer promessas ABSURDAS ("Vou trazer o Messi pra jogar no sabão", "Contratei um olheiro da FIFA").
- Pode dar bronca pesada citando jogadores pelo nome ("Cadê o ${playerNames.split(",")[0]||"fulano"}? Tá devendo!").
- Pode causar polêmica com árbitro, adversários, patrocinadores.
- Tom: autoritário, megalomaníaco, exagerado, com pitadas de loucura total.
- Pode inventar fake news sobre si mesmo ("A CBF me ligou pedindo conselho").
- Tudo no espírito de zueira entre amigos. Vale tudo na zoação.

Gere UMA única frase ou duas curtas (máx 150 caracteres), em primeira pessoa. Responda APENAS o texto da fala, sem aspas nem título.`;
    callGemini(prompt,S.geminiKey).then(raw=>{
      const text=(raw||"").replace(/^["']|["']$/g,"").trim().slice(0,180)||"A diretoria está de olho. Disciplina e respeito ao mando.";
      up({cartolaMessage:{date:today,text}});
    }).finally(()=>{cartolaGeneratingRef.current=false;sGeneratingCartola(false);});
  },[S.geminiKey,S.cartolaMessage,S.players,S.tournamentStartAt,today]);
  useEffect(()=>{
    if(!S.geminiKey||torcedorGeneratingRef.current)return;
    if(S.torcedorMessage&&S.torcedorMessage.date===today)return;
    torcedorGeneratingRef.current=true;
    sGeneratingTorcedor(true);
    const playerNames=(S.players||[]).map(p=>p.nickname||p.name).filter(Boolean).slice(0,5).join(", ")||"a galera";
    const prompt=`Você é o TORCEDOR MAIS CORNETEIRO do Futsabão (campeonato de futebol de sabão). Zueira PESADA de arquibancada, provocação de buteco, zoação de grupo de WhatsApp.

Jogadores para cornetar: ${playerNames}.

ESTILO OBRIGATÓRIO:
- Corneta PESADA citando jogadores pelo nome/apelido ("${playerNames.split(",")[0]||"Fulano"}, vc joga mais no FIFA do que no sabão!").
- Pode criar apelidos zueiros, inventar histórias engraçadas ("Vi o ${playerNames.split(",")[0]||"cara"} treinando com chinelo de dedo").
- Pode fazer fake news sobre os jogadores ("Fulano visto dormindo no vestiário antes do treino").
- Pode provocar times, questionar o árbitro, zoar o cartola.
- Tom: corneta de arquibancada sem dó, provocação de pelada, zoeira máxima.
- Tudo no espírito de zueira entre amigos. Vale tudo na zoação (sem preconceito/discriminação).

Gere UMA frase curta (máx 150 caracteres), em primeira pessoa. Responda APENAS o texto da corneta, sem aspas nem título.`;
    callGemini(prompt,S.geminiKey).then(raw=>{
      const text=(raw||"").replace(/^["']|["']$/g,"").trim().slice(0,180)||"A torcida tá de olho. No jogo a gente vê quem é quem.";
      up({torcedorMessage:{date:today,text}});
    }).finally(()=>{torcedorGeneratingRef.current=false;sGeneratingTorcedor(false);});
  },[S.geminiKey,S.torcedorMessage,S.players,today]);
  const feedGeneratingRef=useRef(false);
  useEffect(()=>{
    if(!S.geminiKey||hasTournament||feedGeneratingRef.current)return;
    const feed=S.preTorneioFeed||[];
    const feedToday=feed.filter(p=>p.createdAt&&p.createdAt.startsWith(today));
    if(feedToday.length>=12)return;
    const TWO_H=2*60*60*1000;
    const startOfToday=new Date(today.replace(/-/g,"/")).getTime();
    const lastAt=S.lastFeedGenerationAt;
    const base=lastAt&&lastAt>=startOfToday?lastAt:startOfToday;
    const now=Date.now();
    const slotsPassed=Math.floor((now-base)/TWO_H);
    let slotsToDo=Math.min(slotsPassed,12-feedToday.length,5);
    if(slotsToDo<=0)return;
    feedGeneratingRef.current=true;
    const pl=S.players||[];
    const playerNames=pl.map(p=>p.nickname||p.name).filter(Boolean).slice(0,8).join(", ")||"atletas";
    const todayFormatted=new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"});
    const tournamentDateStr=S.tournamentStartAt?new Date(S.tournamentStartAt).toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"}):"07 de março de 2026";
    const commentatorsList=(S.commentators||[]).map(c=>c.name).slice(0,5).join(", ")||"Galvão Bueno, Neto";
    const commentatorsForFeed=(S.commentators||[]).filter(c=>c.type==="analyst");
    const journalistsForFeed=S.journalists||[];
    const buildPrompt=(author,commentatorPick=null,journalistPick=null)=>{
      if(author.authorType==="reporter"){
        if(journalistPick){
          return `Você é EXATAMENTE o repórter ${journalistPick.name} (TV/rádio), com este estilo: ${journalistPick.style}.
Você está AO VIVO no pré-torneio de FUTEBOL DE SABÃO (futsabão). Hoje é ${todayFormatted}. O torneio acontece em ${tournamentDateStr}, no estádio ${STADIUM.name}. Árbitro: ${REFEREE.name}. Presidente: Rafão. Jogadores em destaque: ${playerNames}.
Faça UMA fala curta em primeira pessoa, como reportagem de bastidor: descreva o clima, cite PELO MENOS um atleta pelo nome ou apelido, e encerre com uma PERGUNTA forte ou provocativa para o atleta ou torcedor.
NÃO use frases genéricas como "o pré-torneio segue a todo vapor" ou "está tudo muito animado". Não explique que é uma IA. Responda apenas a fala do repórter, sem manchete, sem título e sem aspas.`;
        }
        return `Você é um REPÓRTER de portal esportivo. Está postando uma NOTÍCIA CURTA do pré-torneio Futsabão (futebol de sabão). Hoje é ${todayFormatted}. Torneio em ${tournamentDateStr}. Jogadores: ${playerNames}. Árbitro: ${REFEREE.name}. Estádio: ${STADIUM.name}.
CITE pelo menos um atleta pelo nome e, se fizer sentido, mencione o árbitro ${REFEREE.name} ou o presidente Rafão. Traga bastidor e termine com uma pergunta. NÃO use frases genéricas como "o pré-torneio segue a todo vapor".
Uma ou duas frases curtas (máx 180 caracteres). Responda APENAS o texto da fala do repórter, sem aspas nem título.`;
      }
      if(author.authorType==="comentarista"&&commentatorPick){
        const styleHint=commentatorPick.style?` CARACTERÍSTICA E ESTILO DESTE COMENTARISTA (OBRIGATÓRIO seguir): ${commentatorPick.style}.`:"";
        return `Você é EXATAMENTE o comentarista ${commentatorPick.name} em uma transmissão esportiva, com este estilo: ${commentatorPick.style}.
Você está comentando o PRÉ-JOGO do Futsabão (futebol de sabão). Hoje é ${todayFormatted}. Jogadores: ${playerNames}. Árbitro: ${REFEREE.name}. Outros na transmissão: ${commentatorsList}.${styleHint}
A fala deve ser CARICATA e no seu JEITO ÚNICO: opinião forte, corneta, humor ou análise marcante. CITE pelo menos um atleta pelo nome ou apelido e, se fizer sentido, o árbitro ${REFEREE.name} ou o presidente Rafão. Termine com uma PERGUNTA ou PROVOCAÇÃO, como nos debates esportivos.
NÃO use frases genéricas como "o pré-torneio segue a todo vapor" ou "vamos ver o que acontece". Responda APENAS a fala do comentarista (uma ou duas frases curtas, máx 200 caracteres), sem explicações extras, sem título e sem aspas.`;
      }
      if(author.authorType==="comentarista")return `Você é um COMENTARISTA de transmissão. Está postando uma fala de PRÉ-JOGO sobre o Futsabão (futebol de sabão). Hoje é ${todayFormatted}. Jogadores: ${playerNames}. Árbitro: ${REFEREE.name}. Outros comentaristas: ${commentatorsList}.
CITE jogadores pelo nome. Tom CARICATO e com opinião forte — nada genérico. Pode mencionar o árbitro, clima de transmissão, expectativa. Termine com uma pequena provocação ou pergunta.
NÃO repita frases prontas como "o pré-torneio segue a todo vapor". Uma ou duas frases curtas (máx 180 caracteres). Responda APENAS o texto da fala, sem aspas nem título.`;
      if(author.authorType==="cartola")return `Você é um CARTOLA (dirigente) CARICATO. Postando recado no pré-torneio Futsabão (futebol de sabão). Hoje é ${todayFormatted}. Jogadores: ${playerNames}. Árbitro: ${REFEREE.name}.
CITE jogadores pelo nome. Pode falar do árbitro, do presidente, dar bronca, promessas absurdas. Tom: autoritário e zueiro. Evite frases genéricas.
Uma ou duas frases curtas (máx 180 caracteres), primeira pessoa. Responda APENAS o texto, sem aspas nem título.`;
      if(author.authorType==="torcedor")return `Você é o TORCEDOR CORNETEIRO do Futsabão (futebol de sabão). Postando corneta de pré-torneio. Jogadores: ${playerNames}. Árbitro: ${REFEREE.name}.
CITE jogadores pelo nome. Pode zoar o árbitro, o presidente, provocar. Tom: arquibancada, zoeira. Evite mensagens vazias; traga uma crítica ou piada específica.
Uma ou duas frases curtas (máx 180 caracteres). Responda APENAS o texto, sem aspas nem título.`;
      if(author.authorType==="presidente")return `Você é o PRESIDENTE (Rafão) do Futsabão. Postando declaração curta no pré-torneio. Jogadores: ${playerNames}. Árbitro: ${REFEREE.name}.
CITE atletas pelo nome. Pode falar do árbitro, dar declaração, crítica leve. Tom: presidente de federação, primeira pessoa. Evite frases genéricas.
Uma ou duas frases curtas (máx 180 caracteres). Responda APENAS o texto, sem aspas nem título.`;
      return `Você é o ÁRBITRO (Rodolfo Seifert) do Futsabão. Postando declaração curta no pré-torneio. Jogadores: ${playerNames}. Presidente Rafão também está na organização.
CITE atletas pelo nome se fizer sentido. Pode falar do presidente, avisar que vai apitar firme, clima de pré-torneio. Tom: árbitro, primeira pessoa. Evite frases neutras; traga uma posição clara.
Uma ou duas frases curtas (máx 180 caracteres). Responda APENAS o texto, sem aspas nem título.`;
    };
    (async()=>{
      const newPosts=[];
      let accTime=base;
      for(let i=0;i<slotsToDo;i++){
        const author=FEED_AUTHORS[Math.floor(Math.random()*FEED_AUTHORS.length)];
        let authorLabel=author.authorLabel;
        let commentatorPick=null;
        let journalistPick=null;
        if(author.authorType==="comentarista"&&commentatorsForFeed.length>0){
          commentatorPick=commentatorsForFeed[Math.floor(Math.random()*commentatorsForFeed.length)];
          authorLabel=commentatorPick.name;
        }
        if(author.authorType==="reporter"&&journalistsForFeed.length>0){
          journalistPick=journalistsForFeed[Math.floor(Math.random()*journalistsForFeed.length)];
          authorLabel=journalistPick.name;
        }
        const prompt=buildPrompt(author,commentatorPick,journalistPick);
        const raw=await callGemini(prompt,S.geminiKey);
        const text=(raw||"").replace(/^["']|["']$/g,"").trim().slice(0,200);
        accTime+=TWO_H;
        if(text)newPosts.push({id:uid(),authorType:author.authorType,authorLabel,text,createdAt:new Date(accTime).toISOString()});
      }
      up({preTorneioFeed:[...(S.preTorneioFeed||[]),...newPosts],lastFeedGenerationAt:accTime});
    })().finally(()=>{feedGeneratingRef.current=false;});
  },[S.geminiKey,S.preTorneioFeed,S.lastFeedGenerationAt,today,hasTournament,S.players,S.commentators,S.tournamentStartAt,feedScheduleTick]);
  useEffect(()=>{
    if(hasTournament)return;
    const t=setInterval(()=>sFeedScheduleTick(Date.now()),2*60*60*1000);
    return()=>clearInterval(t);
  },[hasTournament]);
  useEffect(()=>{const bc=getBroadcastChannel();if(!bc)return;const h=(e)=>{if(e.data?.type==="goal"){sGoalNotif({player:e.data.player,team:e.data.team});try{navigator.vibrate?.([200,100,200]);}catch(e){}setTimeout(()=>sGoalNotif(null),4000);}};bc.addEventListener("message",h);return()=>bc.removeEventListener("message",h);},[]);
  const{teams:tm,matches:mt,players:pl}=S;
  const gt=id=>tm.find(t=>t.id===id);
  const played=mt.filter(m=>m.played);const upcoming=mt.filter(m=>!m.played);
  // Standings calc
  const h2h=(t1,t2)=>{const m=mt.filter(m=>m.played&&((m.homeTeamId===t1&&m.awayTeamId===t2)||(m.homeTeamId===t2&&m.awayTeamId===t1)));let p1=0,p2=0;m.forEach(x=>{const s1=x.homeTeamId===t1?x.homeScore:x.awayScore;const s2=x.homeTeamId===t1?x.awayScore:x.homeScore;if(s1>s2)p1+=3;else if(s1===s2){p1++;p2++;}else p2+=3;});return p1-p2;};
  const st=tm.map(team=>{const ms=mt.filter(m=>m.played&&(m.homeTeamId===team.id||m.awayTeamId===team.id));let w=0,d=0,l=0,gf=0,ga=0;ms.forEach(m=>{const isH=m.homeTeamId===team.id;const s=isH?m.homeScore:m.awayScore;const c=isH?m.awayScore:m.homeScore;gf+=s;ga+=c;if(s>c)w++;else if(s===c)d++;else l++;});return{team,p:ms.length,w,d,l,gf,ga,gd:gf-ga,pts:w*3+d};}).sort((a,b)=>{if(b.pts!==a.pts)return b.pts-a.pts;if(b.w!==a.w)return b.w-a.w;if(b.gd!==a.gd)return b.gd-a.gd;if(b.gf!==a.gf)return b.gf-a.gf;return h2h(b.team.id,a.team.id);});
  // Scorers
  const allG=played.flatMap(m=>m.goals||[]).filter(g=>!g.ownGoal);const sMap={};allG.forEach(g=>{if(!sMap[g.playerId])sMap[g.playerId]={goals:0,teamId:g.teamId};sMap[g.playerId].goals++;});
  const sc=Object.entries(sMap).map(([pid,d])=>({player:pl.find(p=>p.id===pid),team:tm.find(t=>t.id===d.teamId),goals:d.goals})).filter(s=>s.player&&s.team).sort((a,b)=>b.goals-a.goals).slice(0,5);
  // Last results
  const lastResults=played.slice(-6).reverse();
  // Pré-torneio: data alvo e countdown
  const tournamentTargetDate=S.tournamentStartAt?new Date(S.tournamentStartAt):new Date(2026,2,7);
  const nowPre=new Date();
  const daysUntilStart=Math.max(0,Math.ceil((tournamentTargetDate-nowPre)/(24*60*60*1000)));
  const startDateFormatted=tournamentTargetDate.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
  const reminderDateStr=tournamentTargetDate.toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"});
  return <div style={{paddingTop:10,paddingBottom:44}}>
    {/* Hero: logo + estrelas em bloco com fundo sutil */}
    <div style={{textAlign:"center",marginBottom:24,padding:"20px 16px 24px",borderRadius:16,background:`linear-gradient(135deg,${K.gold}08 0%,${K.acc}06 50%,${K.gold}08 100%)`,border:`1px solid ${K.gold}20`}}>
      <div style={{marginBottom:12,animation:"gw 4s ease-in-out infinite"}}><img src={LOGO} alt="" style={{maxWidth:200,width:"100%",height:"auto",display:"block",margin:"0 auto",filter:"drop-shadow(0 8px 30px rgba(196,165,97,0.15))"}}/></div>
      <div style={{display:"inline-block",padding:"6px 24px",borderRadius:20,background:`linear-gradient(90deg,transparent,${K.gold}0D,transparent)`,border:`1px solid ${K.gold}25`}}>
        <span style={{fontFamily:fC,fontSize:10,fontWeight:700,color:K.gDm,letterSpacing:"0.15em"}}>★ ★ ★ ★ ★</span>
      </div>
    </div>
    {/* Welcome banner after registration */}
    {justRegistered&&loggedPlayer&&<G style={{textAlign:"center",padding:"24px 20px",marginBottom:16,border:`1px solid ${K.grn}30`,background:`linear-gradient(135deg,${K.grn}08,${K.grn}15)`}}>
      <div style={{fontSize:48,marginBottom:10}}>✅</div>
      <h3 style={{fontFamily:fH,fontSize:20,color:K.grn,marginBottom:8}}>Cadastro realizado com sucesso!</h3>
      <p style={{color:K.tx,fontSize:14,lineHeight:1.5,marginBottom:12}}>Entre no app todos os dias pois teremos novidades!</p>
      <p style={{fontSize:12,color:K.txD,marginBottom:14}}>Endereço: <a href="https://futsabao.vercel.app/" style={{color:K.gold,fontWeight:600,textDecoration:"underline"}}>futsabao.vercel.app</a></p>
      <BT onClick={()=>sJustRegistered(false)} v="grn" style={{fontSize:12,padding:"8px 24px"}}>ENTENDIDO!</BT>
    </G>}
    {/* Athlete action: register — CTA mais destacado */}
    {role==="athlete"&&!loggedPlayer&&<G hover style={{cursor:"pointer",padding:"16px 20px",marginBottom:16,border:`2px solid ${K.gold}40`,boxShadow:`0 4px 20px ${K.gold}25`}} onClick={()=>go("register")}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:48,height:48,borderRadius:12,background:K.grn+"12",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:`1px solid ${K.grn}25`}}>📝</div>
        <div style={{flex:1}}><div style={{fontFamily:fC,fontWeight:700,fontSize:15,color:K.grn}}>INSCREVER-SE NO TORNEIO</div><div style={{fontSize:12,color:K.txD,marginTop:2}}>Preencha seus dados para participar</div></div>
        <div style={{color:K.grn,fontSize:24}}>›</div>
      </div>
    </G>}
    {/* Logged athlete: mini-header com avatar + badge Conectado */}
    {loggedPlayer&&<div style={{marginBottom:16}}>
      <G style={{padding:"12px 16px",marginBottom:10,border:`1px solid #8B5CF620`,background:`linear-gradient(90deg,${K.sf},${K.sf})`}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:12,background:K.gold+"20",border:`1px solid ${K.gold}30`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:fH,fontSize:16,fontWeight:700,color:K.gold,flexShrink:0}}>
            {loggedPlayer.photo?<img src={loggedPlayer.photo} alt="" style={{width:"100%",height:"100%",borderRadius:12,objectFit:"cover"}}/>:(loggedPlayer.nickname||loggedPlayer.name||"A")[0].toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:fC,fontWeight:700,fontSize:14,color:K.tx}}>{loggedPlayer.nickname||loggedPlayer.name}</div>
            <span style={{display:"inline-block",marginTop:2,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:700,fontFamily:fC,color:K.grn,background:K.grn+"18",border:`1px solid ${K.grn}30`}}>Conectado</span>
          </div>
        </div>
      </G>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        <G hover className="athlete-action-card" style={{cursor:"pointer",padding:"14px 10px",textAlign:"center"}} onClick={()=>go("feed")}>
          <span style={{fontSize:26,display:"block"}}>📰</span><div style={{fontFamily:fC,fontWeight:700,fontSize:11,color:K.gold,marginTop:6}}>FEED</div>
        </G>
        <G hover className="athlete-action-card" style={{cursor:"pointer",padding:"14px 10px",textAlign:"center"}} onClick={()=>go("bolao")}>
          <span style={{fontSize:26,display:"block"}}>🎰</span><div style={{fontFamily:fC,fontWeight:700,fontSize:11,color:"#F39C12",marginTop:6}}>BOLÃO</div>
        </G>
        <G hover className="athlete-action-card" style={{cursor:"pointer",padding:"14px 10px",textAlign:"center"}} onClick={()=>go("gallery")}>
          <span style={{fontSize:26,display:"block"}}>📸</span><div style={{fontFamily:fC,fontWeight:700,fontSize:11,color:K.grn,marginTop:6}}>FOTOS</div>
        </G>
        <G hover className="athlete-action-card" style={{cursor:"pointer",padding:"14px 10px",textAlign:"center"}} onClick={()=>{up({viewPlayerId:loggedPlayer.id});go("playerstats");}}>
          <span style={{fontSize:26,display:"block"}}>📊</span><div style={{fontFamily:fC,fontWeight:700,fontSize:11,color:K.blu,marginTop:6}}>MINHA FICHA</div>
        </G>
        <G hover className="athlete-action-card" style={{cursor:"pointer",padding:"14px 10px",textAlign:"center"}} onClick={()=>go("assists")}>
          <span style={{fontSize:26,display:"block"}}>🤝</span><div style={{fontFamily:fC,fontWeight:700,fontSize:11,color:"#14B8A6",marginTop:6}}>ASSISTÊNCIAS</div>
        </G>
      </div>
      {/* Meus números */}
      {(()=>{const myBetsCount=Object.entries(S.bets||{}).filter(([,arr])=>arr.some(b=>b.playerId===loggedPlayer.id)).length;const myVotesCount=Object.entries(S.votes||{}).filter(([,arr])=>arr.some(v=>v.voterId===loggedPlayer.id)).length;if(myBetsCount===0&&myVotesCount===0)return null;return <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}><span style={{fontSize:10,color:K.txD}}>Meus palpites: <b style={{color:K.tx}}>{myBetsCount}</b></span><span style={{fontSize:10,color:K.txD}}>Votei MVP em: <b style={{color:K.tx}}>{myVotesCount}</b> jogo{myVotesCount!==1?"s":""}</span></div>;})()}
    </div>}
    {/* Card Meu time — destaque com cor do time e próximo adversário */}
    {loggedPlayer&&hasTournament&&(()=>{const myTeam=tm.find(t=>t.playerIds?.includes(loggedPlayer.id));if(!myTeam)return null;const pos=st.findIndex(s=>s.team.id===myTeam.id)+1;const nextM=upcoming.find(m=>m.homeTeamId===myTeam.id||m.awayTeamId===myTeam.id);const nextOpp=nextM?gt(nextM.homeTeamId===myTeam.id?nextM.awayTeamId:nextM.homeTeamId):null;const teamColor=myTeam.color?.bg||K.acc;return <G style={{marginBottom:16,padding:16,border:`2px solid ${teamColor}40`,background:`linear-gradient(135deg,${teamColor}0C 0%,${teamColor}04 100%)`,boxShadow:`0 4px 16px ${teamColor}15`}}>
      <div style={{fontFamily:fC,fontSize:10,fontWeight:700,color:K.txD,letterSpacing:"0.08em",marginBottom:8}}>MEU TIME</div>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <Badge team={myTeam} size={40}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15,color:K.tx}}>{myTeam.name}</div>
          <div style={{fontSize:12,color:K.txD,marginTop:2}}>{pos}º na classificação</div>
          {nextOpp&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
            <span style={{fontSize:11,fontWeight:700,color:K.txM}}>Próximo jogo: vs {nextOpp.name}</span>
            <Badge team={nextOpp} size={20}/>
          </div>}
        </div>
      </div>
    </G>;})()}
    <div style={!hasTournament?{marginBottom:16,padding:16,borderRadius:12,border:`1px solid ${K.bd}`,background:K.bg2}:{}}>
    {!hasTournament&&<div style={{fontFamily:fC,fontSize:13,fontWeight:700,color:K.gold,letterSpacing:"0.1em",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>📰 HOJE NO FUTSABÃO<div style={{flex:1,height:1,background:K.gold+"25"}}/></div>}
    {/* Manchete do dia — resumo na Home */}
    {(S.dailyHeadline&&S.dailyHeadline.date===today)&&<div style={{marginBottom:20}}>
      <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.gold,letterSpacing:"0.08em",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>📰 MANCHETE DO DIA<div style={{flex:1,height:1,background:K.gold+"15"}}/></div>
      <G style={{padding:22,borderLeft:`5px solid ${K.gold}`,background:K.gold+"08",animation:"fu 0.4s ease"}}>
        <div style={{fontFamily:fH,fontSize:20,fontWeight:700,color:K.tx,marginBottom:12,lineHeight:1.3}}>{S.dailyHeadline.headline}</div>
        {S.dailyHeadline.body&&<p style={{fontSize:14,color:K.txD,lineHeight:1.55,marginBottom:14}}>{S.dailyHeadline.body}</p>}
        {S.dailyHeadline.dispute&&<div style={{padding:"12px 16px",borderRadius:10,border:`1px solid ${K.bdh}`,background:K.bg2}}>
          <div style={{fontSize:10,fontWeight:700,color:K.gDm,fontFamily:fC,letterSpacing:"0.06em",marginBottom:6}}>🎙️ NA MESA — Comentaristas discordam</div>
          <p style={{fontSize:12,color:K.tx,fontStyle:"italic",lineHeight:1.45}}>"{S.dailyHeadline.dispute}"</p>
        </div>}
      </G>
    </div>}
    {generatingDailyHeadline&&<G style={{marginBottom:16,padding:20,textAlign:"center"}}><span style={{fontSize:14,color:K.txD}}>Carregando manchete do dia...</span></G>}
    {/* Resumo: 2 itens do feed ao vivo + CTA Ver todo o feed */}
    {!hasTournament&&(()=>{
      const feed=(S.preTorneioFeed||[]).filter(p=>p.createdAt&&p.createdAt.startsWith(today)).sort((a,b)=>(new Date(b.createdAt))-(new Date(a.createdAt)));
      const getAuthor=(type)=>{const x=FEED_AUTHORS.find(f=>f.authorType===type);return x||{authorLabel:type,icon:"💬",color:K.txD};};
      const preview=feed.slice(0,2);
      return <div style={{marginBottom:16}}>
        {preview.length>0&&<div style={{marginBottom:10}}>
          <div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:K.gold,letterSpacing:"0.06em",marginBottom:8}}>📡 AO VIVO — últimas</div>
          <div style={{display:"grid",gap:8}}>
            {preview.map(item=>{
              const a=getAuthor(item.authorType);
              return <G key={item.id} style={{padding:12,borderLeft:`4px solid ${a.color}`,background:a.color+"0C"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,marginBottom:4}}>
                  <span style={{fontSize:11,fontWeight:700,color:a.color,fontFamily:fC}}>{a.icon} {item.authorLabel}</span>
                  {item.createdAt&&<span style={{fontSize:10,color:K.txD}}>{new Date(item.createdAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>}
                </div>
                <p style={{fontSize:12,color:K.tx,lineHeight:1.45,fontStyle:"italic"}}>"{item.text}"</p>
              </G>;
            })}
          </div>
        </div>}
        <G hover style={{cursor:"pointer",padding:"14px 18px",border:`2px solid ${K.gold}30`,background:K.gold+"0A",borderRadius:12}} onClick={()=>go("feed")}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
            <span style={{fontFamily:fC,fontWeight:700,fontSize:13,color:K.gold}}>📰 Ver todo o feed</span>
            <span style={{fontSize:18,color:K.gold}}>›</span>
          </div>
          <p style={{fontSize:11,color:K.txD,marginTop:4}}>Manchete, Cartola, torcedor, presidente, árbitro, ao vivo e plantão</p>
        </G>
      </div>;
    })()}
    {hasTournament&&(S.dailyHeadline||S.cartolaMessage||S.presidentMessage||S.refereeMessage||(S.athleteNews||[]).length>0)&&<G hover style={{cursor:"pointer",marginBottom:16,padding:"14px 18px",border:`2px solid ${K.gold}30`,background:K.gold+"0A",borderRadius:12}} onClick={()=>go("feed")}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
        <span style={{fontFamily:fC,fontWeight:700,fontSize:13,color:K.gold}}>📰 Hoje no Futsabão</span>
        <span style={{fontSize:18,color:K.gold}}>›</span>
      </div>
      <p style={{fontSize:11,color:K.txD,marginTop:4}}>Ver manchete, recados e plantão</p>
    </G>}
    </div>
    {/* Info cards */}
    <div style={!hasTournament?{marginBottom:16,padding:16,borderRadius:12,border:`1px solid ${K.bd}`,background:K.bg2}:{}}>
    {!hasTournament&&<div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.accL,letterSpacing:"0.08em",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>🏟️ FICHA DO CAMPEONATO<div style={{flex:1,height:1,background:K.acc+"20"}}/></div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
      <G style={{padding:"12px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>🏟️</span>
          <div><div style={{fontFamily:fC,fontWeight:700,fontSize:12,color:K.tx}}>{STADIUM.name}</div><div style={{fontSize:10,color:K.txD}}>{STADIUM.location}</div></div>
        </div>
      </G>
      <G style={{padding:"12px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>🟨</span>
          <div><div style={{fontFamily:fC,fontWeight:700,fontSize:12,color:K.tx}}>{REFEREE.name}</div><div style={{fontSize:10,color:K.txD,lineHeight:1.2}}>FIFS · 47 anos</div></div>
        </div>
      </G>
    </div>
    {/* Stats row — mini dashboard com ícone por stat */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      {[{l:"TIMES",v:tm.length,c:K.accL,icon:"🛡️"},{l:"ATLETAS",v:pl.length,c:K.gold,icon:"👥"},{l:"JOGOS",v:played.length,c:K.grn,icon:"🏟️"},{l:"GOLS",v:allG.length,c:"#A855F7",icon:"⚽"}].map((s,i)=>
        <G key={i} style={{padding:"14px 10px",textAlign:"center"}}><span style={{fontSize:18,display:"block",marginBottom:4}}>{s.icon}</span><div style={{fontFamily:fH,fontSize:26,fontWeight:700,color:s.c,lineHeight:1}}>{s.v}</div><div style={{fontFamily:fC,fontSize:9,color:K.txD,marginTop:4,letterSpacing:"0.08em"}}>{s.l}</div></G>
      )}
    </div>
    {/* Broadcasters */}
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>{BROADCASTERS.map(b=><span key={b.id} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:7,background:b.color+"0D",border:`1px solid ${b.color}15`,fontSize:11,fontWeight:700,fontFamily:fC,color:b.color}}>{b.icon} {b.name}</span>)}</div>
    </div>

    {!hasTournament?<div style={{marginBottom:20,overflow:"hidden",borderRadius:18,border:`2px solid ${K.gold}40`,boxShadow:`0 8px 32px ${K.gold}20`,background:`linear-gradient(180deg,${K.acc}0C 0%,${K.gold}08 50%,${K.acc}0C 100%)`}}>
      <div style={{height:5,background:`linear-gradient(90deg,${K.acc},${K.gold},${K.acc})`}}/>
      <div style={{padding:"32px 20px",textAlign:"center"}}>
        <div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:K.gold,letterSpacing:"0.2em",marginBottom:10}}>AQUECIMENTO</div>
        <div style={{fontFamily:fC,fontSize:10,fontWeight:700,color:K.gold,letterSpacing:"0.12em",marginBottom:8}}>{daysUntilStart>0?`DIA -${daysUntilStart}`:"É HOJE!"}</div>
        <span style={{fontSize:40,display:"block",marginBottom:12}}>🏆</span>
        <p style={{fontFamily:fH,fontSize:daysUntilStart>0?32:26,fontWeight:700,color:K.tx,marginBottom:8,lineHeight:1.2}}>{daysUntilStart>0?`Faltam ${daysUntilStart} dia${daysUntilStart!==1?"s":""}`:"O torneio começa hoje!"}</p>
        <p style={{fontSize:12,color:K.txD,marginBottom:20}}>O torneio começa em {startDateFormatted}</p>
        <p style={{fontSize:13,fontWeight:700,color:K.gold,marginBottom:20}}>📅 Lembrem-se: o campeonato é dia {reminderDateStr}!</p>
        <div style={{padding:"14px 22px",borderRadius:14,background:`linear-gradient(135deg,${K.acc}20,${K.gold}15)`,border:`1px solid ${K.acc}40`,display:"inline-block",marginBottom:18}}>
          <span style={{fontFamily:fH,fontSize:28,fontWeight:700,color:K.accL}}>{pl.length}</span>
          <span style={{fontSize:12,color:K.txD,marginLeft:10}}>atleta{pl.length!==1?"s":""} já garantido{pl.length!==1?"s":""}</span>
        </div>
        <p style={{fontSize:12,color:K.txM,lineHeight:1.5,maxWidth:320,margin:"0 auto"}}>Aqueça a torcida! Convide os amigos, responda ao jornalista e acompanhe quem já está inscrito.</p>
      </div>
      <div style={{height:5,background:`linear-gradient(90deg,${K.acc},${K.gold},${K.acc})`}}/>
    </div>:<>
      {/* CLASSIFICAÇÃO — seção colapsável */}
      {st.length>0&&<div style={{marginBottom:16}}>
        <button type="button" onClick={()=>sCollapseClassificacao(!collapseClassificacao)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,marginBottom:8,background:"none",border:"none",cursor:"pointer",padding:0,textAlign:"left"}}>
          <span style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#F97316",letterSpacing:"0.08em"}}>📊 CLASSIFICAÇÃO</span><div style={{flex:1,height:1,background:"#F9761612"}}/><span style={{fontSize:14,color:K.txD}}>{collapseClassificacao?"▶":"▼"}</span>
        </button>
        {!collapseClassificacao&&<G style={{padding:0,overflow:"hidden",overflowX:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"28px 1fr 26px 26px 26px 26px 26px 26px 28px 38px",padding:"8px 10px",background:K.tblH,fontSize:8,fontWeight:800,color:K.txM,fontFamily:fC,letterSpacing:"0.04em",minWidth:400}}>
            <div>#</div><div>TIME</div>{["J","V","E","D","GP","GC","SG","PTS"].map(h=><div key={h} style={{textAlign:"center"}}>{h}</div>)}
          </div>
          {st.map((s,i)=><div key={s.team.id} style={{display:"grid",gridTemplateColumns:"28px 1fr 26px 26px 26px 26px 26px 26px 28px 38px",padding:"8px 10px",alignItems:"center",borderTop:`1px solid ${K.bd}`,background:i===0?K.gold+"05":"transparent",minWidth:400}}>
            <div style={{fontFamily:fH,fontWeight:700,fontSize:13,color:i===0?K.gold:i<3?K.grn:K.txM}}>{i+1}</div>
            <div style={{display:"flex",alignItems:"center",gap:5}}><Badge team={s.team} size={18}/><span style={{fontWeight:700,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.team.name}</span></div>
            <div style={{textAlign:"center",fontSize:10,color:K.txD}}>{s.p}</div>
            <div style={{textAlign:"center",fontSize:10,color:K.grn,fontWeight:700}}>{s.w}</div>
            <div style={{textAlign:"center",fontSize:10,color:K.txD}}>{s.d}</div>
            <div style={{textAlign:"center",fontSize:10,color:K.red,fontWeight:700}}>{s.l}</div>
            <div style={{textAlign:"center",fontSize:10,color:K.txD}}>{s.gf}</div>
            <div style={{textAlign:"center",fontSize:10,color:K.txD}}>{s.ga}</div>
            <div style={{textAlign:"center",fontSize:10,fontWeight:700,color:s.gd>0?K.grn:s.gd<0?K.red:K.txD}}>{s.gd>0?"+":""}{s.gd}</div>
            <div style={{textAlign:"center",fontFamily:fH,fontSize:14,fontWeight:700,color:i===0?K.gold:K.tx}}>{s.pts}</div>
          </div>)}
        </G>
        }</div>}

      {/* PRÓXIMAS PARTIDAS — seção colapsável */}
      {upcoming.length>0&&<div style={{marginBottom:16}}>
        <button type="button" onClick={()=>sCollapseProximas(!collapseProximas)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,marginBottom:8,background:"none",border:"none",cursor:"pointer",padding:0,textAlign:"left"}}>
          <span style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.grn,letterSpacing:"0.08em"}}>📅 PRÓXIMAS PARTIDAS ({upcoming.length})</span><div style={{flex:1,height:1,background:K.grn+"12"}}/><span style={{fontSize:14,color:K.txD}}>{collapseProximas?"▶":"▼"}</span>
        </button>
        {!collapseProximas&&<div style={{display:"grid",gap:6}}>{upcoming.slice(0,6).map(m=>{const h=gt(m.homeTeamId),a=gt(m.awayTeamId);if(!h||!a)return null;
          const hasBet=loggedPlayer&&(S.bets[m.id]||[]).some(b=>b.playerId===loggedPlayer.id);
          const gk=S.geminiKey;
          const genHype=async()=>{if(!gk||m.hypeText)return;sLoadingHypeId(m.id);const prompt=`Próxima partida do Futsabão (futebol de sabão): ${h.name} vs ${a.name}. Gere 1 ou 2 frases de prévia ÉPICA, PROVOCATIVA e ZUEIRA. Pode inventar bastidores ("Clima TENSO no vestiário do ${h.name}"), criar rivalidades absurdas, profecias malucas ("Fonte revela que ${a.name} treinou em sabão artesanal"). Tom: narrador empolgado + fofoqueiro esportivo. Zueira total, fake news engraçada liberada. Responda APENAS o texto, sem título.`;const text=await callGemini(prompt,gk);if(text)up({matches:mt.map(x=>x.id===m.id?{...x,hypeText:text.slice(0,250)}:x)});sLoadingHypeId(null);};
          return <G key={m.id} hover={!!loggedPlayer} style={{padding:"10px 14px",cursor:loggedPlayer?"pointer":"default"}} onClick={()=>loggedPlayer&&go("bolao")}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <Badge team={h} size={22}/><span style={{fontFamily:fC,fontWeight:700,fontSize:12,flex:1,textAlign:"right"}}>{h.name}</span>
              <span style={{fontFamily:fH,fontWeight:700,color:K.txM,fontSize:12,padding:"2px 10px",borderRadius:6,background:K.gold+"08",border:`1px solid ${K.gold}10`}}>VS</span>
              <span style={{fontFamily:fC,fontWeight:700,fontSize:12,flex:1}}>{a.name}</span><Badge team={a} size={22}/>
            </div>
            {m.hypeText?<p style={{fontSize:11,color:K.txD,lineHeight:1.4,marginTop:8,paddingTop:8,borderTop:`1px solid ${K.bd}`}}>{m.hypeText}</p>:gk&&<button type="button" onClick={e=>{e.stopPropagation();genHype();}} disabled={!!loadingHypeId} style={{marginTop:6,background:"none",border:"none",color:K.grn,cursor:loadingHypeId?"default":"pointer",fontSize:10,fontFamily:fC}}>{loadingHypeId===m.id?"Gerando...":"Ver análise"}</button>}
            {loggedPlayer&&<div style={{textAlign:"center",marginTop:4}}>
              {hasBet?<span style={{fontSize:9,color:K.grn,fontFamily:fC}}>✅ Palpite feito</span>:<span style={{fontSize:9,color:"#F39C12",fontFamily:fC}}>🎰 Fazer palpite</span>}
            </div>}
          </G>;
        })}{upcoming.length>6&&<p style={{fontSize:10,color:K.txD,textAlign:"center",marginTop:4}}>+{upcoming.length-6} partida{upcoming.length-6>1?"s":""}</p>}</div>
        }</div>}

      {/* ÚLTIMOS RESULTADOS — seção colapsável */}
      {lastResults.length>0&&<div style={{marginBottom:16}}>
        <button type="button" onClick={()=>sCollapseResultados(!collapseResultados)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,marginBottom:8,background:"none",border:"none",cursor:"pointer",padding:0,textAlign:"left"}}>
          <span style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.blu,letterSpacing:"0.08em"}}>🏁 ÚLTIMOS RESULTADOS</span><div style={{flex:1,height:1,background:K.blu+"12"}}/><span style={{fontSize:14,color:K.txD}}>{collapseResultados?"▶":"▼"}</span>
        </button>
        {!collapseResultados&&<div style={{display:"grid",gap:6}}>{lastResults.map(m=>{const h=gt(m.homeTeamId),a=gt(m.awayTeamId);if(!h||!a)return null;
          const ko=m.phase==="knockout",tied=m.homeScore===m.awayScore;
          const mVotes=S.votes[m.id]||[];const mTally={};mVotes.forEach(v=>{mTally[v.mvpId]=(mTally[v.mvpId]||0)+1;});
          const mvpEntry=Object.entries(mTally).sort((a,b)=>b[1]-a[1])[0];const mvpPlayer=mvpEntry?pl.find(p=>p.id===mvpEntry[0]):null;
          const mvpTeam=mvpPlayer?tm.find(t=>t.playerIds?.includes(mvpPlayer.id)):null;
          const gk=S.geminiKey;
          const genFlash=async()=>{if(!gk||m.postMatchFlash)return;sLoadingFlashId(m.id);const goals=(m.goals||[]).map(g=>{const p=pl.find(x=>x.id===g.playerId);return p?(p.nickname||p.name):"?";});const prompt=`Partida do Futsabão (futebol de sabão) ENCERRADA: ${h.name} ${m.homeScore} × ${m.awayScore} ${a.name}.${goals.length?` Gols: ${goals.join(", ")}.`:""}${mvpPlayer?` MVP: ${mvpPlayer.nickname||mvpPlayer.name}.`:""} Gere 1 ou 2 frases de "flash" pós-jogo DRAMÁTICO e ZUEIRO. Pode exagerar lances ("Gol fantasma?!"), inventar polêmicas ("Árbitro consultou o VAR do sabão!"), criar narrativas absurdas, zoar o perdedor. Tom: narrador emocionado com sensacionalismo máximo e zueira de pelada. Responda APENAS o texto, sem aspas nem título.`;const text=await callGemini(prompt,gk);if(text)up({matches:mt.map(x=>x.id===m.id?{...x,postMatchFlash:text.slice(0,300)}:x)});sLoadingFlashId(null);};
          const genMvpQuote=async()=>{if(!gk||!mvpPlayer||m.mvpQuote)return;sLoadingMvpId(m.id);const prompt=`O jogador ${mvpPlayer.nickname||mvpPlayer.name} foi eleito MVP da partida ${h.name} ${m.homeScore} × ${m.awayScore} ${a.name} no Futsabão (futebol de sabão). Gere UMA frase curta como se fosse a reação dele no pós-jogo. ESTILO: pode ser ARROGANTE ("Sou o melhor do sabão e vocês sabem"), ZOEIRO ("O sabão escorrega pra todo mundo menos pra mim"), PROVOCATIVO ("Fala pro ${h.name===a.name?"adversário":a.name} que eu mando abraço"), pode tirar sarro dos adversários, se autoproclamar craque. Tom: jogador zoeiro de pelada, cheio de si. Responda APENAS a frase, entre aspas.`;const text=await callGemini(prompt,gk);const quote=text?(text.replace(/^["']|["']$/g,"").trim().slice(0,150)):null;if(quote)up({matches:mt.map(x=>x.id===m.id?{...x,mvpQuote:quote}:x)});sLoadingMvpId(null);};
          return <G key={m.id} hover style={{padding:"10px 14px",cursor:"pointer"}} onClick={()=>{go("matchview",{currentMatch:m.id});}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <Badge team={h} size={22}/><span style={{fontFamily:fC,fontWeight:700,fontSize:12,flex:1,textAlign:"right"}}>{h.name}</span>
              <div style={{textAlign:"center",minWidth:60}}><span style={{fontFamily:fH,fontWeight:700,color:K.gold,fontSize:16}}>{m.homeScore} × {m.awayScore}</span>{ko&&tied&&m.hPen!=null&&<div style={{fontFamily:fC,fontSize:9,color:K.gold}}>Pên:{m.hPen}×{m.aPen}</div>}</div>
              <span style={{fontFamily:fC,fontWeight:700,fontSize:12,flex:1}}>{a.name}</span><Badge team={a} size={22}/>
            </div>
            {m.postMatchFlash?<p style={{fontSize:11,color:K.txD,lineHeight:1.4,marginTop:8,paddingTop:8,borderTop:`1px solid ${K.bd}`}}>Flash: {m.postMatchFlash}</p>:gk&&<button type="button" onClick={e=>{e.stopPropagation();genFlash();}} disabled={!!loadingFlashId} style={{marginTop:6,background:"none",border:"none",color:K.blu,cursor:loadingFlashId?"default":"pointer",fontSize:10,fontFamily:fC}}>{loadingFlashId===m.id?"Gerando...":"Gerar flash"}</button>}
            {/* MVP badge inline */}
            {mvpPlayer?<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:6,padding:"4px 10px",borderRadius:8,background:K.gold+"08",border:`1px solid ${K.gold}10`}}>
              <span style={{fontSize:10}}>👑</span>
              <div style={{width:18,height:18,borderRadius:5,overflow:"hidden",background:(mvpTeam?.color.bg||K.txM)+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {mvpPlayer.photo?<img src={mvpPlayer.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:7,fontWeight:800,color:mvpTeam?.color.bg||K.gold,fontFamily:fC}}>{(mvpPlayer.nickname||mvpPlayer.name)[0]}</span>}
              </div>
              <span style={{fontSize:10,fontWeight:700,color:K.gold}}>{mvpPlayer.nickname||mvpPlayer.name}</span>
              <span style={{fontSize:9,color:K.txD}}>MVP · {mvpEntry[1]} voto{mvpEntry[1]>1?"s":""}</span>
            </div>:<div style={{display:"flex",gap:8,marginTop:4,justifyContent:"center"}}>
              <span style={{fontSize:9,color:"#8B5CF6",fontFamily:fC}}>💬 Chat</span>
              <span style={{fontSize:9,color:K.gold,fontFamily:fC}}>🏆 Votar MVP</span>
              <span style={{fontSize:9,color:K.grn,fontFamily:fC}}>📸 Fotos</span>
            </div>}
            {mvpPlayer&&(m.mvpQuote?<p style={{fontSize:10,color:K.txD,fontStyle:"italic",marginTop:4}}>Reação: "{m.mvpQuote}"</p>:gk&&<button type="button" onClick={e=>{e.stopPropagation();genMvpQuote();}} disabled={!!loadingMvpId} style={{marginTop:4,background:"none",border:"none",color:K.gold,cursor:loadingMvpId?"default":"pointer",fontSize:10,fontFamily:fC}}>{loadingMvpId===m.id?"Gerando...":"Gerar reação do MVP"}</button>)}
            {/* Panjango badge inline */}
            {(()=>{const pjV=(S.panjangoVotes||{})[m.id]||[];if(!pjV.length)return null;const pjT={};pjV.forEach(v=>{pjT[v.panjangoId]=(pjT[v.panjangoId]||0)+1;});const pjE=Object.entries(pjT).sort((a,b)=>b[1]-a[1])[0];const pjP=pjE?pl.find(p=>p.id===pjE[0]):null;const pjTeam=pjP?tm.find(t=>t.playerIds?.includes(pjP.id)):null;if(!pjP)return null;return <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:4,padding:"4px 10px",borderRadius:8,background:"#E74C3C08",border:"1px solid #E74C3C10"}}>
              <span style={{fontSize:10}}>🤦</span>
              <div style={{width:18,height:18,borderRadius:5,overflow:"hidden",background:(pjTeam?.color.bg||K.txM)+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {pjP.photo?<img src={pjP.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:7,fontWeight:800,color:pjTeam?.color.bg||"#E74C3C",fontFamily:fC}}>{(pjP.nickname||pjP.name)[0]}</span>}
              </div>
              <span style={{fontSize:10,fontWeight:700,color:"#E74C3C"}}>{pjP.nickname||pjP.name}</span>
              <span style={{fontSize:9,color:K.txD}}>Panjango · {pjE[1]} voto{pjE[1]>1?"s":""}</span>
            </div>;})()}
          </G>;
        })}</div>
        }</div>}

      {/* 👑 MVPs DO CAMPEONATO — Ranking global */}
      {(()=>{
        const globalMvp={};
        played.forEach(m=>{const mVotes=S.votes[m.id]||[];const mTally={};mVotes.forEach(v=>{mTally[v.mvpId]=(mTally[v.mvpId]||0)+1;});const best=Object.entries(mTally).sort((a,b)=>b[1]-a[1])[0];if(best){if(!globalMvp[best[0]])globalMvp[best[0]]={wins:0,totalVotes:0};globalMvp[best[0]].wins++;globalMvp[best[0]].totalVotes+=best[1];}});
        const gmArr=Object.entries(globalMvp).map(([pid,d])=>({player:pl.find(p=>p.id===pid),team:tm.find(t=>t.playerIds?.includes(pid)),...d})).filter(x=>x.player).sort((a,b)=>b.wins-a.wins||b.totalVotes-a.totalVotes);
        if(!gmArr.length)return null;
        return <div style={{marginBottom:16}}>
          <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.gold,letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>👑 MVPs DO CAMPEONATO<div style={{flex:1,height:1,background:K.gold+"12"}}/></div>
          <G style={{padding:0,overflow:"hidden"}}>
            {gmArr.map((r,i)=><div key={r.player.id} style={{display:"flex",alignItems:"center",gap:10,padding:i===0?"14px 16px":"10px 14px",borderTop:i?`1px solid ${K.bd}`:"none",background:i===0?K.gold+"12":"transparent",borderRadius:i===0?10:0}}>
              <div style={{fontFamily:fH,fontWeight:700,fontSize:i===0?18:14,width:i===0?28:24,textAlign:"center",color:i===0?K.gold:i<3?"#94A3B8":K.txM}}>{i===0?"👑":i===1?"🥈":i===2?"🥉":`${i+1}º`}</div>
              <div style={{width:i===0?36:32,height:i===0?36:32,borderRadius:8,overflow:"hidden",background:(r.team?.color.bg||K.txM)+"10",display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${i===0?K.gold+"40":K.bd}`,flexShrink:0}}>
                {r.player.photo?<img src={r.player.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:fC,fontWeight:800,fontSize:i===0?14:12,color:r.team?.color.bg||K.txD}}>{(r.player.nickname||r.player.name)[0]}</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:i===0?13:12}}>{r.player.nickname||r.player.name}</div>
                {r.team&&<div style={{fontSize:10,color:r.team.color.bg,display:"flex",alignItems:"center",gap:3}}><Badge team={r.team} size={11}/>{r.team.name}</div>}
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:fH,fontWeight:700,fontSize:i===0?18:16,color:i===0?K.gold:K.tx}}>🏆 {r.wins}×</div>
                <div style={{fontSize:9,color:K.txD}}>MVP</div>
              </div>
            </div>)}
          </G>
        </div>;
      })()}

      {/* 🤦 PANJANGOS DO CAMPEONATO — Ranking global */}
      {(()=>{
        const globalPj={};
        played.forEach(m=>{const pjV=(S.panjangoVotes||{})[m.id]||[];const pjT={};pjV.forEach(v=>{pjT[v.panjangoId]=(pjT[v.panjangoId]||0)+1;});const best=Object.entries(pjT).sort((a,b)=>b[1]-a[1])[0];if(best){if(!globalPj[best[0]])globalPj[best[0]]={wins:0,totalVotes:0};globalPj[best[0]].wins++;globalPj[best[0]].totalVotes+=best[1];}});
        const gpArr=Object.entries(globalPj).map(([pid,d])=>({player:pl.find(p=>p.id===pid),team:tm.find(t=>t.playerIds?.includes(pid)),...d})).filter(x=>x.player).sort((a,b)=>b.wins-a.wins||b.totalVotes-a.totalVotes);
        if(!gpArr.length)return null;
        return <div style={{marginBottom:16}}>
          <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#E74C3C",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>🤦 PANJANGOS DO CAMPEONATO<div style={{flex:1,height:1,background:"#E74C3C12"}}/></div>
          <G style={{padding:0,overflow:"hidden"}}>
            {gpArr.map((r,i)=><div key={r.player.id} style={{display:"flex",alignItems:"center",gap:10,padding:i===0?"14px 16px":"10px 14px",borderTop:i?`1px solid ${K.bd}`:"none",background:i===0?"#E74C3C12":"transparent",borderRadius:i===0?10:0}}>
              <div style={{fontFamily:fH,fontWeight:700,fontSize:i===0?18:14,width:i===0?28:24,textAlign:"center",color:i===0?"#E74C3C":i<3?"#94A3B8":K.txM}}>{i===0?"🤦":i===1?"2º":i===2?"3º":`${i+1}º`}</div>
              <div style={{width:i===0?36:32,height:i===0?36:32,borderRadius:8,overflow:"hidden",background:(r.team?.color.bg||K.txM)+"10",display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${i===0?"#E74C3C40":K.bd}`,flexShrink:0}}>
                {r.player.photo?<img src={r.player.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:fC,fontWeight:800,fontSize:i===0?14:12,color:r.team?.color.bg||K.txD}}>{(r.player.nickname||r.player.name)[0]}</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:i===0?13:12}}>{r.player.nickname||r.player.name}</div>
                {r.team&&<div style={{fontSize:10,color:r.team.color.bg,display:"flex",alignItems:"center",gap:3}}><Badge team={r.team} size={11}/>{r.team.name}</div>}
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:fH,fontWeight:700,fontSize:i===0?18:16,color:i===0?"#E74C3C":K.tx}}>🤦 {r.wins}×</div>
                <div style={{fontSize:9,color:K.txD}}>Panjango</div>
              </div>
            </div>)}
          </G>
        </div>;
      })()}

      {/* ARTILHARIA TOP 5 */}
      {sc.length>0&&<div style={{marginBottom:16}}>
        <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#A855F7",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>⚽ ARTILHARIA<div style={{flex:1,height:1,background:"#A855F712"}}/></div>
        <G style={{padding:0,overflow:"hidden"}}>
          {sc.map((s,i)=><div key={s.player.id} style={{display:"flex",alignItems:"center",gap:10,padding:i===0?"14px 16px":"10px 14px",borderTop:i?`1px solid ${K.bd}`:"none",background:i===0?K.gold+"10":"transparent",borderRadius:i===0?10:0}}>
            <div style={{fontFamily:fH,fontWeight:700,fontSize:i===0?18:14,width:i===0?28:24,textAlign:"center",color:i===0?K.gold:i<3?"#94A3B8":K.txM}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}º`}</div>
            <div style={{width:i===0?36:32,height:i===0?36:32,borderRadius:8,overflow:"hidden",background:s.team.color.bg+"10",display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${i===0?K.gold+"40":K.bd}`,flexShrink:0}}>{s.player.photo?<img src={s.player.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:fC,fontWeight:800,fontSize:i===0?14:12,color:s.team.color.bg}}>{(s.player.nickname||s.player.name)[0]}</span>}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:i===0?13:12}}>{s.player.nickname||s.player.name}</div><div style={{fontSize:10,color:s.team.color.bg,display:"flex",alignItems:"center",gap:3}}><Badge team={s.team} size={11}/>{s.team.name}</div></div>
            <div style={{fontFamily:fH,fontWeight:700,fontSize:i===0?22:18,color:i===0?K.gold:K.grn}}>⚽ {s.goals}</div>
          </div>)}
        </G>
      </div>}

      {/* TIMES */}
      {tm.length>0&&<div style={{marginBottom:16}}>
        <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.accL,letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>🛡️ TIMES ({tm.length})<div style={{flex:1,height:1,background:K.acc+"12"}}/></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
          {tm.map(t=>{
            const teamPlayers=(t.playerIds||[]).map(pid=>pl.find(p=>p.id===pid)).filter(Boolean);
            return <G key={t.id} style={{padding:"12px 10px",textAlign:"center"}}>
              <Badge team={t} size={36}/>
              <div style={{fontFamily:fC,fontWeight:700,fontSize:12,marginTop:6}}>{t.name}</div>
              <div style={{fontSize:10,color:K.txD,marginTop:2}}>{t.playerIds.length} jogadores</div>
              {teamPlayers.length>0&&<div style={{fontSize:9,color:K.txM,marginTop:6,textAlign:"left",lineHeight:1.35}}>{teamPlayers.map(p=>{const apelido=p.nickname?.trim();const exibir=apelido||p.name;return <div key={p.id}>{exibir}{p.number?` #${p.number}`:""}</div>})}</div>}
            </G>;
          })}
        </div>
      </div>}

      {/* PATROCINADORES */}
      {S.sponsors.length>0&&<div style={{marginBottom:16}}>
        <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.gold,letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>🏅 PATROCINADORES<div style={{flex:1,height:1,background:K.gold+"12"}}/></div>
        {[{id:"Ouro",color:"#C4A561",icon:"🥇"},{id:"Prata",color:"#94A3B8",icon:"🥈"},{id:"Bronze",color:"#B45309",icon:"🥉"},{id:"Apoio",color:"#6B7280",icon:"🤝"}].map(cat=>{
          const items=S.sponsors.filter(s=>s.category===cat.id);
          if(!items.length)return null;
          return <div key={cat.id} style={{marginBottom:10}}>
            <div style={{fontFamily:fC,fontSize:10,fontWeight:700,color:cat.color,letterSpacing:"0.06em",marginBottom:5}}>{cat.icon} {cat.id.toUpperCase()}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {items.map(s=><G key={s.id} style={{padding:"8px 14px",display:"inline-flex",alignItems:"center",gap:8}}>
                {s.logo?<img src={s.logo} alt="" style={{width:28,height:28,borderRadius:6,objectFit:"contain",background:"#fff",padding:2}}/>:<span style={{fontSize:14}}>🏢</span>}
                <span style={{fontWeight:700,fontSize:12,color:K.tx}}>{s.name}</span>
              </G>)}
            </div>
          </div>;
        })}
      </div>}
    </>}
  </div>;
}

/* ══════════ ATHLETE FEED (Hoje no Futsabão) ══════════ */
const FEED_AUTHORS=[{authorType:"reporter",authorLabel:"Reporter",icon:"📰",color:K.gold},{authorType:"comentarista",authorLabel:"Comentarista",icon:"🎙️",color:K.blu},{authorType:"cartola",authorLabel:"Cartola",icon:"👔",color:K.accL},{authorType:"torcedor",authorLabel:"Torcedor",icon:"📢",color:"#F97316"},{authorType:"presidente",authorLabel:"Presidente Rafão",icon:"🎩",color:"#3B82F6"},{authorType:"arbitro",authorLabel:"Árbitro Rodolfo",icon:"⚖️",color:"#14B8A6"}];
function AthleteFeed({S,go,up,REFEREE,STADIUM,BROADCASTERS,role,loggedPlayer}){
  const hasTournament=(S.matches||[]).length>0;
  const today=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;})();
  const[hasSubmittedInterview,sHasSubmittedInterview]=useState(false);
  const[interviewAnswer,sInterviewAnswer]=useState("");
  const[generatingNews,sGeneratingNews]=useState(false);
  const interviewPick=useRef(null);
  return <div style={{paddingTop:10,paddingBottom:44}}>
    <BB onClick={()=>go("home")} crumb="HOJE NO FUTSABÃO"/>
    <div style={{fontFamily:fC,fontSize:13,fontWeight:700,color:K.gold,letterSpacing:"0.1em",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>📰 HOJE NO FUTSABÃO<div style={{flex:1,height:1,background:K.gold+"25"}}/></div>
    {/* Manchete do dia */}
    {(S.dailyHeadline&&S.dailyHeadline.date===today)&&<div style={{marginBottom:20}}>
      <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.gold,letterSpacing:"0.08em",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>📰 MANCHETE DO DIA<div style={{flex:1,height:1,background:K.gold+"15"}}/></div>
      <G style={{padding:22,borderLeft:`5px solid ${K.gold}`,background:K.gold+"08",animation:"fu 0.4s ease"}}>
        <div style={{fontFamily:fH,fontSize:20,fontWeight:700,color:K.tx,marginBottom:12,lineHeight:1.3}}>{S.dailyHeadline.headline}</div>
        {S.dailyHeadline.body&&<p style={{fontSize:14,color:K.txD,lineHeight:1.55,marginBottom:14}}>{S.dailyHeadline.body}</p>}
        {S.dailyHeadline.dispute&&<div style={{padding:"12px 16px",borderRadius:10,border:`1px solid ${K.bdh}`,background:K.bg2}}>
          <div style={{fontSize:10,fontWeight:700,color:K.gDm,fontFamily:fC,letterSpacing:"0.06em",marginBottom:6}}>🎙️ NA MESA — Comentaristas discordam</div>
          <p style={{fontSize:12,color:K.tx,fontStyle:"italic",lineHeight:1.45}}>"{S.dailyHeadline.dispute}"</p>
        </div>}
      </G>
    </div>}
    {(S.dailyHeadline&&S.dailyHeadline.date===today)&&(S.cartolaMessage||S.torcedorMessage||S.presidentMessage||S.refereeMessage)&&<div style={{height:1,background:K.bd,marginBottom:16,maxWidth:120,marginLeft:"auto",marginRight:"auto"}}/>}
    {/* O Cartola falou */}
    {(S.cartolaMessage&&S.cartolaMessage.date===today)&&<div style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.accL,letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>👔 O CARTOLA FALOU<div style={{flex:1,height:1,background:K.acc+"15"}}/></div>
      <G style={{padding:16,borderLeft:`4px solid ${K.acc}`,background:K.acc+"08"}}>
        <p style={{fontSize:14,color:K.tx,fontStyle:"italic",lineHeight:1.5}}>"{S.cartolaMessage.text}"</p>
        <div style={{fontSize:10,color:K.txD,marginTop:8}}>Palavra do dirigente · {today}</div>
      </G>
    </div>}
    {/* O Torcedor mandou */}
    {(S.torcedorMessage&&S.torcedorMessage.date===today)&&<div style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#F97316",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>📢 O TORCEDOR MANDOU<div style={{flex:1,height:1,background:"#F9731615"}}/></div>
      <G style={{padding:16,borderLeft:`4px solid #F97316`,background:"#F9731608"}}>
        <p style={{fontSize:14,color:K.tx,fontStyle:"italic",lineHeight:1.5}}>"{S.torcedorMessage.text}"</p>
        <div style={{fontSize:10,color:K.txD,marginTop:8}}>Corneta do dia · {today}</div>
      </G>
    </div>}
    {/* Palavra do Presidente */}
    {(S.presidentMessage&&S.presidentMessage.date===today)&&<div style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#3B82F6",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>🎩 PALAVRA DO PRESIDENTE<div style={{flex:1,height:1,background:"#3B82F615"}}/></div>
      <G style={{padding:16,borderLeft:"4px solid #3B82F6",background:"#3B82F608"}}>
        <p style={{fontSize:14,color:K.tx,fontStyle:"italic",lineHeight:1.5}}>"{S.presidentMessage.text}"</p>
        <div style={{fontSize:10,color:K.txD,marginTop:8}}>Rafão — Presidente · {today}</div>
      </G>
    </div>}
    {/* Palavra do Árbitro */}
    {(S.refereeMessage&&S.refereeMessage.date===today)&&<div style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#14B8A6",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>⚖️ PALAVRA DO ÁRBITRO<div style={{flex:1,height:1,background:"#14B8A615"}}/></div>
      <G style={{padding:16,borderLeft:"4px solid #14B8A6",background:"#14B8A608"}}>
        <p style={{fontSize:14,color:K.tx,fontStyle:"italic",lineHeight:1.5}}>"{S.refereeMessage.text}"</p>
        <div style={{fontSize:10,color:K.txD,marginTop:8}}>Rodolfo Seifert — Árbitro · {today}</div>
      </G>
    </div>}
    {/* Ao vivo no pré-torneio */}
    {!hasTournament&&(()=>{
      const feed=(S.preTorneioFeed||[]).filter(p=>p.createdAt&&p.createdAt.startsWith(today)).sort((a,b)=>(new Date(b.createdAt))-(new Date(a.createdAt)));
      const getAuthor=(type)=>{const x=FEED_AUTHORS.find(f=>f.authorType===type);return x||{authorLabel:type,icon:"💬",color:K.txD};};
      if(feed.length===0)return <div style={{marginBottom:16}}><div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.gDm,letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>📡 AO VIVO NO PRÉ-TORNEIO<div style={{flex:1,height:1,background:K.gold+"15"}}/></div><p style={{fontSize:12,color:K.txD,padding:"12px 0"}}>As notícias e falas do dia aparecem aqui ao longo do dia.</p></div>;
      return <div style={{marginBottom:16}}>
        <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.gold,letterSpacing:"0.08em",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>📡 AO VIVO NO PRÉ-TORNEIO<div style={{flex:1,height:1,background:K.gold+"15"}}/></div>
        <div style={{display:"grid",gap:10}}>
          {feed.map(item=>{
            const a=getAuthor(item.authorType);
            return <G key={item.id} style={{padding:14,borderLeft:`4px solid ${a.color}`,background:a.color+"0C"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:6}}>
                <span style={{fontSize:12,fontWeight:700,color:a.color,fontFamily:fC}}>{a.icon} {item.authorLabel}</span>
                {item.createdAt&&<span style={{fontSize:10,color:K.txD}}>{new Date(item.createdAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>}
              </div>
              <p style={{fontSize:13,color:K.tx,lineHeight:1.5,fontStyle:"italic"}}>"{item.text}"</p>
            </G>;
          })}
        </div>
      </div>;
    })()}
    {/* Pergunta do jornalista */}
    {loggedPlayer&&!hasSubmittedInterview&&(()=>{
      const jList=S.journalists?.length?S.journalists:[{id:"_",name:"Redação Futsabão"}];
      if(!interviewPick.current)interviewPick.current={journalist:jList[Math.floor(Math.random()*jList.length)],question:JOURNALIST_QUESTIONS[Math.floor(Math.random()*JOURNALIST_QUESTIONS.length)]};
      const{journalist,question}=interviewPick.current;
      const submit=async()=>{
        const ans=interviewAnswer.trim();
        if(!ans)return;
        const outlets=BROADCASTERS?.length?BROADCASTERS:[{id:"b1",name:"Cazé TV",color:"#FF4654"}];
        const outlet=outlets[Math.floor(Math.random()*outlets.length)];
        const playerName=loggedPlayer.name||"Atleta";
        const dateStr=new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"long"});
        let headline=`${playerName} responde sobre o torneio`;
        let body=`Durante uma entrevista neste dia ${dateStr}, o atleta ${playerName} falou sobre o torneio de futsabão e respondeu com bom humor quando o jornalista ${journalist.name} da ${outlet.name} o questionou sobre "${question}". ${playerName} foi direto: "${ans.slice(0,200)}".`;
        const gk=S.geminiKey;
        if(gk){
          sGeneratingNews(true);
          const prompt=`Você é um editor de portal esportivo. O jornalista ${journalist.name} (${outlet.name}) entrevistou o atleta ${playerName} no Futsabão (campeonato de futebol de sabão).
Pergunta: "${question}". Resposta do atleta: "${ans.slice(0,250)}".

OBRIGATÓRIO: Gere uma MINI-NOTÍCIA (2 ou 3 frases) no formato de reportagem, NÃO no formato "Fulano perguntou a Ciclano: ... Resposta: ...".
Exemplo de formato correto: "Durante uma entrevista neste dia 01 de março, o atleta Felpis falou sobre o torneio de futsabão e respondeu com bom humor quando o jornalista Mauro Naves da ESPN o questionou sobre 'Quem é o jogador mais difícil de marcar?'. Felpis foi direto: 'Não tem.'"
- Use o dia e mês atuais, o nome do atleta, do jornalista e do veículo. Inclua a pergunta entre aspas e a resposta do atleta entre aspas no final.
- Pode dar um toque sensacionalista ou de zueira leve, mas mantenha o formato de notícia curta.

Gere em exatamente 2 linhas:
Linha 1: manchete curta (máx 60 caracteres).
Linha 2: texto da mini-notícia no formato de reportagem acima (máx 350 caracteres).
Responda APENAS com essas duas linhas, sem título extra.`;
          const raw=await callGemini(prompt,gk);
          if(raw){
            const lines=raw.split("\n").map(s=>s.trim()).filter(Boolean);
            if(lines.length>=1)headline=lines[0].slice(0,120);
            if(lines.length>=2)body=lines.slice(1).join(" ").slice(0,400);
          }
          sGeneratingNews(false);
        }
        const newItem={id:uid(),journalistId:journalist.id,journalistName:journalist.name,playerId:loggedPlayer.id,playerName:playerName,question,answer:ans.slice(0,250),outletId:outlet.id,outletName:outlet.name,outletColor:outlet.color||K.gold,headline,body,createdAt:new Date().toISOString()};
        up({athleteNews:[...(S.athleteNews||[]),newItem]});
        sHasSubmittedInterview(true);
        sInterviewAnswer("");
      };
      return <G style={{marginBottom:16,padding:22,border:`2px solid #0EA5E935`,background:`linear-gradient(135deg,#0EA5E912,#0EA5E908)`}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <span style={{fontSize:28}}>🎤</span>
          <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#0EA5E9",letterSpacing:"0.06em"}}>{journalist.name} pergunta:</div>
        </div>
        <p style={{fontSize:15,color:K.tx,fontWeight:600,marginBottom:14,lineHeight:1.4}}>{question}</p>
        <textarea value={interviewAnswer} onChange={e=>sInterviewAnswer(e.target.value.slice(0,250))} placeholder="Sua resposta (até 250 caracteres)..." maxLength={250} rows={3} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1px solid ${K.bd}`,background:K.inp,color:K.tx,fontSize:13,fontFamily:ff,resize:"vertical",boxSizing:"border-box"}}/>
        <div style={{fontSize:10,color:K.txD,marginTop:6}}>{interviewAnswer.length}/250</div>
        <BT onClick={submit} disabled={!interviewAnswer.trim()||generatingNews} style={{marginTop:14}}>{generatingNews?"GERANDO NOTÍCIA...":"PUBLICAR RESPOSTA"}</BT>
      </G>;
    })()}
    {/* Plantão */}
    {(S.athleteNews||[]).length>0&&<div style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#0EA5E9",letterSpacing:"0.08em",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>📰 PLANTÃO<div style={{flex:1,height:1,background:"#0EA5E915"}}/></div>
      <div style={{display:"grid",gap:12}}>
        {[...(S.athleteNews||[])].sort((a,b)=>(new Date(b.createdAt))-(new Date(a.createdAt))).map(n=>(
          <G key={n.id} style={{padding:14,borderLeft:`4px solid ${n.outletColor||K.gold}`,display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{width:36,height:36,borderRadius:10,background:(n.outletColor||K.gold)+"25",border:`1px solid ${(n.outletColor||K.gold)}40`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:fH,fontSize:14,fontWeight:700,color:n.outletColor||K.gold,flexShrink:0}}>{(n.outletName||"N")[0]}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                <span style={{fontSize:10,fontWeight:700,color:n.outletColor||K.gold,fontFamily:fC}}>{n.outletName}</span>
                {n.createdAt&&<span style={{fontSize:10,color:K.txD}}>{new Date(n.createdAt).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>}
              </div>
              <div style={{fontFamily:fH,fontSize:14,fontWeight:700,color:K.tx,marginBottom:6}}>{n.headline}</div>
              <p style={{fontSize:12,color:K.txD,lineHeight:1.5}}>{n.body}</p>
            </div>
          </G>
        ))}
      </div>
    </div>}
  </div>;
}

/* ══════════ MODERAÇÃO (ADMIN) ══════════ */
function Moderation({S,up,go}){
  const today=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;})();
  const[delHeadline,sDelHeadline]=useState(false);
  const[delCartola,sDelCartola]=useState(false);
  const[delTorcedor,sDelTorcedor]=useState(false);
  const[delNewsId,sDelNewsId]=useState(null);
  const[delChat,sDelChat]=useState(null);
  const[delPresident,sDelPresident]=useState(false);
  const[delReferee,sDelReferee]=useState(false);
  const[delFeedId,sDelFeedId]=useState(null);
  const gt=id=>S.teams.find(t=>t.id===id);
  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")} crumb="MODERAÇÃO"/>
    <SH icon="🛡️" title="MODERAÇÃO" sub="Excluir comentários e mensagens de todos" color="#E74C3C"/>
    {/* Manchete do dia */}
    {S.dailyHeadline&&<div style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:K.gold,letterSpacing:"0.06em",marginBottom:6}}>📰 MANCHETE DO DIA</div>
      <G style={{padding:14,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
        <div><div style={{fontWeight:700,fontSize:13,color:K.tx}}>{S.dailyHeadline.headline}</div><div style={{fontSize:10,color:K.txD,marginTop:4}}>{S.dailyHeadline.date}</div></div>
        <BT onClick={()=>sDelHeadline(true)} v="red" style={{padding:"6px 12px",fontSize:11}}>EXCLUIR</BT>
      </G>
    </div>}
    {/* Cartola */}
    {S.cartolaMessage&&<div style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:K.accL,letterSpacing:"0.06em",marginBottom:6}}>👔 CARTOLA</div>
      <G style={{padding:14,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
        <div><p style={{fontSize:12,color:K.tx,fontStyle:"italic"}}>"{S.cartolaMessage.text}"</p><div style={{fontSize:10,color:K.txD,marginTop:4}}>{S.cartolaMessage.date}</div></div>
        <BT onClick={()=>sDelCartola(true)} v="red" style={{padding:"6px 12px",fontSize:11}}>EXCLUIR</BT>
      </G>
    </div>}
    {/* Torcedor */}
    {S.torcedorMessage&&<div style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:"#F97316",letterSpacing:"0.06em",marginBottom:6}}>📢 TORCEDOR</div>
      <G style={{padding:14,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
        <div><p style={{fontSize:12,color:K.tx,fontStyle:"italic"}}>"{S.torcedorMessage.text}"</p><div style={{fontSize:10,color:K.txD,marginTop:4}}>{S.torcedorMessage.date}</div></div>
        <BT onClick={()=>sDelTorcedor(true)} v="red" style={{padding:"6px 12px",fontSize:11}}>EXCLUIR</BT>
      </G>
    </div>}
    {/* Presidente */}
    {S.presidentMessage&&<div style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:"#3B82F6",letterSpacing:"0.06em",marginBottom:6}}>🎩 PRESIDENTE</div>
      <G style={{padding:14,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
        <div><p style={{fontSize:12,color:K.tx,fontStyle:"italic"}}>"{S.presidentMessage.text}"</p><div style={{fontSize:10,color:K.txD,marginTop:4}}>{S.presidentMessage.date}</div></div>
        <BT onClick={()=>sDelPresident(true)} v="red" style={{padding:"6px 12px",fontSize:11}}>EXCLUIR</BT>
      </G>
    </div>}
    {/* Árbitro */}
    {S.refereeMessage&&<div style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:"#14B8A6",letterSpacing:"0.06em",marginBottom:6}}>⚖️ ÁRBITRO</div>
      <G style={{padding:14,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
        <div><p style={{fontSize:12,color:K.tx,fontStyle:"italic"}}>"{S.refereeMessage.text}"</p><div style={{fontSize:10,color:K.txD,marginTop:4}}>{S.refereeMessage.date}</div></div>
        <BT onClick={()=>sDelReferee(true)} v="red" style={{padding:"6px 12px",fontSize:11}}>EXCLUIR</BT>
      </G>
    </div>}
    {/* Feed de atletas (Plantão) */}
    <div style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:"#0EA5E9",letterSpacing:"0.06em",marginBottom:8}}>📰 PLANTÃO — NOTÍCIAS DOS ATLETAS</div>
      {(S.athleteNews||[]).length===0?<p style={{fontSize:12,color:K.txD}}>Nenhuma notícia.</p>:<div style={{display:"grid",gap:8}}>
        {(S.athleteNews||[]).map(n=>(
          <G key={n.id} style={{padding:12,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
            <div><div style={{fontWeight:700,fontSize:12,color:K.tx}}>{n.headline}</div><div style={{fontSize:10,color:K.txD}}>{n.outletName} · {n.createdAt?new Date(n.createdAt).toLocaleString("pt-BR"):""}</div></div>
            <BT onClick={()=>sDelNewsId(n.id)} v="red" style={{padding:"5px 10px",fontSize:10}}>EXCLUIR</BT>
          </G>
        ))}
      </div>}
    </div>
    {/* Feed pré-torneio (Ao vivo) */}
    <div style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:K.gold,letterSpacing:"0.06em",marginBottom:8}}>📡 FEED PRÉ-TORNEIO — AO VIVO</div>
      {(S.preTorneioFeed||[]).length===0?<p style={{fontSize:12,color:K.txD}}>Nenhum post no feed.</p>:<div style={{display:"grid",gap:8}}>
        {[...(S.preTorneioFeed||[])].sort((a,b)=>(new Date(b.createdAt||0))-(new Date(a.createdAt||0))).slice(0,20).map(item=>(
          <G key={item.id} style={{padding:12,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
            <div><div style={{fontSize:10,fontWeight:700,color:K.txD,marginBottom:4}}>{item.authorLabel}{item.createdAt?" · "+new Date(item.createdAt).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):""}</div><p style={{fontSize:12,color:K.tx,fontStyle:"italic"}}>"{item.text}"</p></div>
            <BT onClick={()=>sDelFeedId(item.id)} v="red" style={{padding:"5px 10px",fontSize:10}}>EXCLUIR</BT>
          </G>
        ))}
        {(S.preTorneioFeed||[]).length>20&&<p style={{fontSize:10,color:K.txD}}>Mostrando os 20 mais recentes.</p>}
      </div>}
    </div>
    {/* Chat da torcida */}
    <div style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:"#8B5CF6",letterSpacing:"0.06em",marginBottom:8}}>💬 CHAT DA TORCIDA</div>
      {Object.keys(S.fanChat||{}).length===0?<p style={{fontSize:12,color:K.txD}}>Nenhuma mensagem.</p>:Object.entries(S.fanChat||{}).map(([chatKey,msgs])=>{
        if(!msgs||!msgs.length)return null;
        const match=S.matches.find(m=>m.id===chatKey);const ht=gt(match?.homeTeamId),at=gt(match?.awayTeamId);const matchLabel=match&&ht&&at?`${ht.name} × ${at.name}`:chatKey;
        return <div key={chatKey} style={{marginBottom:12}}>
          <div style={{fontSize:10,color:K.txM,marginBottom:6}}>Partida: {matchLabel}</div>
          <div style={{display:"grid",gap:6}}>
            {msgs.map(m=>(
              <G key={m.id} style={{padding:10,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                <div><div style={{fontSize:11,fontWeight:700,color:K.tx}}>{m.name}</div><div style={{fontSize:12,color:K.txD}}>{m.text}</div><div style={{fontSize:9,color:K.txM}}>{m.time}</div></div>
                <BT onClick={()=>sDelChat({chatKey,msgId:m.id})} v="red" style={{padding:"5px 10px",fontSize:10}}>EXCLUIR</BT>
              </G>
            ))}
          </div>
        </div>;
      })}
    </div>
    <ConfirmDialog open={delHeadline} onCancel={()=>sDelHeadline(false)} onConfirm={()=>{up({dailyHeadline:null});sDelHeadline(false);}} title="Excluir manchete do dia?" message="A manchete do dia será removida. Amanhã uma nova pode ser gerada." confirmLabel="EXCLUIR" icon="📰"/>
    <ConfirmDialog open={delCartola} onCancel={()=>sDelCartola(false)} onConfirm={()=>{up({cartolaMessage:null});sDelCartola(false);}} title="Excluir mensagem do Cartola?" message="A fala do Cartola será removida." confirmLabel="EXCLUIR" icon="👔"/>
    <ConfirmDialog open={delTorcedor} onCancel={()=>sDelTorcedor(false)} onConfirm={()=>{up({torcedorMessage:null});sDelTorcedor(false);}} title="Excluir mensagem do Torcedor?" message="A corneta do Torcedor será removida." confirmLabel="EXCLUIR" icon="📢"/>
    <ConfirmDialog open={delPresident} onCancel={()=>sDelPresident(false)} onConfirm={()=>{up({presidentMessage:null});sDelPresident(false);}} title="Excluir recado do Presidente?" message="O recado do Presidente será removido." confirmLabel="EXCLUIR" icon="🎩"/>
    <ConfirmDialog open={delReferee} onCancel={()=>sDelReferee(false)} onConfirm={()=>{up({refereeMessage:null});sDelReferee(false);}} title="Excluir recado do Árbitro?" message="O recado do Árbitro será removido." confirmLabel="EXCLUIR" icon="⚖️"/>
    <ConfirmDialog open={!!delNewsId} onCancel={()=>sDelNewsId(null)} onConfirm={()=>{up({athleteNews:(S.athleteNews||[]).filter(n=>n.id!==delNewsId)});sDelNewsId(null);}} title="Excluir notícia?" message="Esta notícia do Plantão será removida." confirmLabel="EXCLUIR" icon="📰"/>
    <ConfirmDialog open={!!delFeedId} onCancel={()=>sDelFeedId(null)} onConfirm={()=>{up({preTorneioFeed:(S.preTorneioFeed||[]).filter(p=>p.id!==delFeedId)});sDelFeedId(null);}} title="Excluir post do feed?" message="Este post do feed pré-torneio será removido." confirmLabel="EXCLUIR" icon="📡"/>
    <ConfirmDialog open={!!delChat} onCancel={()=>sDelChat(null)} onConfirm={()=>{if(!delChat)return;const next={...S.fanChat,[delChat.chatKey]:(S.fanChat[delChat.chatKey]||[]).filter(m=>m.id!==delChat.msgId)};up({fanChat:next});sDelChat(null);}} title="Excluir mensagem do chat?" message="Esta mensagem da torcida será removida." confirmLabel="EXCLUIR" icon="💬"/>
  </div>;
}

/* ══════════ RECADOS (ADMIN) ══════════ */
function Recados({S,up,go}){
  const today=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;})();
  const[presTxt,sPresTxt]=useState("");
  const[refTxt,sRefTxt]=useState("");
  const sendPres=()=>{if(!presTxt.trim())return;up({presidentMessage:{date:today,text:presTxt.trim()}});sPresTxt("");};
  const sendRef=()=>{if(!refTxt.trim())return;up({refereeMessage:{date:today,text:refTxt.trim()}});sRefTxt("");};
  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")} crumb="RECADOS"/>
    <SH icon="📣" title="RECADOS" sub="Envie recados do Presidente e do Árbitro aos atletas" color="#3B82F6"/>

    {/* Palavra do Presidente */}
    <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#3B82F6",letterSpacing:"0.08em",marginBottom:8,marginTop:8,display:"flex",alignItems:"center",gap:8}}>🎩 PALAVRA DO PRESIDENTE — RAFÃO<div style={{flex:1,height:1,background:"#3B82F615"}}/></div>
    {S.presidentMessage&&<G style={{padding:14,marginBottom:10,borderLeft:"4px solid #3B82F6",background:"#3B82F608"}}>
      <p style={{fontSize:13,color:K.tx,fontStyle:"italic",lineHeight:1.5}}>"{S.presidentMessage.text}"</p>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8}}>
        <span style={{fontSize:10,color:K.txD}}>{S.presidentMessage.date}</span>
        <BT onClick={()=>up({presidentMessage:null})} v="red" style={{padding:"4px 10px",fontSize:10}}>LIMPAR</BT>
      </div>
    </G>}
    <G style={{padding:16,marginBottom:20}}>
      <textarea value={presTxt} onChange={e=>sPresTxt(e.target.value)} placeholder="Escreva o recado do Presidente Rafão…" rows={3} style={{width:"100%",padding:12,borderRadius:8,border:`1px solid ${K.bd}`,background:K.inp,color:K.tx,fontSize:13,fontFamily:ff,resize:"vertical",boxSizing:"border-box"}}/>
      <BT onClick={sendPres} disabled={!presTxt.trim()} style={{marginTop:10,width:"100%"}}>ENVIAR RECADO DO PRESIDENTE</BT>
    </G>

    {/* Palavra do Árbitro */}
    <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#14B8A6",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>⚖️ PALAVRA DO ÁRBITRO — RODOLFO SEIFERT<div style={{flex:1,height:1,background:"#14B8A615"}}/></div>
    {S.refereeMessage&&<G style={{padding:14,marginBottom:10,borderLeft:"4px solid #14B8A6",background:"#14B8A608"}}>
      <p style={{fontSize:13,color:K.tx,fontStyle:"italic",lineHeight:1.5}}>"{S.refereeMessage.text}"</p>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8}}>
        <span style={{fontSize:10,color:K.txD}}>{S.refereeMessage.date}</span>
        <BT onClick={()=>up({refereeMessage:null})} v="red" style={{padding:"4px 10px",fontSize:10}}>LIMPAR</BT>
      </div>
    </G>}
    <G style={{padding:16,marginBottom:20}}>
      <textarea value={refTxt} onChange={e=>sRefTxt(e.target.value)} placeholder="Escreva o recado do Árbitro Rodolfo Seifert…" rows={3} style={{width:"100%",padding:12,borderRadius:8,border:`1px solid ${K.bd}`,background:K.inp,color:K.tx,fontSize:13,fontFamily:ff,resize:"vertical",boxSizing:"border-box"}}/>
      <BT onClick={sendRef} disabled={!refTxt.trim()} style={{marginTop:10,width:"100%"}}>ENVIAR RECADO DO ÁRBITRO</BT>
    </G>
  </div>;
}

/* ══════════ ADMIN HOME ══════════ */
function Home({S,go,REFEREE,STADIUM,BROADCASTERS,exportData,importData}){
  const pl=S.matches.filter(m=>m.played).length;
  const impRef=useRef(null);
  return <div style={{paddingTop:10,paddingBottom:44}}>
    <div style={{textAlign:"center",marginBottom:24}}>
      <div style={{marginBottom:16,animation:"gw 4s ease-in-out infinite"}}><img src={LOGO} alt="" style={{maxWidth:200,width:"100%",height:"auto",display:"block",margin:"0 auto",filter:"drop-shadow(0 8px 30px rgba(196,165,97,0.15))"}}/></div>
    </div>
    {/* Data persistence indicator */}
    <G style={{marginBottom:14,padding:"10px 14px",border:`1px solid ${K.grn}15`}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:K.grn}}/>
        <span style={{fontFamily:fC,fontSize:11,fontWeight:700,color:K.grn,letterSpacing:"0.06em"}}>DADOS SALVOS</span>
        <span style={{fontSize:10,color:K.txD,flex:1}}>Auto-save no navegador + sincroniza abas</span>
        <input ref={impRef} type="file" accept=".json" onChange={importData} style={{display:"none"}}/>
        <button onClick={()=>impRef.current?.click()} style={{background:"none",border:`1px solid ${K.bd}`,borderRadius:6,cursor:"pointer",padding:"3px 10px",fontSize:10,color:K.txD,fontFamily:fC,fontWeight:700}}>📥 IMPORTAR</button>
        <button onClick={exportData} style={{background:"none",border:`1px solid ${K.bd}`,borderRadius:6,cursor:"pointer",padding:"3px 10px",fontSize:10,color:K.txD,fontFamily:fC,fontWeight:700}}>📤 BACKUP</button>
      </div>
    </G>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
      {[{l:"JOGADORES",v:S.players.length,c:K.gold},{l:"TIMES",v:S.teams.length,c:K.accL},{l:"PARTIDAS",v:`${pl}/${S.matches.length||0}`,c:K.blu}].map((s,i)=>
        <G key={i} style={{padding:"14px 10px",textAlign:"center"}}><div style={{fontFamily:fH,fontSize:26,fontWeight:700,color:s.c,lineHeight:1}}>{s.v}</div><div style={{fontFamily:fC,fontSize:9,color:K.txD,marginTop:4,letterSpacing:"0.1em"}}>{s.l}</div></G>
      )}
    </div>
    <div style={{display:"grid",gap:7}}>
      {[
        {ic:"👤",l:"JOGADORES",d:"Cadastro, notas e link",s:"players",c:K.gold},
        {ic:"🛡️",l:"TIMES",d:"Equipes, escudos e sorteio",s:"teams",c:K.accL},
        {ic:"🏆",l:"CAMPEONATO",d:"Formato, partidas e edição",s:"tournament",c:K.gBr},
        {ic:"📊",l:"CLASSIFICAÇÃO",d:"Tabela com desempate FIFA",s:"standings",c:"#F97316"},
        {ic:"⚽",l:"ARTILHARIA",d:"Ranking de goleadores",s:"scorers",c:"#A855F7"},
        {ic:"🎙️",l:"TRANSMISSÃO",d:"Narradores, comentaristas, jornalistas e IA",s:"commentators",c:"#8B5CF6"},
        {ic:"📋",l:"SÚMULA",d:"Relatório oficial",s:"sumula",c:"#14B8A6"},
        {ic:"📣",l:"RECADOS",d:"Palavra do Presidente e do Árbitro",s:"recados",c:"#3B82F6"},
        {ic:"🛡️",l:"MODERAÇÃO",d:"Excluir comentários e mensagens",s:"moderation",c:"#E74C3C"},
        {ic:"🏅",l:"PATROCINADORES",d:"Cadastro de patrocinadores",s:"sponsors",c:"#C4A561"},
      ].map((it,i)=>
        <G key={i} hover style={{cursor:"pointer",padding:"13px 16px"}} onClick={()=>go(it.s)}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",background:it.c+"0D",fontSize:18,flexShrink:0,border:`1px solid ${it.c}15`}}>{it.ic}</div>
            <div style={{flex:1}}><div style={{fontFamily:fC,fontWeight:700,fontSize:13,color:K.tx,letterSpacing:"0.04em"}}>{it.l}</div><div style={{fontSize:11,color:K.txD,marginTop:1}}>{it.d}</div></div>
            <div style={{color:K.gDm,fontSize:16}}>›</div>
          </div>
        </G>
      )}
    </div>
  </div>;
}

/* ══════════ FAKE PLAYER GENERATOR ══════════ */
const FAKE_NAMES=["João Silva","Pedro Santos","Lucas Oliveira","Matheus Costa","Gabriel Souza","Rafael Lima","Bruno Ferreira","Felipe Almeida","Thiago Pereira","André Rodrigues","Diego Martins","Carlos Eduardo","Vinícius Araújo","Leandro Barbosa","Marcos Paulo","Renan Lopes","Gustavo Mendes","Fabio Cardoso","Henrique Ribeiro","Daniel Nascimento","Caio Moreira","Igor Teixeira","Alex Monteiro","Eduardo Pinto","Renato Gomes","Wesley Carvalho","Juliano Freitas","Robson Dias","Anderson Cunha","Marcelo Vieira"];
const FAKE_NICKS=["Pelézinho","Bolinha","Sabonete","Escorregão","Caneta","Raio","Torpedo","Chuteira","Perninha","Foguete","Trovão","Relâmpago","Borracha","Chapéu","Drible","Catimba","Firula","Elástico","Pedalada","Canhão","Lambreta","Bicicleta","Piscineiro","Carrinho","Chocolatinho","Gordinho","Magrelo","Baixinho","Grandão","Mortadela","Salsicha","Presunto","Paçoca","Pipoca","Faísca","Lampião","Capivara","Jacaré","Garoto","Moleque","Pivete","Cria","Zé Gotinha","Sabãozinho","Espuminha","Bolhinha","Detergente","Shampoo","Bucha","Esponja"];
const FAKE_PHRASES=["Habilidade pura!","Sem freio!","Quem tenta não erra!","Bola no pé e sabão no chão!","Escorrega mas não cai!","Firula é meu sobrenome!","Nasceu pra jogar!","Cai mas levanta!","O campo é meu quintal!","Se escorregar passou!","Sabão não me para!","Deus me livre de cair!","Pé firme, mente tranquila!","Sou raiz!","Futebol de sabão é arte!","Cansei de ser humilde!","Jogo limpo? Aqui não!","Hoje o sabão tá nervoso!","Vim pra ser campeão!","É escorregão ou drible?"];
function genFakePlayer(){
  const name=FAKE_NAMES[Math.floor(Math.random()*FAKE_NAMES.length)];
  const nickname=FAKE_NICKS[Math.floor(Math.random()*FAKE_NICKS.length)];
  const position=POS[Math.floor(Math.random()*POS.length)];
  const birthYear=1985+Math.floor(Math.random()*20);
  const number=Math.floor(Math.random()*99)+1;
  const phrase=FAKE_PHRASES[Math.floor(Math.random()*FAKE_PHRASES.length)];
  const rating=Math.floor(Math.random()*3)+3;
  return{id:uid(),name,nickname,position,birthYear:String(birthYear),number:String(number),phrase,photo:null,rating};
}

/* ══════════ PLAYERS ══════════ */
function Players({S,up,go}){
  const[sL,sSL]=useState(false);const[cp,sCp]=useState(false);const[eId,sEId]=useState(null);
  const[delId,sDelId]=useState(null); // confirm delete
  const rl=`${window.location.origin}${window.location.pathname}#register`;
  const[showQR,sShowQR]=useState(null); // player id for QR
  const add=f=>up({players:[...S.players,{id:uid(),...f}]});
  const rem=id=>{up({players:S.players.filter(p=>p.id!==id),teams:S.teams.map(t=>({...t,playerIds:t.playerIds.filter(p=>p!==id)}))});sDelId(null);};
  const save=f=>{up({players:S.players.map(p=>p.id===eId?{...p,...f}:p)});sEId(null);};
  const doCp=()=>{navigator.clipboard?.writeText(rl).then(()=>{sCp(true);setTimeout(()=>sCp(false),2e3);});};
  const simPlayer=()=>{const fake=genFakePlayer();up({players:[...S.players,fake]});};
  const ep=S.players.find(p=>p.id===eId);
  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")} crumb="JOGADORES"/>
    <SH icon="👤" title="JOGADORES" sub={`${S.players.length} atleta${S.players.length!==1?"s":""}`}/>
    {/* Admin: Simulator */}
    <G style={{marginBottom:14,padding:"10px 14px",border:`1px dashed ${K.acc}25`,background:K.acc+"06"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:16}}>🤖</span>
        <div style={{flex:1}}><div style={{fontFamily:fC,fontWeight:700,fontSize:11,color:K.accL,letterSpacing:"0.06em"}}>SIMULADOR DE JOGADOR</div><div style={{fontSize:10,color:K.txD}}>Admin · Gera jogador fictício aleatório</div></div>
        <BT onClick={simPlayer} v="acc" style={{padding:"8px 16px",fontSize:11}}>+ GERAR</BT>
      </div>
    </G>
    <G style={{marginBottom:14,padding:14}}>
      <button onClick={()=>sSL(!sL)} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",color:K.gold,cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:fC,letterSpacing:"0.06em",padding:0,width:"100%",textTransform:"uppercase"}}>🔗 LINK DE CADASTRO<span style={{marginLeft:"auto",transition:"transform 0.2s",transform:sL?"rotate(180deg)":"",color:K.txD}}>▾</span></button>
      {sL&&<div style={{marginTop:12}}><p style={{fontSize:12,color:K.txD,marginBottom:8}}>Compartilhe para os jogadores:</p><div style={{display:"flex",gap:8}}><div style={{flex:1,padding:"9px 13px",borderRadius:8,background:K.inp,border:`1px solid ${K.bd}`,fontSize:12,color:K.txD,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rl}</div><BT onClick={doCp} v={cp?"grn":"gold"} style={{padding:"9px 16px",fontSize:11}}>{cp?"✓ COPIADO":"COPIAR"}</BT></div>
      <button onClick={()=>go("register")} style={{marginTop:8,background:"none",border:"none",color:K.gold,cursor:"pointer",fontWeight:600,fontSize:11,fontFamily:ff,padding:0,textDecoration:"underline"}}>Visualizar inscrição →</button></div>}
    </G>
    <G style={{marginBottom:16,padding:20}}><PF onSubmit={add} showRating/></G>
    <Modal open={!!eId} onClose={()=>sEId(null)} title="EDITAR JOGADOR">{ep&&<PF onSubmit={save} label="SALVAR" initial={ep} showRating/>}</Modal>
    <div style={{display:"grid",gap:6}}>{S.players.map((p,i)=><G key={p.id} hover style={{padding:"10px 14px",animation:`fu 0.25s ease ${i*.03}s both`}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:44,height:44,borderRadius:11,overflow:"hidden",background:K.gold+"08",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${K.bd}`}}>{p.photo?<img src={p.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:fH,fontSize:18,fontWeight:700,color:K.gold+"35"}}>{(p.nickname||p.name)[0]}</span>}</div>
        {p.number&&<div style={{width:30,height:30,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",background:K.acc+"15",color:K.accL,fontWeight:800,fontSize:13,fontFamily:fC,flexShrink:0}}>{p.number}</div>}
        <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.nickname||p.name}</div><div style={{fontSize:11,color:K.txD}}>{[p.position,p.birthYear&&`${new Date().getFullYear()-p.birthYear}a`].filter(Boolean).join(" · ")}</div></div>
        {(getPlayerStarRating(p.id,S.matchStarRatings)??p.rating??0)>0&&<Stars value={getPlayerStarRating(p.id,S.matchStarRatings)??p.rating??0} ro sz={13}/>}
        <button onClick={(e)=>{e.stopPropagation();sShowQR(p.id);}} aria-label="QR Code" style={{background:"none",border:"none",color:K.txD,cursor:"pointer",padding:4,fontSize:13}}>📱</button>
        <button onClick={(e)=>{e.stopPropagation();up({viewPlayerId:p.id});go("playerstats");}} aria-label="Ver estatísticas" style={{background:"none",border:"none",color:K.blu,cursor:"pointer",padding:4,fontSize:13}}>📊</button>
        <button onClick={()=>sEId(p.id)} aria-label="Editar jogador" style={{background:"none",border:"none",color:K.txD,cursor:"pointer",padding:4,fontSize:13}}>✏️</button>
        <button onClick={()=>sDelId(p.id)} aria-label="Remover jogador" style={{background:"none",border:"none",color:"#E74C3C50",cursor:"pointer",padding:4,fontSize:13}}>🗑️</button>
      </div>
    </G>)}</div>
    {/* QR Code Modal (#14) */}
    <Modal open={!!showQR} onClose={()=>sShowQR(null)} title="QR CODE DE ACESSO">{(()=>{const qrP=S.players.find(x=>x.id===showQR);if(!qrP)return null;const qrUrl=`${window.location.origin}${window.location.pathname}?player=${qrP.id}&pin=${qrP.pin||""}#athlete`;return <div style={{textAlign:"center"}}>
      <div style={{marginBottom:12}}><QRCode data={qrUrl} size={220}/></div>
      <div style={{fontFamily:fH,fontSize:18,fontWeight:700,color:K.tx}}>{qrP.nickname||qrP.name}</div>
      {qrP.number&&<div style={{fontFamily:fC,fontSize:14,color:K.gold,fontWeight:700}}>#{qrP.number}</div>}
      <div style={{fontSize:11,color:K.txD,marginTop:8,padding:"8px 14px",borderRadius:8,background:K.row,fontFamily:"monospace",wordBreak:"break-all"}}>{qrUrl}</div>
      <p style={{fontSize:10,color:K.txM,marginTop:8}}>O jogador aponta a câmera e acessa direto o app</p>
      <BT onClick={()=>{navigator.clipboard?.writeText(qrUrl);}} v="gold" style={{marginTop:10,fontSize:11,padding:"8px 18px"}}>📋 COPIAR LINK</BT>
    </div>;})()}</Modal>
    <ConfirmDialog open={!!delId} onCancel={()=>sDelId(null)} onConfirm={()=>rem(delId)} title="Remover Jogador?" message={`"${(S.players.find(p=>p.id===delId)?.nickname||S.players.find(p=>p.id===delId)?.name)||""}" será removido de todos os times. Ação irreversível.`} confirmLabel="REMOVER" icon="👤"/>
    {!S.players.length&&<div style={{textAlign:"center",padding:40,color:K.txM,fontFamily:fC,letterSpacing:"0.08em"}}>NENHUM JOGADOR CADASTRADO</div>}
  </div>;
}

/* ══════════ REGISTER ══════════ */
function Register({S,up,go,role,sLoggedPlayer}){
  const[done,sD]=useState(false);
  const[registeredPlayer,sRegisteredPlayer]=useState(null);
  const sub=f=>{
    if(!f.name?.trim())return;
    const newPlayer={id:uid(),...f,rating:0};
    up({players:[...S.players,newPlayer]});
    if(role==="athlete"&&sLoggedPlayer){
      try{sessionStorage.setItem("futsabao_just_registered","1");}catch(e){}
      sLoggedPlayer({id:newPlayer.id,name:newPlayer.nickname||newPlayer.name});
      go("home");
      return;
    }
    sRegisteredPlayer(newPlayer);
    sD(true);
  };
  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")} label={role==="admin"?"ADMIN":"VOLTAR"}/>
    <div style={{textAlign:"center",marginTop:20,marginBottom:24}}>
      <img src={LOGO} alt="" style={{maxWidth:200,width:"100%",display:"block",margin:"0 auto 12px"}}/>
      <p style={{color:K.txD,fontSize:13,marginTop:6}}>Preencha seus dados para se inscrever!</p>
    </div>
    {done?<G style={{textAlign:"center",padding:40}}>
      <div style={{fontSize:56,marginBottom:14}}>✅</div>
      <h3 style={{fontFamily:fH,fontSize:22,color:K.gold}}>CADASTRO CONCLUÍDO COM SUCESSO!</h3>
      <p style={{color:K.txD,marginTop:8}}>Agora é só esperar a convocação! 🧼⚽</p>
      <p style={{color:K.gDm,fontSize:13,marginTop:12,maxWidth:320,marginLeft:"auto",marginRight:"auto"}}>Guarde seu PIN de 4 dígitos — você precisará dele para acessar a Área do Atleta.</p>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:20,alignItems:"center"}}>
        {role==="admin"&&<BT onClick={()=>{sD(false);sRegisteredPlayer(null);}}>CADASTRAR OUTRO</BT>}
        {role==="admin"&&<BT onClick={()=>go("home")} v="gh">VOLTAR AO INÍCIO</BT>}
      </div>
    </G>
    :<G style={{padding:24}}><PF onSubmit={sub} label="INSCREVER-SE"/></G>}
  </div>;
}

/* ══════════ COMMENTATORS ══════════ */
function Commentators({S,up,go}){
  const[n,sN]=useState("");const[st,sSt]=useState("");const[tp,sTp]=useState("narrator");const[key,sK]=useState(S.geminiKey||"");const[expId,sExpId]=useState(null);
  const[delComId,sDelComId]=useState(null);
  const[delJId,sDelJId]=useState(null);
  const journalists=S.journalists||[];
  const add=()=>{if(!n.trim())return;
    if(tp==="journalist"){up({journalists:[...journalists,{id:uid(),name:n.trim(),style:st.trim()}]});}
    else{up({commentators:[...S.commentators,{id:uid(),name:n.trim(),type:tp,style:st.trim()}]});}
    sN("");sSt("");
  };
  const narrators=S.commentators.filter(c=>c.type==="narrator");
  const analysts=S.commentators.filter(c=>c.type==="analyst");
  const renderCard=(c)=>{
    const isExp=expId===c.id;const preview=c.style?.length>70?c.style.slice(0,70)+"…":c.style;
    const isNar=c.type==="narrator";const color=isNar?"#E8CE8B":"#8B5CF6";const icon=isNar?"🎙️":"💬";
    return <G key={c.id} style={{padding:"12px 16px",marginBottom:5}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,borderRadius:9,background:color+"0A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,border:`1px solid ${color}15`,flexShrink:0}}>{icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:13,color:K.tx}}>{c.name}</div>
          {c.style&&<div onClick={()=>sExpId(isExp?null:c.id)} style={{fontSize:11,color:color,marginTop:2,cursor:"pointer",lineHeight:1.4}}>
            {isExp?<span style={{fontStyle:"italic",whiteSpace:"pre-wrap"}}>{c.style}</span>:<span style={{fontStyle:"italic"}}>{preview} <span style={{color:K.gDm,fontSize:10}}>▾</span></span>}
          </div>}
        </div>
        <button onClick={()=>sDelComId(c.id)} aria-label="Remover" style={{background:"none",border:"none",color:"#E74C3C40",cursor:"pointer",padding:4,flexShrink:0}}>🗑️</button>
      </div>
    </G>;
  };
  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")} crumb="TRANSMISSÃO"/>
    <SH icon="🎙️" title="NARRADORES, COMENTARISTAS & JORNALISTAS" sub="Equipe sorteada em cada jogo — jornalistas entrevistam no pós-jogo" color="#8B5CF6"/>
    <G style={{marginBottom:14,padding:16}}>
      <LB>API KEY GEMINI</LB>
      <div style={{display:"flex",gap:8}}><IN value={key} onChange={e=>sK(e.target.value)} placeholder="Cole sua API key" type="password" style={{flex:1}}/><BT onClick={()=>up({geminiKey:key.trim()})} v="gh">{S.geminiKey?"✓ SALVA":"SALVAR"}</BT></div>
      <p style={{fontSize:11,color:K.txD,marginTop:8}}>Durante o jogo, a IA gera uma conversa ao vivo entre narrador e comentaristas no estilo de cada um.</p>
    </G>
    <G style={{marginBottom:16,padding:20}}>
      <div style={{display:"flex",gap:7,marginBottom:14}}>
        {[{id:"narrator",l:"🎙️ NARRADOR"},{id:"analyst",l:"💬 COMENTARISTA"},{id:"journalist",l:"🎤 JORNALISTA"}].map(t=>
          <button key={t.id} onClick={()=>sTp(t.id)} style={{padding:"8px 16px",borderRadius:8,fontWeight:700,fontSize:11,fontFamily:fC,letterSpacing:"0.05em",border:`1px solid ${tp===t.id?K.gold:K.bd}`,cursor:"pointer",background:tp===t.id?K.gold+"0D":"transparent",color:tp===t.id?K.gold:K.txD}}>{t.l}</button>
        )}
      </div>
      <div style={{display:"grid",gap:10,marginBottom:14}}>
        <div><LB>Nome</LB><IN value={n} onChange={e=>sN(e.target.value)} placeholder={tp==="narrator"?"Ex: Galvão Bueno":tp==="journalist"?"Ex: Eric Faria":"Ex: Neto"}/></div>
        <div><LB>Prompt / Estilo</LB><IN value={st} onChange={e=>sSt(e.target.value)} placeholder={tp==="journalist"?"Descreva como conduz a entrevista pós-jogo":"Descreva o estilo ou cole um prompt"}/></div>
      </div>
      <BT onClick={add} disabled={!n.trim()}>+ CADASTRAR</BT>
    </G>
    {/* Narrators */}
    <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#E8CE8B",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>🎙️ NARRADORES ({narrators.length})<div style={{flex:1,height:1,background:"#E8CE8B15"}}/></div>
    {narrators.map(renderCard)}
    {/* Analysts */}
    <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#8B5CF6",letterSpacing:"0.08em",marginTop:16,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>💬 COMENTARISTAS ({analysts.length})<div style={{flex:1,height:1,background:"#8B5CF615"}}/></div>
    {analysts.map(renderCard)}
    {/* Journalists */}
    <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#0EA5E9",letterSpacing:"0.08em",marginTop:16,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>🎤 JORNALISTAS ({journalists.length})<div style={{flex:1,height:1,background:"#0EA5E915"}}/></div>
    {journalists.length?journalists.map(j=>{
      const isExp=expId===j.id;const preview=j.style?.length>70?j.style.slice(0,70)+"…":j.style;
      return <G key={j.id} style={{padding:"12px 16px",marginBottom:5}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:9,background:"#0EA5E90A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,border:"1px solid #0EA5E915",flexShrink:0}}>🎤</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:13,color:K.tx}}>{j.name}</div>
            {j.style&&<div onClick={()=>sExpId(isExp?null:j.id)} style={{fontSize:11,color:"#0EA5E9",marginTop:2,cursor:"pointer",lineHeight:1.4}}>
              {isExp?<span style={{fontStyle:"italic",whiteSpace:"pre-wrap"}}>{j.style}</span>:<span style={{fontStyle:"italic"}}>{preview} <span style={{color:K.gDm,fontSize:10}}>▾</span></span>}
            </div>}
          </div>
          <button onClick={()=>sDelJId(j.id)} aria-label="Remover" style={{background:"none",border:"none",color:"#E74C3C40",cursor:"pointer",padding:4,flexShrink:0}}>🗑️</button>
        </div>
      </G>;
    }):<div style={{textAlign:"center",padding:16,color:K.txM,fontSize:11}}>Nenhum jornalista cadastrado</div>}
    <p style={{fontSize:10,color:K.txD,marginTop:10}}>🎤 Jornalistas entrevistam jogadores destaque após cada partida — perguntas geradas por IA.</p>
    <ConfirmDialog open={!!delComId} onCancel={()=>sDelComId(null)} onConfirm={()=>{up({commentators:S.commentators.filter(x=>x.id!==delComId)});sDelComId(null);}} title="Remover?" message={`"${S.commentators.find(c=>c.id===delComId)?.name||""}" será removido da equipe de transmissão.`} confirmLabel="REMOVER" icon="🎙️"/>
    <ConfirmDialog open={!!delJId} onCancel={()=>sDelJId(null)} onConfirm={()=>{up({journalists:(S.journalists||[]).filter(x=>x.id!==delJId)});sDelJId(null);}} title="Remover Jornalista?" message={`"${(S.journalists||[]).find(j=>j.id===delJId)?.name||""}" será removido.`} confirmLabel="REMOVER" icon="🎤"/>
  </div>;
}

/* ══════════ TEAMS ══════════ */
function Teams({S,up,go}){
  const[num,sNum]=useState(S.teams.length||2);const[mode,sMode]=useState("manual");const[stars,sSt]=useState([]);const[aTo,sATo]=useState(null);const[eTid,sETid]=useState(null);
  const{players:pl,teams:tm}=S;const asgn=tm.flatMap(t=>t.playerIds);const free=pl.filter(p=>!asgn.includes(p.id));const lgR=useRef(null);
  const create=()=>{const nt=[];for(let i=0;i<num;i++){const ex=tm[i];nt.push({id:ex?.id||uid(),name:ex?.name||`Time ${i+1}`,color:TC[i%TC.length],playerIds:ex?.playerIds||[],logo:ex?.logo||null});}up({teams:nt.slice(0,num)});};
  const draft=()=>{const s=shuf(pl.map(p=>p.id));const nt=tm.map(t=>({...t,playerIds:[]}));s.forEach((p,i)=>nt[i%nt.length].playerIds.push(p));up({teams:nt});};
  const selDraft=()=>{if(!stars.length)return;const nt=tm.map(t=>({...t,playerIds:[]}));shuf(stars).forEach((p,i)=>nt[i%nt.length].playerIds.push(p));shuf(pl.filter(p=>!stars.includes(p.id)).map(p=>p.id)).forEach(p=>{[...nt].sort((a,b)=>a.playerIds.length-b.playerIds.length)[0].playerIds.push(p);});up({teams:nt});sSt([]);};
  const ratDraft=()=>{const getR=(x)=>getPlayerStarRating(x.id,S.matchStarRatings)??x.rating??0;const sorted=[...pl].sort((a,b)=>getR(b)-getR(a));const tc=Math.min(tm.length,sorted.filter(p=>getR(p)>=4).length)||tm.length;const top=sorted.slice(0,tc).map(p=>p.id);const nt=tm.map(t=>({...t,playerIds:[]}));shuf(top).forEach((p,i)=>nt[i%nt.length].playerIds.push(p));shuf(sorted.filter(p=>!top.includes(p.id)).map(p=>p.id)).forEach(p=>{[...nt].sort((a,b)=>a.playerIds.length-b.playerIds.length)[0].playerIds.push(p);});up({teams:nt});};
  const uT=(id,u)=>up({teams:tm.map(t=>t.id===id?{...t,...u}:t)});
  const hLg=async(tid,e)=>{const f=e.target.files?.[0];if(f){const r=new FileReader();r.onload=async ev=>{const compressed=await compressPhoto(ev.target.result,150,0.7);uT(tid,{logo:compressed});};r.readAsDataURL(f);}};
  const addTo=(pid,tid)=>{up({teams:tm.map(t=>({...t,playerIds:t.id===tid?[...t.playerIds,pid]:t.playerIds.filter(x=>x!==pid)}))});sATo(null);};
  const remFrom=(pid,tid)=>up({teams:tm.map(t=>t.id===tid?{...t,playerIds:t.playerIds.filter(x=>x!==pid)}:t)});
  const et=tm.find(t=>t.id===eTid);

  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")} crumb="TIMES"/><SH icon="🛡️" title="TIMES" sub={`${pl.length} jogadores · ${free.length} disponíveis`} color={K.accL}/>
    <G style={{marginBottom:14,padding:18}}><LB>QUANTIDADE</LB><div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>{[2,3,4,5,6,7,8,9,10,11,12].map(n=><button key={n} onClick={()=>sNum(n)} style={{width:40,height:40,borderRadius:9,fontWeight:800,fontSize:15,fontFamily:fC,border:`1px solid ${num===n?K.gold:K.bd}`,cursor:"pointer",background:num===n?K.gold+"12":"transparent",color:num===n?K.gold:K.txD,transition:"all 0.2s"}}>{n}</button>)}<BT onClick={create} style={{marginLeft:"auto"}}>{tm.length?"ATUALIZAR":"CRIAR"}</BT></div></G>
    {tm.length>0&&<><G style={{marginBottom:16,padding:18}}>
      <LB>DISTRIBUIÇÃO</LB>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>{[{id:"manual",l:"✋ MANUAL"},{id:"random",l:"🎲 SORTEIO"},{id:"selective",l:"⭐ SELETIVO"},{id:"rating",l:"📊 POR NOTA"}].map(m=><button key={m.id} onClick={()=>sMode(m.id)} style={{padding:"9px 16px",borderRadius:9,fontWeight:700,fontSize:11,fontFamily:fC,letterSpacing:"0.06em",border:`1px solid ${mode===m.id?K.gold:K.bd}`,cursor:"pointer",background:mode===m.id?K.gold+"0D":"transparent",color:mode===m.id?K.gold:K.txD,transition:"all 0.2s"}}>{m.l}</button>)}</div>
      {mode==="random"&&<div style={{display:"flex",gap:8}}><BT onClick={draft}>🎲 SORTEAR</BT><BT onClick={draft} v="acc">🔄 NOVAMENTE</BT></div>}
      {mode==="selective"&&<div><p style={{fontSize:12,color:K.txD,marginBottom:10}}>Craques que <strong style={{color:K.gold}}>NÃO ficam juntos</strong>:</p><div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>{pl.map(p=>{const on=stars.includes(p.id);return <button key={p.id} onClick={()=>sSt(s=>on?s.filter(x=>x!==p.id):[...s,p.id])} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${on?K.gold:K.bd}`,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:ff,background:on?K.gold+"0D":"transparent",color:on?K.gold:K.txD}}>{on&&"⭐ "}{p.number?`${p.number} `:""}{p.nickname||p.name}</button>;})}</div><div style={{display:"flex",gap:8}}><BT onClick={selDraft} disabled={!stars.length}>⭐ SORTEAR</BT><BT onClick={selDraft} v="acc" disabled={!stars.length}>🔄 NOVAMENTE</BT></div></div>}
      {mode==="rating"&&<div><p style={{fontSize:12,color:K.txD,marginBottom:10}}>Equilibra times usando nota do admin:</p><div style={{display:"flex",gap:8}}><BT onClick={ratDraft} v="acc">📊 POR NOTA</BT><BT onClick={ratDraft}>🔄 NOVAMENTE</BT></div></div>}
    </G>
    <Modal open={!!eTid} onClose={()=>sETid(null)} title="EDITAR TIME">{et&&<div><div style={{marginBottom:10}}><LB>NOME</LB><IN value={et.name} onChange={e=>uT(et.id,{name:e.target.value})}/></div><div style={{marginBottom:12}}><LB>ESCUDO</LB><div style={{display:"flex",alignItems:"center",gap:10}}><input ref={lgR} type="file" accept="image/*" onChange={e=>hLg(et.id,e)} style={{display:"none"}}/><BT onClick={()=>lgR.current?.click()} v="gh" style={{fontSize:11}}>📷 {et.logo?"TROCAR":"ADICIONAR"}</BT>{et.logo&&<><img src={et.logo} alt="" style={{width:40,height:40,borderRadius:10,objectFit:"cover"}}/><button onClick={()=>uT(et.id,{logo:null})} style={{background:"none",border:"none",color:"#E74C3C55",cursor:"pointer",fontSize:11}}>Remover</button></>}</div></div><BT onClick={()=>sETid(null)}>✓ FEITO</BT></div>}</Modal>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:12}}>{tm.map(team=>{const lid=`lg-${team.id}`;return <div key={team.id} style={{background:K.sf,borderRadius:14,overflow:"hidden",border:`1px solid ${K.bd}`,backdropFilter:"blur(12px)"}}>
      <div style={{padding:"10px 14px",background:`linear-gradient(135deg,${team.color.bg},${team.color.bg}cc)`,display:"flex",alignItems:"center",gap:8,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <input id={lid} type="file" accept="image/*" onChange={e=>hLg(team.id,e)} style={{display:"none"}}/><label htmlFor={lid} style={{cursor:"pointer",flexShrink:0}}>{team.logo?<img src={team.logo} alt="" style={{width:30,height:30,borderRadius:8,objectFit:"cover",border:"2px solid rgba(255,255,255,0.2)"}}/>:<div style={{width:30,height:30,borderRadius:8,border:"2px dashed rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.35)",fontSize:12}}>📷</div>}</label>
        <input value={team.name} onChange={e=>uT(team.id,{name:e.target.value})} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:7,padding:"5px 10px",color:team.color.t,fontWeight:800,fontSize:14,fontFamily:fC,flex:1,outline:"none"}}/>
        <span style={{background:"rgba(255,255,255,0.12)",borderRadius:7,padding:"3px 9px",fontWeight:800,fontSize:12,color:team.color.t,fontFamily:fC}}>{team.playerIds.length}</span>
        <button onClick={()=>sETid(team.id)} aria-label="Editar time" style={{background:"none",border:"none",color:"rgba(255,255,255,0.45)",cursor:"pointer",padding:2,fontSize:12}}>✏️</button>
      </div>
      <div style={{padding:8,minHeight:42}}>{team.playerIds.map(pid=>{const p=pl.find(x=>x.id===pid);if(!p)return null;return <div key={pid} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,marginBottom:3,background:K.row}}>
        <div style={{width:24,height:24,borderRadius:6,overflow:"hidden",background:team.color.bg+"12",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{p.photo?<img src={p.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:10,fontWeight:800,color:team.color.bg,fontFamily:fC}}>{(p.nickname||p.name)[0]}</span>}</div>
        {p.number&&<span style={{fontSize:10,fontWeight:800,color:team.color.bg,fontFamily:fC}}>{p.number}</span>}<span style={{fontSize:12,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.nickname||p.name}</span><button onClick={()=>remFrom(pid,team.id)} aria-label="Remover do time" style={{background:"none",border:"none",color:K.txM,cursor:"pointer",padding:1,fontSize:10}}>✕</button></div>;})}
        {mode==="manual"&&free.length>0&&(aTo===team.id?<div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>{free.map(p=><button key={p.id} onClick={()=>addTo(p.id,team.id)} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${K.bd}`,background:K.inp,color:K.txD,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:ff}}>{p.number?`${p.number} `:""}{p.nickname||p.name}</button>)}<button onClick={()=>sATo(null)} style={{padding:"4px 10px",borderRadius:6,border:"none",background:"#E74C3C10",color:"#E74C3C",cursor:"pointer",fontSize:11}}>Cancelar</button></div>
        :<button onClick={()=>sATo(team.id)} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:7,borderRadius:7,marginTop:5,width:"100%",border:`1px dashed ${K.bd}`,background:"none",color:K.txM,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:fC}}>+ ADICIONAR</button>)}
      </div>
    </div>;})}</div></>}
  </div>;
}

/* ══════════ TOURNAMENT ══════════ */
function Tournament({S,up,go,REFEREE,STADIUM,BROADCASTERS}){
  const[fmt,sFmt]=useState(S.tournament?.format||"round-robin");const[emId,sEmId]=useState(null);const[eH,sEH]=useState(0);const[eA,sEA]=useState(0);const[eHP,sEHP]=useState(null);const[eAP,sEAP]=useState(null);
  const[confirmReset,sConfirmReset]=useState(false);
  const[confirmWipe,sConfirmWipe]=useState(false);
  const[koCount,sKoCount]=useState(S.tournament?.koCount||4);
  const{teams:tm,matches:mt}=S;
  const needsKoConfig=fmt==="two-groups"||fmt==="group-knockout"||fmt==="round-robin";
  const maxKo=Math.min(tm.length,12);
  const koOptions=[];for(let n=2;n<=maxKo;n*=2)koOptions.push(n);
  const gen=()=>{
    if(fmt==="two-groups"){const r=genTwoGroups(tm.map(t=>t.id));up({matches:r.matches,tournament:{format:fmt,started:true,groups:r.groups,koCount,koGenerated:false}});}
    else if(fmt==="group-knockout"){const r=genTwoGroups(tm.map(t=>t.id));up({matches:r.matches,tournament:{format:fmt,started:true,groups:r.groups,koCount,koGenerated:false}});}
    else if(fmt==="round-robin"){let m=genRR(tm.map(t=>t.id));up({matches:m,tournament:{format:fmt,started:true,koCount,koGenerated:false}});}
    else{let m=genKO(tm.map(t=>t.id));up({matches:m,tournament:{format:fmt,started:true}});}
  };
  // Generate knockout from standings
  const canGenKO=S.tournament?.started&&!S.tournament?.koGenerated&&fmt!=="knockout"&&S.tournament?.koCount>0&&mt.filter(m=>m.phase==="group").every(m=>m.played);
  const genKOFromStandings=()=>{
    const tr=S.tournament;const kc=tr.koCount||4;
    let qualifiedIds=[];
    if(tr.groups){
      // 2 groups: take top N/2 from each group
      const perGroup=Math.ceil(kc/2);
      ["A","B"].forEach(g=>{
        const gTeams=tr.groups[g].map(id=>tm.find(t=>t.id===id)).filter(Boolean);
        const gMatches=mt.filter(m=>m.groupLabel===g&&m.played);
        const sorted=gTeams.map(team=>{const ms=gMatches.filter(m=>m.homeTeamId===team.id||m.awayTeamId===team.id);let gf=0,ga=0,w=0,d=0;ms.forEach(m=>{const isH=m.homeTeamId===team.id;const s=isH?m.homeScore:m.awayScore;const c=isH?m.awayScore:m.homeScore;gf+=s;ga+=c;if(s>c)w++;else if(s===c)d++;});return{id:team.id,pts:w*3+d,gd:gf-ga,gf};}).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf);
        qualifiedIds.push(...sorted.slice(0,perGroup).map(t=>t.id));
      });
    } else {
      // Round-robin: take top N overall
      const sorted=tm.map(team=>{const ms=mt.filter(m=>m.played&&(m.homeTeamId===team.id||m.awayTeamId===team.id));let gf=0,ga=0,w=0,d=0;ms.forEach(m=>{const isH=m.homeTeamId===team.id;const s=isH?m.homeScore:m.awayScore;const c=isH?m.awayScore:m.homeScore;gf+=s;ga+=c;if(s>c)w++;else if(s===c)d++;});return{id:team.id,pts:w*3+d,gd:gf-ga,gf};}).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf);
      qualifiedIds=sorted.slice(0,kc).map(t=>t.id);
    }
    // Cross seeding: 1st of A vs last qualified of B, etc.
    const koMatches=[];
    if(tr.groups){
      const aQ=qualifiedIds.filter(id=>tr.groups.A.includes(id));
      const bQ=qualifiedIds.filter(id=>tr.groups.B.includes(id));
      for(let i=0;i<Math.min(aQ.length,bQ.length);i++)koMatches.push(mk(1,"knockout",aQ[i],bQ[bQ.length-1-i]));
    } else {
      for(let i=0;i<Math.floor(qualifiedIds.length/2);i++)koMatches.push(mk(1,"knockout",qualifiedIds[i],qualifiedIds[qualifiedIds.length-1-i]));
    }
    up({matches:[...mt,...koMatches],tournament:{...tr,koGenerated:true}});
  };
  const gt=id=>tm.find(t=>t.id===id);
  const gr=()=>{const r={};mt.forEach(m=>{const gl=m.groupLabel?` — GRUPO ${m.groupLabel}`:"";const k=m.phase==="knockout"?`MATA-MATA — R${m.round}`:`RODADA ${m.round}${gl}`;if(!r[k])r[k]=[];r[k].push(m);});return r;};
  const oe=m=>{sEmId(m.id);sEH(m.homeScore||0);sEA(m.awayScore||0);sEHP(m.hPen);sEAP(m.aPen);};
  const se=()=>{up({matches:mt.map(m=>m.id===emId?{...m,homeScore:eH,awayScore:eA,played:true,hPen:eHP,aPen:eAP}:m)});sEmId(null);};
  const rm=()=>{up({matches:mt.map(m=>m.id===emId?{...m,homeScore:null,awayScore:null,played:false,goals:[],hPen:null,aPen:null}:m)});sEmId(null);};
  const em=mt.find(m=>m.id===emId);

  const getKOWinnerId=(m)=>{
    if(!m?.played)return null;
    const hs=m.homeScore,as=m.awayScore;
    if(hs==null||as==null)return null;
    if(hs>as)return m.homeTeamId;
    if(as>hs)return m.awayTeamId;
    if(m.hPen!=null&&m.aPen!=null){
      if(m.hPen>m.aPen)return m.homeTeamId;
      if(m.aPen>m.hPen)return m.awayTeamId;
    }
    return null;
  };
  const koAll=mt.filter(m=>m.phase==="knockout");
  const lastKORound=koAll.length?Math.max(...koAll.map(m=>m.round||1)):null;
  const lastKOMatches=lastKORound==null?[]:koAll.filter(m=>m.round===lastKORound);
  const koWinnersRaw=lastKOMatches.map(getKOWinnerId);
  const canGenNextKO=lastKOMatches.length>1&&lastKOMatches.every(m=>m.played)&&koWinnersRaw.every(Boolean)&&koWinnersRaw.length>=2&&koWinnersRaw.length%2===0;
  const genNextKORound=()=>{
    if(!canGenNextKO)return;
    const winners=koWinnersRaw;
    const nextRound=(lastKORound||1)+1;
    const nm=[];
    for(let i=0;i<winners.length;i+=2)nm.push(mk(nextRound,"knockout",winners[i],winners[i+1]));
    up({matches:[...mt,...nm]});
  };

  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")} crumb="CAMPEONATO"/><SH icon="🏆" title="CAMPEONATO" color={K.gBr}/>
    {/* Data de início do torneio — pré-torneio countdown para atletas */}
    <G style={{marginTop:14,marginBottom:14,padding:16}}>
      <LB>DATA DE INÍCIO DO TORNEIO</LB>
      <p style={{fontSize:11,color:K.txD,marginBottom:10}}>Os atletas veem um countdown no app até essa data. Deixe em branco para usar 7 dias à frente.</p>
      <input type="date" value={S.tournamentStartAt?S.tournamentStartAt.slice(0,10):""} onChange={e=>up({tournamentStartAt:e.target.value?new Date(e.target.value).toISOString():null})} style={{padding:"10px 14px",borderRadius:9,border:`1px solid ${K.bd}`,background:K.inp,color:K.tx,fontSize:14,fontFamily:ff,width:"100%",maxWidth:260,boxSizing:"border-box"}}/>
    </G>
    {tm.length<2?<G style={{textAlign:"center",padding:36,marginTop:14}}><p style={{color:K.txD}}>Crie pelo menos 2 times.</p><BT onClick={()=>go("teams")} v="acc" style={{marginTop:14}}>MONTAR TIMES</BT></G>:!mt.length?<G style={{marginTop:14,padding:22}}>
      <LB>FORMATO</LB><div style={{display:"grid",gap:8,marginBottom:22}}>{[{id:"round-robin",l:"TODOS CONTRA TODOS",d:"Pontos corridos + mata-mata",ic:"🔄"},{id:"knockout",l:"MATA-MATA",d:"Eliminação direta · empate = pênaltis",ic:"⚔️"},{id:"two-groups",l:"2 GRUPOS",d:"Fase de grupos A e B + mata-mata",ic:"🏟️"},{id:"group-knockout",l:"GRUPOS + MATA-MATA",d:"2 grupos + eliminação cruzada",ic:"⚔️🏟️"}].map(f=><G key={f.id} hover style={{cursor:"pointer",padding:"14px 16px",border:`1px solid ${fmt===f.id?K.gold+"35":K.bd}`}} onClick={()=>sFmt(f.id)}><div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:28}}>{f.ic}</span><div><div style={{fontFamily:fC,fontWeight:700,fontSize:14,color:fmt===f.id?K.gold:K.tx}}>{f.l}</div><div style={{fontSize:12,color:K.txD}}>{f.d}</div></div></div></G>)}</div>
      {/* Knockout advancement selector */}
      {needsKoConfig&&fmt!=="knockout"&&koOptions.length>0&&<div style={{marginBottom:18}}>
        <LB>QUANTOS TIMES VÃO AO MATA-MATA?</LB>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {koOptions.map(n=><button key={n} onClick={()=>sKoCount(n)} style={{padding:"8px 18px",borderRadius:8,fontFamily:fC,fontWeight:700,fontSize:14,border:`1px solid ${koCount===n?K.gold+"50":K.bd}`,background:koCount===n?K.gold+"12":"transparent",color:koCount===n?K.gold:K.txD,cursor:"pointer"}}>{n} times</button>)}
        </div>
        <p style={{fontSize:10,color:K.txD,marginTop:6}}>{fmt==="two-groups"||fmt==="group-knockout"?`Top ${Math.ceil(koCount/2)} de cada grupo avançam`:`Top ${koCount} da classificação avançam`} → mata-mata com cruzamento</p>
      </div>}
      <BT onClick={gen}>▶ GERAR TABELA</BT>
    </G>:<div style={{marginTop:14}}>
      <div style={{marginBottom:14,display:"flex",gap:8,flexWrap:"wrap"}}>
        <BT onClick={()=>sConfirmReset(true)} v="red" style={{fontSize:11,padding:"8px 16px"}}>RESETAR</BT>
        <BT onClick={()=>sConfirmWipe(true)} v="gh" style={{fontSize:11,padding:"8px 16px"}}>🆕 NOVO CAMPEONATO</BT>
      </div>
      <ConfirmDialog open={confirmReset} onCancel={()=>sConfirmReset(false)} onConfirm={()=>{up({matches:[],tournament:null});sConfirmReset(false);}} title="Resetar Campeonato?" message="Todas as partidas, placares e gols serão perdidos. Essa ação não pode ser desfeita." confirmLabel="RESETAR TUDO" icon="🗑️"/>
      <ConfirmDialog open={confirmWipe} onCancel={()=>sConfirmWipe(false)} onConfirm={()=>{up({tournament:null,matches:[],currentMatch:null,teams:[],votes:{},bets:{},panjangoVotes:{},matchStarRatings:{}});sConfirmWipe(false);}} title="Criar novo campeonato?" message="Isso apaga o campeonato atual E os times (equipes). Os atletas cadastrados serão mantidos." confirmLabel="CRIAR NOVO" icon="🆕"/>
      {/* Generate knockout phase when group stage is complete */}
      {canGenKO&&<G style={{marginBottom:16,padding:16,border:`1px solid ${K.grn}25`,background:K.grn+"06",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:8}}>✅</div>
        <div style={{fontFamily:fC,fontWeight:700,fontSize:13,color:K.grn,letterSpacing:"0.06em",marginBottom:4}}>FASE DE GRUPOS CONCLUÍDA!</div>
        <p style={{fontSize:11,color:K.txD,marginBottom:12}}>Top {S.tournament?.groups?Math.ceil((S.tournament.koCount||4)/2)+" de cada grupo":(S.tournament.koCount||4)+" da classificação"} avançam ao mata-mata com cruzamento.</p>
        <BT onClick={genKOFromStandings} v="grn" style={{fontSize:13,padding:"12px 28px"}}>⚔️ GERAR MATA-MATA</BT>
      </G>}
      {koAll.length>0&&lastKOMatches.length>1&&<G style={{marginBottom:16,padding:16,border:`1px solid ${K.gold}22`,background:K.gold+"06",textAlign:"center"}}>
        <div style={{fontSize:26,marginBottom:8}}>{koWinnersRaw.length===2?"🏆":"⚔️"}</div>
        <div style={{fontFamily:fC,fontWeight:700,fontSize:13,color:K.gold,letterSpacing:"0.06em",marginBottom:6}}>{koWinnersRaw.length===2?"PRONTO PARA A FINAL":"PRONTO PARA A PRÓXIMA FASE"}</div>
        <p style={{fontSize:11,color:K.txD,marginBottom:12}}>Quando todos os jogos desta fase estiverem concluídos (e, em empate, com pênaltis), gere a próxima rodada do mata-mata.</p>
        <BT onClick={genNextKORound} v="gold" disabled={!canGenNextKO} style={{fontSize:13,padding:"12px 28px",opacity:canGenNextKO?1:0.55,cursor:canGenNextKO?"pointer":"default"}}>
          {koWinnersRaw.length===2?"🏆 GERAR FINAL":"⚔️ GERAR PRÓXIMA FASE"}
        </BT>
      </G>}
      <Modal open={!!emId} onClose={()=>sEmId(null)} title="EDITAR RESULTADO">{em&&(()=>{const h=gt(em.homeTeamId),a=gt(em.awayTeamId);const ko=em.phase==="knockout",tied=eH===eA;return <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:16}}><div style={{textAlign:"center"}}><Badge team={h} size={36}/><div style={{fontSize:12,fontWeight:700,fontFamily:fC,marginTop:4}}>{h?.name}</div></div><div style={{display:"flex",alignItems:"center",gap:8}}><IN type="number" min="0" value={eH} onChange={e=>sEH(Math.max(0,+e.target.value))} style={{width:58,textAlign:"center",fontSize:22,fontWeight:900,fontFamily:fH,padding:"8px"}}/><span style={{color:K.gDm,fontWeight:800,fontFamily:fH,fontSize:18}}>×</span><IN type="number" min="0" value={eA} onChange={e=>sEA(Math.max(0,+e.target.value))} style={{width:58,textAlign:"center",fontSize:22,fontWeight:900,fontFamily:fH,padding:"8px"}}/></div><div style={{textAlign:"center"}}><Badge team={a} size={36}/><div style={{fontSize:12,fontWeight:700,fontFamily:fC,marginTop:4}}>{a?.name}</div></div></div>
        {ko&&tied&&<G style={{marginBottom:14,padding:14,border:`1px solid ${K.gold}20`}}><div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:K.gold,marginBottom:10,letterSpacing:"0.06em"}}>⚽ PÊNALTIS</div><div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12}}><div style={{textAlign:"center"}}><div style={{fontSize:10,color:K.txD,marginBottom:4}}>{h?.name}</div><IN type="number" min="0" value={eHP??""} onChange={e=>sEHP(Math.max(0,+e.target.value))} style={{width:54,textAlign:"center",fontSize:18,fontWeight:900,fontFamily:fH,padding:"7px"}}/></div><span style={{color:K.gDm,fontWeight:800}}>×</span><div style={{textAlign:"center"}}><div style={{fontSize:10,color:K.txD,marginBottom:4}}>{a?.name}</div><IN type="number" min="0" value={eAP??""} onChange={e=>sEAP(Math.max(0,+e.target.value))} style={{width:54,textAlign:"center",fontSize:18,fontWeight:900,fontFamily:fH,padding:"7px"}}/></div></div></G>}
        <div style={{display:"flex",gap:8}}><BT onClick={se}>✓ SALVAR</BT><BT onClick={rm} v="red">LIMPAR</BT></div>
      </div>;})()}</Modal>
      {Object.entries(gr()).map(([round,rm])=><div key={round} style={{marginBottom:20}}>
        <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.gold,letterSpacing:"0.1em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}><div style={{width:20,height:1,background:K.gold+"35"}}/>{round}<div style={{flex:1,height:1,background:K.gold+"12"}}/></div>
        <div style={{display:"grid",gap:7}}>{rm.map((match,mi)=>{const h=gt(match.homeTeamId),a=gt(match.awayTeamId);if(!h||!a)return null;const ko=match.phase==="knockout",tied=match.played&&match.homeScore===match.awayScore;
          const seed=match.id.charCodeAt(0)+match.id.charCodeAt(1);const numBc=seed%2===0?1:2;const bcStart=seed%(BROADCASTERS.length);const mBcs=[];for(let bi=0;bi<numBc;bi++)mBcs.push(BROADCASTERS[(bcStart+bi)%BROADCASTERS.length]);
          return <G key={match.id} style={{padding:"12px 14px"}}><div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:7}}><span style={{fontFamily:fC,fontWeight:700,fontSize:13,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</span><Badge team={h} size={26}/></div>
            {match.played?<div style={{textAlign:"center",minWidth:76}}><div style={{padding:"4px 14px",borderRadius:8,background:K.gold+"08",border:`1px solid ${K.gold}12`,fontFamily:fH,fontWeight:700,fontSize:18,color:K.gold}}>{match.homeScore} × {match.awayScore}</div>{ko&&tied&&match.hPen!=null&&<div style={{fontFamily:fC,fontSize:10,color:K.gold,fontWeight:700,marginTop:3}}>PÊN: {match.hPen}×{match.aPen}</div>}</div>:<BT onClick={()=>go("match",{currentMatch:match.id})} v="grn" style={{padding:"7px 16px",fontSize:11}}>▶ JOGAR</BT>}
            <div style={{flex:1,display:"flex",alignItems:"center",gap:7}}><Badge team={a} size={26}/><span style={{fontFamily:fC,fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</span></div>
            <button onClick={()=>oe(match)} aria-label="Editar resultado" style={{background:"none",border:"none",color:K.txM,cursor:"pointer",padding:3,fontSize:12}}>✏️</button>
          </div>
          {/* Schedule + metadata */}
          <div style={{display:"flex",gap:8,marginTop:6,paddingLeft:4,flexWrap:"wrap",alignItems:"center"}}>
            <input type="time" value={match.scheduledTime||""} onChange={e=>up({matches:mt.map(m=>m.id===match.id?{...m,scheduledTime:e.target.value}:m)})} style={{background:K.inp,border:`1px solid ${K.bd}`,borderRadius:6,padding:"2px 8px",color:match.scheduledTime?K.gold:K.txM,fontSize:11,fontWeight:700,fontFamily:fC,width:75,cursor:"pointer"}} aria-label="Horário do jogo"/>
            <span style={{fontSize:10,color:"#0EA5E970"}}>🏟️ {STADIUM.name}</span><span style={{fontSize:10,color:"#F43F5E70"}}>🟨 {REFEREE.name}</span>{mBcs.map(b=><span key={b.id} style={{fontSize:10,color:b.color+"90",fontWeight:600}}>{b.icon} {b.name}</span>)}
          </div></G>;})}</div>
      </div>)}
    </div>}
  </div>;
}

/* ══════════ MATCH LIVE ══════════ */
function Match({S,up,go,REFEREE,STADIUM,BROADCASTERS}){
  const{currentMatch:cm,matches:mt,teams:tm,players:pl,commentators:ct,geminiKey:gk}=S;const match=mt.find(m=>m.id===cm);
  const[clk,sClk]=useState(0);const[run,sRun]=useState(false);const[goals,sGoals]=useState(match?.goals||[]);const[showPen,sSP]=useState(false);const[hPen,sHP]=useState(0);const[aPen,sAP]=useState(0);
  const[chatMsgs,sChatMsgs]=useState([]);const[aiL,sAiL]=useState(false);
  const[showConfetti,sShowConfetti]=useState(false);const[showGoalFlash,sShowGoalFlash]=useState(false);
  const[showDramaPen,sShowDramaPen]=useState(false);
  const[matchTab,sMatchTab]=useState("score");
  const[showEntrance,sShowEntrance]=useState(true); // #18 entrance animation
  const[assistCtx,sAssistCtx]=useState(null); // {goalId, teamId, scorerId}
  const chatRef=useRef(null);const chatTimer=useRef(null);
  const didAutoStartChatRef=useRef(false);
  // Fix #3: Absolute-time-based timer (survives background tabs)
  const startTimeRef=useRef(null);const elapsedBeforePause=useRef(0);const timerRef=useRef(null);
  useEffect(()=>{
    if(run){
      startTimeRef.current=Date.now();
      timerRef.current=setInterval(()=>{
        const elapsed=elapsedBeforePause.current+Math.floor((Date.now()-startTimeRef.current)/1000);
        sClk(elapsed);
      },250); // 4x/sec for accuracy
    }else{
      if(startTimeRef.current)elapsedBeforePause.current+=Math.floor((Date.now()-startTimeRef.current)/1000);
      clearInterval(timerRef.current);
    }
    return()=>clearInterval(timerRef.current);
  },[run]);
  // Auto-draw crew: 1 narrator + 2 analysts + 1-2 broadcasters
  const[crew]=useState(()=>{
    const narrators=ct.filter(c=>c.type==="narrator");
    const analysts=ct.filter(c=>c.type==="analyst");
    const nar=narrators.length?narrators[Math.floor(Math.random()*narrators.length)]:null;
    const shufA=shuf(analysts);
    const an1=shufA[0]||null;const an2=shufA[1]||null;
    const numBc=Math.random()<0.5?1:2;
    const shufB=shuf(BROADCASTERS||[]);
    const bcs=shufB.slice(0,numBc);
    return{narrator:nar,analyst1:an1,analyst2:an2,broadcasters:bcs};
  });
  const ht=tm.find(t=>t.id===match?.homeTeamId),at=tm.find(t=>t.id===match?.awayTeamId);
  // Auto-scroll chat
  useEffect(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight;},[chatMsgs]);
  // Auto-generate chat every ~25s when running
  const goalsRef=useRef(goals);goalsRef.current=goals;
  const clkRef=useRef(clk);clkRef.current=clk;
  const chatMsgsRef=useRef(chatMsgs);chatMsgsRef.current=chatMsgs;
  useEffect(()=>{
    if(run&&gk&&crew.narrator){
      chatTimer.current=setInterval(()=>genChat("auto"),22000+Math.random()*8000);
      return()=>clearInterval(chatTimer.current);
    }else{clearInterval(chatTimer.current);}
  },[run,gk]);

  useEffect(()=>{
    if(didAutoStartChatRef.current)return;
    if(matchTab!=="chat")return;
    if(!run)return;
    if(!gk||!crew.narrator)return;
    if(aiL)return;
    if(chatMsgs.length!==0)return;
    didAutoStartChatRef.current=true;
    setTimeout(()=>genChat("start"),250);
  },[matchTab,run,gk,crew?.narrator,aiL,chatMsgs.length]);

  if(!match||!ht||!at)return <div style={{paddingTop:20}}><BB onClick={()=>go("tournament")} crumb="PARTIDA AO VIVO"/></div>;
  // #18 Team Entrance Animation
  if(showEntrance&&!run&&clk===0&&goals.length===0)return <TeamEntrance S={S} match={match} onStart={()=>{sShowEntrance(false);handlePlay();}}/>;
  const hg=goals.filter(g=>g.teamId===ht.id).length,ag=goals.filter(g=>g.teamId===at.id).length;
  const fm=s=>`${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  const ko=match.phase==="knockout",tied=hg===ag;
  const addG=(pid,tid,opts)=>{
    const o=opts||{};
    const goal={id:uid(),playerId:pid,teamId:tid,minute:Math.floor(clk/60),second:clk,ownGoal:!!o.ownGoal,assistPlayerId:o.assistPlayerId??null};
    sGoals(prev=>[...prev,goal]);
    if(!goal.ownGoal)sAssistCtx({goalId:goal.id,teamId:tid,scorerId:pid});
    // Confetti + flash
    sShowConfetti(true);sShowGoalFlash(true);try{SFX.goal();}catch(e){}
    setTimeout(()=>sShowConfetti(false),3500);
    setTimeout(()=>sShowGoalFlash(false),1500);
    // Trigger goal reaction
    if(gk&&crew.narrator)setTimeout(()=>genChat("goal"),800);
    // #15 Notify other tabs
    const bc=getBroadcastChannel();if(bc)bc.postMessage({type:"goal",player:(pl.find(p=>p.id===pid)?.nickname||pl.find(p=>p.id===pid)?.name)+(goal.ownGoal?" (GC)":"") ,team:tm.find(t=>t.id===tid)?.name,ts:Date.now()});
  };
  const finish=()=>{sRun(false);clearInterval(chatTimer.current);try{SFX.end();}catch(e){}if(ko&&tied&&!showPen){sShowDramaPen(true);return;}up({matches:mt.map(m=>m.id===match.id?{...m,homeScore:hg,awayScore:ag,goals,played:true,hPen:ko&&tied?hPen:null,aPen:ko&&tied?aPen:null}:m),currentMatch:null});go("tournament");};
  const gtp=t=>t.playerIds.map(pid=>pl.find(p=>p.id===pid)).filter(Boolean);
  const applyAssist=(assistPlayerId)=>{
    if(!assistCtx?.goalId){sAssistCtx(null);return;}
    sGoals(prev=>prev.map(g=>g.id===assistCtx.goalId?{...g,assistPlayerId:assistPlayerId??null}:g));
    sAssistCtx(null);
  };

  // Colors for crew
  const crewColors={narrator:"#E8CE8B",analyst1:"#8B5CF6",analyst2:"#0EA5E9"};

  const genChat=async(trigger)=>{
    if(!gk||!crew.narrator||aiL)return;
    sAiL(true);
    const curGoals=goalsRef.current;
    const curClk=clkRef.current;
    const prevMsgs=chatMsgsRef.current;
    const hgN=curGoals.filter(g=>g.teamId===ht.id).length;
    const agN=curGoals.filter(g=>g.teamId===at.id).length;
    const gl=curGoals.map(g=>{const p=pl.find(x=>x.id===g.playerId);return`${g.minute}' ${p?.nickname||p?.name}${p?.number?" (nº"+p.number+")":""}${g.ownGoal?" (GC)":""} (${tm.find(t=>t.id===g.teamId)?.name})`;}).join("; ");
    const lastGoal=curGoals.length?curGoals[curGoals.length-1]:null;
    const lastScorer=lastGoal?pl.find(x=>x.id===lastGoal.playerId):null;
    const lastTeam=lastGoal?tm.find(t=>t.id===lastGoal.teamId):null;
    const recentChat=prevMsgs.slice(-6).map(m=>`${m.name}: ${m.text}`).join("\n");
    // Build player roster for context
    const roster=(team)=>{const pls=team.playerIds.map(pid=>pl.find(p=>p.id===pid)).filter(Boolean);return pls.map(p=>`${p.nickname||p.name}${p.number?" nº"+p.number:""}${p.position?" ("+p.position+")":""}`).join(", ");};
    const bcNames=crew.broadcasters.map(b=>b.name).join(" e ");
    const prompt=`Você está numa transmissão AO VIVO de FUTEBOL DE SABÃO (futebol jogado em campo ensaboado, escorregadio, hilário e caótico). A zueira é TOTAL.

EMISSORA(S): ${bcNames}

EQUIPE DE TRANSMISSÃO (cada um fala UMA frase):
1. NARRADOR: ${crew.narrator.name} — ${crew.narrator.style}
${crew.analyst1?`2. COMENTARISTA: ${crew.analyst1.name} — ${crew.analyst1.style}`:""}
${crew.analyst2?`3. COMENTARISTA: ${crew.analyst2.name} — ${crew.analyst2.style}`:""}

JOGO: ${ht.name} ${hgN} × ${agN} ${at.name}
MINUTO: ${Math.floor(curClk/60)}'
ESTÁDIO: ${STADIUM.name} (${STADIUM.location})
ÁRBITRO: ${REFEREE.name} — ${REFEREE.bio}

ESCALAÇÃO ${ht.name}: ${roster(ht)}
ESCALAÇÃO ${at.name}: ${roster(at)}
${gl?"GOLS ATÉ AGORA: "+gl:"Sem gols até agora."}
${trigger==="goal"&&lastScorer?`⚽ ACABOU DE SAIR GOL! ${lastScorer.nickname||lastScorer.name}${lastScorer.number?" (camisa "+lastScorer.number+")":""} marcou para o ${lastTeam?.name}! REAJAM!`:""}
${trigger==="start"?`A PARTIDA ESTÁ COMEÇANDO na ${bcNames}! Façam a abertura empolgante, citem os times, jogadores e o árbitro ${REFEREE.name}.`:""}
${trigger==="end"?"A PARTIDA ACABOU! Façam o encerramento, citem o placar final e destaques.":""}

${recentChat?"ÚLTIMAS FALAS (continue a conversa):\n"+recentChat:""}

REGRAS OBRIGATÓRIAS:
- Cada pessoa fala UMA frase (máx 25 palavras), no seu estilo único
- CITE NOMES dos jogadores pelo apelido ou número da camisa, cite o árbitro ${REFEREE.name} e a emissora ${bcNames}
- ${trigger==="goal"?"TODOS reagem ao gol — o narrador GRITA, os comentaristas analisam/debatem":"Faça comentários sobre o que está acontecendo, cite jogadores específicos"}
- ZUEIRA MÁXIMA: os comentaristas BRIGAM entre si, discordam pesadamente, provocam, interrompem, zoam um ao outro
- Podem INVENTAR histórias ao vivo sobre os jogadores ("Fonte me disse que...", "Eu soube nos bastidores que...")
- Podem criar FAKE NEWS engraçadas ao vivo ("Me dizem que o ${ht.name} treinou com sabão artesanal da Bahia")
- O narrador faz PIADAS com as quedas no sabão, escorregões, lances absurdos
- É futebol de SABÃO: escorregadio, caótico, jogadores caem, escorregam, é hilário — EXPLOREM ISSO
- Tom: mesa redonda caótica + narração empolgada de pelada + zoeira de grupo de WhatsApp
- Tudo no espírito de zueira entre amigos. Vale tudo na zoação (sem preconceito/discriminação)
- Responda APENAS no formato JSON: [{"name":"Nome","text":"fala"}]
- NÃO inclua nada fora do JSON (sem markdown, sem explicação)`;

    try{
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gk}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
      const data=await res.json();
      const raw=data?.candidates?.[0]?.content?.parts?.[0]?.text||"[]";
      const clean=raw.replace(/```json|```/g,"").trim();
      const msgs=JSON.parse(clean);
      if(Array.isArray(msgs)){
        const newMsgs=msgs.map(m=>({
          id:uid(),
          name:m.name,
          text:m.text,
          time:fm(curClk),
          role:m.name===crew.narrator?.name?"narrator":m.name===crew.analyst1?.name?"analyst1":"analyst2",
          isGoal:trigger==="goal"
        }));
        sChatMsgs(prev=>[...prev,...newMsgs]);
      }
    }catch(e){
      sChatMsgs(prev=>[...prev,{id:uid(),name:"Sistema",text:"Erro na transmissão...",time:fm(curClk),role:"system"}]);
    }
    sAiL(false);
  };

  // Trigger start commentary when play begins
  const handlePlay=()=>{
    const wasRunning=run;
    sRun(!run);
    if(!wasRunning){try{SFX.whistle();}catch(e){}} if(!wasRunning&&gk&&crew.narrator&&chatMsgs.length===0){
      setTimeout(()=>genChat("start"),500);
    }
  };

  return <div style={{paddingTop:20,paddingBottom:40}}>
    <Confetti active={showConfetti}/>
    <GoalFlash show={showGoalFlash}/>
    <BB onClick={()=>go("tournament")} crumb="PARTIDA AO VIVO"/>
    <button onClick={()=>go("tvmode")} style={{float:"right",marginTop:-30,background:K.gold+"0D",border:`1px solid ${K.gold}25`,borderRadius:8,padding:"6px 14px",color:K.gold,cursor:"pointer",fontFamily:fC,fontWeight:700,fontSize:10,letterSpacing:"0.06em"}} aria-label="Abrir modo telão">📺 TELÃO</button>

    <Modal open={!!assistCtx} onClose={()=>sAssistCtx(null)} title="ASSISTÊNCIA">{assistCtx&&(()=>{const team=tm.find(t=>t.id===assistCtx.teamId);const cand=team?team.playerIds.map(pid=>pl.find(p=>p.id===pid)).filter(p=>p&&p.id!==assistCtx.scorerId):[];return <div>
      <p style={{fontSize:12,color:K.txD,marginBottom:12}}>Quem deu a assistência?</p>
      <div style={{display:"grid",gap:6,marginBottom:12}}>
        {cand.map(p=><button key={p.id} onClick={()=>applyAssist(p.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:10,border:`1px solid ${K.bd}`,background:K.inp,color:K.tx,cursor:"pointer",textAlign:"left"}}>
          <div style={{width:28,height:28,borderRadius:9,overflow:"hidden",background:K.gold+"12",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{p.photo?<img src={p.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:fC,fontWeight:900,fontSize:12,color:K.gold}}>{(p.nickname||p.name||"?")[0]}</span>}</div>
          <span style={{fontWeight:700,fontSize:13,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.nickname||p.name}</span>
        </button>)}
      </div>
      <div style={{display:"flex",gap:8}}>
        <BT onClick={()=>applyAssist(null)} v="gh" style={{flex:1,justifyContent:"center"}}>SEM ASSISTÊNCIA</BT>
        <BT onClick={()=>sAssistCtx(null)} v="gold" style={{flex:1,justifyContent:"center"}}>FECHAR</BT>
      </div>
    </div>;})()}</Modal>

    {/* Scoreboard — always visible, compact */}
    <G style={{marginTop:12,marginBottom:12,textAlign:"center",padding:"16px 12px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${ht.color.bg},${K.gold},${at.color.bg})`}}/>
      {run&&<div style={{position:"absolute",top:10,right:12,display:"flex",alignItems:"center",gap:5}}><div style={{width:8,height:8,borderRadius:"50%",background:K.grn,animation:"lp 1.5s infinite"}}/><span style={{fontFamily:fC,fontSize:10,color:K.grn,fontWeight:700,letterSpacing:"0.1em"}}>AO VIVO</span></div>}
      <div style={{fontFamily:fH,fontSize:36,fontWeight:700,fontVariantNumeric:"tabular-nums",color:run?K.grn:K.txD,marginBottom:8,textShadow:run?"0 0 40px rgba(46,204,113,0.2)":"none",transition:"all 0.3s"}}>{fm(clk)}</div>
      <button onClick={handlePlay} style={{width:48,height:48,borderRadius:"50%",border:"none",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",background:run?"linear-gradient(135deg,#E74C3C,#C0392B)":"linear-gradient(135deg,#2ECC71,#27AE60)",color:"#fff",boxShadow:run?"0 4px 24px rgba(231,76,60,0.2)":"0 4px 24px rgba(46,204,113,0.2)",marginBottom:12}} aria-label={run?"Pausar cronômetro":"Iniciar cronômetro"}>
        {run?<svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>:<svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>}
      </button>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
        <div style={{flex:1,textAlign:"center"}}><Badge team={ht} size={40}/><div style={{fontFamily:fC,fontWeight:700,fontSize:12,marginTop:4}}>{ht.name}</div></div>
        <div style={{fontFamily:fH,fontSize:48,fontWeight:700,color:K.tx,fontVariantNumeric:"tabular-nums"}}>{hg} <span style={{color:K.txM,fontSize:24}}>×</span> {ag}</div>
        <div style={{flex:1,textAlign:"center"}}><Badge team={at} size={40}/><div style={{fontFamily:fC,fontWeight:700,fontSize:12,marginTop:4}}>{at.name}</div></div>
      </div>
    </G>

    {/* Match Tabs */}
    <div role="tablist" aria-label="Seções da partida" style={{display:"flex",gap:4,marginBottom:12}}>
      {[{id:"score",l:"⚽ GOLS",c:K.grn},{id:"goals",l:"📋 LANCE",c:K.gold},{id:"chat",l:"🎙️ CHAT",c:"#8B5CF6"}].map(t=>
        <button key={t.id} role="tab" aria-selected={matchTab===t.id} onClick={()=>sMatchTab(t.id)} style={{flex:1,padding:"10px 6px",borderRadius:10,fontFamily:fC,fontWeight:700,fontSize:11,border:`1px solid ${matchTab===t.id?t.c+"40":K.bd}`,background:matchTab===t.id?t.c+"10":"transparent",color:matchTab===t.id?t.c:K.txD,cursor:"pointer"}}>{t.l}</button>
      )}
    </div>

    {/* TAB: GOLS — Big touch-friendly goal buttons */}
    {matchTab==="score"&&<>
      {showDramaPen&&<PenaltyShootout homeTeam={ht} awayTeam={at} onFinish={(hp,ap)=>{sShowDramaPen(false);up({matches:mt.map(m=>m.id===match.id?{...m,homeScore:hg,awayScore:ag,goals,played:true,hPen:hp,aPen:ap}:m),currentMatch:null});go("tournament");}}/>}
      {showPen&&<G style={{marginBottom:14,padding:18,border:`1px solid ${K.gold}20`}}>
        <div style={{textAlign:"center",marginBottom:12}}><span style={{fontFamily:fH,fontSize:16,color:K.gold}}>⚽ PÊNALTIS</span></div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:14}}>
          <div style={{textAlign:"center"}}><Badge team={ht} size={32}/><div style={{fontFamily:fC,fontSize:11,fontWeight:700,marginTop:4}}>{ht.name}</div><IN type="number" min="0" value={hPen} onChange={e=>sHP(Math.max(0,+e.target.value))} style={{width:54,textAlign:"center",fontSize:20,fontWeight:900,fontFamily:fH,padding:"7px",marginTop:5}}/></div>
          <span style={{color:K.gDm,fontWeight:800,fontFamily:fH,fontSize:18}}>×</span>
          <div style={{textAlign:"center"}}><Badge team={at} size={32}/><div style={{fontFamily:fC,fontSize:11,fontWeight:700,marginTop:4}}>{at.name}</div><IN type="number" min="0" value={aPen} onChange={e=>sAP(Math.max(0,+e.target.value))} style={{width:54,textAlign:"center",fontSize:20,fontWeight:900,fontFamily:fH,padding:"7px",marginTop:5}}/></div>
        </div>
        <div style={{textAlign:"center"}}><BT onClick={()=>{genChat("end");finish();}}>✓ CONFIRMAR</BT></div>
      </G>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        {[ht,at].map(team=><div key={team.id}>
          <div style={{fontFamily:fC,fontSize:10,fontWeight:700,color:team.color.bg,letterSpacing:"0.08em",marginBottom:6,textAlign:"center"}}>{team.name}</div>
          <div style={{display:"grid",gap:5}}>{gtp(team).map(p=>{const pg=goals.filter(g=>g.playerId===p.id&&!g.ownGoal).length;const oppId=team.id===ht.id?at.id:ht.id;
            return <div key={p.id} style={{display:"flex",gap:6}}>
              <button onClick={()=>addG(p.id,team.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 10px",borderRadius:12,border:`2px solid ${K.bd}`,background:K.sf,color:K.tx,cursor:"pointer",textAlign:"left",width:"100%",transition:"all 0.15s",backdropFilter:"blur(8px)",minHeight:52}} onMouseEnter={e=>{e.currentTarget.style.background=team.color.bg+"18";e.currentTarget.style.borderColor=team.color.bg+"45";}} onMouseLeave={e=>{e.currentTarget.style.background=K.sf;e.currentTarget.style.borderColor=K.bd;}}>
                <div style={{width:32,height:32,borderRadius:9,overflow:"hidden",flexShrink:0,background:team.color.bg+"12",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {p.photo?<img src={p.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:12,fontWeight:800,color:team.color.bg,fontFamily:fC}}>{(p.nickname||p.name)[0]}</span>}
                </div>
                {p.number&&<span style={{fontSize:12,fontWeight:800,color:team.color.bg,fontFamily:fC}}>{p.number}</span>}
                <span style={{fontSize:13,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.nickname||p.name}</span>
                {pg>0&&<span style={{background:team.color.bg,color:team.color.t,borderRadius:8,padding:"3px 9px",fontSize:12,fontWeight:900,fontFamily:fC}}>⚽{pg}</span>}
              </button>
              <button onClick={()=>addG(p.id,oppId,{ownGoal:true})} title="Gol contra" aria-label="Gol contra" style={{width:52,minWidth:52,borderRadius:12,border:`2px solid ${K.bd}`,background:K.red+"10",color:K.red,cursor:"pointer",fontFamily:fC,fontWeight:900,fontSize:11,letterSpacing:"0.06em",display:"flex",alignItems:"center",justifyContent:"center"}}>
                GC
              </button>
            </div>;
          })}</div>
        </div>)}
      </div>
      {!showPen&&<BT onClick={()=>{if(gk&&crew.narrator)genChat("end");finish();}} v="grn" style={{width:"100%",justifyContent:"center",padding:"16px",fontSize:16}}>✓ ENCERRAR PARTIDA</BT>}
    </>}

    {/* TAB: LANCE — Goals log + match info */}
    {matchTab==="goals"&&<>
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:"#0EA5E970",padding:"3px 10px",borderRadius:6,background:"#0EA5E906",fontFamily:fC}}>🏟️ {STADIUM.name}</span>
        <span style={{fontSize:10,color:"#F43F5E70",padding:"3px 10px",borderRadius:6,background:"#F43F5E06",fontFamily:fC}}>🟨 {REFEREE.name}</span>
        {crew.broadcasters.map(b=><span key={b.id} style={{fontSize:10,color:b.color+"90",padding:"3px 10px",borderRadius:6,background:b.color+"06",fontWeight:600,fontFamily:fC}}>{b.icon} {b.name}</span>)}
      </div>
      {crew.narrator&&<div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap"}}>
        <span style={{fontSize:10,padding:"3px 10px",borderRadius:6,background:crewColors.narrator+"0D",border:`1px solid ${crewColors.narrator}18`,color:crewColors.narrator,fontFamily:fC,fontWeight:700}}>🎙️ {crew.narrator.name}</span>
        {crew.analyst1&&<span style={{fontSize:10,padding:"3px 10px",borderRadius:6,background:crewColors.analyst1+"0D",border:`1px solid ${crewColors.analyst1}18`,color:crewColors.analyst1,fontFamily:fC,fontWeight:700}}>💬 {crew.analyst1.name}</span>}
        {crew.analyst2&&<span style={{fontSize:10,padding:"3px 10px",borderRadius:6,background:crewColors.analyst2+"0D",border:`1px solid ${crewColors.analyst2}18`,color:crewColors.analyst2,fontFamily:fC,fontWeight:700}}>💬 {crew.analyst2.name}</span>}
      </div>}
      {goals.length>0?<G style={{padding:14}}><div style={{fontFamily:fC,fontSize:10,fontWeight:700,color:K.gDm,marginBottom:8,letterSpacing:"0.08em"}}>⚽ GOLS ({goals.length})</div>{goals.map(g=>{const p=pl.find(x=>x.id===g.playerId);const t=tm.find(x=>x.id===g.teamId);const a=g.assistPlayerId?pl.find(x=>x.id===g.assistPlayerId):null;return <div key={g.id} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 10px",borderRadius:8,marginBottom:4,background:K.row}}><span style={{fontFamily:fH,fontWeight:700,color:K.grn,fontSize:14,minWidth:32}}>{g.minute}'</span><span style={{fontSize:14}}>{g.ownGoal?"🤦":"⚽"}</span><span style={{fontWeight:700,fontSize:13,flex:1}}>{p?.nickname||p?.name}{g.ownGoal&&<span style={{fontSize:11,color:K.red,fontWeight:800,marginLeft:6}}>(GC)</span>}{!g.ownGoal&&a&&<span style={{fontSize:10,color:K.txM,fontWeight:700,marginLeft:8,fontFamily:fC}}>· Assist: {a.nickname||a.name}</span>}</span><span style={{fontSize:10,color:t?.color.bg,fontWeight:700,fontFamily:fC,background:t?.color.bg+"0D",padding:"3px 8px",borderRadius:5}}>{t?.name}</span><button onClick={()=>sGoals(goals.filter(x=>x.id!==g.id))} aria-label="Remover gol" style={{background:"none",border:"none",color:K.txM,cursor:"pointer",padding:3,fontSize:12}}>✕</button></div>;})}</G>
      :<G style={{textAlign:"center",padding:30}}><span style={{fontSize:28,display:"block",marginBottom:6}}>⚽</span><p style={{color:K.txM,fontSize:12}}>Nenhum gol ainda</p></G>}
    </>}

    {/* TAB: CHAT — AI broadcast */}
    {matchTab==="chat"&&<>
      {gk&&crew.narrator?<G style={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"10px 14px",background:K.inp,borderBottom:`1px solid ${K.bd}`,display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:run?K.grn:K.txM,animation:run?"lp 1.5s infinite":"none"}}/><span style={{fontFamily:fC,fontSize:11,fontWeight:700,color:run?K.grn:K.txM,letterSpacing:"0.08em"}}>TRANSMISSÃO {run?"AO VIVO":"PAUSADA"}</span>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
            {aiL&&<span style={{fontSize:10,color:"#8B5CF6",fontStyle:"italic"}}>digitando...</span>}
            <button onClick={handlePlay} style={{width:34,height:34,borderRadius:10,border:`1px solid ${run?K.red+"35":K.grn+"35"}`,background:run?K.red+"10":K.grn+"10",color:run?K.red:K.grn,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14}} aria-label={run?"Pausar transmissão":"Iniciar transmissão"}>
              {run?"⏸":"▶"}
            </button>
          </div>
        </div>
        <div ref={chatRef} style={{maxHeight:360,overflowY:"auto",padding:"10px 14px"}}>
          {chatMsgs.length===0&&<div style={{textAlign:"center",padding:20,color:K.txM,fontSize:12}}>{run?"Iniciando transmissão…":"Clique em ▶ para iniciar a transmissão"}</div>}
          {chatMsgs.map(m=>{
            const c=m.role==="narrator"?crewColors.narrator:m.role==="analyst1"?crewColors.analyst1:m.role==="analyst2"?crewColors.analyst2:K.txD;
            const icon=m.role==="narrator"?"🎙️":"💬";
            return <div key={m.id} style={{marginBottom:8,animation:"fu 0.3s ease"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                <span style={{fontSize:12,marginTop:2}}>{m.isGoal?"⚽":icon}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                    <span style={{fontFamily:fC,fontWeight:700,fontSize:12,color:c}}>{m.name}</span>
                    <span style={{fontSize:9,color:K.txM,fontFamily:fC}}>{m.time}</span>
                  </div>
                  <div style={{fontSize:13,color:K.tx,lineHeight:1.4}}>{m.text}</div>
                </div>
              </div>
            </div>;
          })}
        </div>
        <div style={{padding:"8px 14px",borderTop:`1px solid ${K.bd}`,display:"flex",gap:6}}>
          <button onClick={()=>genChat("auto")} disabled={aiL} style={{flex:1,padding:"10px 14px",borderRadius:8,border:`1px solid #8B5CF615`,background:"#8B5CF608",color:aiL?K.txM:"#8B5CF6",cursor:aiL?"default":"pointer",fontSize:12,fontWeight:700,fontFamily:fC}}>💬 {aiL?"GERANDO...":"GERAR COMENTÁRIO"}</button>
        </div>
      </G>:<G style={{textAlign:"center",padding:30}}>
        <span style={{fontSize:28,display:"block",marginBottom:6}}>🎙️</span>
        <p style={{color:K.txD,fontSize:12}}>Configure a API Gemini na aba Transmissão para ativar o chat ao vivo com IA.</p>
      </G>}
    </>}
  </div>;
}

/* ══════════ STANDINGS ══════════ */
function Standings({S,go}){
  const{teams:tm,matches:mt,tournament:tr}=S;
  const h2h=(t1,t2,fMt)=>{const m=fMt.filter(m=>m.played&&((m.homeTeamId===t1&&m.awayTeamId===t2)||(m.homeTeamId===t2&&m.awayTeamId===t1)));let p1=0,p2=0;m.forEach(x=>{const s1=x.homeTeamId===t1?x.homeScore:x.awayScore;const s2=x.homeTeamId===t1?x.awayScore:x.homeScore;if(s1>s2)p1+=3;else if(s1===s2){p1++;p2++;}else p2+=3;});return p1-p2;};
  const calcTable=(teamList,fMt)=>teamList.map(team=>{const ms=fMt.filter(m=>m.played&&(m.homeTeamId===team.id||m.awayTeamId===team.id));let w=0,d=0,l=0,gf=0,ga=0;ms.forEach(m=>{const isH=m.homeTeamId===team.id;const s=isH?m.homeScore:m.awayScore;const c=isH?m.awayScore:m.homeScore;gf+=s;ga+=c;if(s>c)w++;else if(s===c)d++;else l++;});return{team,p:ms.length,w,d,l,gf,ga,gd:gf-ga,pts:w*3+d};}).sort((a,b)=>{if(b.pts!==a.pts)return b.pts-a.pts;if(b.w!==a.w)return b.w-a.w;if(b.gd!==a.gd)return b.gd-a.gd;if(b.gf!==a.gf)return b.gf-a.gf;return h2h(b.team.id,a.team.id,fMt);});
  const isGroups=tr?.format==="two-groups"&&tr?.groups;
  const renderTable=(st,label)=><>
    {label&&<div style={{fontFamily:fC,fontSize:13,fontWeight:700,color:K.gold,letterSpacing:"0.08em",marginTop:16,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>🏟️ {label}<div style={{flex:1,height:1,background:K.gold+"15"}}/></div>}
    <G style={{padding:0,overflow:"hidden",overflowX:"auto",marginBottom:12}}>
      <div style={{display:"grid",gridTemplateColumns:"32px 1fr 28px 28px 28px 28px 28px 28px 30px 42px",padding:"10px 12px",background:K.tblH,fontSize:9,fontWeight:800,color:K.txM,fontFamily:fC,letterSpacing:"0.04em",minWidth:430}}>
        <div>#</div><div>TIME</div>{["J","V","E","D","GP","GC","SG","PTS"].map(h=><div key={h} style={{textAlign:"center"}}>{h}</div>)}
      </div>
      {st.map((s,i)=><div key={s.team.id} style={{display:"grid",gridTemplateColumns:"32px 1fr 28px 28px 28px 28px 28px 28px 30px 42px",padding:"10px 12px",alignItems:"center",borderTop:`1px solid ${K.bd}`,background:i===0?K.gold+"05":"transparent",minWidth:430}}>
        <div style={{fontFamily:fH,fontWeight:700,fontSize:14,color:i===0?K.gold:i<3?K.grn:K.txM}}>{i+1}</div>
        <div style={{display:"flex",alignItems:"center",gap:6}}><Badge team={s.team} size={22}/><span style={{fontWeight:700,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.team.name}</span></div>
        <div style={{textAlign:"center",fontSize:11,color:K.txD}}>{s.p}</div>
        <div style={{textAlign:"center",fontSize:11,color:K.grn,fontWeight:700}}>{s.w}</div>
        <div style={{textAlign:"center",fontSize:11,color:K.txD}}>{s.d}</div>
        <div style={{textAlign:"center",fontSize:11,color:K.red,fontWeight:700}}>{s.l}</div>
        <div style={{textAlign:"center",fontSize:11,color:K.txD}}>{s.gf}</div>
        <div style={{textAlign:"center",fontSize:11,color:K.txD}}>{s.ga}</div>
        <div style={{textAlign:"center",fontSize:11,fontWeight:700,color:s.gd>0?K.grn:s.gd<0?K.red:K.txD}}>{s.gd>0?"+":""}{s.gd}</div>
        <div style={{textAlign:"center",fontFamily:fH,fontSize:15,fontWeight:700,color:i===0?K.gold:K.tx}}>{s.pts}</div>
      </div>)}
    </G>
  </>;
  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")} crumb="CLASSIFICAÇÃO"/><SH icon="📊" title="CLASSIFICAÇÃO" color="#F97316"/>
    <p style={{fontSize:10,color:K.txD,marginBottom:12,fontFamily:fC,letterSpacing:"0.04em"}}>DESEMPATE: PONTOS → VITÓRIAS → SALDO → GOLS PRÓ → CONFRONTO DIRETO</p>
    {isGroups?<>
      {["A","B"].map(g=>{const gTeams=tr.groups[g].map(id=>tm.find(t=>t.id===id)).filter(Boolean);const gMatches=mt.filter(m=>m.groupLabel===g);return <div key={g}>{renderTable(calcTable(gTeams,gMatches),`GRUPO ${g}`)}</div>;})}
    </>:<>
      {(()=>{const st=calcTable(tm,mt);return !st.length?<div style={{textAlign:"center",padding:30,color:K.txM}}>Nenhum time.</div>:renderTable(st);})()}
    </>}
  </div>;
}

/* ══════════ SCORERS ══════════ */
function Scorers({S,go}){
  const{matches:mt,players:pl,teams:tm}=S;const allG=mt.filter(m=>m.played).flatMap(m=>m.goals||[]).filter(g=>!g.ownGoal);const map={};allG.forEach(g=>{if(!map[g.playerId])map[g.playerId]={goals:0,teamId:g.teamId};map[g.playerId].goals++;});
  const sc=Object.entries(map).map(([pid,d])=>({player:pl.find(p=>p.id===pid),team:tm.find(t=>t.id===d.teamId),goals:d.goals})).filter(s=>s.player&&s.team).sort((a,b)=>b.goals-a.goals);
  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")}/><SH icon="⚽" title="ARTILHARIA" color="#A855F7"/>
    {!sc.length?<div style={{textAlign:"center",padding:30,color:K.txM}}>Nenhum gol.</div>:
    <div style={{display:"grid",gap:6,marginTop:12}}>{sc.map((s,i)=><G key={s.player.id} style={{padding:"12px 16px",border:`1px solid ${i===0?K.gold+"18":K.bd}`,background:i===0?K.gold+"04":K.sf}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{fontFamily:fH,width:28,fontWeight:700,fontSize:15,textAlign:"center",color:i===0?K.gold:i===1?"#94A3B8":i===2?"#B45309":K.txM}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}º`}</div>
        <div style={{width:40,height:40,borderRadius:10,overflow:"hidden",flexShrink:0,background:s.team.color.bg+"10",display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${K.bd}`}}>{s.player.photo?<img src={s.player.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:fH,fontSize:16,fontWeight:700,color:s.team.color.bg}}>{(s.player.nickname||s.player.name)[0]}</span>}</div>
        <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:14}}>{s.player.nickname||s.player.name}</div><div style={{fontSize:11,color:s.team.color.bg,fontWeight:600,display:"flex",alignItems:"center",gap:3}}><Badge team={s.team} size={13}/> {s.team.name}</div></div>
        <div style={{display:"flex",alignItems:"center",gap:5,background:i===0?K.gold+"0D":K.grn+"0A",padding:"5px 14px",borderRadius:9,border:`1px solid ${i===0?K.gold+"15":K.grn+"12"}`}}><span style={{fontSize:14}}>⚽</span><span style={{fontFamily:fH,fontWeight:700,fontSize:20,color:i===0?K.gold:K.grn}}>{s.goals}</span></div>
      </div>
    </G>)}</div>}
  </div>;
}

/* ══════════ ASSISTS ══════════ */
function Assists({S,go}){
  const{matches:mt,players:pl,teams:tm}=S;
  const all=mt.filter(m=>m.played).flatMap(m=>m.goals||[]).filter(g=>!g.ownGoal&&g.assistPlayerId);
  const map={};
  all.forEach(g=>{const pid=g.assistPlayerId;if(!pid)return;if(!map[pid])map[pid]={assists:0,teamId:g.teamId};map[pid].assists++;});
  const rk=Object.entries(map).map(([pid,d])=>({player:pl.find(p=>p.id===pid),team:tm.find(t=>t.id===d.teamId),assists:d.assists})).filter(x=>x.player&&x.team).sort((a,b)=>b.assists-a.assists);
  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")}/><SH icon="🤝" title="ASSISTÊNCIAS" color="#14B8A6"/>
    {!rk.length?<div style={{textAlign:"center",padding:30,color:K.txM}}>Nenhuma assistência.</div>:
    <div style={{display:"grid",gap:6,marginTop:12}}>{rk.map((s,i)=><G key={s.player.id} style={{padding:"12px 16px",border:`1px solid ${i===0?K.gold+"18":K.bd}`,background:i===0?K.gold+"04":K.sf}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{fontFamily:fH,width:28,fontWeight:700,fontSize:15,textAlign:"center",color:i===0?K.gold:i===1?"#94A3B8":i===2?"#B45309":K.txM}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}º`}</div>
        <div style={{width:40,height:40,borderRadius:10,overflow:"hidden",flexShrink:0,background:s.team.color.bg+"10",display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${K.bd}`}}>{s.player.photo?<img src={s.player.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:fH,fontSize:16,fontWeight:700,color:s.team.color.bg}}>{(s.player.nickname||s.player.name)[0]}</span>}</div>
        <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:14}}>{s.player.nickname||s.player.name}</div><div style={{fontSize:11,color:s.team.color.bg,fontWeight:600,display:"flex",alignItems:"center",gap:3}}><Badge team={s.team} size={13}/> {s.team.name}</div></div>
        <div style={{display:"flex",alignItems:"center",gap:5,background:i===0?K.gold+"0D":"#14B8A60A",padding:"5px 14px",borderRadius:9,border:`1px solid ${i===0?K.gold+"15":"#14B8A615"}`}}><span style={{fontSize:14}}>🤝</span><span style={{fontFamily:fH,fontWeight:700,fontSize:20,color:i===0?K.gold:"#14B8A6"}}>{s.assists}</span></div>
      </div>
    </G>)}</div>}
  </div>;
}

/* ══════════ MATCH VIEW (Fan Chat + MVP Voting) ══════════ */
function MatchView({S,up,go,loggedPlayer,STADIUM,REFEREE}){
  const{currentMatch:cm,matches:mt,teams:tm,players:pl,fanChat,votes,panjangoVotes:pjVotes,matchStarRatings}=S;
  const match=mt.find(m=>m.id===cm);const gt=id=>tm.find(t=>t.id===id);
  const[msg,sMsg]=useState("");const[tab,sTab]=useState("chat");const[mvpId,sMvpId]=useState("");const[voteDone,sVoteDone]=useState(false);
  const[pjId,sPjId]=useState("");const[pjDone,sPjDone]=useState(false);
  if(!match)return <div style={{paddingTop:20}}><BB onClick={()=>go("home")}/><p style={{color:K.txD,textAlign:"center",marginTop:20}}>Partida não encontrada.</p></div>;
  const ht=gt(match.homeTeamId),at=gt(match.awayTeamId);
  const chatKey=match.id;const msgs=fanChat[chatKey]||[];
  const sendMsg=()=>{if(!msg.trim()||!loggedPlayer)return;const nm={id:uid(),playerId:loggedPlayer.id,name:loggedPlayer.name,text:msg.trim(),time:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})};up({fanChat:{...fanChat,[chatKey]:[...msgs,nm]}});sMsg("");};
  // MVP voting
  const matchVotes=votes[match.id]||[];const hasVoted=loggedPlayer&&matchVotes.some(v=>v.voterId===loggedPlayer.id);
  const doVote=()=>{if(!mvpId||!loggedPlayer||hasVoted)return;const nv={id:uid(),voterId:loggedPlayer.id,mvpId,voterName:loggedPlayer.name};up({votes:{...votes,[match.id]:[...matchVotes,nv]}});sVoteDone(true);};
  // MVP tally
  const tally={};matchVotes.forEach(v=>{tally[v.mvpId]=(tally[v.mvpId]||0)+1;});
  const mvpRank=Object.entries(tally).map(([pid,cnt])=>({player:pl.find(p=>p.id===pid),count:cnt})).filter(x=>x.player).sort((a,b)=>b.count-a.count);
  const allPlayers=[...((ht?.playerIds||[]).map(pid=>pl.find(p=>p.id===pid)).filter(Boolean)),...((at?.playerIds||[]).map(pid=>pl.find(p=>p.id===pid)).filter(Boolean))];
  // Panjango voting
  const matchPjVotes=(pjVotes||{})[match.id]||[];const hasPjVoted=loggedPlayer&&matchPjVotes.some(v=>v.voterId===loggedPlayer.id);
  const doPjVote=()=>{if(!pjId||!loggedPlayer||hasPjVoted)return;const nv={id:uid(),voterId:loggedPlayer.id,panjangoId:pjId,voterName:loggedPlayer.name};up({panjangoVotes:{...(pjVotes||{}),[match.id]:[...matchPjVotes,nv]}});sPjDone(true);};
  const pjTally={};matchPjVotes.forEach(v=>{pjTally[v.panjangoId]=(pjTally[v.panjangoId]||0)+1;});
  const pjRank=Object.entries(pjTally).map(([pid,cnt])=>({player:pl.find(p=>p.id===pid),count:cnt})).filter(x=>x.player).sort((a,b)=>b.count-a.count);
  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")}/>
    <G style={{marginTop:12,textAlign:"center",padding:"16px 14px",marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14}}>
        <div style={{textAlign:"center"}}><Badge team={ht} size={40}/><div style={{fontFamily:fC,fontWeight:700,fontSize:12,marginTop:4}}>{ht?.name}</div></div>
        {match.played?<div style={{fontFamily:fH,fontSize:36,fontWeight:700,color:K.gold}}>{match.homeScore} × {match.awayScore}</div>:<div style={{fontFamily:fH,fontSize:16,color:K.txM}}>EM BREVE</div>}
        <div style={{textAlign:"center"}}><Badge team={at} size={40}/><div style={{fontFamily:fC,fontWeight:700,fontSize:12,marginTop:4}}>{at?.name}</div></div>
      </div>
      {/* Scorers mini list */}
      {match.played&&(match.goals||[]).length>0&&<div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:6,marginTop:10}}>
        {(match.goals||[]).map(g=>{const p=pl.find(x=>x.id===g.playerId);const t=tm.find(x=>x.id===g.teamId);return p?<span key={g.id} style={{fontSize:10,padding:"2px 8px",borderRadius:5,background:(t?.color.bg||K.txM)+"0D",color:t?.color.bg||K.txD,fontWeight:600,border:`1px solid ${(t?.color.bg||K.txM)}12`}}>⚽ {g.minute}' {p.nickname||p.name}</span>:null;})}
      </div>}
      {/* MVP preview badge in header */}
      {mvpRank.length>0&&<div style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:10,padding:"5px 14px",borderRadius:20,background:K.gold+"0A",border:`1px solid ${K.gold}15`}}>
        <span style={{fontSize:12}}>👑</span>
        <span style={{fontSize:11,fontWeight:700,color:K.gold}}>{mvpRank[0].player.nickname||mvpRank[0].player.name}</span>
        <span style={{fontSize:9,color:K.txD}}>MVP · {mvpRank[0].count} voto{mvpRank[0].count>1?"s":""}</span>
      </div>}
      {/* Panjango preview badge in header */}
      {pjRank.length>0&&<div style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:6,padding:"5px 14px",borderRadius:20,background:"#E74C3C0A",border:"1px solid #E74C3C15"}}>
        <span style={{fontSize:12}}>🤦</span>
        <span style={{fontSize:11,fontWeight:700,color:"#E74C3C"}}>{pjRank[0].player.nickname||pjRank[0].player.name}</span>
        <span style={{fontSize:9,color:K.txD}}>Panjango · {pjRank[0].count} voto{pjRank[0].count>1?"s":""}</span>
      </div>}
    </G>
    {/* Tabs with counts */}
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      {[{id:"chat",l:"💬 CHAT",c:"#8B5CF6",cnt:msgs.length},{id:"mvp",l:"🏆 MVP",c:K.gold,cnt:matchVotes.length},{id:"panjango",l:"🤦 PANJANGO",c:"#E74C3C",cnt:matchPjVotes.length},{id:"photos",l:"📸 FOTOS",c:K.grn,cnt:(S.photos[match.id]||[]).length},...(match.played?[{id:"notas",l:"⭐ NOTAS",c:"#EAB308",cnt:((matchStarRatings||{})[match.id]||[]).filter(r=>r.voterId===loggedPlayer?.id).length}]:[])].map(t=>
        <button key={t.id} onClick={()=>sTab(t.id)} style={{flex:1,padding:"10px 8px",borderRadius:10,fontFamily:fC,fontWeight:700,fontSize:12,border:`1px solid ${tab===t.id?t.c+"35":K.bd}`,background:tab===t.id?t.c+"10":"transparent",color:tab===t.id?t.c:K.txD,cursor:"pointer",position:"relative"}}>
          {t.l}
          {t.cnt>0&&<span style={{marginLeft:4,fontSize:9,padding:"1px 5px",borderRadius:8,background:t.c+"18",color:t.c}}>{t.cnt}</span>}
        </button>
      )}
    </div>

    {tab==="chat"&&<G style={{padding:0,overflow:"hidden"}}>
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${K.bd}`,display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:12}}>💬</span><span style={{fontFamily:fC,fontSize:11,fontWeight:700,color:"#8B5CF6",letterSpacing:"0.06em"}}>CHAT DA TORCIDA</span>
        <span style={{fontSize:10,color:K.txD,marginLeft:"auto"}}>{msgs.length} msg</span>
      </div>
      <div style={{maxHeight:300,overflowY:"auto",padding:"10px 14px",minHeight:100}}>
        {!msgs.length&&<div style={{textAlign:"center",padding:20,color:K.txM,fontSize:12}}>Nenhuma mensagem ainda. Seja o primeiro!</div>}
        {msgs.map(m=><div key={m.id} style={{marginBottom:8,animation:"fu 0.2s ease"}}>
          <div style={{display:"flex",gap:6}}>
            <span style={{fontFamily:fC,fontWeight:700,fontSize:11,color:m.playerId===loggedPlayer?.id?"#8B5CF6":K.gold}}>{m.name}</span>
            <span style={{fontSize:9,color:K.txM}}>{m.time}</span>
          </div>
          <div style={{fontSize:13,color:K.tx,marginTop:1}}>{m.text}</div>
        </div>)}
      </div>
      {loggedPlayer?<div style={{padding:"8px 12px",borderTop:`1px solid ${K.bd}`,display:"flex",gap:6}}>
        <IN value={msg} onChange={e=>sMsg(e.target.value)} placeholder="Manda na torcida..." onKeyDown={e=>e.key==="Enter"&&sendMsg()} style={{flex:1,padding:"8px 12px",fontSize:12}}/>
        <BT onClick={sendMsg} style={{padding:"8px 14px",fontSize:11}}>ENVIAR</BT>
      </div>:<div style={{padding:"10px 14px",borderTop:`1px solid ${K.bd}`,textAlign:"center"}}><p style={{fontSize:11,color:K.txD}}>Faça login na "Área do Atleta" para enviar mensagens</p></div>}
    </G>}

    {tab==="mvp"&&<div>
      {!match.played?<G style={{textAlign:"center",padding:30}}><p style={{color:K.txD}}>Votação disponível após a partida</p></G>:<>
        {/* Vote form — show FIRST if player hasn't voted yet */}
        {loggedPlayer&&!hasVoted&&!voteDone&&<G style={{padding:20,marginBottom:14,border:`1px solid ${K.gold}20`}}>
          <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.gold,marginBottom:4,letterSpacing:"0.08em"}}>🏆 VOTE NO MVP DA PARTIDA</div>
          <p style={{fontSize:11,color:K.txD,marginBottom:12}}>Quem foi o melhor em campo? Seu voto é secreto e único. Você não pode votar em si mesmo.</p>
          {[ht,at].filter(Boolean).map(team=>{const tPlayers=(allPlayers.filter(p=>team.playerIds.includes(p.id))).filter(p=>p.id!==loggedPlayer?.id);return tPlayers.length?<div key={team.id} style={{marginBottom:10}}>
            <div style={{fontFamily:fC,fontSize:10,fontWeight:700,color:team.color.bg,letterSpacing:"0.06em",marginBottom:5}}>{team.name}</div>
            <div style={{display:"grid",gap:3}}>{tPlayers.map(p=>{const pGoals=(match.goals||[]).filter(g=>g.playerId===p.id).length;
              return <button key={p.id} onClick={()=>sMvpId(p.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:9,border:`1px solid ${mvpId===p.id?K.gold+"50":K.bd}`,background:mvpId===p.id?K.gold+"0D":"transparent",cursor:"pointer",width:"100%",textAlign:"left",transition:"all 0.15s",color:K.tx}}>
                <div style={{width:28,height:28,borderRadius:8,overflow:"hidden",background:team.color.bg+"10",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${mvpId===p.id?K.gold+"30":K.bd}`}}>
                  {p.photo?<img src={p.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:10,fontWeight:800,color:team.color.bg,fontFamily:fC}}>{(p.nickname||p.name)[0]}</span>}
                </div>
                {p.number&&<span style={{fontSize:10,fontWeight:800,color:team.color.bg,fontFamily:fC,minWidth:18}}>{p.number}</span>}
                <span style={{fontSize:12,fontWeight:600,flex:1}}>{p.nickname||p.name}</span>
                {p.position&&<span style={{fontSize:9,color:K.txD}}>{p.position}</span>}
                {pGoals>0&&<span style={{fontSize:10,background:K.grn+"12",color:K.grn,padding:"1px 6px",borderRadius:4,fontWeight:700}}>⚽{pGoals}</span>}
                {mvpId===p.id&&<span style={{fontSize:14}}>✓</span>}
              </button>;
            })}</div>
          </div>:null;})}
          <BT onClick={doVote} disabled={!mvpId} style={{width:"100%",justifyContent:"center",marginTop:6}}>🏆 CONFIRMAR MEU VOTO</BT>
        </G>}
        {loggedPlayer&&(hasVoted||voteDone)&&<G style={{textAlign:"center",padding:14,marginBottom:14,border:`1px solid ${K.grn}18`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span style={{fontSize:18}}>✅</span>
            <div><span style={{color:K.grn,fontSize:12,fontWeight:700}}>Voto registrado!</span>
            {(()=>{const myVote=matchVotes.find(v=>v.voterId===loggedPlayer.id);const mvpP=myVote?pl.find(p=>p.id===myVote.mvpId):null;return mvpP?<span style={{fontSize:11,color:K.txD,marginLeft:6}}>Você votou em {mvpP.nickname||mvpP.name}</span>:null;})()}
            </div>
          </div>
        </G>}
        {!loggedPlayer&&<G style={{textAlign:"center",padding:16,marginBottom:14,border:`1px solid #8B5CF618`}}>
          <span style={{fontSize:16}}>🔒</span><p style={{color:K.txD,fontSize:12,marginTop:4}}>Faça login na <b style={{color:"#8B5CF6"}}>"Área do Atleta"</b> para votar no MVP</p>
        </G>}

        {/* MVP WINNER — Crown card */}
        {mvpRank.length>0&&(()=>{const winner=mvpRank[0];const wTeam=tm.find(t=>t.playerIds?.includes(winner.player.id));const totalVotes=matchVotes.length;const pct=totalVotes?Math.round(winner.count/totalVotes*100):0;const wGoals=(match.goals||[]).filter(g=>g.playerId===winner.player.id).length;
          return <G style={{textAlign:"center",padding:24,marginBottom:14,border:`1px solid ${K.gold}25`,background:`linear-gradient(180deg,${K.gold}06,transparent)`}}>
            <div style={{fontSize:48,animation:"crown 0.6s ease-out",marginBottom:4}}>👑</div>
            <div style={{fontFamily:fC,fontSize:10,color:K.gold,letterSpacing:"0.15em",marginBottom:10,fontWeight:700}}>MVP DA PARTIDA</div>
            <div style={{width:76,height:76,borderRadius:20,overflow:"hidden",margin:"0 auto 10px",background:K.gold+"10",display:"flex",alignItems:"center",justifyContent:"center",border:`3px solid ${K.gold}40`,boxShadow:`0 0 30px ${K.gold}15`}}>
              {winner.player.photo?<img src={winner.player.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:fH,fontSize:28,fontWeight:700,color:K.gold}}>{(winner.player.nickname||winner.player.name)[0]}</span>}
            </div>
            <div style={{fontFamily:fH,fontSize:24,fontWeight:700,color:K.gold}}>{winner.player.nickname||winner.player.name}</div>
            {winner.player.number&&<div style={{fontSize:11,color:K.txD,marginTop:2}}>Camisa {winner.player.number}{winner.player.position?` · ${winner.player.position}`:""}</div>}
            {wTeam&&<div style={{display:"inline-flex",alignItems:"center",gap:4,marginTop:6}}><Badge team={wTeam} size={14}/><span style={{fontSize:11,color:wTeam.color.bg,fontWeight:600}}>{wTeam.name}</span></div>}
            <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:12}}>
              <div style={{textAlign:"center"}}><div style={{fontFamily:fH,fontSize:20,fontWeight:700,color:K.gold}}>{winner.count}</div><div style={{fontSize:9,color:K.txD,fontFamily:fC}}>VOTOS</div></div>
              <div style={{textAlign:"center"}}><div style={{fontFamily:fH,fontSize:20,fontWeight:700,color:K.gold}}>{pct}%</div><div style={{fontSize:9,color:K.txD,fontFamily:fC}}>DOS VOTOS</div></div>
              {wGoals>0&&<div style={{textAlign:"center"}}><div style={{fontFamily:fH,fontSize:20,fontWeight:700,color:K.grn}}>⚽ {wGoals}</div><div style={{fontSize:9,color:K.txD,fontFamily:fC}}>GOLS</div></div>}
            </div>
          </G>;
        })()}

        {/* ALL VOTED PLAYERS — Progress bars */}
        {mvpRank.length>0&&<div style={{marginBottom:14}}>
          <div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:K.txD,letterSpacing:"0.06em",marginBottom:8}}>📊 VOTAÇÃO ({matchVotes.length} voto{matchVotes.length!==1?"s":""})</div>
          <G style={{padding:0,overflow:"hidden"}}>
            {mvpRank.map((r,i)=>{const pct=matchVotes.length?Math.round(r.count/matchVotes.length*100):0;const rTeam=tm.find(t=>t.playerIds?.includes(r.player.id));const barColor=i===0?K.gold:i===1?"#94A3B8":K.txM;
              return <div key={r.player.id} style={{padding:"10px 14px",borderTop:i?`1px solid ${K.bd}`:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                  <div style={{fontFamily:fH,fontWeight:700,fontSize:13,color:i===0?K.gold:i===1?"#94A3B8":K.txM,width:22,textAlign:"center"}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}º`}</div>
                  <div style={{width:26,height:26,borderRadius:7,overflow:"hidden",background:(rTeam?.color.bg||K.txM)+"10",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {r.player.photo?<img src={r.player.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:9,fontWeight:800,color:rTeam?.color.bg||K.txD,fontFamily:fC}}>{(r.player.nickname||r.player.name)[0]}</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:12}}>{r.player.nickname||r.player.name}</div>
                    {rTeam&&<div style={{fontSize:9,color:rTeam.color.bg}}>{rTeam.name}</div>}
                  </div>
                  <div style={{fontFamily:fH,fontWeight:700,fontSize:16,color:barColor}}>{r.count}</div>
                  <div style={{fontSize:10,color:K.txD,minWidth:30,textAlign:"right"}}>{pct}%</div>
                </div>
                {/* Progress bar */}
                <div style={{height:4,borderRadius:2,background:K.bd,overflow:"hidden",marginLeft:30}}>
                  <div style={{height:"100%",borderRadius:2,background:barColor,width:`${pct}%`,transition:"width 0.5s ease"}}/>
                </div>
              </div>;
            })}
          </G>
        </div>}

        {/* WHO VOTED */}
        {matchVotes.length>0&&<div style={{marginBottom:14}}>
          <div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:K.txD,letterSpacing:"0.06em",marginBottom:8}}>🗳️ VOTOS REGISTRADOS</div>
          <G style={{padding:12}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {matchVotes.map(v=>{const mvpP=pl.find(p=>p.id===v.mvpId);return <div key={v.id} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:7,background:K.gold+"08",border:`1px solid ${K.gold}10`,fontSize:10}}>
                <span style={{fontWeight:700,color:K.tx}}>{v.voterName}</span>
                <span style={{color:K.txM}}>→</span>
                <span style={{fontWeight:700,color:K.gold}}>{mvpP?.nickname||mvpP?.name||"?"}</span>
              </div>;})}
            </div>
          </G>
        </div>}

        {matchVotes.length===0&&<G style={{textAlign:"center",padding:24}}>
          <span style={{fontSize:32,display:"block",marginBottom:8}}>🏆</span>
          <p style={{color:K.txD,fontSize:13}}>Nenhum voto ainda</p>
          <p style={{color:K.txM,fontSize:11,marginTop:4}}>Seja o primeiro a escolher o MVP!</p>
        </G>}
      </>}
    </div>}

    {tab==="panjango"&&<div>
      {!match.played?<G style={{textAlign:"center",padding:30}}><p style={{color:K.txD}}>Votação disponível após a partida</p></G>:<>
        {loggedPlayer&&!hasPjVoted&&!pjDone&&<G style={{padding:20,marginBottom:14,border:"1px solid #E74C3C20"}}>
          <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#E74C3C",marginBottom:4,letterSpacing:"0.08em"}}>🤦 VOTE NO PANJANGO DA PARTIDA</div>
          <p style={{fontSize:11,color:K.txD,marginBottom:12}}>Quem foi o pior em campo? Aquele que escorregou demais no sabão!</p>
          {[ht,at].filter(Boolean).map(team=>{const tPlayers=allPlayers.filter(p=>team.playerIds.includes(p.id));return tPlayers.length?<div key={team.id} style={{marginBottom:10}}>
            <div style={{fontFamily:fC,fontSize:10,fontWeight:700,color:team.color.bg,letterSpacing:"0.06em",marginBottom:5}}>{team.name}</div>
            <div style={{display:"grid",gap:3}}>{tPlayers.map(p=>{
              return <button key={p.id} onClick={()=>sPjId(p.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:9,border:`1px solid ${pjId===p.id?"#E74C3C50":K.bd}`,background:pjId===p.id?"#E74C3C0D":"transparent",cursor:"pointer",width:"100%",textAlign:"left",transition:"all 0.15s",color:K.tx}}>
                <div style={{width:28,height:28,borderRadius:8,overflow:"hidden",background:team.color.bg+"10",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${pjId===p.id?"#E74C3C30":K.bd}`}}>
                  {p.photo?<img src={p.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:10,fontWeight:800,color:team.color.bg,fontFamily:fC}}>{(p.nickname||p.name)[0]}</span>}
                </div>
                {p.number&&<span style={{fontSize:10,fontWeight:800,color:team.color.bg,fontFamily:fC,minWidth:18}}>{p.number}</span>}
                <span style={{fontSize:12,fontWeight:600,flex:1}}>{p.nickname||p.name}</span>
                {p.position&&<span style={{fontSize:9,color:K.txD}}>{p.position}</span>}
                {pjId===p.id&&<span style={{fontSize:14}}>✓</span>}
              </button>;
            })}</div>
          </div>:null;})}
          <BT onClick={doPjVote} disabled={!pjId} v="red" style={{width:"100%",justifyContent:"center",marginTop:6}}>🤦 CONFIRMAR MEU VOTO</BT>
        </G>}
        {loggedPlayer&&(hasPjVoted||pjDone)&&<G style={{textAlign:"center",padding:14,marginBottom:14,border:"1px solid #E74C3C18"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span style={{fontSize:18}}>✅</span>
            <div><span style={{color:"#E74C3C",fontSize:12,fontWeight:700}}>Voto registrado!</span>
            {(()=>{const myVote=matchPjVotes.find(v=>v.voterId===loggedPlayer.id);const pjP=myVote?pl.find(p=>p.id===myVote.panjangoId):null;return pjP?<span style={{fontSize:11,color:K.txD,marginLeft:6}}>Você votou em {pjP.nickname||pjP.name}</span>:null;})()}
            </div>
          </div>
        </G>}
        {!loggedPlayer&&<G style={{textAlign:"center",padding:16,marginBottom:14,border:"1px solid #8B5CF618"}}>
          <span style={{fontSize:16}}>🔒</span><p style={{color:K.txD,fontSize:12,marginTop:4}}>Faça login na <b style={{color:"#8B5CF6"}}>"Área do Atleta"</b> para votar no Panjango</p>
        </G>}
        {/* PANJANGO WINNER — Shame card */}
        {pjRank.length>0&&(()=>{const winner=pjRank[0];const wTeam=tm.find(t=>t.playerIds?.includes(winner.player.id));const totalVotes=matchPjVotes.length;const pct=totalVotes?Math.round(winner.count/totalVotes*100):0;
          return <G style={{textAlign:"center",padding:24,marginBottom:14,border:"1px solid #E74C3C25",background:"linear-gradient(180deg,#E74C3C06,transparent)"}}>
            <div style={{fontSize:48,marginBottom:4}}>🤦</div>
            <div style={{fontFamily:fC,fontSize:10,color:"#E74C3C",letterSpacing:"0.15em",marginBottom:10,fontWeight:700}}>PANJANGO DA PARTIDA</div>
            <div style={{width:76,height:76,borderRadius:20,overflow:"hidden",margin:"0 auto 10px",background:"#E74C3C10",display:"flex",alignItems:"center",justifyContent:"center",border:"3px solid #E74C3C40",boxShadow:"0 0 30px #E74C3C15"}}>
              {winner.player.photo?<img src={winner.player.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:fH,fontSize:28,fontWeight:700,color:"#E74C3C"}}>{(winner.player.nickname||winner.player.name)[0]}</span>}
            </div>
            <div style={{fontFamily:fH,fontSize:24,fontWeight:700,color:"#E74C3C"}}>{winner.player.nickname||winner.player.name}</div>
            {winner.player.number&&<div style={{fontSize:11,color:K.txD,marginTop:2}}>Camisa {winner.player.number}{winner.player.position?` · ${winner.player.position}`:""}</div>}
            {wTeam&&<div style={{display:"inline-flex",alignItems:"center",gap:4,marginTop:6}}><Badge team={wTeam} size={14}/><span style={{fontSize:11,color:wTeam.color.bg,fontWeight:600}}>{wTeam.name}</span></div>}
            <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:12}}>
              <div style={{textAlign:"center"}}><div style={{fontFamily:fH,fontSize:20,fontWeight:700,color:"#E74C3C"}}>{winner.count}</div><div style={{fontSize:9,color:K.txD,fontFamily:fC}}>VOTOS</div></div>
              <div style={{textAlign:"center"}}><div style={{fontFamily:fH,fontSize:20,fontWeight:700,color:"#E74C3C"}}>{pct}%</div><div style={{fontSize:9,color:K.txD,fontFamily:fC}}>DOS VOTOS</div></div>
            </div>
          </G>;
        })()}
        {/* ALL VOTED PLAYERS — Progress bars */}
        {pjRank.length>0&&<div style={{marginBottom:14}}>
          <div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:K.txD,letterSpacing:"0.06em",marginBottom:8}}>📊 VOTAÇÃO ({matchPjVotes.length} voto{matchPjVotes.length!==1?"s":""})</div>
          <G style={{padding:0,overflow:"hidden"}}>
            {pjRank.map((r,i)=>{const pct=matchPjVotes.length?Math.round(r.count/matchPjVotes.length*100):0;const rTeam=tm.find(t=>t.playerIds?.includes(r.player.id));const barColor=i===0?"#E74C3C":i===1?"#94A3B8":K.txM;
              return <div key={r.player.id} style={{padding:"10px 14px",borderTop:i?`1px solid ${K.bd}`:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                  <div style={{fontFamily:fH,fontWeight:700,fontSize:13,color:i===0?"#E74C3C":i===1?"#94A3B8":K.txM,width:22,textAlign:"center"}}>{i===0?"🤦":i===1?"2º":i===2?"3º":`${i+1}º`}</div>
                  <div style={{width:26,height:26,borderRadius:7,overflow:"hidden",background:(rTeam?.color.bg||K.txM)+"10",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {r.player.photo?<img src={r.player.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:9,fontWeight:800,color:rTeam?.color.bg||K.txD,fontFamily:fC}}>{(r.player.nickname||r.player.name)[0]}</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:12}}>{r.player.nickname||r.player.name}</div>
                    {rTeam&&<div style={{fontSize:9,color:rTeam.color.bg}}>{rTeam.name}</div>}
                  </div>
                  <div style={{fontFamily:fH,fontWeight:700,fontSize:16,color:barColor}}>{r.count}</div>
                  <div style={{fontSize:10,color:K.txD,minWidth:30,textAlign:"right"}}>{pct}%</div>
                </div>
                <div style={{height:4,borderRadius:2,background:K.bd,overflow:"hidden",marginLeft:30}}>
                  <div style={{height:"100%",borderRadius:2,background:barColor,width:`${pct}%`,transition:"width 0.5s ease"}}/>
                </div>
              </div>;
            })}
          </G>
        </div>}
        {matchPjVotes.length===0&&<G style={{textAlign:"center",padding:24}}>
          <span style={{fontSize:32,display:"block",marginBottom:8}}>🤦</span>
          <p style={{color:K.txD,fontSize:13}}>Nenhum voto ainda</p>
          <p style={{color:K.txM,fontSize:11,marginTop:4}}>Seja o primeiro a escolher o Panjango!</p>
        </G>}
      </>}
    </div>}

    {tab==="notas"&&match.played&&<div>
      {!loggedPlayer?<G style={{textAlign:"center",padding:24}}>
        <span style={{fontSize:20}}>🔒</span><p style={{color:K.txD,fontSize:12,marginTop:8}}>Faça login na "Área do Atleta" para avaliar os atletas</p>
      </G>:<>
        <G style={{padding:20,marginBottom:14,border:"1px solid #EAB30825"}}>
          <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#EAB308",marginBottom:4,letterSpacing:"0.08em"}}>⭐ AVALIE OS ATLETAS DA PARTIDA</div>
          <p style={{fontSize:11,color:K.txD,marginBottom:14}}>Dê de 1 a 5 estrelas para cada jogador que atuou. A média dessas notas será a nota do atleta. Você não pode se avaliar.</p>
          {[ht,at].filter(Boolean).map(team=>{const rateable=allPlayers.filter(p=>team.playerIds.includes(p.id)&&p.id!==loggedPlayer?.id);return rateable.length?<div key={team.id} style={{marginBottom:16}}>
            <div style={{fontFamily:fC,fontSize:10,fontWeight:700,color:team.color.bg,letterSpacing:"0.06em",marginBottom:8}}>{team.name}</div>
            <div style={{display:"grid",gap:8}}>{rateable.map(p=>{
              const matchRatings=(matchStarRatings||{})[match.id]||[];
              const myRating=matchRatings.find(r=>r.voterId===loggedPlayer.id&&r.playerId===p.id);
              const setStars=(stars)=>{const arr=matchRatings.filter(r=>!(r.voterId===loggedPlayer.id&&r.playerId===p.id));arr.push({voterId:loggedPlayer.id,playerId:p.id,stars});up({matchStarRatings:{...(matchStarRatings||{}),[match.id]:arr}});};
              return <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:`1px solid ${K.bd}`,background:K.sf}}>
                <div style={{width:32,height:32,borderRadius:8,overflow:"hidden",background:team.color.bg+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {p.photo?<img src={p.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:11,fontWeight:800,color:team.color.bg,fontFamily:fC}}>{(p.nickname||p.name)[0]}</span>}
                </div>
                <div style={{flex:1,minWidth:0}}><span style={{fontWeight:600,fontSize:13}}>{p.nickname||p.name}</span>{p.number&&<span style={{fontSize:10,color:K.txD,marginLeft:6}}>#{p.number}</span>}</div>
                <Stars value={myRating?.stars||0} onChange={setStars} sz={20}/>
              </div>;
            })}</div>
          </div>:null;})}
        </G>
        {allPlayers.filter(p=>p.id!==loggedPlayer?.id).length===0&&<p style={{fontSize:12,color:K.txD,textAlign:"center",padding:20}}>Apenas você jogou nesta partida; não há outros atletas para avaliar.</p>}
      </>}
    </div>}

    {tab==="photos"&&<Gallery S={S} up={up} go={go} loggedPlayer={loggedPlayer} matchId={match.id} inline/>}

    {/* Instagram Card — only for played matches */}
    {match.played&&<div style={{marginTop:16}}>
      <div style={{fontFamily:fC,fontSize:11,fontWeight:700,color:K.accL,letterSpacing:"0.06em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>📸 CARD PARA INSTAGRAM<div style={{flex:1,height:1,background:K.accL+"15"}}/></div>
      <InstaCard match={match} teams={tm} players={pl} sponsors={S.sponsors||[]} votes={votes} panjangoVotes={pjVotes||{}}/>
    </div>}
  </div>;
}

/* ══════════ GALLERY ══════════ */
function Gallery({S,up,go,loggedPlayer,matchId,inline=false}){
  const photos=S.photos||{};const matchPhotos=matchId?(photos[matchId]||[]):Object.values(photos).flat();
  const fr=useRef(null);const[viewImg,sViewImg]=useState(null);
  const addPhoto=(e)=>{const f=e.target.files?.[0];if(!f||!matchId||!loggedPlayer)return;const r=new FileReader();r.onloadend=async()=>{const compressed=await compressPhoto(r.result,600,0.65);const np={id:uid(),src:compressed,playerId:loggedPlayer.id,playerName:loggedPlayer.name,time:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})};up({photos:{...photos,[matchId]:[...(photos[matchId]||[]),np]}});};r.readAsDataURL(f);};
  const content=<>
    {loggedPlayer&&matchId&&<div style={{marginBottom:14}}>
      <input ref={fr} type="file" accept="image/*" onChange={addPhoto} style={{display:"none"}}/>
      <BT onClick={()=>fr.current?.click()} v="grn" style={{width:"100%",justifyContent:"center"}}>📸 ENVIAR FOTO</BT>
    </div>}
    {!matchPhotos.length?<div style={{textAlign:"center",padding:20,color:K.txM}}>Nenhuma foto ainda.</div>:
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
      {matchPhotos.map(p=><div key={p.id} style={{cursor:"pointer",position:"relative"}} onClick={()=>sViewImg(p)}>
        <img src={p.src} alt="" style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:10,border:`1px solid ${K.bd}`}}/>
        <div style={{position:"absolute",bottom:4,left:4,right:4,background:"rgba(0,0,0,0.6)",borderRadius:6,padding:"3px 6px"}}>
          <span style={{fontSize:9,color:"#fff",fontWeight:600}}>{p.playerName}</span>
        </div>
      </div>)}
    </div>}
    {viewImg&&<div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>sViewImg(null)}>
      <img src={viewImg.src} alt="" style={{maxWidth:"100%",maxHeight:"85vh",borderRadius:12}}/>
      <div style={{position:"absolute",bottom:40,textAlign:"center",color:"#fff"}}><div style={{fontSize:14,fontWeight:700}}>{viewImg.playerName}</div><div style={{fontSize:11,color:"#aaa"}}>{viewImg.time}</div></div>
    </div>}
  </>;
  if(inline)return content;
  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")}/><SH icon="📸" title="GALERIA DE FOTOS" color={K.grn}/>
    {content}
  </div>;
}

/* ══════════ BOLÃO ══════════ */
function Bolao({S,up,go,loggedPlayer}){
  const{matches:mt,teams:tm,bets}=S;const gt=id=>tm.find(t=>t.id===id);
  const upcoming=mt.filter(m=>!m.played);const played=mt.filter(m=>m.played);
  const[selMatch,sSelMatch]=useState("");const[bH,sBH]=useState("");const[bA,sBA]=useState("");
  const doBet=()=>{
    if(!selMatch||bH===""||bA===""||!loggedPlayer)return;
    const key=selMatch;const existing=bets[key]||[];
    if(existing.some(b=>b.playerId===loggedPlayer.id))return;
    const nb={id:uid(),playerId:loggedPlayer.id,playerName:loggedPlayer.name,homeScore:+bH,awayScore:+bA};
    up({bets:{...bets,[key]:[...existing,nb]}});sBH("");sBA("");sSelMatch("");
  };
  // Score bets
  const scoreBet=(bet,match)=>{if(!match.played)return null;const exact=bet.homeScore===match.homeScore&&bet.awayScore===match.awayScore;const winner=(bet.homeScore>bet.awayScore?"h":bet.homeScore<bet.awayScore?"a":"d")===(match.homeScore>match.awayScore?"h":match.homeScore<match.awayScore?"a":"d");return exact?3:winner?1:0;};
  // Leaderboard
  const lb={};Object.entries(bets).forEach(([mid,mBets])=>{const match=mt.find(m=>m.id===mid);if(!match?.played)return;mBets.forEach(b=>{const pts=scoreBet(b,match);if(pts===null)return;if(!lb[b.playerId])lb[b.playerId]={name:b.playerName,pts:0,exact:0,right:0};lb[b.playerId].pts+=pts;if(pts===3)lb[b.playerId].exact++;if(pts>=1)lb[b.playerId].right++;});});
  const lbArr=Object.values(lb).sort((a,b)=>b.pts-a.pts||b.exact-a.exact);
  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")}/><SH icon="🎰" title="BOLÃO" sub="Palpite os resultados e ganhe pontos!" color="#F39C12"/>
    {!loggedPlayer?<G style={{textAlign:"center",padding:24}}><p style={{color:K.txD}}>Faça login na "Área do Atleta" para participar do bolão</p></G>:<>
    {/* Place bet */}
    {upcoming.length>0&&<G style={{padding:20,marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#F39C12",marginBottom:10}}>📝 FAZER PALPITE</div>
      <SL value={selMatch} onChange={e=>sSelMatch(e.target.value)} style={{marginBottom:12}}>
        <option value="">Selecione a partida...</option>
        {upcoming.map(m=>{const h=gt(m.homeTeamId),a=gt(m.awayTeamId);const already=(bets[m.id]||[]).some(b=>b.playerId===loggedPlayer?.id);return h&&a&&!already?<option key={m.id} value={m.id}>{h.name} vs {a.name}</option>:null;})}
      </SL>
      {selMatch&&(()=>{const m=mt.find(x=>x.id===selMatch);const h=gt(m?.homeTeamId),a=gt(m?.awayTeamId);return h&&a?<div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:14}}>
          <div style={{textAlign:"center"}}><Badge team={h} size={30}/><div style={{fontSize:10,fontWeight:700,fontFamily:fC,marginTop:2}}>{h.name}</div></div>
          <IN type="number" min="0" value={bH} onChange={e=>sBH(e.target.value)} style={{width:50,textAlign:"center",fontSize:20,fontWeight:900,fontFamily:fH,padding:"6px"}}/>
          <span style={{color:K.gDm,fontWeight:800}}>×</span>
          <IN type="number" min="0" value={bA} onChange={e=>sBA(e.target.value)} style={{width:50,textAlign:"center",fontSize:20,fontWeight:900,fontFamily:fH,padding:"6px"}}/>
          <div style={{textAlign:"center"}}><Badge team={a} size={30}/><div style={{fontSize:10,fontWeight:700,fontFamily:fC,marginTop:2}}>{a.name}</div></div>
        </div>
        <BT onClick={doBet} disabled={bH===""||bA===""} style={{width:"100%",justifyContent:"center"}}>🎰 CONFIRMAR PALPITE</BT>
      </div>:null;})()}
    </G>}
    {/* My bets */}
    {(()=>{const myBets=Object.entries(bets).flatMap(([mid,bs])=>bs.filter(b=>b.playerId===loggedPlayer?.id).map(b=>({...b,matchId:mid}))).filter(Boolean);
      return myBets.length>0&&<div style={{marginBottom:16}}>
        <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.gold,marginBottom:8}}>📋 MEUS PALPITES</div>
        <div style={{display:"grid",gap:4}}>{myBets.map(b=>{const m=mt.find(x=>x.id===b.matchId);const h=gt(m?.homeTeamId),a=gt(m?.awayTeamId);const pts=m?.played?scoreBet(b,m):null;
          return m&&h&&a?<G key={b.id} style={{padding:"10px 14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <Badge team={h} size={18}/><span style={{fontSize:11,fontWeight:700,flex:1,textAlign:"right"}}>{h.name}</span>
              <span style={{fontFamily:fH,fontWeight:700,fontSize:14,color:"#F39C12"}}>{b.homeScore}×{b.awayScore}</span>
              <span style={{fontSize:11,fontWeight:700,flex:1}}>{a.name}</span><Badge team={a} size={18}/>
              {pts!==null&&<span style={{fontSize:10,fontWeight:800,fontFamily:fC,padding:"2px 8px",borderRadius:5,background:pts===3?K.grn+"15":pts===1?"#F39C1215":K.red+"10",color:pts===3?K.grn:pts===1?"#F39C12":K.red}}>{pts===3?"EXATO! +3":pts===1?"Acertou +1":"Errou 0"}</span>}
              {!m.played&&<span style={{fontSize:9,color:K.txM,fontFamily:fC}}>AGUARDANDO</span>}
            </div>
          </G>:null;})}</div>
      </div>;})()}
    {/* Leaderboard */}
    {lbArr.length>0&&<div style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:"#F39C12",letterSpacing:"0.08em",marginBottom:8}}>🏆 RANKING DO BOLÃO</div>
      <G style={{padding:0,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"30px 1fr 50px 40px 40px",padding:"8px 12px",background:K.tblH,fontSize:9,fontWeight:800,color:K.txM,fontFamily:fC}}>
          <div>#</div><div>NOME</div><div style={{textAlign:"center"}}>PTS</div><div style={{textAlign:"center"}}>EX</div><div style={{textAlign:"center"}}>OK</div>
        </div>
        {lbArr.map((r,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"30px 1fr 50px 40px 40px",padding:"8px 12px",borderTop:`1px solid ${K.bd}`}}>
          <div style={{fontFamily:fH,fontWeight:700,fontSize:13,color:i===0?"#F39C12":K.txM}}>{i===0?"🏆":`${i+1}º`}</div>
          <div style={{fontWeight:700,fontSize:12}}>{r.name}</div>
          <div style={{textAlign:"center",fontFamily:fH,fontWeight:700,fontSize:14,color:"#F39C12"}}>{r.pts}</div>
          <div style={{textAlign:"center",fontSize:10,color:K.grn}}>{r.exact}</div>
          <div style={{textAlign:"center",fontSize:10,color:K.txD}}>{r.right}</div>
        </div>)}
      </G>
      <p style={{fontSize:9,color:K.txM,marginTop:4,fontFamily:fC}}>PLACAR EXATO = 3 PTS · ACERTOU VENCEDOR = 1 PT</p>
    </div>}
    </>}
  </div>;
}

/* ══════════ SPONSORS ══════════ */
function Sponsors({S,up,go}){
  const[n,sN]=useState("");const[cat,sCat]=useState("Ouro");const[logo,sLogo]=useState(null);
  const[delSId,sDelSId]=useState(null);
  const fr=useRef(null);
  const cats=[{id:"Ouro",color:"#C4A561",icon:"🥇"},{id:"Prata",color:"#94A3B8",icon:"🥈"},{id:"Bronze",color:"#B45309",icon:"🥉"},{id:"Apoio",color:"#6B7280",icon:"🤝"}];
  const hp=e=>{const f=e.target.files?.[0];if(f){const r=new FileReader();r.onloadend=async()=>{const compressed=await compressPhoto(r.result,150,0.7);sLogo(compressed);};r.readAsDataURL(f);}};
  const add=()=>{if(!n.trim())return;up({sponsors:[...S.sponsors,{id:uid(),name:n.trim(),category:cat,logo}]});sN("");sLogo(null);};
  const grouped=cats.map(c=>({...c,items:S.sponsors.filter(s=>s.category===c.id)})).filter(g=>g.items.length>0);
  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")} crumb="PATROCINADORES"/>
    <SH icon="🏅" title="PATROCINADORES" sub="Cadastre e gerencie os patrocinadores do campeonato" color="#C4A561"/>
    <G style={{marginBottom:16,padding:20}}>
      <LB>Nome do Patrocinador</LB><IN value={n} onChange={e=>sN(e.target.value)} placeholder="Ex: Empresa XYZ" style={{marginBottom:12}}/>
      <LB>Categoria</LB>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {cats.map(c=><button key={c.id} onClick={()=>sCat(c.id)} style={{padding:"7px 14px",borderRadius:8,fontWeight:700,fontSize:11,fontFamily:fC,border:`1px solid ${cat===c.id?c.color:K.bd}`,cursor:"pointer",background:cat===c.id?c.color+"12":"transparent",color:cat===c.id?c.color:K.txD}}>{c.icon} {c.id.toUpperCase()}</button>)}
      </div>
      <LB>Logo (opcional)</LB>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <input ref={fr} type="file" accept="image/*" onChange={hp} style={{display:"none"}}/>
        <button onClick={()=>fr.current?.click()} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${logo?K.gold+"40":K.bd}`,background:logo?K.gold+"08":"transparent",color:logo?K.gold:K.txD,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:ff}}>📷 {logo?"Logo ✓":"Upload Logo"}</button>
        {logo&&<img src={logo} alt="" style={{width:36,height:36,borderRadius:8,objectFit:"contain",background:"#fff",padding:2}}/>}
      </div>
      <BT onClick={add} disabled={!n.trim()}>+ CADASTRAR</BT>
    </G>
    {grouped.map(g=><div key={g.id} style={{marginBottom:16}}>
      <div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:g.color,letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>{g.icon} {g.id.toUpperCase()} ({g.items.length})<div style={{flex:1,height:1,background:g.color+"15"}}/></div>
      <div style={{display:"grid",gap:6}}>{g.items.map(s=><G key={s.id} style={{padding:"12px 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {s.logo?<img src={s.logo} alt="" style={{width:40,height:40,borderRadius:10,objectFit:"contain",background:"#fff",padding:3,border:`1px solid ${K.bd}`}}/>:<div style={{width:40,height:40,borderRadius:10,background:g.color+"0D",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,border:`1px solid ${g.color}15`}}>🏢</div>}
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:K.tx}}>{s.name}</div><div style={{fontSize:11,color:g.color,fontWeight:600}}>{g.icon} {s.category}</div></div>
          <button onClick={()=>sDelSId(s.id)} aria-label="Remover" style={{background:"none",border:"none",color:"#E74C3C40",cursor:"pointer",padding:4}}>🗑️</button>
        </div>
      </G>)}</div>
    </div>)}
    <ConfirmDialog open={!!delSId} onCancel={()=>sDelSId(null)} onConfirm={()=>{up({sponsors:S.sponsors.filter(x=>x.id!==delSId)});sDelSId(null);}} title="Remover Patrocinador?" message={`"${S.sponsors.find(s=>s.id===delSId)?.name||""}" será removido.`} confirmLabel="REMOVER" icon="🏅"/>
    {!S.sponsors.length&&<div style={{textAlign:"center",padding:30,color:K.txM}}>Nenhum patrocinador cadastrado.</div>}
  </div>;
}

/* ══════════ SUMULA ══════════ */
function Sumula({S,go,REFEREE,STADIUM,BROADCASTERS}){
  const{matches:mt,teams:tm,players:pl}=S;const played=mt.filter(m=>m.played);const[sel,sSel]=useState(null);const gt=id=>tm.find(t=>t.id===id);const sm=sel?mt.find(m=>m.id===sel):null;const now=new Date();
  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")} crumb="SÚMULA"/><SH icon="📋" title="SÚMULA" sub="Relatório oficial das partidas" color="#14B8A6"/>
    {!played.length?<div style={{textAlign:"center",padding:30,color:K.txM}}>Nenhuma partida.</div>:
    <div style={{display:"grid",gap:6,marginBottom:16}}>{played.map(m=>{const h=gt(m.homeTeamId),a=gt(m.awayTeamId);if(!h||!a)return null;return <G key={m.id} hover style={{cursor:"pointer",padding:"11px 14px",border:`1px solid ${sel===m.id?"#14B8A630":K.bd}`}} onClick={()=>sSel(m.id)}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><Badge team={h} size={22}/><span style={{fontFamily:fC,fontWeight:700,fontSize:12}}>{h.name}</span><span style={{fontFamily:fH,fontWeight:700,color:K.gold,fontSize:14}}>{m.homeScore}×{m.awayScore}</span><span style={{fontFamily:fC,fontWeight:700,fontSize:12}}>{a.name}</span><Badge team={a} size={22}/>{m.phase==="knockout"&&m.homeScore===m.awayScore&&m.hPen!=null&&<span style={{fontSize:10,color:K.gold,fontFamily:fC}}>(Pên:{m.hPen}×{m.aPen})</span>}</div>
    </G>;})}</div>}
    {sm&&(()=>{const h=gt(sm.homeTeamId),a=gt(sm.awayTeamId);const hP=h.playerIds.map(pid=>pl.find(p=>p.id===pid)).filter(Boolean);const aP=a.playerIds.map(pid=>pl.find(p=>p.id===pid)).filter(Boolean);const ko=sm.phase==="knockout",tied=sm.homeScore===sm.awayScore;
      return <G style={{border:`1px solid #14B8A620`,padding:24}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <img src={LOGO} alt="" style={{maxWidth:140,display:"block",margin:"0 auto 10px"}}/>
          <div style={{fontFamily:fC,fontSize:10,fontWeight:700,color:"#14B8A6",letterSpacing:"0.12em",marginBottom:8}}>SÚMULA OFICIAL</div>
          <div style={{fontSize:12,color:K.txD}}>{now.toLocaleDateString("pt-BR")} · {now.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
          <div style={{fontSize:12,color:"#0EA5E9",marginTop:4}}>🏟️ {STADIUM.name} — {STADIUM.location}</div>
          <div style={{fontSize:12,color:"#F43F5E",marginTop:4}}>🟨 Árbitro: {REFEREE.name}</div>
          <div style={{fontSize:10,color:K.txD,marginTop:2,fontStyle:"italic"}}>{REFEREE.bio}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:20}}>
          <div style={{textAlign:"center"}}><Badge team={h} size={44}/><div style={{fontFamily:fC,fontWeight:800,fontSize:14,marginTop:5}}>{h.name}</div></div>
          <div style={{textAlign:"center"}}><div style={{fontFamily:fH,fontSize:36,fontWeight:700,color:K.gold}}>{sm.homeScore} × {sm.awayScore}</div>{ko&&tied&&sm.hPen!=null&&<div style={{fontFamily:fC,fontSize:12,color:K.gold,fontWeight:700,marginTop:3}}>Pênaltis: {sm.hPen} × {sm.aPen}</div>}</div>
          <div style={{textAlign:"center"}}><Badge team={a} size={44}/><div style={{fontFamily:fC,fontWeight:800,fontSize:14,marginTop:5}}>{a.name}</div></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:18}}>{[[h,hP],[a,aP]].map(([team,pls])=><div key={team.id}><div style={{fontFamily:fC,fontSize:10,fontWeight:700,color:team.color.bg,letterSpacing:"0.08em",marginBottom:6}}>ESCALAÇÃO — {team.name}</div>{pls.map(p=><div key={p.id} style={{fontSize:12,color:K.txD,padding:"2px 0"}}>{p.number&&<span style={{fontWeight:800,color:team.color.bg,marginRight:5,fontFamily:fC}}>{p.number}</span>}{p.nickname||p.name}{p.position&&<span style={{color:K.txM}}> ({p.position})</span>}</div>)}</div>)}</div>
        {sm.goals?.length>0&&<div style={{marginBottom:14}}><div style={{fontFamily:fC,fontSize:10,fontWeight:700,color:K.grn,letterSpacing:"0.08em",marginBottom:6}}>⚽ GOLS</div>{sm.goals.map(g=>{const p=pl.find(x=>x.id===g.playerId);const t=tm.find(x=>x.id===g.teamId);return <div key={g.id} style={{fontSize:12,color:K.tx,padding:"2px 0"}}><span style={{fontFamily:fH,fontWeight:700,color:K.grn,marginRight:8}}>{g.minute}'</span>{p?.nickname||p?.name}<span style={{color:K.txD}}> ({t?.name})</span></div>;})}</div>}
        <div style={{borderTop:`1px solid ${K.bd}`,paddingTop:12,textAlign:"center"}}><span style={{fontFamily:fC,fontSize:10,color:K.txM,letterSpacing:"0.1em"}}>CAMPEONATO BRASILEIRO DE FUTSABÃO — EDIÇÃO NACIONAL</span></div>
      </G>;})()}
  </div>;
}

/* ══════════ TV MODE (#11) ══════════ */
function TVMode({S,go}){
  const{currentMatch:cm,matches:mt,teams:tm,players:pl}=S;const match=mt.find(m=>m.id===cm);
  const ht=tm.find(t=>t.id===match?.homeTeamId),at=tm.find(t=>t.id===match?.awayTeamId);
  const[clk,sClk]=useState(0);const[lastGoal,sLastGoal]=useState(null);
  const startRef=useRef(null);const timerRef=useRef(null);
  // Listen for live updates
  useEffect(()=>{
    const bc=getBroadcastChannel();if(!bc)return;
    const handler=(e)=>{
      if(e.data?.type==="goal"){sLastGoal({player:e.data.player,team:e.data.team,ts:Date.now()});setTimeout(()=>sLastGoal(null),6000);}
    };
    bc.addEventListener("message",handler);
    return()=>bc.removeEventListener("message",handler);
  },[]);
  // Live clock sync
  useEffect(()=>{
    startRef.current=Date.now();
    timerRef.current=setInterval(()=>sClk(c=>c+1),1000);
    return()=>clearInterval(timerRef.current);
  },[]);
  if(!match||!ht||!at)return <div style={{background:"#000",color:"#fff",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:fH,fontSize:36}}>Aguardando partida...</div>;
  const goals=match.goals||[];const hg=goals.filter(g=>g.teamId===ht.id).length,ag=goals.filter(g=>g.teamId===at.id).length;
  const fm=s=>`${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  return <div onClick={()=>go("match")} style={{position:"fixed",inset:0,zIndex:9999,background:"linear-gradient(135deg,#0a0a0a,#1a0a14,#0a0a0a)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:fH,overflow:"hidden"}}>
    <style>{`@keyframes tvpulse{0%,100%{text-shadow:0 0 40px rgba(46,204,113,0.3)}50%{text-shadow:0 0 80px rgba(46,204,113,0.6)}}@keyframes goalblast{0%{transform:scale(0);opacity:0}50%{transform:scale(1.2);opacity:1}100%{transform:scale(1);opacity:1}}@keyframes goaltext{0%{transform:translateY(50px);opacity:0}100%{transform:translateY(0);opacity:1}}`}</style>
    {/* Top bar */}
    <div style={{position:"absolute",top:0,left:0,right:0,height:4,background:`linear-gradient(90deg,${ht.color.bg},#C4A561,${at.color.bg})`}}/>
    <div style={{position:"absolute",top:20,display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:10,height:10,borderRadius:"50%",background:"#2ECC71",animation:"lp 1.5s infinite"}}/><span style={{fontFamily:fC,fontSize:16,color:"#2ECC71",fontWeight:700,letterSpacing:"0.15em"}}>AO VIVO</span>
    </div>
    {/* Clock */}
    <div style={{fontSize:48,fontWeight:700,color:"#2ECC71",fontVariantNumeric:"tabular-nums",animation:"tvpulse 3s ease infinite",marginBottom:30}}>{fm(clk)}</div>
    {/* Scoreboard */}
    <div style={{display:"flex",alignItems:"center",gap:40}}>
      <div style={{textAlign:"center"}}><Badge team={ht} size={100}/><div style={{fontSize:28,fontWeight:700,color:"#fff",marginTop:12}}>{ht.name}</div></div>
      <div style={{fontSize:120,fontWeight:700,color:"#C4A561",fontVariantNumeric:"tabular-nums",textShadow:"0 0 60px rgba(196,165,97,0.3)"}}>{hg}<span style={{fontSize:60,color:"#5A5647",margin:"0 15px"}}>×</span>{ag}</div>
      <div style={{textAlign:"center"}}><Badge team={at} size={100}/><div style={{fontSize:28,fontWeight:700,color:"#fff",marginTop:12}}>{at.name}</div></div>
    </div>
    {/* Goal scorers */}
    {goals.length>0&&<div style={{marginTop:30,display:"flex",gap:40}}>
      {[ht,at].map(team=><div key={team.id} style={{textAlign:"center"}}>{goals.filter(g=>g.teamId===team.id).map(g=>{const p=pl.find(x=>x.id===g.playerId);return <div key={g.id} style={{color:team.color.bg,fontSize:18,fontFamily:fC,fontWeight:700,marginBottom:4}}>⚽ {g.minute}' {p?.nickname||p?.name}</div>;})}</div>)}
    </div>}
    {/* GOAL BLAST overlay */}
    {lastGoal&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"radial-gradient(circle,rgba(196,165,97,0.15),rgba(0,0,0,0.9))",zIndex:10}}>
      <div style={{fontSize:200,animation:"goalblast 0.5s ease"}}>⚽</div>
      <div style={{fontSize:72,fontWeight:700,color:"#C4A561",animation:"goaltext 0.5s ease 0.3s both",textTransform:"uppercase",textShadow:"0 4px 40px rgba(196,165,97,0.5)"}}>GOOOOOL!</div>
      <div style={{fontSize:36,fontWeight:700,color:"#fff",animation:"goaltext 0.5s ease 0.6s both",marginTop:10}}>{lastGoal.player}</div>
      <div style={{fontSize:24,color:"#E8CE8B",animation:"goaltext 0.5s ease 0.8s both",fontFamily:fC}}>{lastGoal.team}</div>
    </div>}
    {/* Bottom info */}
    <div style={{position:"absolute",bottom:20,textAlign:"center"}}>
      <div style={{fontFamily:fC,fontSize:14,color:"#5A5647",letterSpacing:"0.15em"}}>CAMPEONATO BRASILEIRO DE FUTSABÃO</div>
      <div style={{fontFamily:fC,fontSize:11,color:"#3A3630",marginTop:4}}>Toque para voltar</div>
    </div>
  </div>;
}

/* ══════════ INSTAGRAM CARD GENERATOR (#13) ══════════ */
function InstaCard({match,teams,players,sponsors,votes,panjangoVotes}){
  const canvasRef=useRef(null);const[ready,sReady]=useState(false);
  const ht=teams.find(t=>t.id===match.homeTeamId),at=teams.find(t=>t.id===match.awayTeamId);
  const goals=match.goals||[];
  const mvpVotes=votes[match.id]||[];const tally={};mvpVotes.forEach(v=>{tally[v.mvpId]=(tally[v.mvpId]||0)+1;});
  const mvpEntry=Object.entries(tally).sort((a,b)=>b[1]-a[1])[0];
  const mvp=mvpEntry?players.find(p=>p.id===mvpEntry[0]):null;
  const pjV=(panjangoVotes||{})[match.id]||[];const pjT={};pjV.forEach(v=>{pjT[v.panjangoId]=(pjT[v.panjangoId]||0)+1;});
  const pjEntry=Object.entries(pjT).sort((a,b)=>b[1]-a[1])[0];const panjango=pjEntry?players.find(p=>p.id===pjEntry[0]):null;
  useEffect(()=>{
    const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");c.width=1080;c.height=1080;
    // Background
    const grad=ctx.createLinearGradient(0,0,1080,1080);grad.addColorStop(0,"#070B18");grad.addColorStop(0.5,"#1A0A14");grad.addColorStop(1,"#070B18");ctx.fillStyle=grad;ctx.fillRect(0,0,1080,1080);
    // Top bar
    const barG=ctx.createLinearGradient(0,0,1080,0);barG.addColorStop(0,ht?.color.bg||"#8B1538");barG.addColorStop(0.5,"#C4A561");barG.addColorStop(1,at?.color.bg||"#1B4D8E");ctx.fillStyle=barG;ctx.fillRect(0,0,1080,6);
    // Title
    ctx.fillStyle="#C4A561";ctx.font="bold 28px Oswald,sans-serif";ctx.textAlign="center";ctx.fillText("CAMPEONATO BRASILEIRO DE FUTSABÃO",540,60);
    // Team names
    ctx.fillStyle="#fff";ctx.font="bold 52px Oswald,sans-serif";ctx.fillText(ht?.name||"Casa",300,200);ctx.fillText(at?.name||"Fora",780,200);
    // Score
    ctx.fillStyle="#C4A561";ctx.font="bold 140px Oswald,sans-serif";ctx.fillText(`${match.homeScore}`,380,370);ctx.fillStyle="#5A5647";ctx.font="bold 80px Oswald,sans-serif";ctx.fillText("×",540,360);ctx.fillStyle="#C4A561";ctx.font="bold 140px Oswald,sans-serif";ctx.fillText(`${match.awayScore}`,700,370);
    // Penalties
    if(match.hPen!=null){ctx.fillStyle="#E8CE8B";ctx.font="bold 28px Barlow Condensed,sans-serif";ctx.fillText(`Pênaltis: ${match.hPen} × ${match.aPen}`,540,410);}
    // Goals
    let gy=470;ctx.font="600 22px Barlow,sans-serif";
    goals.slice(0,8).forEach(g=>{const p=players.find(x=>x.id===g.playerId);const t=teams.find(x=>x.id===g.teamId);
      ctx.fillStyle=t?.color.bg||"#C4A561";ctx.fillText(`⚽ ${g.minute}' ${p?.nickname||p?.name||"?"} (${t?.name||"?"})`,540,gy);gy+=32;});
    // MVP
    if(mvp){ctx.fillStyle="#C4A561";ctx.font="bold 24px Barlow Condensed,sans-serif";ctx.fillText(`👑 MVP: ${mvp.nickname||mvp.name}`,540,gy+30);gy+=35;}
    // Panjango
    if(panjango){ctx.fillStyle="#E74C3C";ctx.font="bold 24px Barlow Condensed,sans-serif";ctx.fillText(`🤦 Panjango: ${panjango.nickname||panjango.name}`,540,gy+30);}
    // Sponsors
    const topSponsors=sponsors.filter(s=>s.category==="Ouro"||s.category==="Prata").slice(0,3);
    if(topSponsors.length){ctx.fillStyle="#5A5647";ctx.font="600 18px Barlow Condensed,sans-serif";ctx.fillText(topSponsors.map(s=>s.name).join("  ·  "),540,1010);}
    // Bottom bar
    ctx.fillStyle=barG;ctx.fillRect(0,1074,1080,6);
    // Watermark
    ctx.fillStyle="#3A363080";ctx.font="bold 16px Barlow Condensed,sans-serif";ctx.fillText("futsabao.app",540,1050);
    sReady(true);
  },[match]);
  const download=()=>{const c=canvasRef.current;if(!c)return;const link=document.createElement("a");link.download=`resultado-${ht?.name}-vs-${at?.name}.png`;link.href=c.toDataURL("image/png");link.click();};
  const share=async()=>{const c=canvasRef.current;if(!c)return;try{const blob=await new Promise(r=>c.toBlob(r,"image/png"));if(navigator.canShare?.({files:[new File([blob],"resultado.png",{type:"image/png"})]})){await navigator.share({files:[new File([blob],"resultado.png",{type:"image/png"})],title:"Resultado FutSabão"});}else download();}catch(e){download();}};
  return <div style={{marginTop:14}}>
    <canvas ref={canvasRef} style={{width:"100%",maxWidth:400,borderRadius:12,border:`1px solid ${K.bd}`,display:"block",margin:"0 auto"}}/>
    {ready&&<div style={{display:"flex",gap:8,justifyContent:"center",marginTop:10}}>
      <BT onClick={download} v="gold" style={{fontSize:11,padding:"9px 18px"}}>📥 BAIXAR</BT>
      <BT onClick={share} v="acc" style={{fontSize:11,padding:"9px 18px"}}>📤 COMPARTILHAR</BT>
    </div>}
  </div>;
}

/* ══════════ QR CODE GENERATOR (#14) ══════════ */
function QRCode({data,size=200}){
  const canvasRef=useRef(null);
  useEffect(()=>{
    const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");c.width=size;c.height=size;
    // Simple QR-like visual (actual QR needs library — this generates a scannable-looking pattern + URL text)
    ctx.fillStyle="#fff";ctx.fillRect(0,0,size,size);
    // Generate deterministic pattern from data string
    const hash=data.split("").reduce((a,c)=>((a<<5)-a+c.charCodeAt(0))|0,0);
    const modules=21;const cellSize=Math.floor(size/modules);
    ctx.fillStyle="#000";
    // Position detection patterns (3 corners)
    const drawFinder=(x,y)=>{ctx.fillRect(x,y,7*cellSize,7*cellSize);ctx.fillStyle="#fff";ctx.fillRect(x+cellSize,y+cellSize,5*cellSize,5*cellSize);ctx.fillStyle="#000";ctx.fillRect(x+2*cellSize,y+2*cellSize,3*cellSize,3*cellSize);};
    drawFinder(0,0);ctx.fillStyle="#000";drawFinder((modules-7)*cellSize,0);ctx.fillStyle="#000";drawFinder(0,(modules-7)*cellSize);
    // Data modules (pseudo-random based on hash + data)
    ctx.fillStyle="#000";
    for(let r=0;r<modules;r++)for(let c2=0;c2<modules;c2++){
      if((r<8&&c2<8)||(r<8&&c2>modules-9)||(r>modules-9&&c2<8))continue;
      const v=((hash*(r+1)*(c2+1)+data.charCodeAt((r*modules+c2)%data.length))>>>0)%3;
      if(v===0)ctx.fillRect(c2*cellSize,r*cellSize,cellSize,cellSize);
    }
    // URL text at bottom
    ctx.fillStyle="#333";ctx.font=`bold ${Math.max(8,size/18)}px sans-serif`;ctx.textAlign="center";
    const shortUrl=data.length>40?data.slice(0,37)+"...":data;
    ctx.fillText(shortUrl,size/2,size-4);
  },[data,size]);
  return <canvas ref={canvasRef} style={{borderRadius:8,border:`1px solid ${K.bd}`}}/>;
}

/* ══════════ PLAYER STATS (#17) ══════════ */
function PlayerStats({S,go,playerId}){
  const{players:pl,matches:mt,teams:tm,votes,matchStarRatings}=S;
  const p=pl.find(x=>x.id===playerId);if(!p)return null;
  const team=tm.find(t=>t.playerIds?.includes(p.id));
  const played=mt.filter(m=>m.played);
  const matchesPlayed=played.filter(m=>{const t=tm.find(t=>t.playerIds?.includes(p.id));return t&&(m.homeTeamId===t.id||m.awayTeamId===t.id);});
  const totalGoals=played.reduce((sum,m)=>(m.goals||[]).filter(g=>g.playerId===p.id).length+sum,0);
  const avgRating=getPlayerStarRating(p.id,matchStarRatings);
  let mvpCount=0;played.forEach(m=>{const mv=votes[m.id]||[];const t={};mv.forEach(v=>{t[v.mvpId]=(t[v.mvpId]||0)+1;});const best=Object.entries(t).sort((a,b)=>b[1]-a[1])[0];if(best&&best[0]===p.id)mvpCount++;});
  let panjangoCount=0;const pjVotesAll=S.panjangoVotes||{};played.forEach(m=>{const pv=pjVotesAll[m.id]||[];const t={};pv.forEach(v=>{t[v.panjangoId]=(t[v.panjangoId]||0)+1;});const best=Object.entries(t).sort((a,b)=>b[1]-a[1])[0];if(best&&best[0]===p.id)panjangoCount++;});
  const goalsPerMatch=matchesPlayed.length?((totalGoals/matchesPlayed.length).toFixed(1)):"-";
  // Achievements
  const achievements=[];
  if(totalGoals>=1)achievements.push({icon:"⚽",label:"Primeiro Gol",desc:"Marcou pelo menos 1 gol"});
  if(totalGoals>=3)achievements.push({icon:"🎩",label:"Hat-trick de Sabão",desc:"3+ gols no campeonato"});
  if(totalGoals>=10)achievements.push({icon:"🔥",label:"Artilheiro",desc:"10+ gols no campeonato"});
  if(mvpCount>=1)achievements.push({icon:"👑",label:"MVP",desc:"Eleito melhor da partida"});
  if(mvpCount>=3)achievements.push({icon:"💎",label:"MVP Lendário",desc:"MVP 3+ vezes"});
  if(panjangoCount>=1)achievements.push({icon:"🤦",label:"Panjango",desc:"Eleito pior da partida"});
  if(panjangoCount>=3)achievements.push({icon:"💀",label:"Panjango Lendário",desc:"Panjango 3+ vezes"});
  if(matchesPlayed.length>=5)achievements.push({icon:"🏟️",label:"Veterano de Sabão",desc:"5+ partidas jogadas"});
  return <div style={{paddingTop:20,paddingBottom:40}}>
    <BB onClick={()=>go("home")} crumb={p.nickname||p.name}/>
    {/* Player Card */}
    <G style={{marginTop:14,padding:24,textAlign:"center"}}>
      <div style={{width:80,height:80,borderRadius:20,overflow:"hidden",margin:"0 auto 12px",border:`3px solid ${team?.color.bg||K.gold}`,background:K.row}}>
        {p.photo?<img src={p.photo} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:28,fontWeight:700,color:K.gold,lineHeight:"80px",fontFamily:fH}}>{(p.nickname||p.name)[0]}</span>}
      </div>
      <h2 style={{fontFamily:fH,fontSize:24,color:K.tx}}>{p.nickname||p.name}</h2>
      {p.number&&<span style={{fontFamily:fC,fontSize:14,color:team?.color.bg||K.gold,fontWeight:700}}>#{p.number}</span>}
      {team&&<div style={{fontSize:12,color:K.txD,marginTop:4}}>{team.name} · {p.position||"Sem posição"}</div>}
      {p.phrase&&<div style={{fontSize:12,color:K.gDm,marginTop:8,fontStyle:"italic"}}>"{p.phrase}"</div>}
    </G>
    {/* Stats Grid */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:14}}>
      {[{v:matchesPlayed.length,l:"JOGOS",c:K.blu},{v:totalGoals,l:"GOLS",c:K.grn},{v:mvpCount,l:"MVPs",c:K.gold},{v:panjangoCount,l:"PANJANGO",c:"#E74C3C"},{v:goalsPerMatch,l:"MÉDIA GOLS",c:K.accL},{v:avgRating!=null?avgRating.toFixed(1):"-",l:"NOTA",c:"#EAB308"}].map(s=><G key={s.l} style={{padding:14,textAlign:"center"}}>
        <div style={{fontFamily:fH,fontSize:28,fontWeight:700,color:s.c}}>{s.v}</div>
        <div style={{fontFamily:fC,fontSize:9,fontWeight:700,color:K.txD,letterSpacing:"0.08em"}}>{s.l}</div>
      </G>)}
    </div>
    {avgRating!=null&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:8}}><span style={{fontSize:11,color:K.txD,fontFamily:fC}}>Média das avaliações (estrelas) pós-partida:</span><Stars value={Math.round(avgRating)} ro sz={16}/><span style={{fontSize:12,fontWeight:700,color:"#EAB308"}}>{avgRating.toFixed(1)}</span></div>}
    {/* Achievements (#20) */}
    {achievements.length>0&&<><div style={{fontFamily:fC,fontSize:12,fontWeight:700,color:K.gold,letterSpacing:"0.08em",marginTop:20,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>🏆 CONQUISTAS ({achievements.length})<div style={{flex:1,height:1,background:K.gold+"15"}}/></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>{achievements.map(a=><G key={a.label} style={{padding:14,textAlign:"center"}}>
      <div style={{fontSize:28,marginBottom:4}}>{a.icon}</div>
      <div style={{fontFamily:fC,fontWeight:700,fontSize:11,color:K.tx}}>{a.label}</div>
      <div style={{fontSize:10,color:K.txD,marginTop:2}}>{a.desc}</div>
    </G>)}</div></>}
  </div>;
}

/* ══════════ TEAM ENTRANCE ANIMATION (#18) ══════════ */
function TeamEntrance({S,match,onStart}){
  const{teams:tm,players:pl}=S;
  const[step,sStep]=useState(0); // 0=home, 1=away, 2=ready
  const ht=tm.find(t=>t.id===match?.homeTeamId),at=tm.find(t=>t.id===match?.awayTeamId);
  useEffect(()=>{const t1=setTimeout(()=>sStep(1),3000);const t2=setTimeout(()=>sStep(2),6000);return()=>{clearTimeout(t1);clearTimeout(t2);};},[]);
  if(!ht||!at)return null;
  const team=step===0?ht:at;const pls=(step<2?team:ht).playerIds.map(pid=>pl.find(p=>p.id===pid)).filter(Boolean);
  return <div style={{position:"fixed",inset:0,zIndex:9999,background:"linear-gradient(135deg,#070B18,#1A0A14)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:fH}}>
    <style>{`@keyframes teamslide{0%{transform:translateX(-100%);opacity:0}100%{transform:translateX(0);opacity:1}}@keyframes playerfade{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}`}</style>
    <div style={{position:"absolute",top:0,left:0,right:0,height:4,background:`linear-gradient(90deg,${ht.color.bg},#C4A561,${at.color.bg})`}}/>
    {step<2?<div style={{textAlign:"center",animation:"teamslide 0.8s ease"}}>
      <Badge team={team} size={120}/>
      <h1 style={{fontSize:48,color:"#fff",marginTop:16,textTransform:"uppercase"}}>{team.name}</h1>
      <div style={{display:"flex",flexWrap:"wrap",gap:12,justifyContent:"center",marginTop:24,maxWidth:500}}>
        {pls.map((p,i)=><div key={p.id} style={{animation:`playerfade 0.4s ease ${i*0.1}s both`,textAlign:"center"}}>
          <div style={{width:48,height:48,borderRadius:12,overflow:"hidden",background:team.color.bg+"20",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",border:`2px solid ${team.color.bg}40`}}>
            {p.photo?<img src={p.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:16,fontWeight:800,color:team.color.bg,fontFamily:fC}}>{p.number||"?"}</span>}
          </div>
          <div style={{fontSize:11,color:"#fff",fontFamily:fC,fontWeight:700,marginTop:4}}>{p.nickname||p.name}</div>
        </div>)}
      </div>
    </div>:<div style={{textAlign:"center"}}>
      <div style={{display:"flex",alignItems:"center",gap:30}}>
        <div><Badge team={ht} size={80}/><div style={{fontSize:24,color:"#fff",marginTop:8}}>{ht.name}</div></div>
        <div style={{fontSize:48,color:"#C4A561",fontWeight:700}}>VS</div>
        <div><Badge team={at} size={80}/><div style={{fontSize:24,color:"#fff",marginTop:8}}>{at.name}</div></div>
      </div>
      <BT onClick={onStart} v="grn" style={{marginTop:30,padding:"16px 40px",fontSize:18}}>▶ INICIAR PARTIDA</BT>
    </div>}
  </div>;
}

/* ══════════ DRAMATIZED PENALTIES (#19) ══════════ */
function PenaltyShootout({homeTeam,awayTeam,onFinish}){
  const[kicks,sKicks]=useState([]); // [{team:"home"|"away",result:"goal"|"miss"}]
  const[phase,sPhase]=useState("kick"); // kick, result, done
  const[current,sCurrent]=useState("home");
  const round=Math.floor(kicks.length/2);
  const hGoals=kicks.filter(k=>k.team==="home"&&k.result==="goal").length;
  const aGoals=kicks.filter(k=>k.team==="away"&&k.result==="goal").length;
  const hKicks=kicks.filter(k=>k.team==="home").length;
  const aKicks=kicks.filter(k=>k.team==="away").length;
  const isDone=kicks.length>=10||(round>=5&&hGoals!==aGoals)||(kicks.length>=6&&Math.abs(hGoals-aGoals)>(Math.ceil((10-kicks.length)/2)));
  const doKick=(result)=>{
    const newKicks=[...kicks,{team:current,result}];sKicks(newKicks);
    try{result==="goal"?SFX.goal():SFX.whistle();}catch(e){}
    const nextTeam=current==="home"?"away":"home";
    const hG=newKicks.filter(k=>k.team==="home"&&k.result==="goal").length;
    const aG=newKicks.filter(k=>k.team==="away"&&k.result==="goal").length;
    const r=Math.floor(newKicks.length/2);
    const done=newKicks.length>=10||(r>=5&&hG!==aG);
    if(done){sPhase("done");setTimeout(()=>onFinish(hG,aG),2000);}
    else{sCurrent(nextTeam);sPhase("kick");}
  };
  const curTeam=current==="home"?homeTeam:awayTeam;
  return <G style={{padding:24,textAlign:"center",marginBottom:16}}>
    <div style={{fontFamily:fH,fontSize:22,color:K.gold,marginBottom:16}}>⚽ PÊNALTIS</div>
    {/* Score */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:20,marginBottom:20}}>
      <div style={{textAlign:"center"}}><Badge team={homeTeam} size={40}/><div style={{fontFamily:fH,fontSize:36,fontWeight:700,color:K.tx,marginTop:4}}>{hGoals}</div><div style={{fontFamily:fC,fontSize:10,color:K.txD}}>{homeTeam.name}</div></div>
      <div style={{fontFamily:fH,fontSize:20,color:K.txM}}>×</div>
      <div style={{textAlign:"center"}}><Badge team={awayTeam} size={40}/><div style={{fontFamily:fH,fontSize:36,fontWeight:700,color:K.tx,marginTop:4}}>{aGoals}</div><div style={{fontFamily:fC,fontSize:10,color:K.txD}}>{awayTeam.name}</div></div>
    </div>
    {/* Kick indicators */}
    <div style={{display:"flex",justifyContent:"center",gap:16,marginBottom:20}}>
      {[homeTeam,awayTeam].map((team,ti)=><div key={team.id} style={{display:"flex",gap:4}}>{Array.from({length:5}).map((_,i)=>{
        const kick=kicks.filter(k=>k.team===(ti===0?"home":"away"))[i];
        return <div key={i} style={{width:28,height:28,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,border:`2px solid ${kick?kick.result==="goal"?K.grn:K.red:K.bd}`,background:kick?kick.result==="goal"?K.grn+"15":K.red+"15":"transparent",color:kick?kick.result==="goal"?K.grn:K.red:K.txM}}>{kick?kick.result==="goal"?"✓":"✗":(i+1)}</div>;
      })}</div>)}
    </div>
    {/* Action */}
    {phase!=="done"?<div>
      <div style={{fontFamily:fC,fontSize:14,color:curTeam.color.bg,fontWeight:700,marginBottom:12}}>COBRANÇA: {curTeam.name} (#{(current==="home"?hKicks:aKicks)+1})</div>
      <div style={{display:"flex",gap:12,justifyContent:"center"}}>
        <BT onClick={()=>doKick("goal")} v="grn" style={{padding:"14px 32px",fontSize:16}}>⚽ GOOOL!</BT>
        <BT onClick={()=>doKick("miss")} v="red" style={{padding:"14px 32px",fontSize:16}}>🧤 DEFENDEU!</BT>
      </div>
    </div>:<div style={{fontFamily:fH,fontSize:24,color:K.gold,animation:"fu 0.5s ease"}}>{hGoals>aGoals?homeTeam.name:awayTeam.name} VENCE NOS PÊNALTIS!</div>}
  </G>;
}
