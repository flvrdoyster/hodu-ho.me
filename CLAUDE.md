# hodu-ho.me

최유정 · 홍석화 결혼 청첩장. 빌드 도구 없는 정적 사이트이며, GitHub Pages로 `hodu-ho.me`에 서비스된다.

## 작업 규칙 (반드시 지킬 것)

### 1. 브랜치를 만들지 않는다
이 레포는 **`main` 단일 브랜치**로 운영한다. PR 기능은 비활성화되어 있다.
- 모든 작업은 `main`에서 하고 `main`에 직접 커밋·푸시한다.
- 기능 브랜치를 만들지 않는다. PR을 만들지 않는다.
- 세션이 별도 브랜치로 시작되었더라도, 결과는 `main`에 올린다.

### 2. 디자인을 건드리기 전에 스타일 가이드를 읽는다
**[`wedding/STYLE-GUIDE.md`](wedding/STYLE-GUIDE.md)** 에 색상·타이포·여백·컴포넌트 위계가 전부 정의되어 있다.
CSS나 마크업을 수정하기 전에 반드시 먼저 읽고, **거기 정의된 값과 패턴만 사용한다.**
새 색상·크기·간격·버튼 스타일을 임의로 만들지 않는다. 필요하면 가이드를 먼저 갱신한다.

### 3. main 푸시 = 즉시 배포
`main`에 푸시하면 GitHub Pages가 라이브 사이트에 바로 반영한다. 하객에게 이미 공유된 링크다.
푸시 전에 **반드시 로컬 렌더링으로 확인**한다 (아래 참고).

## 구조

```
index.html              → /wedding/ 으로 리다이렉트만 하는 진입점
404.html                → 빈 폴백
CNAME                   → hodu-ho.me
wedding/
  index.html            청첩장 본문 (섹션 10개)
  style.css             전체 스타일 (단일 파일, @media 없음)
  script.js             전체 동작 (단일 IIFE, 의존성 없음)
  STYLE-GUIDE.md        ★ 디자인 시스템 정의서
  apps-script.gs        RSVP·방명록 백엔드 (Google Apps Script, git으로 배포되지 않음)
  assets/               SVG 일러스트 · 갤러리 이미지
  printable/            인쇄용 .ai 원본
scripts/process-gallery.sh   갤러리 이미지 일괄 변환 (macOS 전용, sips 사용)
```

- 빌드·번들·패키지 매니저 없음. 파일을 그대로 서빙한다.
- 외부 의존성은 Pretendard 웹폰트(jsDelivr CDN) 하나뿐이다.

## 로컬 확인

```bash
python3 -m http.server 8080 -d wedding    # http://localhost:8080
```

레이아웃 변경 시 **375px과 420px 두 폭에서 실제 렌더링을 확인**한다.
`word-break: keep-all`이 전역으로 걸려 있어 한글 라벨은 줄바꿈되지 않고 넘치므로, 가로 배치를 바꿀 때 특히 주의한다.

> 헤드리스 브라우저로 전체 페이지를 한 번에 캡처하면 스크롤 리빌(IntersectionObserver)이 발동하지 않아
> 달력·갤러리·RSVP가 빈 화면으로 찍힌다. 섹션별로 스크롤해서 확인할 것.

## RSVP · 방명록

`script.js`의 `APPS_SCRIPT_URL`이 Google Apps Script 웹앱을 호출한다.
- 제출: `fetch` + `mode: 'no-cors'` (응답을 읽지 않는다)
- 방명록 조회: JSONP (`callback=` 파라미터)
- 이름 마스킹은 서버(`apps-script.gs`)에서 처리한다
- 로컬·오프라인 환경에서는 네트워크 호출이 실패하고 방명록 섹션이 숨겨진 상태로 남는다 — 정상 동작이다
