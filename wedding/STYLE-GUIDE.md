# 청첩장 스타일 가이드

`wedding/` 페이지의 디자인 시스템 정의서. **CSS·HTML을 수정하기 전에 반드시 이 문서를 먼저 읽고, 여기 정의된 값과 패턴만 사용한다.**
새로운 색상·크기·간격 값을 임의로 만들지 않는다. 필요한 값이 여기 없으면 먼저 이 문서를 갱신하고 나서 코드를 고친다.

기준 커밋: `e1f2760` (현재 프로덕션 디자인)

---

## 1. 디자인 원칙

이 청첩장의 인상은 아래 네 가지에서 나온다. 어떤 변경도 이 원칙을 깨서는 안 된다.

1. **모노톤 + 여백** — 색은 검정~회색 램프 하나뿐이다. 강조는 색이 아니라 **무게(weight)와 여백**으로 만든다.
2. **타이포그래피 중심** — 장식 요소가 거의 없다. 자간(letter-spacing)과 행간이 톤을 결정한다.
3. **모바일 단일 컬럼** — 폭 420px 기준의 세로 흐름 하나. 반응형 분기(`@media`)가 존재하지 않으며, 필요 없도록 설계한다.
4. **절제된 모션** — 움직임은 스크롤 진입 시 한 번, 부드럽게. 반복·강조 애니메이션은 쓰지 않는다.

---

## 2. 토큰

모든 값은 `style.css`의 `:root`에 **CSS 변수로 정의되어 있다.**
**스타일시트 본문에 리터럴 값(`#1a1a1a`, `0.8rem`, `4px` …)을 직접 쓰지 않는다.** 반드시 `var(--토큰)`으로 참조한다.
색 표기는 `:root` 한 곳에서만 다루므로 3자리/6자리 헥스나 `rgb()`가 뒤섞일 일이 없다 (정의는 6자리 헥스, 투명도가 필요한 스크림만 `rgba()`).

### 2.1 색상

단일 회색 램프. 역할이 정해져 있으므로 **역할에 맞는 토큰을 고른다.**

| 토큰 | 값 | 역할 · 사용처 |
|---|---|---|
| `--ink` | `#1a1a1a` | **본문/제목** — 기본 텍스트, 이름, 헤딩, 강조 보더, 채움 버튼 배경 |
| `--ink-soft` | `#585757` | **보조 텍스트** — 영문 장소명, 주소, 오시는 길 상세 |
| `--ink-mute` | `#999999` | **약한 텍스트** — 입력 힌트, 방명록 이름, 비활성 토글 라벨, 부가 안내 |
| `--ink-faint` | `#bbbbbb` | placeholder, 아코디언 화살표 |
| `--ink-ghost` | `#c8c8c8` | 최약 — 달력 비활성 날짜, RSVP 완료 트리비아 |
| `--line` | `#dddddd` | **기본 보더** — 아웃라인 버튼, 인풋, 원형 버튼 |
| `--line-section` | `#e5e5e5` | **섹션 구분선** (점선, `.section + .section`) |
| `--line-item` | `#f2f2f2` | **항목 구분선** — 계좌·방명록 리스트, 아코디언 토글 하단 |
| `--surface` | `#ffffff` | 표면 — body, 버튼 배경, 커버 그라디언트 하단 |
| `--surface-sunken` | `#fafafa` | 선택 상태 배경 (`.rsvp__btn.is-active`) |
| `--surface-placeholder` | `#f0f0f0` | 갤러리 썸네일 로딩 전 배경 |
| `--scrim` | `rgba(255,255,255,0.97)` | 라이트박스 배경 (+ `backdrop-filter: blur(4px)`) |

**금지:** 컬러(유채색) 추가. 그림자(`box-shadow`). 위 램프에 없는 회색 값.

#### 시간대 톤 (`--tone-bg`)

`script.js`가 접속 시각에 따라 `--tone-bg`를 갱신하고, **커버 섹션 그라디언트에서만** 소비한다.

