import { useRef, useState } from 'react';
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, PerspectiveCamera, RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../state/stores';
import type { ComponentEntity, ComponentType } from '../domain/types';

function ComponentMesh({ component: c, ghost = false }: { component: ComponentEntity; ghost?: boolean }) {
  const selected = useStore(s => s.selected === c.id); const setSelected = useStore(s => s.setSelected); const remove = useStore(s => s.remove); const move = useStore(s => s.move); const placing = useStore(s => s.placing); const place = useStore(s => s.place); const rotate = useStore(s => s.rotate);
  const color = ghost ? '#a7ed70' : c.status === 'failed' ? '#ff5262' : c.status === 'warning' ? '#ffbd4a' : c.type === 'pipe' ? '#97a9a9' : c.type === 'valve' ? '#dcae61' : c.type === 'tank' ? '#8fa5a5' : '#65c9d4';
  const down = (e: ThreeEvent<PointerEvent>) => { if (ghost) return; e.stopPropagation(); if (placing) { setSelected(c.id); return; } setSelected(c.id); };
  const onKey = undefined;
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
function GroundInteraction() {
  const placing = useStore(s => s.placing); const place = useStore(s => s.place); const setSelected = useStore(s => s.setSelected); const components = useStore(s => s.components); const [cursor, setCursor] = useState<[number,number,number]>([0,.2,0]); const [rot, setRot] = useState(0);
  const worldPosition = (e: ThreeEvent<PointerEvent>) => { const x = Math.round(e.point.x * 2) / 2, z = Math.round(e.point.z * 2) / 2; let p: [number,number,number] = [x,.2,z]; let nearest: ComponentEntity | undefined; let best = 1.15; for (const c of components) { const d = Math.hypot(c.position[0]-x,c.position[2]-z); if(d<best){best=d;nearest=c;} } if(nearest){p=[Math.round((nearest.position[0]+(nearest.type==='tank'?1:2))*2)/2,.2,nearest.position[2]];} return p; };
  return <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.035,0]} onPointerMove={e=>{if(placing)setCursor(worldPosition(e));}} onPointerDown={e=>{e.stopPropagation(); if(placing) place(placing,worldPosition(e),rot); else setSelected(null);}}><planeGeometry args={[100,100]}/><meshBasicMaterial transparent opacity={0} /></mesh>;
}
function SceneContents() {
  const components = useStore(s=>s.components); const placing = useStore(s=>s.placing); const selected = useStore(s=>s.selected); const connections = useStore(s=>s.connections); const [ghostPosition,setGhostPosition] = useState<[number,number,number]>([0,.2,0]); const [rotation,setRotation] = useState(0); const place = useStore(s=>s.place); const setSelected = useStore(s=>s.setSelected); const move=useStore(s=>s.move); const remove=useStore(s=>s.remove); const rotate=useStore(s=>s.rotate); const { camera, gl }=useThree();
  const base = placing ? components.find(c=>c.type===placing) ?? {id:'ghost',type:placing,name:'Preview',position:ghostPosition,rotation,material:'PVC',diameter:.25,length:2,maxPressure:70,pressureLoss:0,flowResistance:1,open:true,opening:1,ports:[],status:'normal' as const,pressure:0,flow:0} : null;
  const keyDown = (e: KeyboardEvent) => { if(e.key.toLowerCase()==='q'||e.key.toLowerCase()==='e'||e.key.toLowerCase()==='r'){ if(placing){setRotation(v=>v+Math.PI/2); } else if(selected){const c=components.find(x=>x.id===selected); if(c)rotate(selected,c.rotation+Math.PI/2);} } if(e.key==='Escape') useStore.getState().setPlacing(null); if(e.key==='Delete'||e.key==='Backspace'){if(selected)remove(selected);} if(e.key.startsWith('Arrow')&&selected){const c=components.find(x=>x.id===selected); if(c){const dx=e.key==='ArrowLeft'?-0.5:e.key==='ArrowRight'?.5:0,dz=e.key==='ArrowUp'?-0.5:e.key==='ArrowDown'?.5:0;move(selected,[c.position[0]+dx,c.position[1],c.position[2]+dz]);}} };
  useState(()=>{window.addEventListener('keydown',keyDown); return ()=>window.removeEventListener('keydown',keyDown);});
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
export default function NetworkScene(){return <Canvas shadows dpr={[1,1.8]} gl={{antialias:true}}><PerspectiveCamera makeDefault position={[9,8,11]} fov={42}/><SceneContents/></Canvas>;}
