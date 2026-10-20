# 풀업 트레이닝

`hodu-ho.me/pullup/`. 청첩장과 같은 레포에 있지만 코드·스타일은 공유하지 않는 독립 페이지다. 빌드 없음, 의존성 없음.

## 파일

| 파일 | 역할 |
| --- | --- |
| `figure.js` | 픽토그램 엔진. 뼈대·기구 그리기, 포즈 보간, 반복 재생, 휴식 전환, 땀·색 효과. `window.Figure` |
| `exercises.js` | 운동별 데이터만. `window.EXERCISES` |
| `script.js` | 앱 로직 (기록, 타이머, 설정, 저장) |
| `apps-script.gs` | Google Sheets 연동용 Apps Script (선택) |

`index.html`에서 `figure.js` → `exercises.js` → `script.js` 순서로 불러온다.

## 사용 흐름

1. 한 개 할 때마다 `Full ROM` 또는 `부분` 버튼을 누른다. 큰 숫자는 Full ROM 개수만 센다. 픽토그램을 눌러도 Full ROM 1개다.
2. `세트 기록`을 누르면 세트가 저장되고 휴식 화면으로 바뀐다. 입력 영역과 휴식 영역은 동시에 보이지 않는다.
3. 휴식 화면: `리셋`은 타이머만 처음으로 되돌린다(흐르던 중이면 계속 흐른다). `다음 세트 시작`이나 타이머 종료로 입력 화면에 돌아온다.
4. `오늘 운동 종료 & 저장`은 휴식 화면에만 있다. 세트 도중 잘못 누르지 않게 하기 위해서다.
5. 목표 세트 수를 채운 세트를 기록하면 타이머 없이 휴식 화면만 연다.
6. 이미 기록한 세트가 있는 채로 페이지를 열면 휴식 화면(타이머 정지)으로 시작한다.

## 판단 규칙

- 유효 개수는 Full ROM만 센다. 부분 반복은 기록은 하되 목표·그래프·판정에 포함하지 않는다.
- 밴드 다운그레이드 배너: 마지막 세션에서 목표 세트 수 이상을 모두 목표 횟수 이상(Full ROM 기준)으로 마치면 띄운다. `더 얇은 밴드 보유 중`이 꺼져 있으면 밴드 교체 대신 세트·횟수 증가를 권한다.
- 급감 경고: 직전 세트 대비 Full ROM 개수가 40% 이상 줄면 표시한다.
- 목표 초과 효과(Full ROM 기준): 목표 도달 시 초록, +1~2 노랑, +3 이상 빨강과 떨림. 목표를 넘긴 뒤부터 한 개마다 땀방울이 튄다.

## 픽토그램 엔진

### 뼈대

모든 운동이 같은 뼈대를 쓴다. 좌표계는 `viewBox 0 0 100 150`.

| 부위 | 좌표 수 | 그리는 방식 |
| --- | --- | --- |
| `armL`, `armR` | 6 (어깨-팔꿈치-손 같은 3점) | 선 9, 둥근 끝 |
| `head` | 2 (중심) | 반지름 9 원 |
| `torso` | 4 (위-아래 2점) | 선 18, 둥근 끝 |
| `legL`, `legR` | 6 (3점) | 선 9, 둥근 끝 |

포즈끼리 좌표 수가 같기 때문에 그대로 선형 보간한다. 좌표 수가 틀리면 `create` 시점에 콘솔 경고가 뜬다. 3점 팔다리에서 관절이 필요 없는 포즈는 가운데 점을 두 끝의 중간에 둔다.

선 굵기만큼 둥근 끝이 튀어나오므로, 몸통 끝점은 실제 어깨·골반보다 9만큼 안쪽에 둔다.

### 기구

`figure.js`의 `PROPS`에 선으로 정의한다. 운동은 이름으로 고르기만 한다.

- `bar` — 철봉, y=14
- `floor` — 바닥, y=130. 휴식 자세에서 항상 켜진다.

새 기구(평행봉, 벤치 등)가 필요하면 `PROPS`에 추가한다.

### 휴식 자세

`figure.js`의 `REST`(쭈그려 앉기)를 모든 운동이 같이 쓴다. 휴식에 들어가면 운동 기구가 꺼지고 바닥이 켜진다. 운동마다 다른 휴식 자세가 필요하면 운동 정의에 `restPose`를 넣는다.

### 운동 추가하기

`exercises.js`에 항목 하나를 추가한다.

```
pushup: {
  id: 'pushup',          // 키와 같게. 경고 메시지에 쓴다
  name: '푸시업',
  props: ['floor'],      // 운동 중 보일 기구
  start: 'up',           // 시작·복귀 자세
  rep: ['down'],         // 한 회에 거치는 자세들. 여러 개면 순서대로 지나간 뒤 start로 돌아온다
  partialDepth: 0.6,     // 부분 반복은 rep[0]까지 이 비율만큼만 간다
  tempo: { up: 380, down: 420 },  // ms. up은 rep의 각 구간, down은 start로 돌아오는 구간
  poses: { up: {...}, down: {...} },
  restPose: {...},       // 선택
}
```

앱은 지금 `EXERCISES.pullup`만 쓴다. 운동을 고르는 화면과 운동별 기록은 아직 없다.

정면에서 알아보기 어려운 동작(푸시업, 플랭크 등)은 옆모습으로 그린다. 같은 뼈대로 왼쪽·오른쪽 팔다리를 거의 겹쳐 두면 된다. 다만 정면 휴식 자세와 옆모습 운동 사이를 보간하면 몸이 납작하게 돌아가는 모양이 되므로, 옆모습 운동에는 옆모습 `restPose`를 따로 주는 편이 낫다.