| 시간 | 값 | |
|---|---|---|
| 05–09 | `#fafbff` | dawn |
| 09–16 | `#ffffff` | day |
| 16–19 | `#fdf8f2` | dusk |
| 19–05 | `#f5f4f8` | night |

이 변수를 다른 섹션에서 쓰지 않는다. 커버만의 장치다.

### 2.2 타이포그래피

폰트: `'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif`
(jsDelivr CDN의 dynamic-subset 버전. `<link rel="preconnect">` 필수.)

**크기 스케일 — 이 4단계 외 사용 금지**

| 토큰 | 값 | 역할 · 사용처 |
|---|---|---|
| `--text-display` | `1.6rem` | 디스플레이 — 이름, 달력 월/일 숫자 |
| `--text-lead` | `1.2rem` | 강조 본문 — 초대 문구, 장소명(국문), 완료 메시지, 스테퍼 숫자 |
| `--text-base` | `1rem` | **기본** — 본문, 버튼 라벨, 인풋, 섹션 헤딩, 달력 날짜, D-day |
| `--text-caption` | `0.8rem` | 캡션 — 라벨, 주소, 상세 설명, 계좌·방명록 항목, 부가 안내 |

**무게**

| 값 | 용도 |
|---|---|
| `700` | 달력 숫자, 대상 날짜 |
| `600` | 섹션 헤딩, 라벨, 장소명(국문), 스테퍼 숫자 |
| `500` | 이름, 채움 버튼, 아코디언 토글, 방명록 이름 |
| `400` | 본문 (기본값, 명시하지 않음) |

**자간 (letter-spacing)** — 이 프로젝트 톤의 핵심

| 값 | 용도 |
|---|---|
| `0.15em` | 넓게 벌린 정보 라인 — 커버 날짜/장소, D-day, 영문 장소명 |
| `0.1em` | **섹션 헤딩 전용** (`오시는 길`, `참석 의사 전달`, `방명록`, `마음 전하실 곳`) |
| `0.08em` | 달력 요일 |
| `0.04em` | 이름, 채움 버튼 라벨, 푸터 |
| `0.02em` | 일반 라벨, 장소명(국문) |

**행간**

| 값 | 용도 |
|---|---|
| `1.1` | 큰 숫자·이름 (타이트하게) |
| `1.5` | 혼주 표기 |
| `1.6` | 일반 본문·상세 |
| `1.8` | 초대 문구, 완료 메시지 (넉넉하게) |

전역 설정: `word-break: keep-all`, `overflow-wrap: break-word`.
→ **한글이 어절 단위로만 줄바꿈된다.** 좁은 컨테이너에 긴 한글 라벨을 넣으면 줄바꿈되지 않고 넘친다. 폭이 좁은 요소를 만들 때 반드시 실제 렌더링으로 확인할 것.

### 2.3 여백

4px 그리드 기반. 실제 사용값:

| 용도 | 값 |
|---|---|
| 섹션 세로 패딩 | `80px` (커버는 `40px`) |
| 섹션 가로 패딩 | `32px` |
| 섹션 내부 기본 gap | `16px` (커버 `18px`) |
| 블록 그룹 간격 | `24px` |
| 요소 묶음 간격 | `12px` · `16px` |
| 인접 요소 간격 | `6px` · `8px` |
| 미세 간격 | `2px` · `4px` |
| 리스트 항목 세로 패딩 | `14px 0` |

**컨테이너 최대폭: `420px`** (`.section`이 `margin: 0 auto`로 중앙 정렬)
→ 실제 콘텐츠 가용 폭은 `420 - 64 = 356px`, 좁은 기기(375px)에서는 `311px`.

### 2.4 모서리·보더

| 토큰 | 값 | 용도 |
|---|---|---|
| `--radius` | `4px` | 버튼, 인풋, 텍스트에어리어 |
| `--radius-lg` | `12px` | 약도 이미지 |
| — | `50%` | 원형 (기하값이라 토큰화하지 않음) |
| `1px solid var(--line)` | 기본 보더 |
| `1px solid var(--ink)` | 강조/활성 보더 |
| `1px dashed var(--line-section)` | 섹션 구분선 |
| `1.4px solid var(--ink)` | 달력 대상일 원 (유일한 예외 두께) |

