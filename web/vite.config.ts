import { defineConfig } from 'vite';

export default defineConfig({
  // MediaPipe Tasks Vision의 WASM 글루 스크립트는 Vite의 esbuild pre-bundle를 거치면
  // "ModuleFactory not set" 오류가 난다. 사전 번들에서 제외해야 정상 로드됨.
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
});
