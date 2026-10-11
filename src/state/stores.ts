import { create } from 'zustand';
import { catalog } from '../domain/catalog';
import type { Diagnostic } from '../domain/simulation';
import type { ComponentEntity, ComponentType, Connection, Vec3 } from '../domain/types';
import { projectApi } from '../services/api';
import type { SimulatedLeak } from '../services/api';
const id = () => crypto.randomUUID();
const initial: ComponentEntity[] = [
  { id: 'tank-main', type: 'tank', name: 'Water Cylinder', position: [-4, 0.6, 0], rotation: 0, material: 'Steel', diameter: .5, length: 1, maxPressure: 200, pressureLoss: 0, flowResistance: 0, open: true, opening: 1, ports: catalog[4].ports, status: 'normal', pressure: 40, flow: 0 },
  { id: 'pipe-main', type: 'pipe', name: 'Rising Pipe', position: [-3, 1.1, 0], rotation: 0, rotation3: [0, 0, Math.PI / 2], material: 'PVC', diameter: .25, length: 2, maxPressure: 70, pressureLoss: 2, flowResistance: 1, open: true, opening: 1, ports: catalog[0].ports, status: 'normal', pressure: 38, flow: 0 },
  { id: 'valve-main', type: 'valve', name: 'Ball Valve', position: [-3, 2.1, 0], rotation: 0, material: 'Brass', diameter: .25, length: 1, maxPressure: 150, pressureLoss: 1, flowResistance: 2, open: true, opening: 1, ports: catalog[2].ports, status: 'normal', pressure: 37, flow: 0 },
  { id: 'pipe-upper', type: 'pipe', name: 'Outlet Pipe', position: [-1.5, 2.1, 0], rotation: 0, material: 'PVC', diameter: .25, length: 2, maxPressure: 70, pressureLoss: 2, flowResistance: 1, open: true, opening: 1, ports: catalog[0].ports, status: 'normal', pressure: 36, flow: 0 },
  { id: 'tap-main', type: 'tap', name: 'Outlet', position: [0, 2.1, 0], rotation: 0, material: 'Chrome', diameter: .25, length: 1, maxPressure: 120, pressureLoss: 0, flowResistance: 1, open: true, opening: 1, ports: catalog[3].ports, status: 'normal', pressure: 36, flow: 0 },
];
const initialConnections: Connection[] = [
  { id: 'c1', fromComponent: 'tank-main', fromPort: 'inlet', toComponent: 'pipe-main', toPort: 'inlet' },
  { id: 'c2', fromComponent: 'pipe-main', fromPort: 'outlet', toComponent: 'valve-main', toPort: 'inlet' },
  { id: 'c3', fromComponent: 'valve-main', fromPort: 'outlet', toComponent: 'pipe-upper', toPort: 'inlet' },
  { id: 'c4', fromComponent: 'pipe-upper', fromPort: 'outlet', toComponent: 'tap-main', toPort: 'inlet' },
];
type Store = {
  components: ComponentEntity[]; connections: Connection[]; selected: string | null; placing: ComponentType | null; pressure: number; running: boolean; diagnostic: Diagnostic; leaks: SimulatedLeak[];
  projectId: string | null; apiStatus: 'connecting' | 'connected' | 'error'; apiError: string | null;
  initialize: () => Promise<void>; setSelected: (id: string | null) => void; setPlacing: (t: ComponentType | null) => void; place: (type: ComponentType, position: Vec3, rotation: number) => void; move: (id: string, position: Vec3) => void; rotate: (id: string, rotation: number) => void; setRotation3: (id: string, rotation: Vec3) => void; setMaterial: (id: string, material: string) => void; connect: (a: string, b: string) => void; disconnect: (a: string, b: string) => void; setConnectionMode: (enabled: boolean) => void; connectionMode: boolean; remove: (id: string) => void; setPressure: (p: number) => void; runSimulation: () => Promise<void>; stopSimulation: () => void; reset: () => Promise<void>; toggleValve: (id: string) => void;
};
const readyDiagnostic: Diagnostic = { rootCause: null, secondaryEffects: [], message: 'Ready to simulate.', recommendation: '' };
const syncError = (set: (partial: Partial<Store>) => void, error: unknown) => set({ apiStatus: 'error', apiError: error instanceof Error ? error.message : 'Unable to reach PipeLab API' });
export const useStore = create<Store>((set, get) => ({
  components: initial, connections: initialConnections, selected: null, placing: null, pressure: 40, running: false, diagnostic: readyDiagnostic, leaks: [], projectId: null, apiStatus: 'connecting', apiError: null, connectionMode: false,
  initialize: async () => {
    try {
      const project = await projectApi.getOrCreateProject();
      if (!project.components.length) await projectApi.seed(project.id, initial, initialConnections);
      else if (project.components.length === 4 && project.components.some(c => c.id === 'tank-main') && project.components.some(c => c.id === 'pipe-main') && project.components.some(c => c.id === 'valve-main') && project.components.some(c => c.id === 'tap-main')) {
        const starterIds = new Set(['tank-main', 'pipe-main', 'valve-main', 'tap-main']);
        await Promise.all(project.components.filter(c => starterIds.has(c.id)).map(c => projectApi.deleteComponent(project.id, c.id)));
        await projectApi.seed(project.id, initial, initialConnections);
      }
      else if (project.components.length === 5 && project.components.some(c => c.id === 'tank-main') && !project.components.some(c => c.id === 'pipe-upper') && project.components.some(c => c.id === 'valve-main')) {
        const obsoleteIds = new Set(['tank-main', 'pipe-main', 'valve-main', 'tap-main']);
        await Promise.all(project.components.filter(c => obsoleteIds.has(c.id)).map(c => projectApi.deleteComponent(project.id, c.id)));
        await projectApi.seed(project.id, initial, initialConnections);
      }
      else if (project.components.length === 5 && project.components.some(c => c.id === 'pipe-upper') && project.components.some(c => c.id === 'tank-main') && project.components.some(c => c.id === 'valve-main')) {
        const currentIds = new Set(project.components.map(c => c.id));
        const requiredIds = new Set(initial.map(c => c.id));
        const starterOnly = [...currentIds].every(componentId => requiredIds.has(componentId));
        if (starterOnly && (project.components.find(c => c.id === 'tank-main')?.name !== 'Water Cylinder' || !project.connections.some(c => c.id === 'c4'))) {
          await Promise.all(project.components.map(c => projectApi.deleteComponent(project.id, c.id)));
          await projectApi.seed(project.id, initial, initialConnections);
        }
      }
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
          })), diagnostic: event.payload.diagnostic, leaks: event.payload.leaks ?? [], running: true });
          return;
        }
        void applyProject();
      }, () => set({ apiStatus: 'error', apiError: 'The project event socket disconnected.' }));
    }
    catch (error) { syncError(set, error); }
  },
  setSelected: selected => set({ selected }), setPlacing: placing => set({ placing, selected: null, connectionMode: false }), setConnectionMode: connectionMode => set({ connectionMode, placing: null }),
  place: (type, position, rotation) => { const def = catalog.find(c => c.type === type)!; const component: ComponentEntity = { id: id(), type, name: def.name, position, rotation, material: String(def.properties.material), diameter: Number(def.properties.diameter ?? .25), length: Number(def.properties.length ?? 1), maxPressure: Number(def.properties.maxPressure), pressureLoss: type === 'pipe' || type === 'curved-pipe' ? 2 : type === 'valve' ? 1 : 0, flowResistance: 1, open: true, opening: 1, ports: def.ports, status: 'normal', pressure: 0, flow: 0 }; set(s => ({ components: [...s.components, component], placing: null, selected: component.id })); const projectId = get().projectId; if (projectId) void projectApi.addComponent(projectId, component).catch(error => syncError(set, error)); },
  move: (componentId, position) => { const component = get().components.find(c => c.id === componentId); if (!component) return; const updated = { ...component, position }; set(s => ({ components: s.components.map(c => c.id === componentId ? updated : c) })); if (get().projectId) void projectApi.updateComponent(get().projectId!, updated).catch(error => syncError(set, error)); },
  rotate: (componentId, rotation) => { const component = get().components.find(c => c.id === componentId); if (!component) return; const updated = { ...component, rotation }; set(s => ({ components: s.components.map(c => c.id === componentId ? updated : c) })); if (get().projectId) void projectApi.updateComponent(get().projectId!, updated).catch(error => syncError(set, error)); },
  setRotation3: (componentId, rotation3) => { const component = get().components.find(c => c.id === componentId); if (!component) return; const updated = { ...component, rotation3 }; set(s => ({ components: s.components.map(c => c.id === componentId ? updated : c) })); if (get().projectId) void projectApi.updateComponent(get().projectId!, updated).catch(error => syncError(set, error)); },
  setMaterial: (componentId, material) => { const component = get().components.find(c => c.id === componentId); if (!component) return; const updated = { ...component, material }; set(s => ({ components: s.components.map(c => c.id === componentId ? updated : c) })); if (get().projectId) void projectApi.updateComponent(get().projectId!, updated).catch(error => syncError(set, error)); },
  connect: (a, b) => { if (a === b) return; const state = get(); const left = state.components.find(c => c.id === a), right = state.components.find(c => c.id === b); if (!left || !right || state.connections.some(c => c.fromComponent === a && c.toComponent === b || c.fromComponent === b && c.toComponent === a)) return; const connection = { id: id(), fromComponent: a, fromPort: left.ports[left.ports.length - 1]?.id ?? 'outlet', toComponent: b, toPort: right.ports[0]?.id ?? 'inlet' }; set(s => ({ connections: [...s.connections, connection], connectionMode: false })); if (state.projectId) void projectApi.addConnection(state.projectId, connection).catch(error => syncError(set, error)); },
  disconnect: (a, b) => { const state = get(); const connection = state.connections.find(c => (c.fromComponent === a && c.toComponent === b) || (c.fromComponent === b && c.toComponent === a)); if (!connection) return; set(s => ({ connections: s.connections.filter(c => c.id !== connection.id) })); if (state.projectId) void projectApi.deleteConnection(state.projectId, connection.id).catch(error => syncError(set, error)); },
  remove: componentId => { set(s => ({ components: s.components.filter(c => c.id !== componentId), connections: s.connections.filter(c => c.fromComponent !== componentId && c.toComponent !== componentId), selected: null })); if (get().projectId) void projectApi.deleteComponent(get().projectId!, componentId).catch(error => syncError(set, error)); },
  setPressure: pressure => { set({ pressure }); if (get().projectId) void projectApi.updatePressure(get().projectId!, pressure).catch(error => syncError(set, error)); },
  runSimulation: async () => { const projectId = get().projectId; if (!projectId) { set({ apiStatus: 'error', apiError: 'The project has not been loaded from the API.' }); return; } try { const result = await projectApi.simulate(projectId, get().pressure); set({ ...result, running: true, apiStatus: 'connected', apiError: null }); } catch (error) { syncError(set, error); } },
  stopSimulation: () => set({ running: false, leaks: [], diagnostic: readyDiagnostic }),
  reset: async () => { const projectId = get().projectId; if (!projectId) return; try { const project = await projectApi.reset(projectId); const state = projectApi.fromProject(project); set({ ...state, leaks: [], selected: null, placing: null, running: false, diagnostic: readyDiagnostic, apiStatus: 'connected', apiError: null }); } catch (error) { syncError(set, error); } },
  toggleValve: componentId => { const component = get().components.find(c => c.id === componentId); if (!component) return; const updated = { ...component, open: !component.open }; set(s => ({ components: s.components.map(c => c.id === componentId ? updated : c) })); if (get().projectId) void projectApi.updateComponent(get().projectId!, updated).catch(error => syncError(set, error)); },
}));
