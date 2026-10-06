import type { ComponentDefinition, ComponentType, PortDefinition } from './types';
const ports = (type: ComponentType): PortDefinition[] => {
  const p = (id: string, x: number): PortDefinition => ({ id, direction: 'bidirectional', position: [x, 0, 0], vector: [Math.sign(x), 0, 0], diameter: 0.25 });
  if (type === 'tank' || type === 'tap') return [p('inlet', type === 'tank' ? 0.5 : -0.5)];
  return [p('inlet', -0.5), p('outlet', 0.5)];
};
export const catalog: ComponentDefinition[] = [
  { type: 'pipe', name: 'PVC Pipe', category: 'Pipe', model: 'pipe', ports: ports('pipe'), properties: { material: 'PVC', maxPressure: 70, diameter: 0.25, length: 2 } },
  { type: 'valve', name: 'Ball Valve', category: 'Valve', model: 'valve', ports: ports('valve'), properties: { material: 'Brass', maxPressure: 150, opening: 1 } },
  { type: 'tap', name: 'Outlet Tap', category: 'Device', model: 'tap', ports: ports('tap'), properties: { material: 'Chrome', maxPressure: 120 } },
  { type: 'tank', name: 'Pressure Tank', category: 'Source', model: 'tank', ports: ports('tank'), properties: { material: 'Steel', maxPressure: 200, pressure: 40 } },
];
