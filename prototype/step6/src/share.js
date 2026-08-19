// STEP 5에서 추가 — 공유.
//
// 브라우저마다 지원 범위가 다르다. 어떤 환경에서도 "공유가 안 된다"로 끝나지 않도록
// 3단계로 내려간다: 이미지+텍스트 → 텍스트만 → 화면에 복사 버튼.

export async function share({ blob, text, url, onFallback, onToast }){
  const file = blob ? new File([blob], 'odd-one-out.png', { type: 'image/png' }) : null;

  // 1순위: 이미지 + 텍스트 + URL (Android Chrome, iOS 16+)
  if (file && navigator.canShare?.({ files: [file] })){
    try { await navigator.share({ files: [file], text, url }); return 'files'; }
    catch (e){ if (e?.name === 'AbortError') return 'cancel'; }   // 사용자가 취소한 건 오류가 아니다
  }
  // 2순위: 텍스트 + URL
  if (navigator.share){
    try { await navigator.share({ text, url }); return 'text'; }
    catch (e){ if (e?.name === 'AbortError') return 'cancel'; }
  }
  // 3순위: 폴백 버튼을 화면에 띄운다 (PC 브라우저 대부분이 여기로 온다)
  onFallback?.();
  return 'fallback';
}

export async function copy(str, onToast){
  try {
    await navigator.clipboard.writeText(str);
    onToast?.('복사했습니다');
    return true;
  } catch {
    // http나 file:// 같은 비보안 컨텍스트에는 clipboard API가 없다
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
