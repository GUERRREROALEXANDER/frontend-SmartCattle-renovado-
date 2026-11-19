import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BackSide,
  CircleGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { SUN_DIRECTION } from './sun'

/** What the sky looks like at one moment; the day and night cycle hands a new one over as time passes. */
export interface SkyLook {
  zenith: Color
  horizon: Color
  /** Sun or moon disc. */
  disc: Color
  cloud: Color
  lightDirection: Vector3
  /** 0 by day, 1 in full night. */
  stars: number
}

// Linear HDR sky values; the renderer tone maps them like any lit surface.
const NOON: SkyLook = {
  zenith: new Color(0x3f7fcf).multiplyScalar(1.25),
  horizon: new Color(0xd3e3ea).multiplyScalar(1.3),
  disc: new Color(1, 0.92, 0.78),
  cloud: new Color(1.45, 1.43, 1.4),
  lightDirection: SUN_DIRECTION,
  stars: 0,
}

function fogVector(fogColor: Color) {
  const srgb = fogColor.clone()
  srgb.getRGB(srgb, SRGBColorSpace)
  return new Vector3(srgb.r, srgb.g, srgb.b)
}

function skyMaterial() {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uHorizon: { value: NOON.horizon.clone() },
      uZenith: { value: NOON.zenith.clone() },
      uSunDir: { value: NOON.lightDirection.clone() },
      uSun: { value: NOON.disc.clone() },
      uCloud: { value: NOON.cloud.clone() },
      uStars: { value: 0 },
      uFog: { value: new Vector3(1, 1, 1) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      uniform vec3 uSunDir;
      uniform vec3 uSun;
      uniform vec3 uCloud;
      uniform float uStars;
      uniform vec3 uFog;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec3 d = normalize(vDir);
        float t = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0.0, 1.0, t), 0.55));
        // Stars sit on a fixed grid of the dome, so they never swim as the camera turns.
        if (uStars > 0.01) {
          vec2 grid = vec2(atan(d.z, d.x) * 58.0, d.y * 92.0);
          vec2 cell = floor(grid);
          float seed = hash(cell);
          vec2 at = fract(grid) - 0.5 - (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.7;
          float star = smoothstep(0.09, 0.0, length(at)) * step(0.86, seed);
          col += vec3(0.85, 0.9, 1.0) * star * (0.5 + seed) * uStars * smoothstep(0.02, 0.3, d.y);
        }
        // Soft fair-weather clouds on a flat layer.
        vec2 uv = d.xz / max(d.y, 0.06) * 1.4;
        float c = vnoise(uv) * 0.55 + vnoise(uv * 2.3 + 4.0) * 0.3 + vnoise(uv * 5.1 + 9.0) * 0.15;
        c = smoothstep(0.55, 0.8, c) * smoothstep(0.03, 0.25, d.y);
        col = mix(col, uCloud, c * 0.75);
        float s = max(dot(d, uSunDir), 0.0);
        col += uSun * (pow(s, 900.0) * 3.0 + pow(s, 16.0) * 0.3 + pow(s, 3.0) * 0.08);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        // Blend into the scene fog at the horizon so the land has no seam.
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFog, 1.0 - smoothstep(-0.02, 0.16, d.y));
      }`,
  })
}

export interface SkyProps {
  fogColor: Color
  environmentIntensity?: number
  /** Defaults to a clear late morning. */
  look?: SkyLook
  /** Dome radius; a scene seen from high above needs a larger one. */
  radius?: number
}

/** Sky dome that follows the camera, plus a matching PMREM environment for image-based light. */
export function Sky({ fogColor, environmentIntensity = 0.6, look = NOON, radius = 320 }: SkyProps) {
  const gl = useThree(state => state.gl)
  const scene = useThree(state => state.scene)
  const domeRef = useRef<Mesh>(null)
  const geometry = useMemo(() => new SphereGeometry(radius, 48, 24), [radius])
  const material = useMemo(() => skyMaterial(), [])

  useEffect(() => {
    const { uniforms } = material
    uniforms.uHorizon.value.copy(look.horizon)
    uniforms.uZenith.value.copy(look.zenith)
    uniforms.uSunDir.value.copy(look.lightDirection)
    uniforms.uSun.value.copy(look.disc)
    uniforms.uCloud.value.copy(look.cloud)
    Object.assign(uniforms.uStars, { value: look.stars })
    uniforms.uFog.value.copy(fogVector(fogColor))

    const envScene = new Scene()
    envScene.add(new Mesh(geometry, material))
    const groundGeometry = new CircleGeometry(300, 32).rotateX(-Math.PI / 2)
    const groundMaterial = new MeshBasicMaterial({ color: new Color(0x4f7a32).multiplyScalar(0.5 * (1 - look.stars * 0.8)) })
    const envGround = new Mesh(groundGeometry, groundMaterial)
    envGround.position.y = -2
    envScene.add(envGround)
    const pmrem = new PMREMGenerator(gl)
    const target = pmrem.fromScene(envScene, 0.02, 0.1, radius * 2.5)
    pmrem.dispose()
    groundGeometry.dispose()
    groundMaterial.dispose()
    Object.assign(scene, { environment: target.texture, environmentIntensity })
    return () => {
      Object.assign(scene, { environment: null })
      target.dispose()
    }
  }, [environmentIntensity, fogColor, geometry, gl, look, material, radius, scene])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame(({ camera }) => {
    domeRef.current?.position.copy(camera.position)
  })

  return <mesh ref={domeRef} geometry={geometry} material={material} renderOrder={-10} frustumCulled={false} />
}
