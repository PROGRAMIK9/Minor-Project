from collections import deque

def run_simulation(components: list[dict], connections: list[dict], source_pressure: float) -> dict:
    """Deterministic graph propagation; deliberately independent of any rendering engine."""
    by_id = {c['id']: c for c in components}
    adjacency: dict[str, list[str]] = {key: [] for key in by_id}
    for edge in connections:
        a, b = edge['from_component'], edge['to_component']
        if a in by_id and b in by_id:
            adjacency[a].append(b); adjacency[b].append(a)
    source = next((c['id'] for c in components if c['type'] == 'tank'), components[0]['id'] if components else None)
    levels: dict[str, int] = {}
    if source:
        queue = deque([source]); levels[source] = 0
        while queue:
            current = queue.popleft()
            for neighbor in adjacency[current]:
                if neighbor not in levels:
                    levels[neighbor] = levels[current] + 1; queue.append(neighbor)
    output = []
    for c in components:
        connected = c['id'] in levels
        pressure = max(0.0, source_pressure - (0 if c['type'] == 'tank' else levels.get(c['id'], 0) * float(c.get('pressure_loss', 0)))) if connected else 0
        status = 'failed' if connected and pressure > c.get('max_pressure', 70) else 'warning' if connected and pressure > c.get('max_pressure', 70) * .82 else 'normal'
        flow = pressure / max(1, float(c.get('flow_resistance', 1))) * float(c.get('opening', 1)) if connected and c.get('open', True) and c['type'] != 'tank' else 0
        output.append({**c, 'pressure': pressure, 'flow': flow, 'status': status})
    failed = next((c for c in output if c['status'] == 'failed'), None)
    diagnosis = {'root_cause': failed, 'secondary_effects': [c for c in output if c['type'] == 'tap' and c['id'] in levels] if failed else [], 'message': f"{failed['name']} exceeds its {failed['max_pressure']} PSI rating." if failed else 'All connected components are within their pressure ratings.', 'recommendation': 'Replace with a higher-rated component or reduce source pressure.' if failed else 'System operating within rated limits.'}
    return {'components': output, 'diagnostic': diagnosis}
