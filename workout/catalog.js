window.CATALOG = {
  lat_pulldown: {
    name: '랫풀다운', pattern: 'vertical_pull', equipment: 'cable_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1,
    cue: '손으로 당기지 말고 팔꿈치를 내린다고 생각하세요',
  },
  assisted_pullup: {
    name: '어시스트 풀업', pattern: 'vertical_pull', equipment: 'assist_machine',
    load: 'assist', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [6, 8],
    default_sets: 6, rest_sec: 150, progression: 'double', difficulty: 2,
    cue: '당기기 전에 어깨부터 아래로 내리세요',
  },
  dumbbell_press: {
    name: '덤벨 프레스', pattern: 'horizontal_push', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [8, 10],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 1,
    cue: '내릴 때 천천히, 가슴이 늘어나는 걸 느끼세요',
  },
  cable_pushdown: {
    name: '케이블 푸시다운', pattern: 'elbow_extension', equipment: 'cable_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [10, 12],
    default_sets: 3, rest_sec: 75, progression: 'double', difficulty: 1,
    cue: '팔꿈치가 앞뒤로 흔들리면 무게가 무거운 거예요',
  },
  seated_cable_row: {
    name: '시티드 케이블 로우', pattern: 'horizontal_pull', equipment: 'cable_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1,
    cue: '상체를 뒤로 젖혀서 당기지 마세요',
  },
  reverse_pec_deck: {
    name: '리버스 펙덱', pattern: 'rear_delt', equipment: 'pec_deck_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 4.54, rep_range: [10, 15],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1,
    cue: '가볍게 잡고 어깨 뒤쪽에 힘이 들어오는지만 보세요',
  },
  deadlift: {
    name: '데드리프트', pattern: 'hinge', equipment: 'barbell',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [5, 5],
    default_sets: 4, rest_sec: 150, progression: 'linear', difficulty: 3,
    cue: '들기 전에 배에 숨을 채우고 단단히 버티세요',
  },
  assisted_dip: {
    name: '어시스트 딥', pattern: 'horizontal_push', equipment: 'assist_machine',
    muscles: { primary: ['chest', 'triceps'], secondary: ['front_delts'] },
    load: 'assist', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [6, 8],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 2,
    cue: '어깨가 귀 쪽으로 올라가지 않게 하세요',
  },
  leg_press: {
    name: '레그 프레스', pattern: 'squat', equipment: 'leg_press_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 10, rep_range: [10, 12],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 1,
    cue: '엉덩이가 등받이에서 뜨기 전까지만 내리세요',
  },
  leg_curl: {
    name: '레그 컬', pattern: 'knee_flexion', equipment: 'leg_curl_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 4.54, rep_range: [10, 12],
    default_sets: 3, rest_sec: 75, progression: 'double', difficulty: 1,
    cue: '내릴 때 버티면서 천천히 풀어 주세요',
  },
  leg_extension: {
    name: '레그 익스텐션', pattern: 'knee_extension', equipment: 'leg_extension_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 4.54, rep_range: [12, 15],
    default_sets: 3, rest_sec: 75, progression: 'double', difficulty: 1,
    cue: '차올리지 말고 꼭대기에서 1초 멈추세요',
  },
  bench_press: {
    name: '벤치 프레스', pattern: 'horizontal_push', equipment: 'barbell',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [8, 10],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 2,
    cue: '발로 바닥을 밀고 날개뼈를 끝까지 모아 두세요',
  },
  dumbbell_row: {
    name: '덤벨 로우', pattern: 'horizontal_pull', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1,
    cue: '몸통이 돌아가면 무게가 무거운 거예요',
  },
  dumbbell_shoulder_press: {
    name: '덤벨 숄더 프레스', pattern: 'vertical_push', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1,
    cue: '허리가 꺾이면 갈비뼈를 내리고 다시 시작하세요',
  },
  dumbbell_curl: {
    name: '덤벨 컬', pattern: 'elbow_flexion', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [10, 12],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1,
    cue: '내릴 때 2초, 팔을 끝까지 펴세요',
  },
  lateral_raise_machine: {
    name: '레터럴 레이즈 머신', pattern: 'lateral_delt', equipment: 'lateral_raise_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [12, 15],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1,
    cue: '어깨 높이까지만 올리고 으쓱하지 마세요',
  },
  cable_lateral_raise: {
    name: '케이블 레터럴 레이즈', pattern: 'lateral_delt', equipment: 'cable_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [12, 15],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 2,
    cue: '손보다 팔꿈치가 먼저 올라가게 하세요',
  },
  squat: {
    name: '스쿼트', pattern: 'squat', equipment: 'barbell',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [5, 5],
    default_sets: 4, rest_sec: 150, progression: 'linear', difficulty: 3,
    cue: '무릎이 안으로 모이지 않게 바닥을 벌리듯 서세요',
  },
  romanian_deadlift: {
    name: '루마니안 데드리프트', pattern: 'hinge', equipment: 'barbell',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [8, 10],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 2,
    cue: '허벅지 뒤가 당길 때까지만, 허리가 말리면 멈추세요',
  },
  hack_squat: {
    name: '핵 스쿼트', pattern: 'squat', equipment: 'hack_squat_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 10, rep_range: [8, 10],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 2,
    cue: '뒤꿈치가 뜨지 않는 깊이까지만 내려가세요',
  },
  split_squat: {
    name: '스플릿 스쿼트', pattern: 'lunge', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 2,
    cue: '앞발에 체중을 싣고 뒷다리는 거들기만 하세요',
  },
  walking_lunge: {
    name: '워킹 런지', pattern: 'lunge', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [10, 12],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 2,
    cue: '서두르지 말고 한 걸음마다 멈췄다 일어서세요',
  },
  calf_raise: {
    name: '카프 레이즈', pattern: 'calf', equipment: 'calf_raise_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [12, 15],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1,
    cue: '반동 없이, 맨 아래에서 1초 늘려 주세요',
  },
  plank: {
    name: '플랭크', pattern: 'core', equipment: 'bodyweight', unsupported: true,
    load: 'none', measure: 'seconds', default_duration_sec: 30,
    default_sets: 3, rest_sec: 60, progression: 'none', difficulty: 1,
  },
  cable_crunch: {
    name: '케이블 크런치', pattern: 'core', equipment: 'cable_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [12, 15],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1,
    cue: '팔로 당기지 말고 갈비뼈를 골반 쪽으로 말아 넣으세요',
  },
  stationary_bike: {
    name: '실내 사이클', pattern: 'cardio', equipment: 'bike',
    load: 'none', measure: 'seconds', default_duration_sec: 900,
    default_sets: 1, rest_sec: 0, progression: 'none', difficulty: 1,
  },
  running: {
    name: '러닝', pattern: 'cardio', equipment: 'outdoor',
    load: 'none', measure: 'seconds', default_duration_sec: 1200,
    default_sets: 1, rest_sec: 0, progression: 'none', difficulty: 1,
  },
  treadmill: {
    name: '트레드밀', pattern: 'cardio', equipment: 'treadmill',
    load: 'none', measure: 'seconds', default_duration_sec: 900,
    default_sets: 1, rest_sec: 0, progression: 'none', difficulty: 1,
  },
  stair_climber: {
    name: '천국의 계단', pattern: 'cardio', equipment: 'stair_climber_machine',
    load: 'none', measure: 'seconds', default_duration_sec: 600,
    default_sets: 1, rest_sec: 0, progression: 'none', difficulty: 1,
  },
};

