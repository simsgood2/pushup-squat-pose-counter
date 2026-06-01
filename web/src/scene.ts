import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export type SceneContext = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  composer: EffectComposer;
  cleanup: () => void;
};

/** Large inverted sphere with a dark navy -> cyan-horizon gradient. */
function buildSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(40, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x05070d) },
      horizonColor: { value: new THREE.Color(0x0c2630) },
      bottomColor: { value: new THREE.Color(0x02030a) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldPos;
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 bottomColor;
      void main() {
        float h = normalize(vWorldPos).y;
        vec3 col = h > 0.0
          ? mix(horizonColor, topColor, clamp(h * 1.4, 0.0, 1.0))
          : mix(horizonColor, bottomColor, clamp(-h * 1.4, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

export function initScene(canvas: HTMLCanvasElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);
  scene.fog = new THREE.FogExp2(0x081420, 0.05);

  // Image-based lighting from a built-in neutral room (no external HDR asset).
  // Kept subtle so the character isn't blown out / picked up by bloom.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();

  scene.add(buildSky());

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.1, 3.5);
  camera.lookAt(0, 0.85, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.85, 0);
  controls.update();

  // Cyan/navy tinted ambient fill.
  const hemiLight = new THREE.HemisphereLight(0x2a4a5e, 0x05070d, 0.4);
  hemiLight.position.set(0, 8, 0);
  scene.add(hemiLight);

  // Key light with a tight shadow frustum fit to the board.
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
  dirLight.position.set(4, 8, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 30;
  dirLight.shadow.camera.left = -3;
  dirLight.shadow.camera.right = 3;
  dirLight.shadow.camera.top = 3;
  dirLight.shadow.camera.bottom = -3;
  dirLight.shadow.bias = -0.0005;
  dirLight.shadow.normalBias = 0.02;
  scene.add(dirLight);

  const grid = new THREE.GridHelper(20, 20, 0x0e2a33, 0x0a1a22);
  scene.add(grid);

  const groundGeo = new THREE.PlaneGeometry(20, 20);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0e16, roughness: 0.92, metalness: 0.0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Post-processing: render -> bloom (neon emissives only) -> tonemap/sRGB output.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.35, // strength (subtle)
    0.3,  // radius
    1.1   // threshold (only HDR neon emissives bloom, not the lit character)
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let animFrameId: number;

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    controls.update();
    composer.render();
  }

  animate();

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  return {
    scene,
    camera,
    renderer,
    controls,
    composer,
    cleanup: () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', onResize);
      composer.dispose();
      renderer.dispose();
    },
  };
}
