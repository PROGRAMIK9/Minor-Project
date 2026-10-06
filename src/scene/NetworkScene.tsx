import { Component, useEffect, useState } from 'react';
import type { ErrorInfo, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useStore } from '../state/stores';
import type { ComponentEntity, ComponentType } from '../domain/types';

function ComponentMesh({ component: c, ghost = false }: { component: ComponentEntity; ghost?: boolean }) {
  const selected = useStore(s => s.selected === c.id); const setSelected = useStore(s => s.setSelected); const remove = useStore(s => s.remove); const move = useStore(s => s.move); const placing = useStore(s => s.placing); const place = useStore(s => s.place); const rotate = useStore(s => s.rotate);
  const color = ghost ? '#a7ed70' : c.status === 'failed' ? '#ff5262' : c.status === 'warning' ? '#ffbd4a' : c.type === 'pipe' ? '#97a9a9' : c.type === 'valve' ? '#dcae61' : c.type === 'tank' ? '#8fa5a5' : '#65c9d4';
  const down = (e: ThreeEvent<PointerEvent>) => { if (ghost) return; e.stopPropagation(); if (placing) { setSelected(c.id); return; } setSelected(c.id); };
  return <group position={c.position} rotation={[0, c.rotation, 0]} onPointerDown={down}>
    {c.type === 'pipe' && <><mesh castShadow><cylinderGeometry args={[.15, .15, 1.9, 16]} /><meshStandardMaterial color={color} metalness={.65} roughness={.3} transparent={ghost} opacity={ghost ? .48 : 1} /></mesh><mesh rotation={[0,0,Math.PI/2]} position={[-1,0,0]}><torusGeometry args={[.15,.035,8,24]} /><meshStandardMaterial color="#c1cecc" metalness={.8} /></mesh><mesh rotation={[0,0,Math.PI/2]} position={[1,0,0]}><torusGeometry args={[.15,.035,8,24]} /><meshStandardMaterial color="#c1cecc" metalness={.8} /></mesh></>}
    {c.type === 'valve' && <><mesh castShadow><cylinderGeometry args={[.15,.15,.78,16]} /><meshStandardMaterial color={color} metalness={.8} roughness={.22} transparent={ghost} opacity={ghost ? .5 : 1}/></mesh><mesh position={[0,.3,0]} castShadow><boxGeometry args={[.08,.55,.08]}/><meshStandardMaterial color="#e8ba6b" metalness={.65}/></mesh><mesh position={[0,.59,0]} castShadow><torusGeometry args={[.19,.035,8,24]}/><meshStandardMaterial color="#d4aa60" metalness={.7}/></mesh></>}
    {c.type === 'tank' && <><mesh position={[0,.25,0]} castShadow><cylinderGeometry args={[.48,.48,1.35,32]}/><meshStandardMaterial color={color} metalness={.75} roughness={.27}/></mesh><mesh position={[0,.94,0]}><cylinderGeometry args={[.48,.48,.08,32]}/><meshStandardMaterial color="#bcc7c4" metalness={.8}/></mesh><mesh position={[0,-.46,0]}><cylinderGeometry args={[.48,.48,.08,32]}/><meshStandardMaterial color="#546969" metalness={.7}/></mesh></>}
    {c.type === 'tap' && <><mesh position={[0,.04,0]} castShadow><cylinderGeometry args={[.09,.09,.56,12]}/><meshStandardMaterial color={color} metalness={.85}/></mesh><mesh position={[.13,.27,0]} rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[.07,.07,.35,12]}/><meshStandardMaterial color="#d5e4e1" metalness={.9}/></mesh><mesh position={[.13,.08,0]}><torusGeometry args={[.1,.018,8,20]}/><meshStandardMaterial color="#b5ceca" metalness={.9}/></mesh></>}
    {selected && !ghost && <mesh position={[0,0,0]}><sphereGeometry args={[.08,12,12]}/><meshBasicMaterial color="#b3ef77"/></mesh>}
    {!ghost && c.status === 'failed' && <mesh position={[0,.5,.05]}><sphereGeometry args={[.13,12,12]}/><meshBasicMaterial color="#ff5365"/></mesh>}
    {!ghost && <><mesh position={[-.5,0,0]}><sphereGeometry args={[.045,10,10]}/><meshBasicMaterial color="#70d8bd"/></mesh><mesh position={[.5,0,0]}><sphereGeometry args={[.045,10,10]}/><meshBasicMaterial color="#70d8bd"/></mesh></>}
    {ghost && <mesh position={[0,0,0]}><boxGeometry args={[2.2,.08,.08]}/><meshBasicMaterial color="#a7ed70" transparent opacity={.2}/></mesh>}
    <group onPointerDown={down} />
  </group>;
}
function SceneContents() {
  const components = useStore(s=>s.components); const placing = useStore(s=>s.placing); const selected = useStore(s=>s.selected); const connections = useStore(s=>s.connections); const [ghostPosition,setGhostPosition] = useState<[number,number,number]>([0,.2,0]); const [rotation,setRotation] = useState(0); const place = useStore(s=>s.place); const setSelected = useStore(s=>s.setSelected); const move=useStore(s=>s.move); const remove=useStore(s=>s.remove); const rotate=useStore(s=>s.rotate); const { camera, gl }=useThree();
  const base = placing ? components.find(c=>c.type===placing) ?? {id:'ghost',type:placing,name:'Preview',position:ghostPosition,rotation,material:'PVC',diameter:.25,length:2,maxPressure:70,pressureLoss:0,flowResistance:1,open:true,opening:1,ports:[],status:'normal' as const,pressure:0,flow:0} : null;
  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => { if(e.key.toLowerCase()==='q'||e.key.toLowerCase()==='e'||e.key.toLowerCase()==='r'){ if(placing){setRotation(v=>v+Math.PI/2); } else if(selected){const c=components.find(x=>x.id===selected); if(c)rotate(selected,c.rotation+Math.PI/2);} } if(e.key==='Escape') useStore.getState().setPlacing(null); if(e.key==='Delete'||e.key==='Backspace'){if(selected)remove(selected);} if(e.key.startsWith('Arrow')&&selected){const c=components.find(x=>x.id===selected); if(c){const dx=e.key==='ArrowLeft'?-0.5:e.key==='ArrowRight'?.5:0,dz=e.key==='ArrowUp'?-0.5:e.key==='ArrowDown'?.5:0;move(selected,[c.position[0]+dx,c.position[1],c.position[2]+dz]);}} };
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  }, [placing, selected, components, move, remove, rotate]);
  const getPos=(e:ThreeEvent<PointerEvent>):[number,number,number]=>{let p:[number,number,number]=[Math.round(e.point.x*2)/2,.2,Math.round(e.point.z*2)/2]; const snap=components.find(c=>Math.hypot(c.position[0]-p[0],c.position[2]-p[2])<1.2); if(snap) p=[Math.round((snap.position[0]+(snap.type==='tank'?1:2))*2)/2,.2,snap.position[2]]; return p;};
  return <>
    <ambientLight intensity={1.4}/><directionalLight position={[4,8,5]} intensity={2.4} castShadow shadow-mapSize={[2048,2048]}/><pointLight position={[-4,4,1]} intensity={18} color="#7bb9bb" distance={16}/>
    <Grid args={[40,40]} position={[0,-.04,0]} cellSize={1} cellThickness={.55} cellColor="#344447" sectionSize={5} sectionThickness={1.2} sectionColor="#52696a" fadeDistance={26} infiniteGrid />
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.05,0]} onPointerMove={e=>placing&&setGhostPosition(getPos(e))} onPointerDown={e=>{e.stopPropagation();if(placing){place(placing,getPos(e),rotation);}else setSelected(null);}}><planeGeometry args={[100,100]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>
    {connections.map(c=>{const a=components.find(x=>x.id===c.fromComponent),b=components.find(x=>x.id===c.toComponent); if(!a||!b)return null; const mid:[number,number,number]=[(a.position[0]+b.position[0])/2,.2,(a.position[2]+b.position[2])/2]; const len=Math.hypot(a.position[0]-b.position[0],a.position[2]-b.position[2]); const angle=Math.atan2(b.position[2]-a.position[2],b.position[0]-a.position[0]);return <group key={c.id} position={mid} rotation={[0,-angle,Math.PI/2]}><mesh castShadow><cylinderGeometry args={[.135,.135,len,16]}/><meshStandardMaterial color="#9eaeab" metalness={.65} roughness={.3}/></mesh><mesh><cylinderGeometry args={[.18,.18,.07,16]}/><meshStandardMaterial color="#d1dfda" metalness={.85}/></mesh></group>;})}
    {components.map(c=><ComponentMesh key={c.id} component={c}/>)}
    {base&&<group position={ghostPosition} rotation={[0,rotation,0]} onPointerDown={e=>{e.stopPropagation();place(placing!,ghostPosition,rotation);}}><ComponentMesh component={{...base,position:[0,0,0],rotation:0}} ghost/></group>}
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.052,0]}><planeGeometry args={[100,100]}/><meshBasicMaterial transparent opacity={0} /></mesh>
    <OrbitControls makeDefault target={[0,0,0]} minDistance={6} maxDistance={24} maxPolarAngle={Math.PI/2.08} enableDamping dampingFactor={.07}/>
  </>;
}

