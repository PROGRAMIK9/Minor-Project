import type { ComponentEntity, Connection } from './types';
export class SimulationGraph {
  constructor(readonly components: ComponentEntity[], readonly connections: Connection[]) {}
  neighbors(id: string): string[] { return this.connections.flatMap(c => c.fromComponent === id ? [c.toComponent] : c.toComponent === id ? [c.fromComponent] : []); }
  connectedFrom(root: string): string[] { const seen = new Set<string>(), queue = [root]; while (queue.length) { const id = queue.shift()!; if (seen.has(id)) continue; seen.add(id); queue.push(...this.neighbors(id).filter(n => !seen.has(n))); } return [...seen]; }
  pathTo(id: string, root: string): string[] { const prev = new Map<string, string>(), queue = [root]; const seen = new Set(queue); while (queue.length) { const cur = queue.shift()!; if (cur === id) break; for (const next of this.neighbors(cur)) if (!seen.has(next)) { seen.add(next); prev.set(next, cur); queue.push(next); } } const path = [id]; while (path[0] !== root && prev.has(path[0])) path.unshift(prev.get(path[0])!); return path[0] === root ? path : []; }
}