### 2.5 모션

| 토큰 | 값 | 용도 |
|---|---|---|
| `--dur-fast` | `0.2s` | 인터랙션 피드백 — 보더 색, 투명도, 화살표 회전 |
| `--dur-mid` | `0.3s` | 라이트박스 페이드·이미지 스케일 |
| `--dur-slow` | `0.8s` | 스크롤 리빌 (opacity + transform) |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | 위치가 움직이는 모든 모션 |

**표준 이징: `var(--ease-out)`** — 위치가 움직이는 모든 모션에 사용.

---

## 3. 레이아웃

```
body
└ main
  └ section.section[data-section="…"]   ← 모든 섹션이 동일 구조
```

- 모든 섹션은 `.section` 하나만 붙이고, 식별은 `data-section` 속성으로 한다 (스타일 훅 아님).
- `.section`은 `display: flex; flex-direction: column; align-items: center; gap: 16px`.
- 섹션 사이 점선 구분선은 `.section + .section`이 **자동 처리**한다. 개별 섹션에 보더를 직접 넣지 않는다.
- 커버(`.section--cover`)만 예외: `min-height: 100dvh`, 세로 중앙 정렬, 시간대 그라디언트.

### `hidden` 속성 주의

`.section`이 `display: flex`이므로 브라우저 기본 `[hidden]`을 덮어써 버린다. 그래서 `.section[hidden] { display: none }` 규칙이 존재한다.
**`hidden`으로 토글하는 요소에 `display`를 지정할 때는 반드시 `[hidden] { display: none }`을 같이 정의한다.** (`.rsvp__done`, `.account__list`, `.guestbook__more`도 동일 이유로 각각 정의되어 있다.)

섹션 순서: `cover → family → invite → date → location → gallery → rsvp → guestbook → account → footer`

---

## 4. 정보 위계

시각 규칙을 다 지켜도 **내용을 잘못된 자리에 놓으면 디자인이 깨진다.** 무엇을 어디에 놓을지는 아래로 판단한다.

### 4.1 문서의 흐름

10개 섹션은 세 구간으로 나뉜다.

| 구간 | 섹션 | 독자의 상태 |
|---|---|---|
| **핵심** | cover · family · invite · date · location | 누가·언제·어디, 어떻게 가는지 확인 |
| **감상·행동** | gallery · rsvp · guestbook | 보고, 답하고, 남긴다 |
| **부가·마무리** | account · footer | 부가 안내를 받고 마친다 |

정보 확인 → 감정 → 행동 → 부가 안내 순으로 톤이 내려간다.
**제약·양해·거절성 안내는 마지막 구간에 둔다.** 핵심 구간에 끼워 넣으면 실무 정보의 흐름을 끊고, 하객이 참석을 준비하는 시점에 "하지 말아 달라"는 말을 먼저 읽게 된다.

### 4.2 새 콘텐츠의 자리를 정하는 순서

1. 하객이 **참석하는 데 반드시 필요한** 정보인가? → 핵심 구간, 해당 섹션 안
2. 감상·참여를 유도하는가? → 감상·행동 구간
3. **부가 안내·양해·제약**인가? → 부가·마무리 구간 (`account` 앞뒤 또는 `footer` 직전)

예시
- 지하철·버스·자가용 안내 → 1번 → `location` 안 (현재 위치가 맞다)
- 화환 사양, 주차 안내, 식사 안내, 복장 안내 → **3번**
- 신랑·신부 사진 → 2번

### 4.3 종속 표현은 색과 크기로만 한다

이 디자인에서 **선(rule)은 "반복되는 구조"를 나눌 때만** 쓴다. 전체 목록이 이게 전부다.

