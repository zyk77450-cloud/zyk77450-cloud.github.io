/* 顶部渐变阅读进度条：跟随滚动位置显示阅读进度 */
(function () {
  function init() {
    if (document.getElementById("reading-progress")) return;
    var bar = document.createElement("div");
    bar.id = "reading-progress";
    document.body.appendChild(bar);

    function update() {
      var st = document.documentElement.scrollTop || document.body.scrollTop;
      var total =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      var percent = total > 0 ? (st / total) * 100 : 0;
      bar.style.width = percent + "%";
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
