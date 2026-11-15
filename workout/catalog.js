window.CATALOG = {
  lat_pulldown: {
    name: '랫풀다운', pattern: 'vertical_pull', equipment: 'cable_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1,
    cue: '가슴을 열고 팔꿈치를 옆구리로 끌어내린다',
  },
  assisted_pullup: {
    name: '어시스트 풀업', pattern: 'vertical_pull', equipment: 'assist_machine',
    load: 'assist', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [6, 8],
    default_sets: 6, rest_sec: 150, progression: 'double', difficulty: 2,
    cue: '어깨를 내리고 가슴을 바 쪽으로 당겨 올린다',
  },
  dumbbell_press: {
    name: '덤벨 프레스', pattern: 'horizontal_push', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [8, 10],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 1,
    cue: '어깨를 뒤로 모으고 손목을 세워 밀어 올린다',
  },
  cable_pushdown: {
    name: '케이블 푸시다운', pattern: 'elbow_extension', equipment: 'cable_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [10, 12],
    default_sets: 3, rest_sec: 75, progression: 'double', difficulty: 1,
    cue: '팔꿈치를 옆구리에 붙이고 팔만 펴서 누른다',
  },
  seated_cable_row: {
    name: '시티드 케이블 로우', pattern: 'horizontal_pull', equipment: 'cable_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1,
    cue: '허리를 세우고 팔꿈치를 뒤로 당겨 날개뼈를 모은다',
  },
  reverse_pec_deck: {
    name: '리버스 펙덱', pattern: 'rear_delt', equipment: 'pec_deck_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 4.54, rep_range: [10, 15],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1,
    cue: '어깨를 올리지 말고 팔꿈치를 뒤로 벌려 당긴다',
  },
  deadlift: {
    name: '데드리프트', pattern: 'hinge', equipment: 'barbell',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [5, 5],
    default_sets: 4, rest_sec: 150, progression: 'linear', difficulty: 3,
    cue: '허리를 편 채 바를 몸에 붙이고 엉덩이로 일어선다',
  },
  assisted_dip: {
    name: '어시스트 딥', pattern: 'horizontal_push', equipment: 'assist_machine',
    muscles: { primary: ['chest', 'triceps'], secondary: ['front_delts'] },
    load: 'assist', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [6, 8],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 2,
    cue: '어깨를 내리고 상체를 살짝 숙여 팔꿈치를 굽힌다',
  },
  leg_press: {
    name: '레그 프레스', pattern: 'squat', equipment: 'leg_press_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 10, rep_range: [10, 12],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 1,
    cue: '무릎을 끝까지 펴 잠그지 말고 발바닥 전체로 민다',
  },
  leg_curl: {
    name: '레그 컬', pattern: 'knee_flexion', equipment: 'leg_curl_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 4.54, rep_range: [10, 12],
    default_sets: 3, rest_sec: 75, progression: 'double', difficulty: 1,
    cue: '엉덩이를 의자에 붙이고 뒤꿈치를 끌어당긴다',
  },
  leg_extension: {
    name: '레그 익스텐션', pattern: 'knee_extension', equipment: 'leg_extension_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 4.54, rep_range: [12, 15],
    default_sets: 3, rest_sec: 75, progression: 'double', difficulty: 1,
    cue: '반동 없이 올리고 꼭대기에서 잠깐 멈춘다',
  },
  bench_press: {
    name: '벤치 프레스', pattern: 'horizontal_push', equipment: 'barbell',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [8, 10],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 2,
    cue: '날개뼈를 모아 가슴을 열고 바를 가슴 아래로 내린다',
  },
  dumbbell_row: {
    name: '덤벨 로우', pattern: 'horizontal_pull', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1,
    cue: '허리를 평평하게 두고 팔꿈치를 엉덩이 쪽으로 당긴다',
  },
  dumbbell_shoulder_press: {
    name: '덤벨 숄더 프레스', pattern: 'vertical_push', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1,
    cue: '허리를 꺾지 말고 배에 힘을 주고 머리 위로 민다',
  },
  dumbbell_curl: {
    name: '덤벨 컬', pattern: 'elbow_flexion', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [10, 12],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1,
    cue: '팔꿈치를 옆구리에 고정하고 반동 없이 올린다',
  },
  lateral_raise_machine: {
    name: '레터럴 레이즈 머신', pattern: 'lateral_delt', equipment: 'lateral_raise_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [12, 15],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1,
    cue: '어깨를 으쓱하지 말고 팔꿈치로 밀어 올린다',
  },
  cable_lateral_raise: {
    name: '케이블 레터럴 레이즈', pattern: 'lateral_delt', equipment: 'cable_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [12, 15],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 2,
    cue: '손이 아니라 팔꿈치를 옆으로 들어 올린다',
  },
  squat: {
    name: '스쿼트', pattern: 'squat', equipment: 'barbell',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [5, 5],
    default_sets: 4, rest_sec: 150, progression: 'linear', difficulty: 3,
    cue: '가슴을 펴고 무릎을 발끝 방향으로 벌리며 앉는다',
  },
  romanian_deadlift: {
    name: '루마니안 데드리프트', pattern: 'hinge', equipment: 'barbell',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [8, 10],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 2,
    cue: '무릎은 살짝만 굽히고 엉덩이를 뒤로 빼며 내린다',
  },
  hack_squat: {
    name: '핵 스쿼트', pattern: 'squat', equipment: 'hack_squat_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 10, rep_range: [8, 10],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 2,
    cue: '발바닥 전체로 밀고 무릎이 안으로 모이지 않게 한다',
  },
  split_squat: {
    name: '스플릿 스쿼트', pattern: 'lunge', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 2,
    cue: '상체를 세우고 앞발 뒤꿈치로 밀어 올라온다',
  },
  walking_lunge: {
    name: '워킹 런지', pattern: 'lunge', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [10, 12],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 2,
    cue: '보폭을 넉넉히 하고 앞무릎이 흔들리지 않게 걷는다',
  },
  calf_raise: {
    name: '카프 레이즈', pattern: 'calf', equipment: 'calf_raise_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [12, 15],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1,
    cue: '뒤꿈치를 끝까지 내리고 꼭대기에서 잠깐 멈춘다',
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
    cue: '엉덩이는 고정하고 배를 말아 상체를 접는다',
  },
  stationary_bike: {
    name: '실내 사이클', pattern: 'cardio', equipment: 'bike',
    load: 'none', measure: 'seconds', default_duration_sec: 900,
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
      { priority: 'optional', default: 'stationary_bike', alts: [] },
    ],
  },
  lower: {
    name: '하체',
    slots: [
      { priority: 'core', default: 'deadlift', alts: ['romanian_deadlift'] },
      { priority: 'core', default: 'leg_press', alts: ['squat', 'hack_squat'] },
      { priority: 'main', default: 'leg_curl', alts: [] },
      { priority: 'main', default: 'leg_extension', alts: ['split_squat', 'walking_lunge'] },
      { priority: 'optional', default: 'stationary_bike', alts: [] },
    ],
  },
};

window.Catalog = {
  get(id) { return Object.prototype.hasOwnProperty.call(window.CATALOG, id) ? window.CATALOG[id] : null; },
  ids() { return Object.keys(window.CATALOG); },
};