function StaticNetwork() {
  const components = useStore(s => s.components);
  const connections = useStore(s => s.connections);
  const selected = useStore(s => s.selected);
  const setSelected = useStore(s => s.setSelected);
  const placing = useStore(s => s.placing);
  const place = useStore(s => s.place);
  const [rotation, setRotation] = useState(0);
  const scale = 74;
  const xs = components.map(c => c.position[0]);
  const zs = components.map(c => c.position[2]);
  const minX = Math.min(-5, ...xs) - 1, maxX = Math.max(5, ...xs) + 1;
  const minZ = Math.min(-3, ...zs) - 1, maxZ = Math.max(3, ...zs) + 1;
  const width = (maxX - minX) * scale, height = (maxZ - minZ) * scale;
  const point = (x: number, z: number) => ({ x: (x - minX) * scale, y: (z - minZ) * scale });
  const glyph: Record<ComponentEntity['type'], string> = { tank: 'TANK', pipe: 'PIPE', valve: 'VALVE', tap: 'TAP' };
  const colors: Record<ComponentEntity['type'], string> = { tank: '#8fa5a5', pipe: '#97a9a9', valve: '#dcae61', tap: '#65c9d4' };
  const centerX = point(0, 0).x, centerY = point(0, 0).y;
  const doPlace = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!placing) { setSelected(null); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round((event.clientX - rect.left) / rect.width * width / scale + minX);
    const z = Math.round((event.clientY - rect.top) / rect.height * height / scale + minZ);
    place(placing, [x, .2, z], rotation);
  };
  return <div className="fallback-scene" aria-label="2D plumbing network editor" onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}>
    <div className="fallback-scene-note"><span className="fallback-badge">2D EDITOR</span> WebGL is unavailable. Network editing remains active.</div>
    <div className="fallback-controls"><button onClick={() => setRotation(r => r + Math.PI / 2)}>↻ Rotate</button><span>Click a component to inspect · click empty space to place</span></div>
    <div className="fallback-scroll"><svg viewBox={`0 0 ${width} ${height}`} onClick={doPlace} role="img" aria-label="Plumbing network components and connections">
      <defs><pattern id="fallback-grid" width={scale / 2} height={scale / 2} patternUnits="userSpaceOnUse"><path d={`M ${scale / 2} 0 L 0 0 0 ${scale / 2}`} fill="none" stroke="#293535" strokeWidth="1"/></pattern></defs>
      <rect width={width} height={height} fill="url(#fallback-grid)"/>
      <line x1={centerX} y1="0" x2={centerX} y2={height} stroke="#be776733" strokeWidth="1"/><line x1="0" y1={centerY} x2={width} y2={centerY} stroke="#68a48f33" strokeWidth="1"/>
      {connections.map(c => { const a = components.find(v => v.id === c.fromComponent), b = components.find(v => v.id === c.toComponent); if (!a || !b) return null; const p1 = point(a.position[0], a.position[2]), p2 = point(b.position[0], b.position[2]); return <g key={c.id}><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#111819" strokeWidth="19" strokeLinecap="round"/><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#9eaeab" strokeWidth="10" strokeLinecap="round"/><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#d2ded7" strokeWidth="2" strokeLinecap="round"/></g>; })}
      {components.map(c => { const p = point(c.position[0], c.position[2]); const color = c.status === 'failed' ? '#ff5262' : c.status === 'warning' ? '#ffbd4a' : colors[c.type]; const isSelected = selected === c.id; return <g key={c.id} transform={`translate(${p.x} ${p.y}) rotate(${c.rotation * 180 / Math.PI})`} onClick={e => { e.stopPropagation(); setSelected(c.id); }} style={{ cursor: 'pointer' }}><circle r={isSelected ? 27 : 23} fill={isSelected ? '#a7ed7022' : '#121819'} stroke={isSelected ? '#a7ed70' : color} strokeWidth={isSelected ? 3 : 2}/><circle r="15" fill={color} opacity=".2" stroke={color}/><text y="4" textAnchor="middle" fill={color} fontSize="9" fontFamily="DM Mono" fontWeight="bold">{glyph[c.type]}</text>{c.status === 'failed' && <circle cx="18" cy="-18" r="6" fill="#ff5262"/>}<text y="38" textAnchor="middle" fill="#b6c3ba" fontSize="10" fontFamily="DM Sans">{c.name}</text><text y="51" textAnchor="middle" fill="#73827b" fontSize="8" fontFamily="DM Mono">{c.pressure.toFixed(0)} PSI</text></g>; })}
    </svg></div>
  </div>;
}

class CanvasErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function NetworkScene() {
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) { const extension = gl.getExtension('WEBGL_lose_context'); extension?.loseContext(); }
      setWebglAvailable(Boolean(gl));
    } catch { setWebglAvailable(false); }
  }, []);
  if (webglAvailable === null) return <div className="scene-loading">Preparing network view…</div>;
  if (!webglAvailable) return <StaticNetwork/>;
  return <CanvasErrorBoundary onError={() => setWebglAvailable(false)}><Canvas shadows dpr={[1,1.5]} gl={{antialias:true, powerPreference:'low-power'}} fallback={<StaticNetwork/>}><PerspectiveCamera makeDefault position={[9,8,11]} fov={42}/><SceneContents/></Canvas></CanvasErrorBoundary>;
}
