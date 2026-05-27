import * as THREE from 'three';

export function initScene(canvas: HTMLCanvasElement): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  const grid = new THREE.GridHelper(20, 20, 0x444444, 0x444444);
  scene.add(grid);

  const groundGeo = new THREE.PlaneGeometry(20, 20);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  let animFrameId: number;

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  (window as unknown as Record<string, unknown>)['__sceneReady'] = true;

  return () => {
    cancelAnimationFrame(animFrameId);
    renderer.dispose();
  };
}
