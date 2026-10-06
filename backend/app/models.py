import uuid
from sqlalchemy import Boolean, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

def uid() -> str: return str(uuid.uuid4())

class User(Base):
    __tablename__ = 'users'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String, default='Local user')

class Project(Base):
    __tablename__ = 'projects'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String, default='Untitled system')
    source_pressure: Mapped[float] = mapped_column(Float, default=40)
    components: Mapped[list['ProjectComponent']] = relationship(cascade='all, delete-orphan')
    connections: Mapped[list['Connection']] = relationship(cascade='all, delete-orphan')

class ProjectComponent(Base):
    __tablename__ = 'project_components'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey('projects.id', ondelete='CASCADE'))
    type: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    position: Mapped[list] = mapped_column(JSON)
    rotation: Mapped[float] = mapped_column(Float, default=0)
    material: Mapped[str] = mapped_column(String, default='PVC')
    diameter: Mapped[float] = mapped_column(Float, default=.25)
    length: Mapped[float] = mapped_column(Float, default=1)
    max_pressure: Mapped[float] = mapped_column(Float, default=70)
    pressure_loss: Mapped[float] = mapped_column(Float, default=0)
    flow_resistance: Mapped[float] = mapped_column(Float, default=1)
    open: Mapped[bool] = mapped_column(Boolean, default=True)
    opening: Mapped[float] = mapped_column(Float, default=1)
    ports: Mapped[list] = mapped_column(JSON, default=list)
    properties: Mapped[dict] = mapped_column(JSON, default=dict)

class Connection(Base):
    __tablename__ = 'connections'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey('projects.id', ondelete='CASCADE'))
    from_component: Mapped[str] = mapped_column(String)
    from_port: Mapped[str] = mapped_column(String)
    to_component: Mapped[str] = mapped_column(String)
    to_port: Mapped[str] = mapped_column(String)

class ComponentDefinition(Base):
    __tablename__ = 'component_definitions'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)
    definition: Mapped[dict] = mapped_column(JSON, default=dict)

class Asset(Base):
    __tablename__ = 'assets'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)
    model: Mapped[str] = mapped_column(String)
    metadata_json: Mapped[dict] = mapped_column('metadata', JSON, default=dict)

class Simulation(Base):
    __tablename__ = 'simulations'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey('projects.id', ondelete='CASCADE'))
    source_pressure: Mapped[float] = mapped_column(Float)
    result: Mapped[dict] = mapped_column(JSON, default=dict)

class SimulationEvent(Base):
    __tablename__ = 'simulation_events'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey('projects.id', ondelete='CASCADE'))
    event_type: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)

class Failure(Base):
    __tablename__ = 'failures'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    simulation_id: Mapped[str] = mapped_column(ForeignKey('simulations.id', ondelete='CASCADE'))
    component_id: Mapped[str] = mapped_column(String)
    reason: Mapped[str] = mapped_column(Text)
    pressure: Mapped[float] = mapped_column(Float)
