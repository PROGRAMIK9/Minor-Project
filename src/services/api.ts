import type { ComponentEntity, Connection } from '../domain/types';
import type { Diagnostic } from '../domain/simulation';

const baseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const socketUrl = baseUrl.replace(/^http/, 'ws');
let socket: WebSocket | null = null;

type ApiComponent = Omit<ComponentEntity, 'maxPressure' | 'pressureLoss' | 'flowResistance' | 'pressure' | 'flow' | 'status'> & {
  max_pressure: number; pressure_loss: number; flow_resistance: number;
  pressure?: number; flow?: number; status?: ComponentEntity['status'];
  properties?: Record<string, unknown>;
};
type ApiConnection = { id: string; from_component: string; from_port: string; to_component: string; to_port: string };
type ApiProject = { id: string; name: string; source_pressure: number; components: ApiComponent[]; connections: ApiConnection[] };
type ApiSimulation = { components: ApiComponent[]; diagnostic: Diagnostic; leaks?: SimulatedLeak[] };
export type SimulatedLeak = { component_id: string; port_id: string; position: [number, number, number]; pressure: number; kind?: 'leak' | 'outlet' | 'break' };
type ApiEvent = { type: string; payload?: ApiSimulation };

const fromApi = (component: ApiComponent): ComponentEntity => ({
  ...component,
  maxPressure: component.max_pressure,
  pressureLoss: component.pressure_loss,
  flowResistance: component.flow_resistance,
  pressure: Number(component.pressure ?? 0),
  flow: Number(component.flow ?? 0),
  status: component.status ?? 'normal',
  ...(component.properties ?? {}),
});
const fromApiConnection = (connection: ApiConnection): Connection => ({
  id: connection.id,
  fromComponent: connection.from_component,
  fromPort: connection.from_port,
  toComponent: connection.to_component,
  toPort: connection.to_port,
});
const toApiConnection = (connection: Connection) => ({
  id: connection.id,
  from_component: connection.fromComponent,
  from_port: connection.fromPort,
  to_component: connection.toComponent,
  to_port: connection.toPort,
});
const toApi = (component: ComponentEntity) => ({
  ...component,
  properties: { rotation3: component.rotation3, fluid: component.fluid, ageDays: component.ageDays, health: component.health, lifeDays: component.lifeDays, customAssetId: component.customAssetId },
  max_pressure: component.maxPressure,
  pressure_loss: component.pressureLoss,
  flow_resistance: component.flowResistance,
});

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init });
  if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export const projectApi = {
  getProject(projectId: string) { return request<ApiProject>(`/projects/${projectId}`); },
  async getOrCreateProject(): Promise<ApiProject> {
    const projects = await request<Array<{ id: string }>>('/projects');
    if (projects.length) return request<ApiProject>(`/projects/${projects[0].id}`);
    return request<ApiProject>('/projects', { method: 'POST', body: JSON.stringify({ name: 'Untitled system' }) });
  },
  async seed(projectId: string, components: ComponentEntity[], connections: Connection[]) {
    await Promise.all(components.map(component => request(`/projects/${projectId}/components`, { method: 'POST', body: JSON.stringify(toApi(component)) })));
    await Promise.all(connections.map(connection => request(`/projects/${projectId}/connections`, { method: 'POST', body: JSON.stringify(toApiConnection(connection)) })));
  },
  async simulate(projectId: string, pressure: number) {
    const result = await request<ApiSimulation>(`/projects/${projectId}/simulate`, { method: 'POST', body: JSON.stringify({ source_pressure: pressure }) });
    return { components: result.components.map(fromApi), diagnostic: result.diagnostic, leaks: result.leaks ?? [] };
  },
  async reset(projectId: string) { return request<ApiProject>(`/projects/${projectId}/reset`, { method: 'POST' }); },
  async updatePressure(projectId: string, pressure: number) { return request(`/projects/${projectId}`, { method: 'PUT', body: JSON.stringify({ source_pressure: pressure }) }); },
  async addComponent(projectId: string, component: ComponentEntity) { return request(`/projects/${projectId}/components`, { method: 'POST', body: JSON.stringify(toApi(component)) }); },
  async addConnection(projectId: string, connection: Connection) { return request(`/projects/${projectId}/connections`, { method: 'POST', body: JSON.stringify(toApiConnection(connection)) }); },
  async deleteConnection(projectId: string, connectionId: string) { return request(`/projects/${projectId}/connections/${connectionId}`, { method: 'DELETE' }); },
  async updateComponent(projectId: string, component: ComponentEntity) { return request(`/projects/${projectId}/components/${component.id}`, { method: 'PUT', body: JSON.stringify(toApi(component)) }); },
  async deleteComponent(projectId: string, componentId: string) { return request(`/projects/${projectId}/components/${componentId}`, { method: 'DELETE' }); },
  subscribe(projectId: string, onEvent: (event: ApiEvent) => void, onError: () => void) {
    socket?.close();
    socket = new WebSocket(`${socketUrl}/ws/projects/${projectId}`);
    socket.onmessage = event => onEvent(JSON.parse(event.data) as ApiEvent);
    socket.onerror = onError;
    return () => { socket?.close(); socket = null; };
  },
  fromProject(project: ApiProject) { return { components: project.components.map(fromApi), connections: project.connections.map(fromApiConnection), pressure: project.source_pressure }; },
};
