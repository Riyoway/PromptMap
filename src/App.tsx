import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Text, Transformer } from 'react-konva';
import Konva from 'konva';
import {
  Upload,
  MousePointer2,
  MapPin,
  SquareDashed,
  Download,
  Copy,
  Save,
  FolderOpen,
  Trash2,
  ImagePlus,
  Sparkles,
  RotateCcw,
  ChevronDown,
  Check,
  Move,
  Focus,
  ZoomIn,
  ZoomOut,
  CheckSquare2,
  X
} from 'lucide-react';
import { useAppStore } from './store';
import { compilePrompt, downloadText, elementLabel, makeProject, uid } from './utils';
import type { MapElement, ProjectData, Strength } from './types';
import './styles.css';

const CANVAS_W = 1100;
const CANVAS_H = 680;
const MIN_ZOOM = .25;
const MAX_ZOOM = 4;

type DraftRect = {x:number;y:number;w:number;h:number};
type ContextMenuState = {x:number;y:number;targetId?:string};

function normalizedRect(rect:DraftRect) {
  return {
    x: rect.w < 0 ? rect.x + rect.w : rect.x,
    y: rect.h < 0 ? rect.y + rect.h : rect.y,
    width: Math.abs(rect.w),
    height: Math.abs(rect.h)
  };
}