| 선 | 용도 |
|---|---|
| `1px dashed var(--line-section)` | 섹션 사이 (`.section + .section`, 자동 적용) |
| `1px solid var(--line-item)` | 반복 항목 사이 — 계좌·방명록 리스트, 아코디언 토글 하단 |
| `1.4px solid var(--ink)` | 달력 대상일 원 (장식) |

반대로 **단발성 부가 텍스트에는 선을 긋지 않는다.** 기존 종속 텍스트는 예외 없이 **색 + 크기만으로** 종속을 표현한다.

| 요소 | 표현 |
|---|---|
| `.loc__venue-addr` · `.loc__detail` | `--text-caption` / `--ink-soft` |
| `.rsvp__hint` · `.rsvp__done-sub` · `.guestbook__name` · `.account__notice` | `--ink-mute` |
| `.rsvp__done-trivia` | `--text-caption` / `--ink-ghost` |

부가 텍스트에 선을 그으면 그것이 **새 구획으로 승격**되어, 가장 덜 중요한 내용이 가장 강한 구조 신호를 갖는 **위계 역전**이 일어난다. 섹션 구분선과 같은 점선을 섹션 *안에* 쓰면 특히 나쁘다 — 그 문단이 잘려 나온 별도 섹션처럼 보인다.

---

## 5. 컴포넌트

### 5.1 버튼 — 3단 위계

목적에 맞는 위계를 **재사용**한다. 새 버튼 스타일을 만들지 않는다.

**① 기본 (채움)** — 섹션당 하나뿐인 주요 행동
`.rsvp__submit`, `.share__btn`
```
width: 100%; padding: 12px 0; border: 1px solid var(--ink); border-radius: var(--radius);
background: var(--ink); color: var(--surface);
font-size: var(--text-base); font-weight: 500; letter-spacing: 0.04em;
:active { opacity: 0.8 }   :disabled { opacity: 0.4 }
```

**② 보조 (아웃라인) — `.btn`** — 병렬 가능한 부수 행동
```
padding: 10px 16px; border: 1px solid var(--line); border-radius: var(--radius);
background: var(--surface); color: var(--ink); font-size: var(--text-base);
:active { border-color: var(--ink) }
```
`.rsvp__btn`(참석/불참 토글), `.account__copy`(복사) 등이 `.btn`을 확장한다.
확장할 때 `.btn`의 패딩·폰트 크기를 덮어쓰지 않는다. 폭이 부족하면 **개수를 줄이거나 세로로 쌓는다.**

> **가로 배치 한계:** 가용 폭 311~356px에서 `.btn` 기본 패딩(좌우 16px) + 1rem 한글 라벨 기준, **한 줄에 안전한 버튼은 2개까지**다. 3개 이상이 필요하면 세로 스택 또는 2열 그리드로 간다.

**③ 텍스트/약한 버튼** — 목록 확장 등
`.guestbook__more` — 전체 폭 아웃라인이되 `--text-caption`, `color: var(--ink-mute)`

**원형 아이콘 버튼**
`.rsvp__step` 36px · `.lightbox__nav` 44px — `border-radius: 50%`, `1px solid var(--line)`

### 5.2 폼

```
.rsvp__field  : flex column, gap 8px  (라벨 + 컨트롤 한 쌍)
.rsvp__label  : --text-caption / 600 / 0.02em / --ink
.rsvp__hint   : 400 / --ink-mute   (라벨 안 괄호 보조문구)
인풋/텍스트에어리어 : padding 10px 12px, 1px solid var(--line), var(--radius), var(--text-base)
  :focus       → border-color: var(--ink)  (outline 없음)
  ::placeholder→ var(--ink-faint)
```
텍스트에어리어는 `resize: none`.

### 5.3 리스트 항목 (계좌 / 방명록)

```
padding: 14px 0;
border-bottom: 1px solid var(--line-item);
:last-child { border-bottom: none }   ← 방명록에 적용
```
계좌 항목은 `grid-template-columns: 1fr auto`로 좌측 정보 2줄 + 우측 복사 버튼 세로 중앙.

### 5.4 아코디언 (마음 전하실 곳)

