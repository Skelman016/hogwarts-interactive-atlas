import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Plus, Minus, LocateFixed, SlidersHorizontal, MapPin, X, LogIn, LogOut, Upload, Trash2, Save, Eye, EyeOff, Compass, Sparkles, ShieldCheck, Check, Image as ImageIcon } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const CATEGORIES = [
  { id:'interest', label:'Punti di interesse', color:'#d6b66b', icon:'✦' },
  { id:'npc_enemy', label:'NPC e nemici', color:'#c87969', icon:'⚔' },
  { id:'farm', label:'Punti farm', color:'#83a879', icon:'✧' },
  { id:'strategic', label:'Punti strategici', color:'#79a9bd', icon:'⌖' }
];
const STATUSES = [{id:'unvisited',label:'Da visitare'},{id:'visited',label:'Visitato'},{id:'completed',label:'Completato'},{id:'verified',label:'Verificato'}];
const emptyDraft = { title:'', category:'interest', description:'', status:'unvisited', difficulty:'', tags:'', image_path:'' };

export default function App() {
  const [session,setSession] = useState(null);
  const [markers,setMarkers] = useState([]);
  const [loading,setLoading] = useState(true);
  const [authOpen,setAuthOpen] = useState(false);
  const [authMode,setAuthMode] = useState('login');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [authMessage,setAuthMessage] = useState('');
  const [search,setSearch] = useState('');
  const [activeFilters,setActiveFilters] = useState(CATEGORIES.map(c=>c.id));
  const [selected,setSelected] = useState(null);
  const [draft,setDraft] = useState(emptyDraft);
  const [modal,setModal] = useState(false);
  const [pendingPoint,setPendingPoint] = useState(null);
  const [zoom,setZoom] = useState(1);
  const [mapUrl,setMapUrl] = useState('');
  const [mapUrlInput,setMapUrlInput] = useState('');
  const [mapSettings,setMapSettings] = useState(false);
  const [saving,setSaving] = useState(false);
  const [notice,setNotice] = useState('');
  const [showFilters,setShowFilters] = useState(false);
  const [pan,setPan] = useState({x:0,y:0});
  const [drag,setDrag] = useState(null);
  const mapRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(()=>{
    if(!supabase){ setLoading(false); return; }
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,s)=>setSession(s));
    return ()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{ if(supabase) loadMarkers(); },[session]);
  async function loadMarkers(){
    setLoading(true);
    const {data,error} = await supabase.from('atlas_markers').select('*').order('created_at',{ascending:false});
    if(error) setNotice('Impossibile caricare i marker: '+error.message);
    else setMarkers(data||[]);
    setLoading(false);
  }
  const visibleMarkers = useMemo(()=>markers.filter(m=>activeFilters.includes(m.category) && (!search || [m.title,m.description,(m.tags||[]).join(' ')].join(' ').toLowerCase().includes(search.toLowerCase()))),[markers,activeFilters,search]);
  const selectedMarker = selected ? markers.find(m=>m.id===selected) : null;
  async function authenticate(e){
    e.preventDefault(); setAuthMessage('');
    const action = authMode==='login' ? supabase.auth.signInWithPassword({email,password}) : supabase.auth.signUp({email,password});
    const {error} = await action;
    setAuthMessage(error ? error.message : authMode==='login' ? 'Accesso effettuato.' : 'Registrazione inviata. Se richiesto, conferma l’email.');
  }
  async function logout(){ await supabase.auth.signOut(); setAuthOpen(false); }
  function openNew(x,y){ if(!session){setAuthOpen(true);setAuthMessage('Accedi per aggiungere o modificare i marker.');return;} setPendingPoint({x,y});setDraft(emptyDraft);setSelected(null);setModal(true); }
  function openEdit(m){ if(!session)return;setPendingPoint({x:m.map_x,y:m.map_y});setDraft({...m,tags:Array.isArray(m.tags)?m.tags.join(', '):''});setSelected(m.id);setModal(true); }
  async function saveMarker(e){
    e.preventDefault(); if(!session)return;setSaving(true);
    const payload={title:draft.title.trim(),category:draft.category,description:draft.description,status:draft.status,difficulty:draft.difficulty||null,tags:draft.tags.split(',').map(t=>t.trim()).filter(Boolean),image_path:draft.image_path||null,map_x:pendingPoint.x,map_y:pendingPoint.y,owner_id:session.user.id};
    const query=selected ? supabase.from('atlas_markers').update(payload).eq('id',selected) : supabase.from('atlas_markers').insert(payload);
    const {error}=await query;
    setSaving(false);
    if(error){setNotice('Salvataggio non riuscito: '+error.message);return;}
    setModal(false);setSelected(null);setNotice('Marker salvato.');loadMarkers();
  }
  async function deleteMarker(id){
    if(!session || !confirm('Eliminare definitivamente questo marker?'))return;
    const {error}=await supabase.from('atlas_markers').delete().eq('id',id);
    if(error)setNotice(error.message);else{setSelected(null);setNotice('Marker eliminato.');loadMarkers();}
  }
  function mapClick(e){
    if(drag?.moved)return;
    if(!mapRef.current)return;
    const rect=mapRef.current.getBoundingClientRect();
    const x=Math.max(0,Math.min(1,(e.clientX-rect.left-pan.x)/(rect.width*zoom)));
    const y=Math.max(0,Math.min(1,(e.clientY-rect.top-pan.y)/(rect.height*zoom)));
    openNew(x,y);
  }
  function startDrag(e){ if(e.button!==0)return;setDrag({x:e.clientX,y:e.clientY,px:pan.x,py:pan.y,moved:false}); }
  function moveDrag(e){if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;setDrag({...drag,moved:drag.moved||Math.abs(dx)+Math.abs(dy)>4});if(drag.moved||Math.abs(dx)+Math.abs(dy)>4)setPan({x:drag.px+dx,y:drag.py+dy});}
  function endDrag(){setDrag(null);}
  function exportJson(){const blob=new Blob([JSON.stringify(markers,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='hogwarts-atlas-markers.json';a.click();URL.revokeObjectURL(url);}
  async function importJson(e){const f=e.target.files?.[0];if(!f||!session)return;try{const parsed=JSON.parse(await f.text());if(!Array.isArray(parsed))throw new Error('Il file deve contenere un array JSON.');const rows=parsed.map(({id,created_at,updated_at,...m})=>({...m,owner_id:session.user.id}));const {error}=await supabase.from('atlas_markers').insert(rows);if(error)throw error;loadMarkers();setNotice('Importazione completata.');}catch(err){setNotice('Importazione non riuscita: '+err.message);}e.target.value='';}
  async function uploadMap(e){const f=e.target.files?.[0];if(!f)return;const url=URL.createObjectURL(f);setMapUrl(url);setMapUrlInput(url);setNotice('Anteprima locale caricata. Per renderla disponibile a tutti, pubblica la base cartografica nel progetto.');}
  function toggleFilter(id){setActiveFilters(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);}
  const categoryOf=id=>CATEGORIES.find(c=>c.id===id)||CATEGORIES[0];

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="crest">✦</div><div><div className="brand-kicker">WIZARDING WORLD · FIELD GUIDE</div><h1>HOGWARTS <span>ATLAS</span></h1></div></div>
      <div className="top-actions"><div className="online"><span/> ATLANTE INTERATTIVO</div>{session?<><span className="user-email">{session.user.email}</span><button className="icon-button" title="Esci" onClick={logout}><LogOut size={17}/></button></>:<button className="login-button" onClick={()=>setAuthOpen(true)}><LogIn size={16}/> ACCEDI</button>}</div>
    </header>
    <main className="workspace">
      <aside className="sidebar">
        <div className="side-heading"><div><span className="eyebrow">ESPLORAZIONE</span><h2>Atlante</h2></div><Compass size={21}/></div>
        <label className="searchbox"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca un luogo, NPC..."/><kbd>⌕</kbd></label>
        <div className="section-title"><span>CATEGORIE</span><button onClick={()=>setShowFilters(!showFilters)}><SlidersHorizontal size={15}/></button></div>
        <div className="filters">{CATEGORIES.map(c=><button key={c.id} className={'filter-row '+(activeFilters.includes(c.id)?'active':'')} onClick={()=>toggleFilter(c.id)}><span className="filter-symbol" style={{color:c.color}}>{c.icon}</span><span>{c.label}</span><span className="filter-count">{markers.filter(m=>m.category===c.id).length}</span><span className="check">{activeFilters.includes(c.id)?'✓':''}</span></button>)}</div>
        <div className="section-title marker-title"><span>REGISTRO MARKER</span><span className="total-count">{visibleMarkers.length}</span></div>
        <div className="marker-list">{visibleMarkers.length===0?<div className="empty-list">Nessun marker presente.<br/><small>Seleziona un punto sulla mappa per iniziare.</small></div>:visibleMarkers.map(m=><button key={m.id} className={'marker-row '+(selected===m.id?'chosen':'')} onClick={()=>setSelected(m.id)}><span className="marker-dot" style={{background:categoryOf(m.category).color}}/><span className="marker-name">{m.title}<small>{categoryOf(m.category).label} · {STATUSES.find(s=>s.id===m.status)?.label||m.status}</small></span><span className="chevron">›</span></button>)}</div>
        <div className="sidebar-bottom"><div className="legend-note"><ShieldCheck size={16}/><span>Consultazione pubblica · Modifiche con accesso</span></div><button className="export-button" onClick={exportJson}>Esporta archivio JSON</button>{session&&<label className="import-button">Importa archivio JSON<input type="file" accept=".json,application/json" onChange={importJson}/></label>}</div>
      </aside>
      <section className="map-area">
        <div className="map-toolbar"><div className="map-title"><span className="eyebrow">HIGHLANDS · SCOZIA</span><h2>Mappa del mondo</h2></div><div className="map-tools"><button title="Carica base cartografica" onClick={()=>session?fileRef.current?.click():setAuthOpen(true)}><ImageIcon size={16}/><span>BASE MAPPA</span></button><input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadMap}/><button title="Riduci zoom" onClick={()=>setZoom(z=>Math.max(.5,z-.15))}><Minus size={16}/></button><span className="zoom-value">{Math.round(zoom*100)}%</span><button title="Aumenta zoom" onClick={()=>setZoom(z=>Math.min(3,z+.15))}><Plus size={16}/></button><button title="Centra mappa" onClick={()=>{setZoom(1);setPan({x:0,y:0})}}><LocateFixed size={16}/></button></div></div>
        <div className="map-frame" onMouseDown={startDrag} onMouseMove={moveDrag} onMouseUp={endDrag} onMouseLeave={endDrag}>
          <div className="map-grid" style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}} ref={mapRef} onClick={mapClick}>
            {mapUrl?<img className="map-image" src={mapUrl} alt="Base cartografica caricata"/>:<div className="map-placeholder"><div className="placeholder-ring ring-one"/><div className="placeholder-ring ring-two"/><div className="placeholder-compass">✥</div><div className="placeholder-content"><div className="placeholder-emblem">✦</div><span className="eyebrow">HOGWARTS LEGACY</span><h3>La mappa attende<br/>il suo esploratore</h3><p>La base cartografica globale originale non è ancora stata inserita.</p><small>Carica un'immagine della mappa per iniziare a posizionare i marker.</small></div><div className="map-label label-north">N O R D</div><div className="map-label label-east">HIGHLANDS</div><div className="map-label label-south">S C O Z I A</div></div>}
            {visibleMarkers.map(m=><button key={m.id} className={'map-marker '+(selected===m.id?'selected':'')} style={{left:(m.map_x*100)+'%',top:(m.map_y*100)+'%', '--marker-color':categoryOf(m.category).color}} title={m.title} onClick={e=>{e.stopPropagation();setSelected(m.id)}}><span className="marker-pip">{categoryOf(m.category).icon}</span><span className="marker-tooltip">{m.title}</span></button>)}
          </div>
          <div className="map-instruction"><MapPin size={14}/> {session?'CLICCA SULLA MAPPA PER AGGIUNGERE UN MARKER':'ACCEDI PER INSERIRE NUOVI MARKER'}</div>
          <div className="map-coordinates">MAP DATA · HOGWARTS LEGACY <span>◇</span> WIZARDING ATLAS</div>
        </div>
        <div className="map-footer"><span><Sparkles size={15}/> {markers.length} luoghi catalogati</span><span>Coordinate normalizzate · Sistema relativo alla mappa</span></div>
      </section>
      {selectedMarker&&<aside className="detail-panel"><button className="close-detail" onClick={()=>setSelected(null)}><X size={18}/></button><span className="eyebrow">SCHEDA DEL LUOGO</span><div className="detail-icon" style={{color:categoryOf(selectedMarker.category).color}}>{categoryOf(selectedMarker.category).icon}</div><h2>{selectedMarker.title}</h2><span className="detail-category">{categoryOf(selectedMarker.category).label}</span><div className="status-pill">{STATUSES.find(s=>s.id===selectedMarker.status)?.label||selectedMarker.status}</div>{selectedMarker.description&&<p className="detail-description">{selectedMarker.description}</p>}{selectedMarker.difficulty&&<div className="detail-meta"><span>Difficoltà</span><b>{selectedMarker.difficulty}</b></div>}{selectedMarker.tags?.length>0&&<div className="tag-list">{selectedMarker.tags.map(t=><span key={t}>{t}</span>)}</div>}{session&&<div className="detail-actions"><button onClick={()=>openEdit(selectedMarker)}><Save size={15}/> MODIFICA</button><button className="delete" onClick={()=>deleteMarker(selectedMarker.id)}><Trash2 size={15}/> ELIMINA</button></div>}</aside>}
    </main>
    {notice&&<div className="toast" onClick={()=>setNotice('')}>{notice}<button><X size={14}/></button></div>}
    {loading&&<div className="loading-overlay"><div className="spinner"/>Sincronizzazione atlante...</div>}
    {authOpen&&<div className="modal-backdrop" onClick={()=>setAuthOpen(false)}><form className="dialog auth-dialog" onClick={e=>e.stopPropagation()} onSubmit={authenticate}><button type="button" className="dialog-close" onClick={()=>setAuthOpen(false)}><X/></button><div className="dialog-emblem">✦</div><span className="eyebrow">AREA RISERVATA</span><h2>{authMode==='login'?'Bentornato, esploratore':'Crea un accesso'}</h2><p>La consultazione dell'atlante è pubblica. Per aggiungere e gestire i marker serve un account autorizzato.</p><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)}/></label>{authMessage&&<div className="auth-message">{authMessage}</div>}<button className="primary-button" type="submit">{authMode==='login'?'ACCEDI':'REGISTRATI'}</button><button className="text-button" type="button" onClick={()=>{setAuthMode(authMode==='login'?'signup':'login');setAuthMessage('')}}>{authMode==='login'?'Non hai un account? Registrati':'Hai già un account? Accedi'}</button></form></div>}
    {modal&&<div className="modal-backdrop" onClick={()=>setModal(false)}><form className="dialog marker-dialog" onClick={e=>e.stopPropagation()} onSubmit={saveMarker}><button type="button" className="dialog-close" onClick={()=>setModal(false)}><X/></button><span className="eyebrow">ARCHIVIO DELL'ATLANTE</span><h2>{selected?'Modifica marker':'Nuovo marker'}</h2><p className="coord-line">Posizione sulla mappa · X {Math.round(pendingPoint.x*1000)/10}% / Y {Math.round(pendingPoint.y*1000)/10}%</p><label>Nome del luogo<input required maxLength={100} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="Es. Torre di San Bakar"/></label><label>Categoria<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label>Descrizione<textarea rows="4" value={draft.description||''} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder="Dettagli, indicazioni, informazioni utili..."/></label><div className="form-grid"><label>Stato<select value={draft.status||'unvisited'} onChange={e=>setDraft({...draft,status:e.target.value})}>{STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><label>Difficoltà<input value={draft.difficulty||''} onChange={e=>setDraft({...draft,difficulty:e.target.value})} placeholder="Es. Media"/></label></div><label>Tag <small>(separati da virgola)</small><input value={draft.tags||''} onChange={e=>setDraft({...draft,tags:e.target.value})} placeholder="tesoro, grotta, boss"/></label><button className="primary-button" type="submit" disabled={saving}>{saving?'SALVATAGGIO...':'SALVA NELL’ATLANTE'}</button></form></div>}
    {!supabase&&<div className="config-warning">Configurazione Supabase mancante: imposta le variabili VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</div>}
  </div>;
}