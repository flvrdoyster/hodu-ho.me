window.CATALOG = {
  lat_pulldown: {
    name: '랫풀다운', pattern: 'vertical_pull', equipment: 'cable_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1,
  },
  assisted_pullup: {
    name: '어시스트 풀업', pattern: 'vertical_pull', equipment: 'assist_machine',
    load: 'assist', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [6, 8],
    default_sets: 6, rest_sec: 150, progression: 'double', difficulty: 2,
  },
  dumbbell_press: {
    name: '덤벨 프레스', pattern: 'horizontal_push', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [8, 10],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 1,
  },
  cable_pushdown: {
    name: '케이블 푸시다운', pattern: 'elbow_extension', equipment: 'cable_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [10, 12],
    default_sets: 3, rest_sec: 75, progression: 'double', difficulty: 1,
  },
  seated_cable_row: {
    name: '시티드 케이블 로우', pattern: 'horizontal_pull', equipment: 'cable_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1,
  },
  reverse_pec_deck: {
    name: '리버스 펙덱', pattern: 'rear_delt', equipment: 'pec_deck_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 4.54, rep_range: [10, 15],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1,
  },
  deadlift: {
    name: '데드리프트', pattern: 'hinge', equipment: 'barbell',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [5, 5],
    default_sets: 4, rest_sec: 150, progression: 'linear', difficulty: 3,
  },
  assisted_dip: {
    name: '어시스트 딥', pattern: 'horizontal_push', equipment: 'assist_machine',
    muscles: { primary: ['chest', 'triceps'], secondary: ['front_delts'] },
    load: 'assist', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [6, 8],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 2,
  },
  leg_press: {
    name: '레그 프레스', pattern: 'squat', equipment: 'leg_press_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 10, rep_range: [10, 12],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 1,
  },
  leg_curl: {
    name: '레그 컬', pattern: 'knee_flexion', equipment: 'leg_curl_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 4.54, rep_range: [10, 12],
    default_sets: 3, rest_sec: 75, progression: 'double', difficulty: 1,
  },
  leg_extension: {
    name: '레그 익스텐션', pattern: 'knee_extension', equipment: 'leg_extension_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 4.54, rep_range: [12, 15],
    default_sets: 3, rest_sec: 75, progression: 'double', difficulty: 1,
  },
  bench_press: {
    name: '벤치 프레스', pattern: 'horizontal_push', equipment: 'barbell',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [8, 10],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 2,
  },
  dumbbell_row: {
    name: '덤벨 로우', pattern: 'horizontal_pull', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1,
  },
  dumbbell_shoulder_press: {
    name: '덤벨 숄더 프레스', pattern: 'vertical_push', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1,
  },
  dumbbell_curl: {
    name: '덤벨 컬', pattern: 'elbow_flexion', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [10, 12],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1,
  },
  lateral_raise_machine: {
    name: '레터럴 레이즈 머신', pattern: 'lateral_delt', equipment: 'lateral_raise_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [12, 15],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1,
  },
  cable_lateral_raise: {
    name: '케이블 레터럴 레이즈', pattern: 'lateral_delt', equipment: 'cable_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [12, 15],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 2,
  },
  squat: {
    name: '스쿼트', pattern: 'squat', equipment: 'barbell',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [5, 5],
    default_sets: 4, rest_sec: 150, progression: 'linear', difficulty: 3,
  },
  romanian_deadlift: {
    name: '루마니안 데드리프트', pattern: 'hinge', equipment: 'barbell',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 2.5, rep_range: [8, 10],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 2,
  },
  hack_squat: {
    name: '핵 스쿼트', pattern: 'squat', equipment: 'hack_squat_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 10, rep_range: [8, 10],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 2,
  },
  split_squat: {
    name: '스플릿 스쿼트', pattern: 'lunge', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 2,
  },
  walking_lunge: {
    name: '워킹 런지', pattern: 'lunge', equipment: 'dumbbell',
    load: 'weight', measure: 'reps', weight_basis: 'per_side', increment: 2, rep_range: [10, 12],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 2,
  },
  calf_raise: {
    name: '카프 레이즈', pattern: 'calf', equipment: 'calf_raise_machine',
    load: 'weight', measure: 'reps', weight_basis: 'total', increment: 5, rep_range: [12, 15],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1,
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
