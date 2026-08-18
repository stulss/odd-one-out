// 공유 — Web Share L2 → L1 → 폴백 3종.
// 어떤 브라우저에서도 "공유가 안 된다"는 상태로 끝나지 않게 한다.

export async function share({ blob, text, url, onFallback, onToast }){
  const file = blob ? new File([blob], 'odd-one-out.png', { type: 'image/png' }) : null;

  // 1순위: 이미지 + 텍스트 + URL
  if (file && navigator.canShare?.({ files: [file] })){
    try { await navigator.share({ files: [file], text, url }); return 'files'; }
    catch (e){ if (e?.name === 'AbortError') return 'cancel'; }
  }
  // 2순위: 텍스트 + URL
  if (navigator.share){
    try { await navigator.share({ text, url }); return 'text'; }
    catch (e){ if (e?.name === 'AbortError') return 'cancel'; }
  }
  // 3순위: 화면에 폴백 버튼을 띄운다
  onFallback?.();
  return 'fallback';
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
