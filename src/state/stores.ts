import { create } from "zustand";
import { catalog } from "../domain/catalog";
import type { Diagnostic } from "../domain/simulation";
import type {
  ComponentEntity,
  ComponentType,
  Connection,
  CustomAsset,
  Vec3,
} from "../domain/types";
import { snapPlacement } from "../domain/placement";
import * as THREE from "three";
import { projectApi } from "../services/api";
import type { SimulatedLeak } from "../services/api";
import { storeAsset } from "../services/assetStorage";
const id = () => crypto.randomUUID();
const initial: ComponentEntity[] = [
  {
    id: "tank-main",
    type: "tank",
    name: "Water Cylinder",
    position: [-4, 1.1, 0],
    rotation: 0,
    rotation3: [0, 0, 0],
    material: "Steel",
    diameter: .5,
    length: 1,
    maxPressure: 200,
    pressureLoss: 0,
    flowResistance: 0,
    open: true,
    opening: 1,
    ports: [{ ...catalog[4].ports[0], position: [.59, .25, 0] }],
    status: "normal",
    pressure: 40,
    flow: 0,
  },
  {
    id: "pipe-main",
    type: "pipe",
    name: "Rising Pipe",
    position: [-3.41, 2.35, 0],
    rotation: 0,
    rotation3: [0, 0, Math.PI / 2],
    material: "PVC",
    diameter: .25,
    length: 2,
    maxPressure: 70,
    pressureLoss: 2,
    flowResistance: 1,
    open: true,
    opening: 1,
    ports: catalog[0].ports,
    status: "normal",
    pressure: 38,
    flow: 0,
  },
  {
    id: "valve-main",
    type: "valve",
    name: "Ball Valve",
    position: [-3.02, 3.35, 0],
    rotation: 0,
    rotation3: [0, 0, 0],
    material: "Brass",
    diameter: .25,
    length: 1,
    maxPressure: 150,
    pressureLoss: 1,
    flowResistance: 2,
    open: true,
    opening: 1,
    ports: catalog[2].ports,
    status: "normal",
    pressure: 37,
    flow: 0,
  },
  {
    id: "pipe-upper",
    type: "pipe",
    name: "Outlet Pipe",
    position: [-1.63, 3.35, 0],
    rotation: 0,
    rotation3: [0, 0, 0],
    material: "PVC",
    diameter: .25,
    length: 2,
    maxPressure: 70,
    pressureLoss: 2,
    flowResistance: 1,
    open: true,
    opening: 1,
    ports: catalog[0].ports,
    status: "normal",
    pressure: 36,
    flow: 0,
  },
  {
    id: "tap-main",
    type: "tap",
    name: "Outlet",
    position: [-.13, 3.35, 0],
    rotation: 0,
    rotation3: [0, 0, 0],
    material: "Chrome",
    diameter: .25,
    length: 1,
    maxPressure: 120,
    pressureLoss: 0,
    flowResistance: 1,
    open: true,
    opening: 1,
    ports: catalog[3].ports,
    status: "normal",
    pressure: 36,
    flow: 0,
  },
];
const initialConnections: Connection[] = [
  {
    id: "c1",
    fromComponent: "tank-main",
    fromPort: "inlet",
    toComponent: "pipe-main",
    toPort: "inlet",
  },
  {
    id: "c2",
    fromComponent: "pipe-main",
    fromPort: "outlet",
    toComponent: "valve-main",
    toPort: "inlet",
  },
  {
    id: "c3",
    fromComponent: "valve-main",
    fromPort: "outlet",
    toComponent: "pipe-upper",
    toPort: "inlet",
  },
  {
    id: "c4",
    fromComponent: "pipe-upper",
    fromPort: "outlet",
    toComponent: "tap-main",
    toPort: "inlet",
  },
];
type Store = {
  components: ComponentEntity[];
  connections: Connection[];
  selected: string | null;
  placing: ComponentType | null;
  placementRotation3: Vec3;
  pressure: number;
  running: boolean;
  diagnostic: Diagnostic;
  leaks: SimulatedLeak[];
  projectId: string | null;
  apiStatus: "connecting" | "connected" | "error";
  apiError: string | null;
  customAssets: CustomAsset[];
  activeCustom: CustomAsset | null;
  initialize: () => Promise<void>;
  setSelected: (id: string | null) => void;
  setPlacing: (t: ComponentType | null) => void;
  setPlacementRotation3: (rotation: Vec3) => void;
  addCustomAsset: (asset: Omit<CustomAsset, "id">) => Promise<void>;
  setCustomAssets: (assets: CustomAsset[]) => void;
  selectCustomAsset: (asset: CustomAsset) => void;
  place: (
    type: ComponentType,
    position: Vec3,
    rotation: number,
    rotation3?: Vec3,
  ) => void;
  move: (id: string, position: Vec3) => void;
  rotate: (id: string, rotation: number) => void;
  setRotation3: (id: string, rotation: Vec3) => void;
  setMaterial: (id: string, material: string) => void;
  setFluid: (id: string, fluid: string) => void;
  setAgeDays: (id: string, ageDays: number) => void;
  align: () => void;
  connect: (a: string, b: string) => void;
  disconnect: (a: string, b: string) => void;
  setConnectionMode: (enabled: boolean) => void;
  connectionMode: boolean;
  remove: (id: string) => void;
  setPressure: (p: number) => void;
  refreshSimulation: () => Promise<void>;
  runSimulation: () => Promise<void>;
  stopSimulation: () => void;
  reset: () => Promise<void>;
  toggleValve: (id: string) => void;
};
const readyDiagnostic: Diagnostic = {
  rootCause: null,
  secondaryEffects: [],
  message: "Ready to simulate.",
  recommendation: "",
};
const syncError = (set: (partial: Partial<Store>) => void, error: unknown) =>
  set({
    apiStatus: "error",
    apiError: error instanceof Error
      ? error.message
      : "Unable to reach PipeLab API",
  });
