/* ============================================================
   鱼群动效（Boids 算法）
   - 一群椭圆小鱼按 分离/对齐/聚合 三规则游动
   - 鼠标划过：鱼群受惊散开
   - 点击页面：撒下食物，鱼群聚拢过来抢食，3 秒后消散
   - 配色与站点主题一致：青 / 紫 / 粉
   ============================================================ */
(function () {
  "use strict";
  if (window.__boidsFishStarted) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.__boidsFishStarted = true;

  var COLORS = ["62,184,190", "124,111,240", "251,113,133"]; // 主题三色
  var FOOD_COLOR = "255,209,102"; // 食物：暖黄
  var isMobile = window.innerWidth < 768;
  var COUNT = isMobile ? 32 : 70;

  var canvas = document.createElement("canvas");
  canvas.id = "boids-fish";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;top:0;left:0;z-index:-1;pointer-events:none;";
  document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d");

  var W = 0;
  var H = 0;
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  /* ---------- 交互输入 ---------- */
  var mouse = { x: -9999, y: -9999 };
  window.addEventListener(
    "mousemove",
    function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    },
    { passive: true }
  );
  window.addEventListener("mouseout", function () {
    mouse.x = -9999;
    mouse.y = -9999;
  });
  window.addEventListener(
    "touchmove",
    function (e) {
      var t = e.touches[0];
      if (t) {
        mouse.x = t.clientX;
        mouse.y = t.clientY;
      }
    },
    { passive: true }
  );
  window.addEventListener("touchend", function () {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  var foods = [];
  window.addEventListener(
    "click",
    function (e) {
      foods.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (foods.length > 6) foods.shift();
    },
    { passive: true }
  );

  /* ---------- 向量小工具 ---------- */
  function limitVec(v, max) {
    var m = Math.hypot(v.x, v.y);
    if (m > max && m > 0) {
      v.x = (v.x / m) * max;
      v.y = (v.y / m) * max;
    }
    return v;
  }

  /* ---------- Boid ---------- */
  function Boid() {
    this.reset();
  }
  Boid.prototype.reset = function () {
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    var a = Math.random() * Math.PI * 2;
    var sp = 1 + Math.random();
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp;
    this.size = 6 + Math.random() * 6; // 身体长半径
    this.color = COLORS[(Math.random() * COLORS.length) | 0];
    this.phase = Math.random() * Math.PI * 2; // 摆尾相位，避免同频
  };

  var SEP_R = 26;
  var ALI_R = 52;
  var COH_R = 64;
  var MAX_SPEED = 0.8;
  var MIN_SPEED = 0.25;
  var MAX_FORCE = 0.06;
  var MOUSE_R = 110;
  var FOOD_R = 170;
  var EAT_R = 28; // 食物内圈进食区：圈内不再吸引，鱼群围成一圈啄食

  Boid.prototype.flock = function (boids, now) {
    var oldAngle = Math.atan2(this.vy, this.vx);
    var sep = { x: 0, y: 0 };
    var ali = { x: 0, y: 0 };
    var coh = { x: 0, y: 0 };
    var nSep = 0;
    var nAli = 0;

    for (var i = 0; i < boids.length; i++) {
      var other = boids[i];
      if (other === this) continue;
      var dx = other.x - this.x;
      var dy = other.y - this.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < 1) continue;

      if (d2 < SEP_R * SEP_R) {
        // 分离：太近就互相推开（近距离权重更大）
        var d = Math.sqrt(d2);
        sep.x -= (dx / d) * (SEP_R - d);
        sep.y -= (dy / d) * (SEP_R - d);
        nSep++;
      }
      if (d2 < ALI_R * ALI_R) {
        // 对齐：与邻居保持同一方向
        ali.x += other.vx;
        ali.y += other.vy;
        nAli++;
      }
      if (d2 < COH_R * COH_R) {
        // 聚合：向邻居中心靠拢
        coh.x += other.x;
        coh.y += other.y;
        coh.n = (coh.n || 0) + 1;
      }
    }

    var ax = 0;
    var ay = 0;

    if (nSep > 0) {
      sep = limitVec(sep, MAX_FORCE * 6);
      ax += sep.x * 1.6;
      ay += sep.y * 1.6;
    }
    if (nAli > 0) {
      ali.x /= nAli;
      ali.y /= nAli;
      ali = limitVec(ali, MAX_FORCE);
      ax += ali.x * 1.0;
      ay += ali.y * 1.0;
    }
    if (coh.n > 0) {
      coh.x = coh.x / coh.n - this.x;
      coh.y = coh.y / coh.n - this.y;
      coh = limitVec(coh, MAX_FORCE);
      ax += coh.x * 0.8;
      ay += coh.y * 0.8;
    }

    // 鼠标扰动：靠近就受惊逃开
    var mdx = this.x - mouse.x;
    var mdy = this.y - mouse.y;
    var md2 = mdx * mdx + mdy * mdy;
    if (md2 < MOUSE_R * MOUSE_R && md2 > 0.01) {
      var md = Math.sqrt(md2);
      var flee = (MOUSE_R - md) / MOUSE_R; // 越近越强
      ax += (mdx / md) * flee * 0.45;
      ay += (mdy / md) * flee * 0.45;
    }

    // 食物吸引：向食物游去；内圈是进食区不再吸引，避免鱼挤成一团抖动
    for (var f = 0; f < foods.length; f++) {
      var food = foods[f];
      var age = (now - food.t) / 3000;
      if (age >= 1) continue;
      var fdx = food.x - this.x;
      var fdy = food.y - this.y;
      var fd2 = fdx * fdx + fdy * fdy;
      if (fd2 < FOOD_R * FOOD_R && fd2 > EAT_R * EAT_R) {
        var fd = Math.sqrt(fd2);
        var pull = (1 - age) * (1 - fd / FOOD_R) * 0.24;
        ax += (fdx / fd) * pull;
        ay += (fdy / fd) * pull;
      }
    }

    // 边界：柔性转向，避免游出屏幕
    var MARGIN = 70;
    if (this.x < MARGIN) ax += 0.08 * (1 - this.x / MARGIN);
    if (this.x > W - MARGIN) ax -= 0.08 * (1 - (W - this.x) / MARGIN);
    if (this.y < MARGIN) ay += 0.08 * (1 - this.y / MARGIN);
    if (this.y > H - MARGIN) ay -= 0.08 * (1 - (H - this.y) / MARGIN);

    // 限速 + 保底速度，让鱼群始终有游动感
    this.vx += ax;
    this.vy += ay;
    var speed = Math.hypot(this.vx, this.vy);
    if (speed > MAX_SPEED) {
      this.vx = (this.vx / speed) * MAX_SPEED;
      this.vy = (this.vy / speed) * MAX_SPEED;
    } else if (speed < MIN_SPEED && speed > 0) {
      this.vx = (this.vx / speed) * MIN_SPEED;
      this.vy = (this.vy / speed) * MIN_SPEED;
      speed = MIN_SPEED;
    }

    // 转向速率限制：按速度限制每帧最大转角，鱼只能走平滑弧线，
    // 消除抢食/避鼠时力打架导致的高频抖动（鬼畜）
    var newAngle = Math.atan2(this.vy, this.vx);
    var dA = newAngle - oldAngle;
    while (dA > Math.PI) dA -= 2 * Math.PI;
    while (dA < -Math.PI) dA += 2 * Math.PI;
    var maxTurn = Math.max(0.02, speed * 0.06);
    if (Math.abs(dA) > maxTurn) {
      newAngle = oldAngle + (dA > 0 ? maxTurn : -maxTurn);
      speed = Math.hypot(this.vx, this.vy);
      this.vx = Math.cos(newAngle) * speed;
      this.vy = Math.sin(newAngle) * speed;
    }

    this.x += this.vx;
    this.y += this.vy;
  };

  Boid.prototype.draw = function (t) {
    var angle = Math.atan2(this.vy, this.vx);
    var wag = Math.sin(t / 270 + this.phase); // 摆尾

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    // 尾巴
    ctx.beginPath();
    ctx.moveTo(-this.size * 0.6, 0);
    ctx.lineTo(
      -this.size * 1.55,
      -this.size * 0.45 + wag * this.size * 0.35
    );
    ctx.lineTo(
      -this.size * 1.55,
      this.size * 0.45 + wag * this.size * 0.35
    );
    ctx.closePath();
    ctx.fillStyle = "rgba(" + this.color + ",0.35)";
    ctx.fill();

    // 身体（椭圆）
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size, this.size * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(" + this.color + ",0.6)";
    ctx.fill();

    // 眼睛
    ctx.beginPath();
    ctx.arc(
      this.size * 0.5,
      -this.size * 0.06,
      Math.max(1.2, this.size * 0.11),
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();

    ctx.restore();
  };

  function drawFood(food, now) {
    var age = (now - food.t) / 3000;
    var alpha = 1 - age;
    // 食物本体
    ctx.beginPath();
    ctx.arc(food.x, food.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(" + FOOD_COLOR + "," + (0.9 * alpha) + ")";
    ctx.fill();
    // 涟漪
    var r = 8 + age * 26;
    ctx.beginPath();
    ctx.arc(food.x, food.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(" + FOOD_COLOR + "," + (0.45 * alpha) + ")";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /* ---------- 初始化与主循环 ---------- */
  var boids = [];
  for (var i = 0; i < COUNT; i++) boids.push(new Boid());

  function frame(t) {
    ctx.clearRect(0, 0, W, H);
    var now = performance.now();
    foods = foods.filter(function (f) {
      return now - f.t < 3000;
    });

    for (var i = 0; i < boids.length; i++) boids[i].flock(boids, now);
    for (var j = 0; j < foods.length; j++) drawFood(foods[j], now);
    for (var k = 0; k < boids.length; k++) boids[k].draw(t);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