### API

```
const fig = Figure.create(rootEl, EXERCISES.pullup);
fig.rep(full)       // 한 회 재생. 재생 중이면 최대 3개까지 쌓는다. 휴식 중엔 무시
fig.rest(on)        // 휴식 자세로 / 시작 자세로
fig.effort(stage)   // '' | 'goal' | 'over1' | 'over2' → 루트에 is-<stage>
fig.sweat(drops)    // 머리 옆으로 땀방울
fig.el              // 루트 요소
```

## 동작 참고 자료

- [free-exercise-db](https://github.com/yuhonas/free-exercise-db) — 운동 800여 개, Unlicense(퍼블릭 도메인). 운동마다 사진 2장(`0.jpg`, `1.jpg`)과 수행 순서 설명이 있어서, 시작 자세와 `rep` 자세를 잡는 기준으로 쓰기 좋다. 예: [`Pullups.json`](https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pullups.json), [`Pullups/0.jpg`](https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pullups/0.jpg). `equipment` 필드는 기구 선택 참고용. 일부 항목은 `null`.
- 도쿄 2020 키네틱 스포츠 픽토그램 ([It's Nice That](https://www.itsnicethat.com/news/tokyo-2020-olympic-paralympic-kinetic-sport-pictograms-animation-260220), [designboom](https://www.designboom.com/design/tokyo-2020-kinetic-pictograms-olympic-games-03-09-2020/)) — 정적 픽토그램을 움직이게 만든 공식 사례. 등장-정지-퇴장 3박자로 2D 픽토그램에서 3D 동작을 표현한다. 움직임 연출 참고용이며 저작물이므로 가져다 쓰지 않는다.
- 머이브리지 연속 사진 ([NGA 소장본, 퍼블릭 도메인](https://www.nga.gov/collection/art-object-page.166680.html)) — 한 동작을 여러 컷으로 나눠 찍은 사진. 키프레임 사이 중간 자세와 타이밍을 볼 때 쓴다. 근력 운동보다는 걷기·뛰기 같은 동작 위주다.
- [pictogram2.com](https://pictogram2.com/) — 픽토그램 스타일 기준. 웹 제작 등 디자인 소재로는 무료지만 소재 자체의 재배포는 금지라, 이 공개 레포에 파일을 넣지 않고 스타일만 참고한다.

## 저장 데이터

`localStorage`의 `pullup_data_v1` 키 하나에 전부 저장한다.

```
settings: { targetSets, targetReps, restSeconds, hasThinnerBand,
            blackOwned, greenOwned, sheetsUrl,
            dismissedDowngradeFor, suggestDowngradeSessionId }
draft:    { date, blackActive: [bool], greenActive: [bool], sets: [Set] }  // 진행 중인 날
sessions: [{ id, date, black, green, sets: [Set] }]                         // 확정된 날
Set:      { reps, romReps, black, green }
```

- `reps`는 시도한 총 개수, `romReps`는 그중 Full ROM 개수.
- 밴드는 보유 개수만큼 아이콘을 만들고 각각 켜고 끈다. 세트에는 켜진 개수만 저장한다.
- 예전 기록은 세트 단위 `fullROM` 불리언이었다. `romReps`가 없으면 `fullROM ? reps : 0`으로 읽는다.
- `dismissedDowngradeFor`는 배너를 닫은 세션 id. 같은 세션으로는 다시 띄우지 않는다.

## Google Sheets 연동 (선택)

`apps-script.gs`를 구글 시트의 Apps Script로 배포하고, 웹앱 URL을 설정 패널의 `Google Sheets 연동 URL`에 넣는다. `오늘 운동 종료` 때 세트마다 한 행씩 보낸다. 응답을 읽지 않는 `no-cors` 요청이라 실패해도 로컬 기록은 그대로다.

시트 컬럼(A~H): 날짜 | 세트번호 | 시도횟수 | FullROM횟수 | 밴드(검정) | 밴드(초록) | 휴식시간(초) | 비고

재배포는 배포 관리 → 편집(연필) → 버전 `새 버전`으로 한다. `새 배포`로 만들면 URL이 바뀌어 앱에 넣은 URL이 깨진다. 배포 없이 동작을 보려면 Apps Script 편집기에서 `debugAppend`를 실행한다.

## 브라우저 제약과 확인 방법

- iOS는 사용자 제스처 안에서 만든 `AudioContext`만 소리를 낸다. 그래서 첫 클릭 때 미리 만들어 두고, 휴식 종료 알림음에 재사용한다.
- `.banner`, `.set-form`, `.timer`는 자체 `display` 값이 있어 브라우저 기본 `[hidden]` 스타일을 덮어쓴다. 각각 `[hidden] { display: none; }` 규칙을 따로 두었다. 지우면 숨김이 안 된다.
- 헤드리스 Chrome은 창 폭을 최소 500px로 잡는다. `--window-size=375,...`로 찍어도 500px 레이아웃을 잘라 찍은 것이므로, 좁은 폭은 iframe(`width:375px`)에 띄워서 확인한다.
- 헤드리스 Chrome의 `--virtual-time-budget` 캡처는 `requestAnimationFrame`으로 그리는 픽토그램을 중간 프레임으로 찍는 경우가 있다. 픽토그램 동작은 DOM 값을 직접 읽거나 실제 브라우저에서 확인한다.
