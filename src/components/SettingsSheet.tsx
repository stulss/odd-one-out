import { useEngine, useSnapshot } from '../hooks/useEngine';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const engine = useEngine();
  const { store, log } = useSnapshot();
  const s = store.settings;
  const { list, have } = engine.achievements();

  return (
    <section id="settings" aria-label="설정">
      <div className="row"><label htmlFor="optSound">소리</label>
        <input type="checkbox" id="optSound" checked={s.sound} onChange={e => engine.setSetting('sound', e.target.checked)} /></div>
      <div className="row"><label htmlFor="optMusic">배경음악</label>
        <input type="checkbox" id="optMusic" checked={s.music} onChange={e => engine.setSetting('music', e.target.checked)} /></div>
      <div className="row"><label htmlFor="optMotion">움직임 줄이기</label>
        <input type="checkbox" id="optMotion" checked={s.reducedMotion} onChange={e => engine.setSetting('reducedMotion', e.target.checked)} /></div>
      <div className="row"><label htmlFor="tuneOut2">난이도 T = <span id="tuneOut">{s.tuneT.toFixed(1)}</span></label>
        <input type="range" id="tuneOut2" min="2.6" max="5.4" step="0.2" value={s.tuneT}
          onChange={e => engine.setSetting('tuneT', +e.target.value)} /></div>
      <div className="hint">T가 클수록 단계마다 <b>차이가 빨리 미묘해집니다</b>. 난이도에 영향을 주는 값은 이 하나뿐입니다.<br />
        (제한 시간은 고정 — 판을 끝내는 것은 시간 부족이 아니라 차이를 못 찾는 것이기 때문)</div>
      <div className="row"><label htmlFor="optColor">색 구분 보조 (색조·채도 차이를 밝기 차이로 표시)</label>
        <input type="checkbox" id="optColor" checked={s.colorSafe} onChange={e => engine.setSetting('colorSafe', e.target.checked)} /></div>
      <div className="row"><label htmlFor="optContrast">고대비 (글씨·경계선 진하게)</label>
        <input type="checkbox" id="optContrast" checked={s.highContrast} onChange={e => engine.setSetting('highContrast', e.target.checked)} /></div>
      <div className="row"><label htmlFor="opt3d">3D 캐릭터 (끄면 가벼운 2D 그림 · 오래된 기기용)</label>
        <input type="checkbox" id="opt3d" checked={s.hero3d} onChange={e => engine.setSetting('hero3d', e.target.checked)} /></div>
      <div className="row"><label>업적 <span id="achCount">{have.size}/{list.length}</span></label></div>
      <ul id="achList">
        {list.map(a => {
          const on = have.has(a.id);
          return (
            <li key={a.id} className={on ? 'on' : ''}>
              <span>{(on ? a.icon : '🔒') + ' ' + a.name}<small>{a.desc}</small></span>
            </li>
          );
        })}
      </ul>
      <div className="row"><label>기록한 판 수</label><b id="logCount">{log.count}</b></div>
      <pre id="logSummary">{log.lines.join('\n') || '아직 기록이 없습니다'}</pre>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost" id="btnCSV" type="button" style={{ minWidth: 0, flex: 1 }}
          onClick={() => void engine.copyText(engine.exportCSV())}>기록 CSV 복사</button>
        <button className="btn ghost" id="btnReset" type="button" style={{ minWidth: 0, flex: 1 }}
          onClick={() => engine.resetAll()}>기록 초기화</button>
      </div>
      <button className="btn" id="btnCloseSettings" type="button" onClick={onClose}>닫기</button>
    </section>
  );
}
