export function fitCanvas(c, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const r = c.getBoundingClientRect();
  c.width = r.width * dpr;
  c.height = r.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: r.width, h: r.height };
}

// progress : 0 -> 1, part des barres colorée en bleu (1 = tout en bleu)
export function drawBars(ctx, w, h, values, progress) {
  ctx.clearRect(0, 0, w, h);
  const slot = w / values.length;
  const barW = Math.max(2, slot * 0.6);
  const played = progress * values.length;
  values.forEach((v, i) => {
    const bh = Math.max(3, v * h);
    const x = i * slot + (slot - barW) / 2;
    const y = (h - bh) / 2;
    ctx.fillStyle = i < played ? "#4f9cff" : "#3a4358";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, barW, bh, barW / 2);
    else ctx.rect(x, y, barW, bh);
    ctx.fill();
  });
}