`.account__toggle` — 전체 폭, `padding: 14px 0`, 하단 `1px solid var(--line-item)`, `--text-base`/500
화살표 `›`는 `.is-open`일 때 `rotate(90deg)`, `transition: transform 0.2s`
목록은 `hidden` 속성으로 토글 (+ `.account__list[hidden] { display: none }`)

### 5.5 달력

7열 그리드, `gap: 14px 4px`, `max-width: 320px`.
일요일 열과 지난 날짜는 `--ink-ghost` *(단, 날짜에는 현재 적용되지 않음 — §11 참고)*. 대상일은 `700` + `::before` 27px 원(`1.4px solid var(--ink)`).

### 5.6 갤러리 / 라이트박스

3열 그리드 `gap: 6px`, 항목은 `aspect-ratio: 1/1` + `object-fit: cover`.
가로로 긴 사진만 `.gallery__item--contain`으로 `object-fit: contain` (JS의 `GALLERY` 배열에서 `fit: 'contain'`으로 지정).
라이트박스: 흰색 97% 스크림 + blur(4px), 이미지 `scale(0.98) → 1`, 열릴 때 `body.no-scroll`.

---

## 6. 인터랙션 규칙

- **`:hover`를 쓰지 않는다.** 모바일 전용 페이지이므로 피드백은 전부 `:active`로 준다.
- 모든 탭 가능한 요소에 `-webkit-tap-highlight-color: transparent`를 넣는다.
- 포커스 표현은 인풋의 `border-color` 변화로만 한다.
- 복사·전송 등 결과 피드백은 **버튼 라벨을 일시적으로 바꾼다** (`복사` → `완료` → 1.5s 후 복귀). 토스트·알럿을 새로 만들지 않는다.

---

## 7. 스크롤 리빌

`IntersectionObserver(threshold: 0.15)`가 커버를 제외한 각 `.section`에 `.is-visible`을 붙인다(1회, 후 unobserve).

애니메이션 대상은 **명시된 요소만**이다: `.cal`, `.gallery`, `.rsvp`, `.rsvp__done`, `.guestbook__list`
→ `opacity: 0 → 1`, `translateY(16px) → 0`

텍스트 위주 섹션(family·invite·location·account·footer)은 **의도적으로 애니메이션하지 않는다.** 새 요소를 리빌 대상에 넣으려면 CSS의 두 셀렉터 목록(초기 상태 / `.is-visible`)에 **모두** 추가해야 한다.

---

## 8. 네이밍 · 코드 컨벤션

- **BEM**: `block__element--modifier` (`.loc__venue-kr`, `.cal__day--target`)
- **상태 클래스**: `is-*` (`is-open`, `is-active`, `is-visible`) — 블록에 종속시켜 사용 (`.account__toggle.is-open`)
- **JS 훅**: 동작만 필요한 경우 `id` 사용 (`#copyAddr`, `#shareBtn`) — 스타일은 클래스로만
- **CSS 파일 순서**: 리셋 → 루트/전역 → 섹션 레이아웃 → 커버 → 공통(이름·D-day·버튼) → 섹션별 블록(HTML 순서와 동일) → 스크롤 리빌
  → 새 블록은 **해당 섹션의 주석 블록 안에** 넣는다. 파일 끝에 붙이지 않는다.
- 주석은 한국어로, **왜**를 적는다 (`.section[hidden]` 주석이 좋은 예).

---

## 9. 접근성

- 아이콘 전용 버튼에 `aria-label` (`이전 사진`, `1명 줄이기`)
- 라이트박스는 `aria-hidden` 토글
- 초 단위로 갱신되는 D-day는 `aria-live="off"` (스크린리더 방해 방지)
- 장식용 이미지는 `alt=""`
- 전화번호 자동 링크 방지: `<meta name="format-detection" content="telephone=no">`

---

## 10. 변경 체크리스트

무언가를 추가·수정하기 전에:

