// WebGL을 쓸 수 있는지 확인한다. three.js를 불러오기 전에(가볍게) 판단하려고 따로 둔 파일이다.
let cached: boolean | null = null;

export function webglSupported(): boolean {
  if (cached !== null) return cached;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    cached = !!gl;
    // 확인용 컨텍스트는 바로 놓아 준다 (브라우저는 동시에 쓸 수 있는 WebGL 컨텍스트 수가 제한적이다)
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

/** 설정(3D 캐릭터)과 기기 지원 여부를 함께 본다. App이 data-hero3d 속성으로 설정을 알려 준다. */
export function hero3dEnabled(): boolean {
  return document.documentElement.dataset.hero3d !== 'off' && webglSupported();
}