export const useStore = create<Store>((set, get) => ({
  components: initial,
  connections: initialConnections,
  selected: null,
  placing: null,
  placementRotation3: [0, 0, 0],
  pressure: 40,
  running: false,
  diagnostic: readyDiagnostic,
  leaks: [],
  projectId: null,
  apiStatus: "connecting",
  apiError: null,
  connectionMode: false,
  customAssets: [],
  activeCustom: null,
  initialize: async () => {
    try {
      const project = await projectApi.getOrCreateProject();
      if (!project.components.length) {
        await projectApi.seed(project.id, initial, initialConnections);
      } else if (
        project.components.length === 4 && project.components.some((c) =>
          c.id === "tank-main"
        ) && project.components.some((c) => c.id === "pipe-main") &&
        project.components.some((c) => c.id === "valve-main") &&
        project.components.some((c) => c.id === "tap-main")
      ) {
        const starterIds = new Set([
          "tank-main",
          "pipe-main",
          "valve-main",
          "tap-main",
        ]);
        await Promise.all(
          project.components.filter((c) => starterIds.has(c.id)).map((c) =>
            projectApi.deleteComponent(project.id, c.id)
          ),
        );
        await projectApi.seed(project.id, initial, initialConnections);
      } else if (
        project.components.length === 5 && project.components.some((c) =>
          c.id === "tank-main"
        ) && !project.components.some((c) => c.id === "pipe-upper") &&
        project.components.some((c) => c.id === "valve-main")
      ) {
        const obsoleteIds = new Set([
          "tank-main",
          "pipe-main",
          "valve-main",
          "tap-main",
        ]);
        await Promise.all(
          project.components.filter((c) => obsoleteIds.has(c.id)).map((c) =>
            projectApi.deleteComponent(project.id, c.id)
          ),
        );
        await projectApi.seed(project.id, initial, initialConnections);
      } else if (
        project.components.length === 5 && project.components.some((c) =>
          c.id === "pipe-upper"
        ) && project.components.some((c) => c.id === "tank-main") &&
        project.components.some((c) => c.id === "valve-main")
      ) {
        const currentIds = new Set(project.components.map((c) => c.id));
        const requiredIds = new Set(initial.map((c) => c.id));
        const starterOnly = [...currentIds].every((componentId) =>
          requiredIds.has(componentId)
        );
        const risingPort = project.components.find((c) => c.id === "pipe-main")
          ?.ports.find((p) => p.id === "inlet")?.position;
        const tank = project.components.find((c) => c.id === "tank-main");
        const valve = project.components.find((c) => c.id === "valve-main");
        const risingPipe = project.components.find((c) => c.id === "pipe-main");
        const legacyStarterLayout = tank?.name === "Water Cylinder" &&
          tank.position[0] === -4 && tank.position[1] === 1.1 &&
          valve?.position[0] === -3.41 && risingPipe?.position[1] === 2.6 &&
          risingPort?.[0] === -1 && risingPort?.[1] === 0;
        if (starterOnly && legacyStarterLayout) {
          await Promise.all(
            project.components.map((c) =>
              projectApi.deleteComponent(project.id, c.id)
            ),
          );
          await projectApi.seed(project.id, initial, initialConnections);
        }
      }
      const hydrated = await projectApi.getProject(project.id);
      const applyProject = async () => {
        try {
          const current = await projectApi.getProject(project.id);
          set({
            ...projectApi.fromProject(current),
            projectId: current.id,
            apiStatus: "connected",
            apiError: null,
          });
        } catch (error) {
          syncError(set, error);
        }
      };
      set({
        ...projectApi.fromProject(hydrated),
        projectId: hydrated.id,
        apiStatus: "connected",
        apiError: null,
      });
      projectApi.subscribe(
        project.id,
        (event) => {
          if (event.type === "simulation_completed" && event.payload) {
            set({
              components: event.payload.components.map((component) => ({
                ...component,
                maxPressure: component.max_pressure,
                pressureLoss: component.pressure_loss,
                flowResistance: component.flow_resistance,
                pressure: Number(component.pressure ?? 0),
                flow: Number(component.flow ?? 0),
                status: component.status ??
                  (Number(component.pressure ?? 0) >
                      Number(component.max_pressure ?? 70)
                    ? "failed"
                    : "normal"),
                ...(component.properties ?? {}),
              })),
              diagnostic: event.payload.diagnostic,
              leaks: event.payload.leaks ?? [],
              running: get().running,
            });
            return;
          }
          void applyProject();
        },
        () =>
          set({
            apiStatus: "error",
            apiError: "The project event socket disconnected.",
          }),
      );
    } catch (error) {
      syncError(set, error);
    }
  },
  setSelected: (selected) => set({ selected }),
  setPlacing: (placing) =>
    set({ placing, selected: null, connectionMode: false }),
  setPlacementRotation3: (placementRotation3) => set({ placementRotation3 }),
  setConnectionMode: (connectionMode) => set({ connectionMode, placing: null }),
  addCustomAsset: async (asset) => {
    const created = { ...asset, id: id() };
    set((s) => ({ customAssets: [...s.customAssets, created] }));
    await storeAsset(created);
  },
  setCustomAssets: (customAssets) => set({ customAssets }),
  selectCustomAsset: (asset) =>
    set({ activeCustom: asset, placing: "custom", selected: null }),
  place: (type, position, rotation, rotation3) => {
    const def = catalog.find((c) => c.type === type)!;
    const state = get();
    const custom = type === "custom" ? state.activeCustom : null;
    const orient = rotation3 ?? [0, rotation, 0];
    const snap = snapPlacement(
      type,
      position,
      orient,
      state.components,
      state.connections,
    );
    const component: ComponentEntity = {
      id: id(),
      type,
      name: custom?.name ?? def.name,
      position: snap.position,
      rotation,
      rotation3: orient,
      material: custom?.material ?? String(def.properties.material),
      diameter: Number(def.properties.diameter ?? .25),
      length: Number(def.properties.length ?? 1),
      maxPressure: custom?.maxPressure ?? Number(def.properties.maxPressure),
      pressureLoss:
        type === "pipe" || type === "curved-pipe" || type === "custom"
          ? 2
          : type === "valve"
          ? 1
          : 0,
      flowResistance: 1,
      open: true,
      opening: 1,
      ports: def.ports,
      status: "normal",
      pressure: 0,
      flow: 0,
      fluid: "Fresh water",
      ageDays: custom?.ageDays ?? 0,
      health: 100,
      lifeDays: 3650,
      customAssetId: custom?.id,
    };
    const connection: Connection | undefined = snap.connection
      ? { ...snap.connection, id: id(), toComponent: component.id }
      : undefined;
    set((s) => ({
      components: [...s.components, component],
      connections: connection ? [...s.connections, connection] : s.connections,
      placing: null,
      selected: component.id,
    }));
    const projectId = get().projectId;
    if (projectId) {
      void projectApi.addComponent(projectId, component).then(() =>
        connection ? projectApi.addConnection(projectId, connection) : undefined
      ).catch((error) => syncError(set, error));
    }
  },
  move: (componentId, position) => {
    const component = get().components.find((c) => c.id === componentId);
    if (!component) return;
    const wasRunning = get().running;
    const updated = { ...component, position };
    set((s) => ({
      components: s.components.map((c) => c.id === componentId ? updated : c),
      ...(wasRunning ? { leaks: [], diagnostic: readyDiagnostic } : {}),
    }));
    if (get().projectId) {
      void projectApi.updateComponent(get().projectId!, updated).then(() => {
        if (wasRunning) {
          void get().runSimulation();
        }
      }).catch((error) => syncError(set, error));
    }
  },
  rotate: (componentId, rotation) => {
    const component = get().components.find((c) => c.id === componentId);
    if (!component) return;
    const updated = { ...component, rotation };
    set((s) => ({
      components: s.components.map((c) => c.id === componentId ? updated : c),
    }));
    if (get().projectId) {
      void projectApi.updateComponent(get().projectId!, updated).catch(
        (error) => syncError(set, error),
      );
    }
  },
  setRotation3: (componentId, rotation3) => {
    const component = get().components.find((c) => c.id === componentId);
    if (!component) return;
    const updated = { ...component, rotation3 };
    set((s) => ({
      components: s.components.map((c) => c.id === componentId ? updated : c),
    }));
    if (get().projectId) {
      void projectApi.updateComponent(get().projectId!, updated).catch(
        (error) => syncError(set, error),
      );
    }
  },
  setMaterial: (componentId, material) => {
    const component = get().components.find((c) => c.id === componentId);
    if (!component) return;
    const updated = { ...component, material };
    set((s) => ({
      components: s.components.map((c) => c.id === componentId ? updated : c),
    }));
    if (get().projectId) {
      void projectApi.updateComponent(get().projectId!, updated).catch(
        (error) => syncError(set, error),
      );
    }
  },
  setFluid: (componentId, fluid) => {
    const component = get().components.find((c) => c.id === componentId);
    if (!component) return;
    const updated = { ...component, fluid };
    set((s) => ({
      components: s.components.map((c) => c.id === componentId ? updated : c),
    }));
    const projectId = get().projectId;
    if (projectId) {
      void projectApi.updateComponent(projectId, updated).then(() =>
        get().refreshSimulation()
      ).catch((error) => syncError(set, error));
    }
  },
  setAgeDays: (componentId, ageDays) => {
    const component = get().components.find((c) => c.id === componentId);
    if (!component) return;
    const updated = { ...component, ageDays };
    set((s) => ({
      components: s.components.map((c) => c.id === componentId ? updated : c),
    }));
    const projectId = get().projectId;
    if (projectId) {
      void projectApi.updateComponent(projectId, updated).then(() =>
        get().refreshSimulation()
      ).catch((error) => syncError(set, error));
    }
  },
  align: () => {
    const state = get();
    const next = state.components.map((c) => ({ ...c }));
    if (!next.length) return;
    const byId = new Map(next.map((c) => [c.id, c]));
    const adjacency = new Map(
      next.map((c) => [c.id, [] as typeof state.connections]),
    );
    state.connections.forEach((edge) => {
      adjacency.get(edge.fromComponent)?.push(edge);
      adjacency.get(edge.toComponent)?.push(edge);
    });
    const root = next.find((c) => c.type === "tank") ?? next[0];
    const visited = new Set([root.id]);
    const queue = [root.id];
    const worldPort = (component: ComponentEntity, portId: string) => {
      const port = component.ports.find((p) => p.id === portId);
      if (!port) return null;
      const rotation = component.rotation3 ?? [0, component.rotation, 0];
      const local = new THREE.Vector3(...port.position).applyEuler(
        new THREE.Euler(...rotation),
      );
      return new THREE.Vector3(...component.position).add(local);
    };
    while (queue.length) {
      const currentId = queue.shift()!;
      const current = byId.get(currentId)!;
      (adjacency.get(currentId) ?? []).forEach((edge) => {
        const currentIsFrom = edge.fromComponent === currentId;
        const neighborId = currentIsFrom
          ? edge.toComponent
          : edge.fromComponent;
        if (visited.has(neighborId)) return;
        const neighbor = byId.get(neighborId);
        if (!neighbor) return;
        const currentPort = worldPort(
          current,
          currentIsFrom ? edge.fromPort : edge.toPort,
        );
        const neighborPortId = currentIsFrom ? edge.toPort : edge.fromPort;
        const neighborPort = neighbor.ports.find((p) =>
          p.id === neighborPortId
        );
        if (currentPort && neighborPort) {
          const rotation = neighbor.rotation3 ?? [0, neighbor.rotation, 0];
          const local = new THREE.Vector3(...neighborPort.position).applyEuler(
            new THREE.Euler(...rotation),
          );
          const position = currentPort.clone().sub(local);
          neighbor.position = [position.x, position.y, position.z];
        }
        visited.add(neighborId);
        queue.push(neighborId);
      });
    }
    set({ components: next });
    if (state.projectId) {
      void Promise.all(
        next.map((c) => projectApi.updateComponent(state.projectId!, c)),
      ).catch((error) => syncError(set, error));
    }
  },
  connect: (a, b) => {
    if (a === b) return;
    const state = get();
    const left = state.components.find((c) => c.id === a),
      right = state.components.find((c) => c.id === b);
    if (
      !left || !right ||
      state.connections.some((c) =>
        c.fromComponent === a && c.toComponent === b ||
        c.fromComponent === b && c.toComponent === a
      )
    ) return;
    const connection = {
      id: id(),
      fromComponent: a,
      fromPort: left.ports[left.ports.length - 1]?.id ?? "outlet",
      toComponent: b,
      toPort: right.ports[0]?.id ?? "inlet",
    };
    set((s) => ({
      connections: [...s.connections, connection],
      connectionMode: false,
    }));
    if (state.projectId) {
      void projectApi.addConnection(state.projectId, connection).catch(
        (error) => syncError(set, error),
      );
    }
  },
  disconnect: (a, b) => {
    const state = get();
    const connection = state.connections.find((c) =>
      (c.fromComponent === a && c.toComponent === b) ||
      (c.fromComponent === b && c.toComponent === a)
    );
    if (!connection) return;
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== connection.id),
    }));
    if (state.projectId) {
      void projectApi.deleteConnection(state.projectId, connection.id).catch(
        (error) => syncError(set, error),
      );
    }
  },
  remove: (componentId) => {
    set((s) => ({
      components: s.components.filter((c) => c.id !== componentId),
      connections: s.connections.filter((c) =>
        c.fromComponent !== componentId && c.toComponent !== componentId
      ),
      selected: null,
    }));
    if (get().projectId) {
      void projectApi.deleteComponent(get().projectId!, componentId).catch(
        (error) => syncError(set, error),
      );
    }
  },
  setPressure: (pressure) => {
    const wasRunning = get().running;
    set({
      pressure,
      ...(wasRunning ? { leaks: [], diagnostic: readyDiagnostic } : {}),
    });
    if (get().projectId) {
      void projectApi.updatePressure(get().projectId!, pressure).then(() => {
        if (wasRunning) {
          void get().runSimulation();
        }
      }).catch((error) => syncError(set, error));
    }
  },
  refreshSimulation: async () => {
    const projectId = get().projectId;
    if (!projectId) return;
    try {
      const result = await projectApi.simulate(projectId, get().pressure);
      set({
        ...result,
        running: get().running,
        apiStatus: "connected",
        apiError: null,
      });
    } catch (error) {
      syncError(set, error);
    }
  },
  runSimulation: async () => {
    const projectId = get().projectId;
    if (!projectId) {
      set({
        apiStatus: "error",
        apiError: "The project has not been loaded from the API.",
      });
      return;
    }
    try {
      const result = await projectApi.simulate(projectId, get().pressure);
      set({ ...result, running: true, apiStatus: "connected", apiError: null });
    } catch (error) {
      syncError(set, error);
    }
  },
  stopSimulation: () =>
    set({ running: false, leaks: [], diagnostic: readyDiagnostic }),
  reset: async () => {
    const projectId = get().projectId;
    if (!projectId) return;
    try {
      await projectApi.reset(projectId);
      await projectApi.seed(projectId, initial, initialConnections);
      await projectApi.updatePressure(projectId, 40);
      const project = await projectApi.getProject(projectId);
      const state = projectApi.fromProject(project);
      set({
        ...state,
        leaks: [],
        selected: null,
        placing: null,
        running: false,
        diagnostic: readyDiagnostic,
        apiStatus: "connected",
        apiError: null,
      });
    } catch (error) {
      syncError(set, error);
    }
  },
  toggleValve: (componentId) => {
    const component = get().components.find((c) => c.id === componentId);
    if (!component) return;
    const updated = { ...component, open: !component.open };
    const wasRunning = get().running;
    set((s) => ({
      components: s.components.map((c) => c.id === componentId ? updated : c),
      ...(wasRunning ? { leaks: [], diagnostic: readyDiagnostic } : {}),
    }));
    if (get().projectId) {
      void projectApi.updateComponent(get().projectId!, updated).then(() => {
        if (wasRunning) {
          void get().runSimulation();
        }
      }).catch((error) => syncError(set, error));
    }
  },
}));
