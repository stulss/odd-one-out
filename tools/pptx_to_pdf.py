# PPTX → PDF 변환 — 설치된 PowerPoint를 COM으로 구동해 실제 내보내기 엔진을 그대로 쓴다.
# (LibreOffice가 없는 환경이라 PowerPoint 자동화가 가장 정확한 렌더링을 보장한다)
#
# 실행: python tools/pptx_to_pdf.py [입력.pptx] [출력.pdf]

import os, sys, time
import win32com.client

sys.stdout.reconfigure(encoding='utf-8')
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SRC = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "발표자료.pptx")
DST = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else "발표자료.pdf")
FORMAT_PDF = 32  # ppSaveAsPDF

def main():
    if not os.path.exists(SRC):
        sys.exit(f"입력 파일 없음: {SRC}")
    if os.path.exists(DST):
        os.remove(DST)  # SaveAs가 기존 파일이 있으면 조용히 실패하는 경우가 있어 미리 지운다

    # 이전 실행이 비정상 종료되면 POWERPNT.EXE가 남아 .pptx를 잠근 채로 떠 있을 수 있다.
    os.system("taskkill /IM POWERPNT.EXE /F >nul 2>&1")
    time.sleep(1)

    app = win32com.client.Dispatch("PowerPoint.Application")
    # PowerPoint는 창을 완전히 숨기면 SaveAs가 실패하는 경우가 있어 최소화만 한다
    try:
        app.WindowState = 2  # ppWindowMinimized
    except Exception:
        pass

    pres = app.Presentations.Open(SRC, WithWindow=False)
    try:
        pres.SaveAs(DST, FORMAT_PDF)
    finally:
        pres.Close()
        app.Quit()

    for _ in range(20):
        if os.path.exists(DST) and os.path.getsize(DST) > 1000:
            break
        time.sleep(0.5)

    if not os.path.exists(DST):
        sys.exit("변환 실패 — 출력 파일이 생성되지 않았습니다.")
    print(f"변환 완료: {DST} ({os.path.getsize(DST)/1024:.0f}KB)")

main()