function App() {
  const store = useAppStore();
  const [image, setImage] = useState<HTMLImageElement>();
  const [imageName, setImageName] = useState<string>();
  const [draftBox, setDraftBox] = useState<DraftRect>();
  const [selectionBox, setSelectionBox] = useState<DraftRect>();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>();
  const [viewport, setViewport] = useState({x:0,y:0,scale:1});
  const [isPanning, setIsPanning] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const panRef = useRef<{pointerX:number;pointerY:number;offsetX:number;offsetY:number;moved:boolean} | null>(null);
  const lastPanMovedRef = useRef(false);
  const prompt = useMemo(() => compilePrompt(store.globalPrompt, store.elements), [store.globalPrompt, store.elements]);
  const selectedElements = store.elements.filter(element => store.selectedIds.includes(element.id));
  const selected = selectedElements.length === 1 ? selectedElements[0] : undefined;

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const pan = panRef.current;
      if (!pan) return;
      const deltaX = event.clientX - pan.pointerX;
      const deltaY = event.clientY - pan.pointerY;
      if (Math.hypot(deltaX, deltaY) > 4) pan.moved = true;
      if (!pan.moved) return;
      setViewport(current => ({
        ...current,
        x: pan.offsetX + deltaX,
        y: pan.offsetY + deltaY
      }));
    };
    const end = () => {
      if (!panRef.current) return;
      lastPanMovedRef.current = panRef.current.moved;
      panRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('blur', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('blur', end);
    };
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]')) return;
      if (event.key === 'Escape') {
        setContextMenu(undefined);
        store.select(undefined);
        return;
      }
      if (store.tool !== 'select') return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        store.selectAll();
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && store.selectedIds.length) {
        event.preventDefault();
        store.removeSelected();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [store]);

  const fit = useMemo(() => {
    if (!image) return { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H };
    const scale = Math.min(CANVAS_W / image.width, CANVAS_H / image.height);
    const width = image.width * scale, height = image.height * scale;
    return { x: (CANVAS_W-width)/2, y:(CANVAS_H-height)/2, width, height };
  }, [image]);

  function uploadImage(file?: File) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setImageName(file.name);
      setViewport({x:0,y:0,scale:1});
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function pointerPos() {
    const p = stageRef.current?.getPointerPosition();
    if (!p) return;
    return { x: (p.x-fit.x)/fit.width, y:(p.y-fit.y)/fit.height };
  }

  function onMouseDown(event: Konva.KonvaEventObject<MouseEvent>) {
    if (event.evt.button !== 0) return;
    if (event.target !== event.target.getStage() && event.target.name() !== 'canvas-surface') return;
    const p = pointerPos();
    if (!p || p.x<0 || p.y<0 || p.x>1 || p.y>1) return;
    if (store.tool === 'pin') {
      store.addElement({ id:uid(), label:elementLabel(store.elements.length), type:'pin', x:p.x, y:p.y, prompt:'', strength:'exact', allowOverflow:false, preserveAspectRatio:true });
    } else if (store.tool === 'box') {
      setDraftBox({x:p.x,y:p.y,w:0,h:0});
    } else {
      setSelectionBox({x:p.x,y:p.y,w:0,h:0});
    }
  }

  function onMouseMove() {
    const p = pointerPos();
    if (!p) return;
    if (draftBox && store.tool === 'box') {
      setDraftBox({ ...draftBox, w:p.x-draftBox.x, h:p.y-draftBox.y });
    } else if (selectionBox && store.tool === 'select') {
      const x = Math.min(1, Math.max(0, p.x));
      const y = Math.min(1, Math.max(0, p.y));
      setSelectionBox({ ...selectionBox, w:x-selectionBox.x, h:y-selectionBox.y });
    }
  }

  function onMouseUp() {
    if (selectionBox) {
      const selection = normalizedRect(selectionBox);
      if (selection.width * fit.width < 5 && selection.height * fit.height < 5) {
        store.select(undefined);
      } else {
        const ids = store.elements.filter(element => {
          if (element.type === 'pin') {
            return element.x >= selection.x && element.x <= selection.x + selection.width && element.y >= selection.y && element.y <= selection.y + selection.height;
          }
          const right = element.x + (element.width ?? 0);
          const bottom = element.y + (element.height ?? 0);
          return element.x <= selection.x + selection.width && right >= selection.x && element.y <= selection.y + selection.height && bottom >= selection.y;
        }).map(element => element.id);
        store.selectMany(ids);
      }
      setSelectionBox(undefined);
      return;
    }
    if (!draftBox) return;
    const box = normalizedRect(draftBox);
    if (box.width > .015 && box.height > .015) {
      store.addElement({ id:uid(), label:elementLabel(store.elements.length), type:'box', x:box.x, y:box.y, width:box.width, height:box.height, prompt:'', strength:'near', allowOverflow:false, preserveAspectRatio:true });
    }
    setDraftBox(undefined);
  }

  function exportPng() {
    const uri = stageRef.current?.toDataURL({ pixelRatio: 2 });
    if (!uri) return;
    const a = document.createElement('a');
    a.download = `${store.projectName.replace(/\s+/g,'-').toLowerCase()}-annotated.png`;
    a.href = uri;
    a.click();
  }

  function saveProject() {
    downloadText(`${store.projectName.replace(/\s+/g,'-').toLowerCase()}.promptmap.json`, JSON.stringify(makeProject(store.projectName, store.globalPrompt, store.elements, imageName), null, 2));
  }

  function loadProject(file?: File) {
    if (!file) return;
    file.text().then(t => {
      const p = JSON.parse(t) as ProjectData;
      store.loadProject(p);
      setImageName(p.imageName);
      setViewport({x:0,y:0,scale:1});
    });
  }

  function beginPan(event: React.PointerEvent<HTMLElement>) {
    if (event.button !== 2 || !image || !(event.target as Element).closest('.canvas-wrap')) return;
    event.preventDefault();
    setContextMenu(undefined);
    lastPanMovedRef.current = false;
    panRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: viewport.x,
      offsetY: viewport.y,
      moved: false
    };
    setIsPanning(true);
  }

  function openContextMenu(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    const didPan = panRef.current?.moved || lastPanMovedRef.current;
    lastPanMovedRef.current = false;
    if (didPan) return;

    let targetId: string | undefined;
    if ((event.target as Element).closest('.canvas-wrap')) {
      const stage = stageRef.current;
      const pointer = stage?.getPointerPosition();
      const name = pointer ? stage?.getIntersection(pointer)?.name() : undefined;
      if (name?.startsWith('annotation:')) targetId = name.slice('annotation:'.length);
    }
    if (targetId && !store.selectedIds.includes(targetId)) store.select(targetId);
    setContextMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 244)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 330)),
      targetId
    });
  }

  function zoomAt(factor:number, point:{x:number;y:number} = {x:0,y:0}) {
    setViewport(current => {
      const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.scale * factor));
      if (scale === current.scale) return current;
      const ratio = scale / current.scale;
      return {
        scale,
        x: point.x - (point.x - current.x) * ratio,
        y: point.y - (point.y - current.y) * ratio
      };
    });
  }

  function zoomCanvas(event: React.WheelEvent<HTMLElement>) {
    if (!image) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
    const factor = Math.exp(-Math.max(-160, Math.min(160, delta)) * .0015);
    zoomAt(factor, {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2
    });
  }

  function resetViewport() {
    setViewport({x:0,y:0,scale:1});
  }

  return <div className="app-shell" onPointerDownCapture={event=>{
    if (contextMenu && event.button === 0 && !(event.target as Element).closest('.context-menu')) setContextMenu(undefined);
  }}>
    <header className="topbar">
      <div className="brand"><div className="logo"><img src="./promptmap-icon.png" alt="" aria-hidden="true" /></div><div><b>PromptMap</b><span>Visual placement compiler</span></div></div>
      <input className="project-name" aria-label="Project name" value={store.projectName} onChange={e=>store.setProjectName(e.target.value)} />
      <div className="header-actions">
        <button onClick={()=>projectRef.current?.click()}><FolderOpen size={16}/> Open</button>
        <button onClick={saveProject}><Save size={16}/> Save</button>
        <button className="primary" disabled={!image} onClick={exportPng}><Download size={16}/> Export PNG</button>
      </div>
    </header>

    <main className="workspace">
      <aside className="leftbar panel">
        <div className="section-title">Tools</div>
        <div className="tool-grid">
          <ToolButton active={store.tool==='select'} onClick={()=>store.setTool('select')} icon={<MousePointer2/>} label="Select" />
          <ToolButton active={store.tool==='pin'} onClick={()=>store.setTool('pin')} icon={<MapPin/>} label="Pin" />
          <ToolButton active={store.tool==='box'} onClick={()=>store.setTool('box')} icon={<SquareDashed/>} label="Box" />
          <ToolButton onClick={()=>fileRef.current?.click()} icon={<ImagePlus/>} label="Image" />
        </div>
        <div className="section-title row">Elements <span>{store.elements.length}</span></div>
        {store.tool === 'select' && store.elements.length > 0 && <div className="selection-toolbar" aria-label="Selection actions">
          <button onClick={store.selectAll}><CheckSquare2 size={14}/> Select all</button>
          <button className="danger" disabled={!store.selectedIds.length} onClick={store.removeSelected}><Trash2 size={14}/> Delete {store.selectedIds.length || ''}</button>
        </div>}
        <div className="element-list">
          {store.elements.map(e => <button key={e.id} aria-pressed={store.selectedIds.includes(e.id)} onClick={event=>store.select(e.id, event.shiftKey && store.tool==='select')} className={store.selectedIds.includes(e.id)?'element active':'element'}>
            <span className="badge">{e.label}</span><span><b>{e.prompt || (e.type==='pin'?'Untitled pin':'Untitled region')}</b><small>{e.type} · {e.strength}</small></span>
          </button>)}
          {!store.elements.length && <div className="empty">Place a pin or drag a box on the image.</div>}
        </div>
        <button className="danger ghost bottom" onClick={store.clear}><RotateCcw size={15}/> Reset project</button>
      </aside>

      <section
        className={isPanning ? 'canvas-area is-panning' : 'canvas-area'}
        data-tool={store.tool}
        onPointerDown={beginPan}
        onWheel={zoomCanvas}
        onContextMenu={openContextMenu}
        aria-label="Annotation canvas"
      >
        {!image && <button className="dropzone" onClick={()=>fileRef.current?.click()}><Upload size={34}/><b>Upload a reference image</b><span>PNG, JPG, WEBP</span></button>}
        {image && <div className="canvas-hud" aria-label="Canvas navigation">
          <span><Move size={14}/> Right-drag · Wheel to zoom</span>
          <div className="zoom-controls" aria-label="Zoom controls">
            <button aria-label="Zoom out" data-tooltip="Zoom out" onClick={()=>zoomAt(1/1.2)}><ZoomOut size={14}/></button>
            <output aria-live="polite">{Math.round(viewport.scale*100)}%</output>
            <button aria-label="Zoom in" data-tooltip="Zoom in" onClick={()=>zoomAt(1.2)}><ZoomIn size={14}/></button>
          </div>
          {(viewport.x !== 0 || viewport.y !== 0 || viewport.scale !== 1) && <button onClick={resetViewport}><Focus size={14}/> Reset view</button>}
        </div>}
        <div className="canvas-wrap" style={{display:image?'block':'none', transform:`translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`}}>
          <Stage ref={stageRef} width={CANVAS_W} height={CANVAS_H} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
            <Layer>
              {image && <><Rect name="canvas-surface" x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#11151a"/><KonvaImage name="canvas-surface" image={image} {...fit}/></>}
              {store.elements.map((e,i)=><Annotation key={e.id} e={e} index={i} fit={fit} selected={store.selectedIds.includes(e.id)} editable={store.tool==='select'} onSelect={additive=>store.select(e.id, additive && store.tool==='select')} onChange={(patch)=>store.updateElement(e.id,patch)}/>) }
              {draftBox && <Rect listening={false} x={fit.x+draftBox.x*fit.width} y={fit.y+draftBox.y*fit.height} width={draftBox.w*fit.width} height={draftBox.h*fit.height} stroke="#fff" dash={[8,6]} fill="rgba(255,255,255,.08)"/>}
              {selectionBox && (()=>{const selection=normalizedRect(selectionBox);return <Rect listening={false} x={fit.x+selection.x*fit.width} y={fit.y+selection.y*fit.height} width={selection.width*fit.width} height={selection.height*fit.height} stroke="#8ac8ff" strokeWidth={1.5} dash={[5,4]} fill="rgba(138,200,255,.12)"/>})()}
            </Layer>
          </Stage>
        </div>
      </section>

      <aside className="rightbar panel">
        <div className="section-title">Project direction</div>
        <textarea aria-label="Project direction" placeholder="Describe the overall image, mood, and goal..." value={store.globalPrompt} onChange={e=>store.setGlobalPrompt(e.target.value)} />
        {selected ? <ElementEditor element={selected} update={(p)=>store.updateElement(selected.id,p)} remove={()=>store.removeElement(selected.id)} /> : selectedElements.length > 1 ? <MultiSelectionEditor elements={selectedElements} remove={store.removeSelected}/> : <div className="inspector-empty"><Sparkles size={28}/><b>Select an element</b><span>Drag across the canvas or Shift-click to select multiple.</span></div>}
        <div className="prompt-box">
          <div className="section-title row">Compiled prompt <button className="icon-btn" aria-label="Copy compiled prompt" data-tooltip="Copy" onClick={()=>navigator.clipboard.writeText(prompt)}><Copy size={15}/></button></div>
          <pre>{prompt}</pre>
          <button className="wide" onClick={()=>navigator.clipboard.writeText(prompt)}><Copy size={16}/> Copy prompt</button>
        </div>
      </aside>
    </main>
    <input ref={fileRef} type="file" accept="image/*" hidden onChange={e=>uploadImage(e.target.files?.[0])}/>
    <input ref={projectRef} type="file" accept="application/json,.json" hidden onChange={e=>loadProject(e.target.files?.[0])}/>
    {contextMenu && <div className="context-menu" role="menu" aria-label="Canvas actions" style={{left:contextMenu.x,top:contextMenu.y}} onContextMenu={event=>event.preventDefault()}>
      <div className="context-menu-header"><span><MousePointer2 size={15}/>{contextMenu.targetId?'Selection':'Canvas'}</span><small>{store.selectedIds.length ? `${store.selectedIds.length} selected` : 'No selection'}</small></div>
      <button role="menuitem" disabled={!store.elements.length} onClick={()=>{store.selectAll();setContextMenu(undefined)}}><CheckSquare2 size={16}/><span>Select all<small>Ctrl / Cmd + A</small></span></button>
      <button role="menuitem" disabled={!store.selectedIds.length} onClick={()=>{store.select(undefined);setContextMenu(undefined)}}><X size={16}/><span>Deselect all<small>Esc</small></span></button>
      <div className="context-divider"/>
      <button role="menuitem" className="danger" disabled={!store.selectedIds.length} onClick={()=>{store.removeSelected();setContextMenu(undefined)}}><Trash2 size={16}/><span>Delete selection<small>Delete</small></span></button>
      <button role="menuitem" className="danger" disabled={!store.elements.length} onClick={()=>{store.removeAll();setContextMenu(undefined)}}><RotateCcw size={16}/><span>Clear all annotations</span></button>
      <div className="context-divider"/>
      <button role="menuitem" disabled={viewport.x===0&&viewport.y===0&&viewport.scale===1} onClick={()=>{resetViewport();setContextMenu(undefined)}}><Focus size={16}/><span>Reset view<small>100%</small></span></button>
    </div>}
  </div>;
}

