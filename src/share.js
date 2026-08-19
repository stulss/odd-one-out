// 공유 — Web Share L2 → 클립보드 이미지 복사 → Web Share L1(텍스트) → 폴백 3종.
// 어떤 브라우저에서도 "공유가 안 된다"는 상태로 끝나지 않게 한다.

export async function share({ blob, text, url, onFallback, onToast }){
  const fullText = url ? `${text}\n${url}` : text;
  const file = blob ? new File([blob], 'odd-one-out.png', { type: 'image/png' }) : null;

  // 1순위: 이미지 + 텍스트 + URL을 네이티브 공유 시트로 (모바일 대부분)
  if (file && navigator.canShare?.({ files: [file] })){
    try { await navigator.share({ files: [file], text, url }); return 'files'; }
    catch (e){ if (e?.name === 'AbortError') return 'cancel'; }
  }

  // 2순위: 이미지를 클립보드에 바로 복사한다 (데스크탑 — 네이티브 공유가 없는 대부분의 경우).
  // 버튼을 한 번 더 눌러 "이미지 저장"까지 갈 필요 없이, [결과 공유] 클릭 한 번으로
  // 카톡·디스코드 등에 바로 붙여넣을 수 있게 한다. 링크 텍스트도 같은 클립보드 항목에
  // text/plain 표현으로 함께 담아, 이미지를 못 받는 곳(텍스트 입력창 등)에 붙여넣으면
  // 링크가 대신 붙는다.
  if (await copyImage(blob, fullText, onToast)) return 'clipboard-image';

  // 3순위: 텍스트 + URL을 네이티브 공유 시트로
  if (navigator.share){
    try { await navigator.share({ text, url }); return 'text'; }
    catch (e){ if (e?.name === 'AbortError') return 'cancel'; }
  }
  // 4순위: 화면에 폴백 버튼을 띄운다
  onFallback?.();
  return 'fallback';
}

// 이미지를 클립보드에 복사한다. 텍스트를 함께 주면 같은 클립보드 항목에
// text/plain 표현으로 넣는다 — 대상 앱이 이미지를 못 받으면 텍스트가 대신 붙는다.
// 미지원 환경(구형 Firefox, 비보안 컨텍스트 등)이나 권한 거부 시 조용히 false를 반환한다.
async function copyImage(blob, text, onToast){
  if (!blob) return false;
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  try {
    // 값을 Promise로 넣는다 — Safari는 clipboard.write가 사용자 제스처 직후에
    // 동기적으로 시작되기를 요구하는데, Promise 형태면 blob 준비를 기다려도 통과한다.
    const items = { [blob.type || 'image/png']: Promise.resolve(blob) };
    if (text) items['text/plain'] = Promise.resolve(new Blob([text], { type: 'text/plain' }));
    await navigator.clipboard.write([new ClipboardItem(items)]);
    onToast?.('결과 이미지를 복사했습니다 · 붙여넣기(Ctrl+V) 해보세요');
    return true;
  } catch {
    return false;
  }
}

export async function copy(str, onToast){
  try {
    await navigator.clipboard.writeText(str);
    onToast?.('복사했습니다');
    return true;
  } catch {
    // 비보안 컨텍스트(http, file://)에서는 clipboard API가 없다
    try {
      const ta = document.createElement('textarea');
      ta.value = str;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      onToast?.(ok ? '복사했습니다' : '복사에 실패했습니다');
      return ok;
    } catch { onToast?.('복사에 실패했습니다'); return false; }
  }
}

export function saveImage(blob, onToast){
  if (!blob){ onToast?.('이미지를 만들 수 없습니다'); return; }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'odd-one-out.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onToast?.('이미지를 저장했습니다');
  } catch { onToast?.('길게 눌러 이미지를 저장하세요'); }
}