- [ ] **이 내용이 놓일 구간을 §4.2로 판단했는가?** (부가 안내를 핵심 구간에 넣지 않았는가)
- [ ] **부가 텍스트에 선을 긋지 않았는가?** (종속은 색+크기로만 — §4.3)
- [ ] **리터럴 값 대신 `var(--토큰)`으로 썼는가?** (본문에 헥스·rem 직접 표기 금지)
- [ ] 쓰려는 색이 §2.1 램프에 있는가? (없으면 만들지 말고 가장 가까운 역할을 쓴다)
- [ ] 폰트 크기가 4단계 스케일 안에 있는가?
- [ ] 여백이 기존 값(4/6/8/12/14/16/24/32/80)과 맞는가?
- [ ] 버튼이면 3단 위계 중 하나를 그대로 재사용했는가?
- [ ] 가로로 나열한 요소가 **375px 기기(가용 311px)** 에서 넘치지 않는가? (`word-break: keep-all` 때문에 한글은 안 접힌다)
- [ ] `hidden`으로 토글하는데 `display`를 지정했다면 `[hidden] { display: none }`을 같이 넣었는가?
- [ ] 리빌 대상에 넣었다면 셀렉터 목록 **두 곳** 모두 수정했는가?
- [ ] `:hover`를 쓰지 않았는가?
- [ ] CSS를 해당 섹션 주석 블록 안에 넣었는가?
- [ ] 실제 렌더링(최소 375px·420px)으로 확인했는가?

---

## 11. 알려진 불일치

### 해소됨

| 항목 | 이전 | 현재 |
|---|---|---|
| 색 표기 혼용 | `#fff`(3자리) / `#ffffff`(6자리) / `rgba()` 가 뒤섞임 | `:root`에서만 정의(6자리 헥스, 스크림만 `rgba`), 본문은 전부 `var()` |
| 최약 회색 중복 | `#ccc`(트리비아) + `#c8c8c8`(달력) — 차이 3/255 | `--ink-ghost` 하나 |
| 항목 구분선 중복 | `#eee`(아코디언) + `#f2f2f2`(리스트) — 차이 4/255 | `--line-item` 하나 |
| 캡션 크기 중복 | `0.8rem` + `0.85rem`(방명록 2곳) | `--text-caption` 하나. 방명록 항목이 계좌 항목과 같은 구조가 됐다 |
| 토큰화 | 모든 값이 리터럴로 흩어져 있음 | `:root`에 23개 토큰, 본문 리터럴 0 |

### 미해결

**달력의 일요일 날짜가 회색으로 표시되지 않는다** *(오늘 작업과 무관한 기존 버그)*

`.cal__day--mute`와 `.cal__day`의 특이도가 같은데 `.cal__day`가 뒤에 선언되어 색을 덮어쓴다.
그 결과 요일 머리글 `S`는 회색인데 날짜 `1·8·15·22·29`는 평일과 같은 `--ink`로 나온다.

```css
.cal__dow--mute,
.cal__day--mute { color: var(--ink-ghost); }   /* 회색 지정 */

.cal__day       { color: var(--ink); }         /* 뒤에 와서 덮어씀 */
```

고치려면 `.cal__day--mute` 규칙을 `.cal__day` **뒤로** 옮기면 된다. 화면에 보이는 변화가 생기므로 별도 합의 후 처리한다.

### 토큰화하지 않은 것

의도적으로 리터럴로 남겨둔 값들이다.

| 대상 | 이유 |
|---|---|
| 여백 (`gap`, `padding`) | 2·4·6·8·12·14·16·18·20·24·32·40·80px로 불규칙해서, 값을 바꾸지 않고는 깔끔한 스케일이 나오지 않는다. `--space-1…13` 식 이름은 의미를 담지 못해 오히려 읽기 어려워진다 |
| 자간·행간·굵기 | 요소마다 맥락에 맞춰 고른 타이포 판단값이라, 이름을 붙이면 (`--tracking-dow` 같은) 한 곳에서만 쓰는 토큰이 늘어난다 |
| `50%`, `1.4px`, `100dvh` 등 | 기하·예외값 |

이 값들은 §2.3·§2.2에 표로 정리해 두었으니 거기서 고른다.