function ToolButton({active,onClick,icon,label}:{active?:boolean;onClick:()=>void;icon:React.ReactNode;label:string}) {
  return <button className={active?'tool active':'tool'} aria-pressed={active === undefined ? undefined : active} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function Annotation({e,index,fit,selected,editable,onSelect,onChange}:{e:MapElement;index:number;fit:{x:number;y:number;width:number;height:number};selected:boolean;editable:boolean;onSelect:(additive:boolean)=>void;onChange:(p:Partial<MapElement>)=>void}) {
  const trRef = useRef<Konva.Transformer>(null);
  const shapeRef = useRef<Konva.Rect>(null);
  if (e.type === 'pin') {
    const x = fit.x+e.x*fit.width, y = fit.y+e.y*fit.height;
    return <>
      <Circle name={`annotation:${e.id}`} x={x} y={y} radius={17} fill={selected?'#fff':'#111'} stroke="#fff" strokeWidth={2} draggable={editable} onClick={event=>onSelect(event.evt.shiftKey)} onTap={()=>onSelect(false)} onDragEnd={ev=>onChange({x:(ev.target.x()-fit.x)/fit.width,y:(ev.target.y()-fit.y)/fit.height})}/>
      <Text x={x-17} y={y-17} width={34} height={34} align="center" verticalAlign="middle" text={e.label||elementLabel(index)} fill={selected?'#111':'#fff'} fontFamily="Arial, sans-serif" fontStyle="bold" fontSize={15} listening={false}/>
    </>;
  }
  const x = fit.x+e.x*fit.width, y = fit.y+e.y*fit.height, w = (e.width??.2)*fit.width, h = (e.height??.15)*fit.height;
  return <>
    <Rect name={`annotation:${e.id}`} ref={shapeRef} x={x} y={y} width={w} height={h} fill="rgba(0,0,0,.22)" stroke="#fff" strokeWidth={selected?3:2} dash={selected?[]:[9,6]} draggable={editable} onClick={event=>onSelect(event.evt.shiftKey)} onTap={()=>onSelect(false)} onDragEnd={ev=>onChange({x:(ev.target.x()-fit.x)/fit.width,y:(ev.target.y()-fit.y)/fit.height})} onTransformEnd={()=>{const n=shapeRef.current;if(!n)return;const sx=n.scaleX(),sy=n.scaleY();n.scaleX(1);n.scaleY(1);onChange({x:(n.x()-fit.x)/fit.width,y:(n.y()-fit.y)/fit.height,width:Math.max(.01,n.width()*sx/fit.width),height:Math.max(.01,n.height()*sy/fit.height)})}}/>
    <Rect x={x+8} y={y+8} width={30} height={30} fill="#fff" cornerRadius={15} listening={false}/>
    <Text x={x+8} y={y+8} width={30} height={30} align="center" verticalAlign="middle" text={e.label||elementLabel(index)} fill="#111" fontFamily="Arial, sans-serif" fontStyle="bold" fontSize={15} listening={false}/>
    {selected && editable && <Transformer ref={trRef} nodes={shapeRef.current?[shapeRef.current]:[]} rotateEnabled={false} borderStroke="#fff" anchorStroke="#111" anchorFill="#fff"/>}
  </>;
}

function ElementEditor({element,update,remove}:{element:MapElement;update:(p:Partial<MapElement>)=>void;remove:()=>void}) {
  return <div className="editor">
    <div className="section-title row">Element {element.label}<button className="icon-btn danger" aria-label={`Delete element ${element.label}`} data-tooltip="Delete" onClick={remove}><Trash2 size={15}/></button></div>
    <label>Name / label<input value={element.prompt} placeholder="e.g. Primary download button" onChange={e=>update({prompt:e.target.value})}/></label>
    <div className="field-label">Placement strength<StrengthSelect value={element.strength} onChange={value=>update({strength:value})}/></div>
    <div className="checks"><Switch checked={element.allowOverflow} onChange={checked=>update({allowOverflow:checked})} label="Allow overflow"/><Switch checked={element.preserveAspectRatio} onChange={checked=>update({preserveAspectRatio:checked})} label="Preserve aspect ratio"/></div>
    <div className="coords"><span>X {Math.round(element.x*100)}%</span><span>Y {Math.round(element.y*100)}%</span>{element.type==='box'&&<><span>W {Math.round((element.width??0)*100)}%</span><span>H {Math.round((element.height??0)*100)}%</span></>}</div>
  </div>;
}

function MultiSelectionEditor({elements,remove}:{elements:MapElement[];remove:()=>void}) {
  return <div className="multi-selection">
    <div className="multi-selection-icon"><CheckSquare2 size={22}/></div>
    <div><b>{elements.length} elements selected</b><span>Shift-click or drag to refine the selection.</span></div>
    <div className="selected-labels">{elements.map(element=><span key={element.id}>{element.label}</span>)}</div>
    <button className="delete-selection" onClick={remove}><Trash2 size={15}/> Delete selected</button>
  </div>;
}

const strengthOptions: {value:Strength;label:string;description:string}[] = [
  {value:'exact', label:'Exact', description:'Keep this precise position'},
  {value:'near', label:'Near', description:'Stay close to this area'},
  {value:'flexible', label:'Flexible', description:'Allow composition changes'},
  {value:'reference', label:'Reference only', description:'Use as a visual hint'}
];

function StrengthSelect({value,onChange}:{value:Strength;onChange:(value:Strength)=>void}) {
  const [open,setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = strengthOptions.find(option=>option.value===value)!;

  useEffect(()=>{
    const close = (event:PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event:KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return ()=>{
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  },[]);

  return <div className={open?'custom-select open':'custom-select'} ref={rootRef}>
    <button className="select-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(currentOpen=>!currentOpen)}>
      <span><b>{current.label}</b><small>{current.description}</small></span><ChevronDown size={16}/>
    </button>
    {open && <div className="select-menu" role="listbox" aria-label="Placement strength">
      {strengthOptions.map(option=><button key={option.value} type="button" role="option" aria-selected={option.value===value} onClick={()=>{onChange(option.value);setOpen(false)}}>
        <span><b>{option.label}</b><small>{option.description}</small></span>{option.value===value&&<Check size={16}/>} 
      </button>)}
    </div>}
  </div>;
}

function Switch({checked,onChange,label}:{checked:boolean;onChange:(checked:boolean)=>void;label:string}) {
  return <button className="switch-row" type="button" role="switch" aria-checked={checked} onClick={()=>onChange(!checked)}>
    <span>{label}</span><span className="switch-track" aria-hidden="true"><span/></span>
  </button>;
}

export default App;
