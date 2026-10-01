"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, Float } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Dataset } from "@/lib/dataset";
import { hashUnit } from "@/lib/format";

/* One point per player; the cloud IS the dataset. */
interface Node {
  x: number;
  y: number;
  z: number;
  color: THREE.Color;
  scale: number;
  overall: number;
}

function buildNodes(dataset: Dataset): Node[] {
  const players = dataset.players;
  const count = Math.min(players.length, 520);
  const step = Math.max(1, Math.floor(players.length / count));
  const nodes: Node[] = [];
  const cyan = new THREE.Color("#22d3ee");
  const lime = new THREE.Color("#a3e635");
  const slate = new THREE.Color("#2b3444");

  for (let i = 0; i < players.length; i += step) {
    const p = players[i];
    // Radius from overall, height from defensive/physical balance. Goalkeepers
    // have no published group ratings, so fall back to the raw attributes that
    // EA does define for them rather than dividing by a hard zero.
    const r = 1.6 + (p.overall / 99) * 3.1;
    const t = hashUnit(String(p.id));
    const theta = t * Math.PI * 2 + p.overall * 0.12;
    const defence = p.hasGroupRatings
      ? p.groups.DEF
      : (p.attributes.standingTackle + p.attributes.interceptions) / 2;
    const physical = p.hasGroupRatings
      ? p.groups.PHY
      : (p.attributes.strength + p.attributes.jumping) / 2;
    const y = (defence / 99 - 0.4) * 5.6 + (physical / 99 - 0.4) * 3.4;
    const quality = (p.overall - 55) / 40;
    const color = slate.clone().lerp(quality > 0.62 ? lime : cyan, Math.max(0, Math.min(1, quality)));
    nodes.push({
      x: Math.cos(theta) * r * (2.6 + t * 0.5),
      y,
      z: Math.sin(theta) * r * (2.6 + t * 0.5),
      color,
      scale: 0.055 + (p.overall / 99) * 0.075,
      overall: p.overall,
    });
  }
  return nodes;
}

function Points({ dataset }: { dataset: Dataset }) {
  const pointsRef = useRef<THREE.Points>(null);
  const size = useThree((s) => s.size);
  const nodes = useMemo(() => buildNodes(dataset), [dataset]);
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(nodes.length * 3);
    const colors = new Float32Array(nodes.length * 3);
    const sizes = new Float32Array(nodes.length);
    nodes.forEach((n, i) => {
      positions.set([n.x, n.y, n.z], i * 3);
      colors.set([n.color.r, n.color.g, n.color.b], i * 3);
      sizes[i] = n.scale;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: geo, material: mat };
  }, [nodes]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.045;
    pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.12) * 0.14;
    const scale = 1 + Math.sin(state.clock.elapsedTime * 0.7) * 0.02;
    pointsRef.current.scale.setScalar(scale * (size.height / 900) * 1.4);
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

function Ball({ position = [0, 0, 0] as [number, number, number] }: { position?: [number, number, number] }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (mesh.current) mesh.current.rotation.y += delta * 0.16;
  });
  return (
    <mesh ref={mesh} position={position} scale={2.05}>
      <icosahedronGeometry args={[1, 3]} />
      <meshStandardMaterial
        color="#0a0d12"
        emissive="#22d3ee"
        emissiveIntensity={0.16}
        roughness={0.42}
        metalness={0.72}
        wireframe
        transparent
        opacity={0.34}
      />
    </mesh>
  );
}

function CameraRig() {
  const { camera, pointer } = useThree();
  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 1.5, 0.045);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, pointer.y * 0.9, 0.045);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export function HeroScene({ dataset }: { dataset: Dataset }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 11], fov: 48 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.35} />
        <pointLight position={[6, 5, 6]} intensity={26} color="#22d3ee" distance={30} />
        <pointLight position={[-7, -4, 4]} intensity={18} color="#a3e635" distance={28} />
        <fog attach="fog" args={["#06070a", 9, 26]} />
        <Float speed={0.7} rotationIntensity={0.18} floatIntensity={0.35}>
          <Ball />
        </Float>
        <Points dataset={dataset} />
        <CameraRig />
        <AdaptiveDpr pixelated />
      </Canvas>
    </div>
  );
}
