import type {
  CanvasObject,
  RectangleObject,
  EllipseObject,
  LineObject,
  StrokeObject,
  TextObject,
} from '../../../types/canvas.js';

/**
 * Applies common transforms (position, rotation, scale, opacity) and renders a single CanvasObject.
 */
export function renderObject(ctx: CanvasRenderingContext2D, obj: CanvasObject): void {
  ctx.save();

  // Apply object opacity
  if (typeof obj.opacity === 'number') {
    ctx.globalAlpha = Math.max(0, Math.min(1, obj.opacity));
  }

  // Render by specific discriminator
  switch (obj.type) {
    case 'rectangle':
      renderRectangle(ctx, obj);
      break;
    case 'ellipse':
      renderEllipse(ctx, obj);
      break;
    case 'line':
      renderLine(ctx, obj);
      break;
    case 'stroke':
      renderStroke(ctx, obj);
      break;
    case 'text':
      renderText(ctx, obj);
      break;
  }

  ctx.restore();
}

function renderRectangle(ctx: CanvasRenderingContext2D, obj: RectangleObject): void {
  ctx.save();
  const width = obj.width * (obj.scaleX ?? 1);
  const height = obj.height * (obj.scaleY ?? 1);

  if (obj.rotation) {
    const centerX = obj.x + width / 2;
    const centerY = obj.y + height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((obj.rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }

  ctx.beginPath();
  if (obj.cornerRadius && obj.cornerRadius > 0 && typeof ctx.roundRect === 'function') {
    ctx.roundRect(obj.x, obj.y, width, height, obj.cornerRadius);
  } else {
    ctx.rect(obj.x, obj.y, width, height);
  }

  if (obj.fill && obj.fill !== 'transparent') {
    ctx.fillStyle = obj.fill;
    ctx.fill();
  }

  if (obj.stroke && obj.strokeWidth > 0) {
    ctx.strokeStyle = obj.stroke;
    ctx.lineWidth = obj.strokeWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function renderEllipse(ctx: CanvasRenderingContext2D, obj: EllipseObject): void {
  ctx.save();
  const rx = Math.max(0, obj.radiusX * (obj.scaleX ?? 1));
  const ry = Math.max(0, obj.radiusY * (obj.scaleY ?? 1));

  ctx.beginPath();
  const rotationRad = ((obj.rotation ?? 0) * Math.PI) / 180;
  ctx.ellipse(obj.x, obj.y, rx, ry, rotationRad, 0, 2 * Math.PI);

  if (obj.fill && obj.fill !== 'transparent') {
    ctx.fillStyle = obj.fill;
    ctx.fill();
  }

  if (obj.stroke && obj.strokeWidth > 0) {
    ctx.strokeStyle = obj.stroke;
    ctx.lineWidth = obj.strokeWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function renderLine(ctx: CanvasRenderingContext2D, obj: LineObject): void {
  ctx.save();
  if (!obj.points || obj.points.length < 2) {
    ctx.restore();
    return;
  }

  const [p1, p2] = obj.points;

  if (obj.rotation) {
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    ctx.translate(midX, midY);
    ctx.rotate((obj.rotation * Math.PI) / 180);
    ctx.translate(-midX, -midY);
  }

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);

  ctx.strokeStyle = obj.stroke || '#f8fafc';
  ctx.lineWidth = Math.max(1, obj.strokeWidth || 2);
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

function renderStroke(ctx: CanvasRenderingContext2D, obj: StrokeObject): void {
  if (!obj.points || obj.points.length === 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(obj.points[0].x, obj.points[0].y);

  for (let i = 1; i < obj.points.length; i++) {
    ctx.lineTo(obj.points[i].x, obj.points[i].y);
  }

  ctx.strokeStyle = obj.stroke || '#38bdf8';
  ctx.lineWidth = Math.max(1, obj.strokeWidth || 3);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

function renderText(ctx: CanvasRenderingContext2D, obj: TextObject): void {
  ctx.save();
  const fontSize = obj.fontSize || 18;
  const fontFamily = obj.fontFamily || 'Inter, sans-serif';
  const fontWeight = obj.fontWeight || 'normal';

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = obj.fill || '#f8fafc';
  ctx.textAlign = obj.textAlign || 'left';
  ctx.textBaseline = 'top';

  if (obj.rotation) {
    ctx.translate(obj.x, obj.y);
    ctx.rotate((obj.rotation * Math.PI) / 180);
    ctx.fillText(obj.text, 0, 0);
  } else {
    ctx.fillText(obj.text, obj.x, obj.y);
  }

  ctx.restore();
}
