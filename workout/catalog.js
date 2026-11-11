window.CATALOG = {
  lat_pulldown: {
    name: '랫풀다운', pattern: 'vertical_pull', equipment: 'cable_machine',
    unit: 'kg', weight_basis: 'total', increment: 2.5, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1, baseline: 35,
  },
  assisted_pullup: {
    name: '어시스트 풀업', pattern: 'vertical_pull', equipment: 'assist_machine',
    unit: 'kg', weight_basis: 'total', assisted: true, increment: -5, rep_range: [6, 8],
    default_sets: 6, rest_sec: 150, progression: 'double', difficulty: 2, estimate: 40,
  },
  dumbbell_press: {
    name: '덤벨 프레스', pattern: 'horizontal_push', equipment: 'dumbbell',
    unit: 'kg', weight_basis: 'per_side', increment: 2, rep_range: [8, 10],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 1, baseline: 12,
  },
  cable_pushdown: {
    name: '케이블 푸시다운', pattern: 'elbow_extension', equipment: 'cable_machine',
    unit: 'kg', weight_basis: 'total', increment: 2.5, rep_range: [10, 12],
    default_sets: 3, rest_sec: 75, progression: 'double', difficulty: 1, baseline: 12.5,
  },
  seated_cable_row: {
    name: '시티드 케이블 로우', pattern: 'horizontal_pull', equipment: 'cable_machine',
    unit: 'kg', weight_basis: 'total', increment: 2.5, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1, baseline: 30,
  },
  reverse_pec_deck: {
    name: '리버스 펙덱', pattern: 'rear_delt', equipment: 'pec_deck_machine',
    unit: 'lb', weight_basis: 'total', increment: 10, rep_range: [10, 15],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1, baseline: 50,
  },
  deadlift: {
    name: '데드리프트', pattern: 'hinge', equipment: 'barbell',
    unit: 'kg', weight_basis: 'total', increment: 2.5, rep_range: [5, 5],
    default_sets: 4, rest_sec: 150, progression: 'linear', difficulty: 3, baseline: 75,
  },
  assisted_dip: {
    name: '어시스트 딥', pattern: 'horizontal_push', equipment: 'assist_machine',
    muscles: { primary: ['chest', 'triceps'], secondary: ['front_delts'] },
    unit: 'kg', weight_basis: 'total', assisted: true, increment: -5, rep_range: [6, 8],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 2, estimate: 55,
  },
  dumbbell_shoulder_press: {
    name: '덤벨 숄더 프레스', pattern: 'vertical_push', equipment: 'dumbbell',
    unit: 'kg', weight_basis: 'per_side', increment: 2, rep_range: [8, 10],
    default_sets: 3, rest_sec: 90, progression: 'double', difficulty: 1, estimate: 8,
  },
  dumbbell_curl: {
    name: '덤벨 컬', pattern: 'elbow_flexion', equipment: 'dumbbell',
    unit: 'kg', weight_basis: 'per_side', increment: 2, rep_range: [10, 12],
    default_sets: 3, rest_sec: 60, progression: 'double', difficulty: 1, estimate: 8,
  },
  leg_press: {
    name: '레그 프레스', pattern: 'squat', equipment: 'leg_press_machine',
    unit: 'kg', weight_basis: 'total', increment: 10, rep_range: [10, 12],
    default_sets: 3, rest_sec: 120, progression: 'double', difficulty: 1, baseline: 70,
  },
  leg_curl: {
    name: '레그 컬', pattern: 'knee_flexion', equipment: 'leg_curl_machine',
    unit: 'lb', weight_basis: 'total', increment: 10, rep_range: [10, 12],
    default_sets: 3, rest_sec: 75, progression: 'double', difficulty: 1, baseline: 50,
  },
  leg_extension: {
    name: '레그 익스텐션', pattern: 'knee_extension', equipment: 'leg_extension_machine',
    unit: 'lb', weight_basis: 'total', increment: 10, rep_range: [12, 15],
    default_sets: 3, rest_sec: 75, progression: 'double', difficulty: 1, baseline: 50,
  },
  stationary_bike: {
    name: '실내 사이클', pattern: 'cardio', equipment: 'bike',
    unit: 'min', progression: 'none', difficulty: 1, baseline: 15,
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
      { priority: 'core', default: 'deadlift', alts: [] },
      { priority: 'core', default: 'leg_press', alts: [] },
      { priority: 'main', default: 'leg_curl', alts: [] },
      { priority: 'main', default: 'leg_extension', alts: [] },
      { priority: 'optional', default: 'stationary_bike', alts: [] },
    ],
  },
};

