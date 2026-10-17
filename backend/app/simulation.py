from collections import deque
from math import cos, sin

def port_world_position(component: dict, port: dict) -> tuple[float, float, float]:
    position = component.get('position', [0, 0, 0]); local = port.get('position', [0, 0, 0])
    rotation = component.get('rotation3') or [0, component.get('rotation', 0), 0]
    x, y, z = local; rx, ry, rz = rotation
    y, z = y*cos(rx)-z*sin(rx), y*sin(rx)+z*cos(rx)
    x, z = x*cos(ry)+z*sin(ry), -x*sin(ry)+z*cos(ry)
    x, y = x*cos(rz)-y*sin(rz), x*sin(rz)+y*cos(rz)
    return (position[0]+x, position[1]+y, position[2]+z)

def connection_is_aligned(edge: dict, by_id: dict) -> bool:
    a, b = by_id.get(edge.get('from_component')), by_id.get(edge.get('to_component'))
    if not a or not b: return False
    ports_a = {p.get('id'):p for p in a.get('ports', [])}; ports_b = {p.get('id'):p for p in b.get('ports', [])}
    pa, pb = ports_a.get(edge.get('from_port')), ports_b.get(edge.get('to_port'))
    if not pa or not pb: return False
    wa, wb = port_world_position(a, pa), port_world_position(b, pb)
    return sum((x-y)**2 for x,y in zip(wa,wb))**.5 <= .2

def run_simulation(components: list[dict], connections: list[dict], source_pressure: float) -> dict:
    """Deterministic graph propagation; deliberately independent of any rendering engine."""
    by_id = {c['id']: c for c in components}
    adjacency: dict[str, list[str]] = {key: [] for key in by_id}
    valid_connections = []
    for edge in connections:
        a, b = edge['from_component'], edge['to_component']
        if a in by_id and b in by_id:
            adjacency[a].append(b); adjacency[b].append(a)
            valid_connections.append(edge)
    source = next((c['id'] for c in components if c['type'] == 'tank'), components[0]['id'] if components else None)
    levels: dict[str, int] = {}
    if source:
        queue = deque([source]); levels[source] = 0
        while queue:
            current = queue.popleft()
            component = by_id[current]
            # A closed valve or tap remains pressurized on its inlet side, but
            # it isolates every component beyond its outlet from the source.
            if component['type'] in ('valve', 'tap') and not component.get('open', True):
                continue
            for neighbor in adjacency[current]:
                if neighbor not in levels:
                    levels[neighbor] = levels[current] + 1; queue.append(neighbor)
    output = []
    for c in components:
        connected = c['id'] in levels
        pressure_drop_per_hop = 2.0 if c['type'] in ('pipe', 'curved-pipe') else 1.0 if c['type'] == 'valve' else 0.5
        pressure = max(0.0, source_pressure - (0 if c['type'] == 'tank' else levels.get(c['id'], 0) * pressure_drop_per_hop)) if connected else 0
        fluid_factor = {'Fresh water': 1.0, 'Hard water': .72, 'Salt water': .42, 'Waste water': .55}.get(c.get('fluid', 'Fresh water'), .8)
        age_days = max(0, float(c.get('ageDays', 0)))
        pressure_ratio = pressure / max(1, float(c.get('max_pressure', 70)))
        health = max(0, min(100, 100 - age_days / 36.5 / fluid_factor - max(0, pressure_ratio - .55) * 38 / fluid_factor))
        life_days = max(0, round((health / 100) * 3650 * fluid_factor / max(1, pressure_ratio * 1.25)))
        status = 'failed' if connected and (pressure > c.get('max_pressure', 70) or health < 12) else 'warning' if connected and (pressure > c.get('max_pressure', 70) * .82 or health < 35) else 'normal'
        flow = pressure / max(1, float(c.get('flow_resistance', 1))) * float(c.get('opening', 1)) if connected and c.get('open', True) and c['type'] != 'tank' else 0
        output.append({**c, 'pressure': pressure, 'flow': flow, 'status': status, 'health': round(health, 1), 'lifeDays': life_days})
    leaks = []
    used_ports = {(e['from_component'], e['from_port']) for e in valid_connections} | {(e['to_component'], e['to_port']) for e in valid_connections}
    for component in components:
        if component['id'] not in levels or component['type'] not in ('pipe', 'curved-pipe', 'valve', 'tap') or not component.get('open', True): continue
        # An exposed port is only a water leak while there is pressure to drive
        # water through it. At zero source pressure it remains a disconnected
        # port, but must not create a leak diagnosis or a water jet.
        component_pressure = next((c['pressure'] for c in output if c['id'] == component['id']), 0)
        if component_pressure <= 0: continue
        if component['type'] == 'tap' and component.get('open', True):
            outlet = next((p for p in component.get('ports', []) if p.get('id') == 'outlet'), None)
            if outlet:
                leaks.append({'component_id': component['id'], 'port_id': outlet['id'], 'position': port_world_position(component, outlet), 'pressure': component_pressure, 'kind': 'outlet'})
        for port in component.get('ports', []):
            if (component['id'], port.get('id')) not in used_ports:
                if component['type'] == 'tap' and port.get('id') == 'outlet': continue
                leaks.append({'component_id': component['id'], 'port_id': port.get('id'), 'position': port_world_position(component, port), 'pressure': component_pressure, 'kind': 'leak'})
    for component in components:
        if component['id'] not in levels or component['type'] not in ('pipe', 'curved-pipe', 'valve'):
            continue
        pressure = next((c['pressure'] for c in output if c['id'] == component['id']), 0)
        if pressure > 0 and pressure >= float(component.get('max_pressure', 70)):
            center = component.get('position', [0, 0, 0])
            leaks.append({'component_id': component['id'], 'port_id': 'body', 'position': (center[0], center[1], center[2]), 'pressure': pressure, 'kind': 'break', 'severity': pressure / max(1,float(component.get('max_pressure',70)))})
    failed = next((c for c in output if c['status'] == 'failed'), None)
    weak = next((c for c in output if c.get('health', 100) < 35), None)
    diagnosis = {'root_cause': failed or weak, 'secondary_effects': [c for c in output if c['type'] == 'tap' and c['id'] in levels] if (failed or weak) else [], 'message': f"{failed['name']} exceeds its safe operating limit." if failed else f"{weak['name']} has only {weak['health']}% health remaining." if weak else f'{len(leaks)} open pressurized port(s) are leaking.' if leaks else 'All connected components are within their pressure ratings.', 'recommendation': 'Replace with a higher-rated component and reduce source pressure.' if failed else f"Schedule replacement within {weak['lifeDays']} days; {weak.get('fluid','water')} is accelerating wear." if weak else 'Connect or cap each open port.' if leaks else 'System operating within rated limits.'}
    return {'components': output, 'diagnostic': diagnosis, 'leaks': leaks}
