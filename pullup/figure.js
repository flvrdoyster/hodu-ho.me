(() => {
  const NS = 'http://www.w3.org/2000/svg';

  const RIG = { armL: 6, armR: 6, head: 2, torso: 4, legL: 6, legR: 6 };

  const PART_CLASS = {
    armL: 'figure__limb',
    armR: 'figure__limb',
    head: 'figure__head',
    torso: 'figure__torso',
    legL: 'figure__limb',
    legR: 'figure__limb',
  };

  const PROPS = {
    bar: { x1: 12, y1: 14, x2: 88, y2: 14 },
    floor: { x1: 10, y1: 130, x2: 90, y2: 130 },
  };

  const REST = {
    props: ['floor'],
    pose: {
      armL: [43, 90, 36, 104, 42, 114], armR: [57, 90, 64, 104, 58, 114],
      head: [50, 72],
      torso: [50, 92, 50, 112],
      legL: [44, 112, 32, 113, 34, 128], legR: [56, 112, 68, 113, 66, 128],
    },
  };

  const STAGES = ['goal', 'over1', 'over2'];

  function svgEl(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  function pathFrom(nums) {
    let d = `M${nums[0]},${nums[1]}`;
    for (let i = 2; i < nums.length; i += 2) d += ` L${nums[i]},${nums[i + 1]}`;
    return d;
  }

  function lerpPose(a, b, t) {
    const out = {};
    for (const key of Object.keys(RIG)) out[key] = a[key].map((v, i) => v + (b[key][i] - v) * t);
    return out;
  }

  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

  function checkPose(label, pose) {
    for (const [part, len] of Object.entries(RIG)) {
      if (!pose[part] || pose[part].length !== len) {
        console.warn(`figure: ${label}.${part} 좌표는 ${len}개여야 함`);
      }
    }
  }

  function create(root, exercise) {
    for (const [name, pose] of Object.entries(exercise.poses)) checkPose(`${exercise.id}.${name}`, pose);
    const restPose = exercise.restPose || REST.pose;
    if (exercise.restPose) checkPose(`${exercise.id}.restPose`, restPose);

    const svg = svgEl('svg', { viewBox: '0 0 100 150', 'aria-hidden': 'true' });
    const propEls = {};
    for (const [name, attrs] of Object.entries(PROPS)) {
      propEls[name] = svg.appendChild(svgEl('line', { class: 'figure__prop', ...attrs }));
    }
    const parts = {};
    for (const key of Object.keys(RIG)) {
      parts[key] = svg.appendChild(key === 'head'
        ? svgEl('circle', { class: PART_CLASS[key], r: 9 })
        : svgEl('path', { class: PART_CLASS[key] }));
    }
    const sweatLayer = svg.appendChild(svgEl('g', {}));
    root.replaceChildren(svg);

    const start = exercise.poses[exercise.start];
    let current = start;
    let raf = null;
    let busy = false;
    let queue = [];
    let resting = false;

    function draw(pose) {
      for (const key of Object.keys(RIG)) {
        if (key === 'head') {
          parts.head.setAttribute('cx', pose.head[0]);
          parts.head.setAttribute('cy', pose.head[1]);
        } else {
          parts[key].setAttribute('d', pathFrom(pose[key]));
        }
      }
    }

    function showProps(names) {
      for (const [name, node] of Object.entries(propEls)) node.classList.toggle('is-on', names.includes(name));
    }

    function animateTo(target, ms, done) {
      const from = current;
      const t0 = performance.now();
      if (raf !== null) cancelAnimationFrame(raf);
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        current = lerpPose(from, target, easeInOut(t));
        draw(current);
        if (t < 1) raf = requestAnimationFrame(step);
        else if (done) done();
      };
      raf = requestAnimationFrame(step);
    }

    function steps(full) {
      if (full) return exercise.rep.map((name) => exercise.poses[name]);
      return [lerpPose(start, exercise.poses[exercise.rep[0]], exercise.partialDepth)];
    }

    function play(full) {
      busy = true;
      const seq = steps(full);
      const next = (i) => {
        if (i < seq.length) {
          animateTo(seq[i], exercise.tempo.up, () => next(i + 1));
          return;
        }
        animateTo(start, exercise.tempo.down, () => {
          if (queue.length > 0) play(queue.shift());
          else busy = false;
        });
      };
      next(0);
    }

    draw(start);
    showProps(exercise.props);

    return {
      el: root,

      rep(full = true) {
        if (resting) return;
        if (!busy) play(full);
        else if (queue.length < 3) queue.push(full);
      },

      rest(on) {
        if (resting === on) return;
        resting = on;
        busy = false;
        queue = [];
        showProps(on ? REST.props : exercise.props);
        animateTo(on ? restPose : start, 500);
      },

      effort(stage) {
        for (const s of STAGES) root.classList.toggle(`is-${s}`, s === stage);
      },

      sweat(drops) {
        for (let i = 0; i < drops; i++) {
          const side = i % 2 === 0 ? -1 : 1;
          const drop = svgEl('circle', {
            class: 'sweat',
            cx: current.head[0] + side * (7 + Math.random() * 3),
            cy: current.head[1] - 2 + Math.random() * 6,
            r: 2.2,
          });
          drop.style.setProperty('--dx', `${side * (8 + Math.random() * 10)}px`);
          drop.style.setProperty('--dy', `${10 + Math.random() * 12}px`);
          drop.addEventListener('animationend', () => drop.remove());
          sweatLayer.appendChild(drop);
        }
      },
    };
  }

  window.Figure = { create };
})();
