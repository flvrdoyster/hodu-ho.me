# 풀업 트레이닝

`hodu-ho.me/pullup/`. 청첩장과 같은 레포에 있지만 코드·스타일은 공유하지 않는 독립 페이지다. 빌드 없음, 의존성 없음.

## 사용 흐름

1. 한 개 할 때마다 `Full ROM` 또는 `부분` 버튼을 누른다. 큰 숫자는 Full ROM 개수만 센다.
2. `세트 기록`을 누르면 세트가 저장되고 화면이 휴식 타이머로 바뀐다. 입력 영역과 타이머는 동시에 보이지 않는다.
3. 타이머가 끝나거나 `다음 세트 시작`을 누르면 입력 화면으로 돌아온다.
4. `오늘 운동 종료 & 저장`으로 그날 세션을 확정한다.

## 판단 규칙

- 유효 개수는 Full ROM만 센다. 부분 반복은 기록은 하되 목표·그래프·판정에 포함하지 않는다.
- 밴드 다운그레이드 배너: 마지막 세션에서 목표 세트 수 이상을 모두 목표 횟수 이상(Full ROM 기준)으로 마치면 띄운다. `더 얇은 밴드 보유 중`이 꺼져 있으면 밴드 교체 대신 세트·횟수 증가를 권한다.
- 급감 경고: 직전 세트 대비 Full ROM 개수가 40% 이상 줄면 표시한다.
- 목표 초과 효과(Full ROM 기준): 목표 도달 시 초록, +1~2 노랑, +3 이상 빨강과 떨림. 목표를 넘긴 뒤부터 한 개마다 땀방울이 튄다.

## 픽토그램

- 포즈(`hang`, `top`, `rest`)마다 팔·다리·몸통의 점 개수를 맞춰 두었기 때문에 좌표를 그대로 선형 보간한다. 포즈를 추가할 때도 점 개수를 맞춰야 한다.
- 부분 반복은 `hang`과 `top` 사이 62% 지점까지만 올라간다.
- 픽토그램을 눌러도 Full ROM 1개로 센다.

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

## 브라우저 제약

- iOS는 사용자 제스처 안에서 만든 `AudioContext`만 소리를 낸다. 그래서 첫 클릭 때 미리 만들어 두고, 휴식 종료 알림음에 재사용한다.
- `.banner`, `.set-form`, `.timer`는 자체 `display` 값이 있어 브라우저 기본 `[hidden]` 스타일을 덮어쓴다. 각각 `[hidden] { display: none; }` 규칙을 따로 두었다. 지우면 숨김이 안 된다.
- 헤드리스 Chrome의 `--virtual-time-budget` 캡처는 `requestAnimationFrame`으로 그리는 픽토그램을 중간 프레임으로 찍는 경우가 있다. 픽토그램 동작은 실제 브라우저에서 확인한다.