window.TEMPLATES = {
  upper: {
    name: '상체',
    slots: [
      { priority: 'core', default: 'assisted_pullup', alts: ['lat_pulldown'] },
      { priority: 'core', default: 'dumbbell_press', alts: ['bench_press', 'assisted_dip'] },
      { priority: 'core', default: 'seated_cable_row', alts: ['dumbbell_row'] },
      { priority: 'main', default: 'cable_pushdown', alts: ['assisted_dip'] },
      { priority: 'main', default: 'reverse_pec_deck', alts: ['lateral_raise_machine', 'cable_lateral_raise'] },
      { priority: 'optional', balance: ['dumbbell_shoulder_press', 'dumbbell_curl'] },
      { priority: 'optional', default: 'stationary_bike', alts: ['running', 'treadmill', 'stair_climber'], recent: true },
    ],
  },
  lower: {
    name: '하체',
    slots: [
      { priority: 'core', default: 'deadlift', alts: ['romanian_deadlift'] },
      { priority: 'core', default: 'leg_press', alts: ['squat', 'hack_squat'] },
      { priority: 'main', default: 'leg_curl', alts: [] },
      { priority: 'main', default: 'leg_extension', alts: ['split_squat', 'walking_lunge'] },
      { priority: 'optional', default: 'stationary_bike', alts: ['running', 'treadmill', 'stair_climber'], recent: true },
    ],
  },
};

window.Catalog = {
  get(id) { return Object.prototype.hasOwnProperty.call(window.CATALOG, id) ? window.CATALOG[id] : null; },
  ids() { return Object.keys(window.CATALOG); },
};
