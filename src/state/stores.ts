import { create } from 'zustand';
import { catalog } from '../domain/catalog';
import type { Diagnostic } from '../domain/simulation';
import type { ComponentEntity, ComponentType, Connection, Vec3 } from '../domain/types';
import { projectApi } from '../services/api';
const id = () => crypto.randomUUID();
const initial: ComponentEntity[] = [
  { id: 'tank-main', type: 'tank', name: 'Pressure Tank', position: [-4, 0.6, 0], rotation: 0, material: 'Steel', diameter: .5, length: 1, maxPressure: 200, pressureLoss: 0, flowResistance: 0, open: true, opening: 1, ports: catalog[3].ports, status: 'normal', pressure: 40, flow: 0 },
  { id: 'pipe-main', type: 'pipe', name: 'PVC Pipe', position: [-1.5, .2, 0], rotation: 0, material: 'PVC', diameter: .25, length: 2, maxPressure: 70, pressureLoss: 2, flowResistance: 1, open: true, opening: 1, ports: catalog[0].ports, status: 'normal', pressure: 38, flow: 0 },
  { id: 'valve-main', type: 'valve', name: 'Ball Valve', position: [1, .2, 0], rotation: 0, material: 'Brass', diameter: .25, length: 1, maxPressure: 150, pressureLoss: 1, flowResistance: 2, open: true, opening: 1, ports: catalog[1].ports, status: 'normal', pressure: 37, flow: 0 },
  { id: 'tap-main', type: 'tap', name: 'Outlet Tap', position: [3.5, .2, 0], rotation: 0, material: 'Chrome', diameter: .25, length: 1, maxPressure: 120, pressureLoss: 0, flowResistance: 1, open: true, opening: 1, ports: catalog[2].ports, status: 'normal', pressure: 37, flow: 0 },
];
const initialConnections: Connection[] = [
  { id: 'c1', fromComponent: 'tank-main', fromPort: 'inlet', toComponent: 'pipe-main', toPort: 'inlet' },
  { id: 'c2', fromComponent: 'pipe-main', fromPort: 'outlet', toComponent: 'valve-main', toPort: 'inlet' },
  { id: 'c3', fromComponent: 'valve-main', fromPort: 'outlet', toComponent: 'tap-main', toPort: 'inlet' },
];
type Store = {
  components: ComponentEntity[]; connections: Connection[]; selected: string | null; placing: ComponentType | null; pressure: number; running: boolean; diagnostic: Diagnostic;
  projectId: string | null; apiStatus: 'connecting' | 'connected' | 'error'; apiError: string | null;
  initialize: () => Promise<void>; setSelected: (id: string | null) => void; setPlacing: (t: ComponentType | null) => void; place: (type: ComponentType, position: Vec3, rotation: number) => void; move: (id: string, position: Vec3) => void; rotate: (id: string, rotation: number) => void; remove: (id: string) => void; setPressure: (p: number) => void; runSimulation: () => Promise<void>; reset: () => Promise<void>; toggleValve: (id: string) => void;
};
const readyDiagnostic: Diagnostic = { rootCause: null, secondaryEffects: [], message: 'Ready to simulate.', recommendation: '' };
const syncError = (set: (partial: Partial<Store>) => void, error: unknown) => set({ apiStatus: 'error', apiError: error instanceof Error ? error.message : 'Unable to reach PipeLab API' });
export const useStore = create<Store>((set, get) => ({
  components: initial, connections: initialConnections, selected: null, placing: null, pressure: 40, running: false, diagnostic: readyDiagnostic, projectId: null, apiStatus: 'connecting', apiError: null,
  initialize: async () => {
    try {
      const project = await projectApi.getOrCreateProject();
      if (!project.components.length) await projectApi.seed(project.id, initial, initialConnections);
      const hydrated = await projectApi.getProject(project.id);
      const applyProject = async () => {
        try { const current = await projectApi.getProject(project.id); set({ ...projectApi.fromProject(current), projectId: current.id, apiStatus: 'connected', apiError: null }); }
        catch (error) { syncError(set, error); }
      };
      set({ ...projectApi.fromProject(hydrated), projectId: hydrated.id, apiStatus: 'connected', apiError: null });
      projectApi.subscribe(project.id, event => {
        if (event.type === 'simulation_completed' && event.payload) {
          set({ components: event.payload.components.map(component => ({
            ...component,
            maxPressure: component.max_pressure,
            pressureLoss: component.pressure_loss,
            flowResistance: component.flow_resistance,
            pressure: Number(component.pressure ?? 0),
            flow: Number(component.flow ?? 0),
            status: component.status ?? 'normal',
          })), diagnostic: event.payload.diagnostic, running: true });
          return;
        }
        void applyProject();
      }, () => set({ apiStatus: 'error', apiError: 'The project event socket disconnected.' }));
    }
    catch (error) { syncError(set, error); }
  },
  setSelected: selected => set({ selected }), setPlacing: placing => set({ placing, selected: null }),
  place: (type, position, rotation) => { const def = catalog.find(c => c.type === type)!; const component: ComponentEntity = { id: id(), type, name: def.name, position, rotation, material: String(def.properties.material), diameter: Number(def.properties.diameter ?? .25), length: Number(def.properties.length ?? 1), maxPressure: Number(def.properties.maxPressure), pressureLoss: type === 'pipe' ? 2 : type === 'valve' ? 1 : 0, flowResistance: 1, open: true, opening: 1, ports: def.ports, status: 'normal', pressure: 0, flow: 0 }; const nearest = get().components.map(other => ({ other, d: Math.hypot(other.position[0] - position[0], other.position[2] - position[2]) })).filter(x => x.d < 3.1).sort((a,b) => a.d-b.d)[0]?.other; const connection = nearest ? { id: id(), fromComponent: nearest.id, fromPort: nearest.ports[nearest.ports.length - 1]?.id ?? 'outlet', toComponent: component.id, toPort: component.ports[0]?.id ?? 'inlet' } : null; set(s => ({ components: [...s.components, component], connections: connection ? [...s.connections, connection] : s.connections, placing: null, selected: component.id })); const projectId = get().projectId; if (projectId) void projectApi.addComponent(projectId, component).then(() => connection && projectApi.addConnection(projectId, connection)).catch(error => syncError(set, error)); },
  move: (componentId, position) => { const component = get().components.find(c => c.id === componentId); if (!component) return; const updated = { ...component, position }; set(s => ({ components: s.components.map(c => c.id === componentId ? updated : c) })); if (get().projectId) void projectApi.updateComponent(get().projectId!, updated).catch(error => syncError(set, error)); },
  rotate: (componentId, rotation) => { const component = get().components.find(c => c.id === componentId); if (!component) return; const updated = { ...component, rotation }; set(s => ({ components: s.components.map(c => c.id === componentId ? updated : c) })); if (get().projectId) void projectApi.updateComponent(get().projectId!, updated).catch(error => syncError(set, error)); },
  remove: componentId => { set(s => ({ components: s.components.filter(c => c.id !== componentId), connections: s.connections.filter(c => c.fromComponent !== componentId && c.toComponent !== componentId), selected: null })); if (get().projectId) void projectApi.deleteComponent(get().projectId!, componentId).catch(error => syncError(set, error)); },
  setPressure: pressure => { set({ pressure }); if (get().projectId) void projectApi.updatePressure(get().projectId!, pressure).catch(error => syncError(set, error)); },
  runSimulation: async () => { const projectId = get().projectId; if (!projectId) { set({ apiStatus: 'error', apiError: 'The project has not been loaded from the API.' }); return; } try { const result = await projectApi.simulate(projectId, get().pressure); set({ ...result, running: true, apiStatus: 'connected', apiError: null }); } catch (error) { syncError(set, error); } },
  reset: async () => { const projectId = get().projectId; if (!projectId) return; try { const project = await projectApi.reset(projectId); const state = projectApi.fromProject(project); set({ ...state, selected: null, placing: null, running: false, diagnostic: readyDiagnostic, apiStatus: 'connected', apiError: null }); } catch (error) { syncError(set, error); } },
  toggleValve: componentId => { const component = get().components.find(c => c.id === componentId); if (!component) return; const updated = { ...component, open: !component.open }; set(s => ({ components: s.components.map(c => c.id === componentId ? updated : c) })); if (get().projectId) void projectApi.updateComponent(get().projectId!, updated).catch(error => syncError(set, error)); },
}));
