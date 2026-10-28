/**
 * Shared, browser-local photograph renderer.
 *
 * A single camera frame is a flat image: the pose is a perspective effect, not a
 * reconstruction of the subject. Preview and JPEG use exactly this same mapping.
 */

const DEG = Math.PI / 180;
const FOCAL_DISTANCE = 2.75;
const frameCaches = new WeakMap();

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedFilter(filter) {
  if (['monochrome', 'mono', 'bw', 'b&w'].includes(filter)) return 'monochrome';
  return filter === 'warm' ? 'warm' : 'color';
}

function normalizedExposure(exposure) {
  return Math.max(-2, Math.min(2, finiteNumber(exposure)));
}

/** Apply this same CSS string when an unwarped video preview is needed. */
export function photoFilterCSS(filter = 'color', exposure = 0) {
  const brightness = Math.pow(2, normalizedExposure(exposure));
  const look = normalizedFilter(filter);
  if (look === 'monochrome') return `grayscale(1) brightness(${brightness})`;
  if (look === 'warm') return `sepia(0.28) saturate(1.12) brightness(${brightness})`;
  return `brightness(${brightness})`;
}

/**
 * Input is model-orbit delta in degrees plus a relative zoom ratio.
 * Output is the bounded effective image-plane rotation, in degrees.
 * A complete yaw turn is continuous and returns to the neutral image.
 */
export function resolvePhotoPose(pose = null) {
  const wrappedYaw = ((finiteNumber(pose?.yaw) % 360) + 540) % 360 - 180;
  const yaw = 28 * Math.sin(wrappedYaw * DEG);
  const pitch = 24 * Math.tanh(finiteNumber(pose?.pitch) / 45);
  return {
    yaw: Math.abs(yaw) < 1e-9 ? 0 : yaw,
    pitch: Math.abs(pitch) < 1e-9 ? 0 : pitch,
    // Zooming out cannot reveal pixels beyond the source camera's field of view.
    zoom: Math.max(1, Math.min(1.6, finiteNumber(pose?.zoom, 1))),
  };
}

/** CSS-equivalent filter fallback for browsers without Canvas2D.filter. */
function applyPixelFilter(context, width, height, filter, exposure) {
  const look = normalizedFilter(filter);
  const brightness = Math.pow(2, normalizedExposure(exposure));
  if (look === 'color' && brightness === 1) return;
  const pixels = context.getImageData(0, 0, width, height);
  const data = pixels.data;
  for (let index = 0; index < data.length; index += 4) {
    let red = data[index];
    let green = data[index + 1];
    let blue = data[index + 2];
    if (look === 'monochrome') {
      red = green = blue = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    } else if (look === 'warm') {
      const sepiaRed = Math.min(255, 0.83004 * red + 0.21532 * green + 0.05292 * blue);
      const sepiaGreen = Math.min(255, 0.09772 * red + 0.91208 * green + 0.04704 * blue);
      const sepiaBlue = Math.min(255, 0.07616 * red + 0.14952 * green + 0.75668 * blue);
      red = Math.max(0, Math.min(255, 1.09444 * sepiaRed - 0.0858 * sepiaGreen - 0.00864 * sepiaBlue));
      green = Math.max(0, Math.min(255, -0.02556 * sepiaRed + 1.0342 * sepiaGreen - 0.00864 * sepiaBlue));
      blue = Math.max(0, Math.min(255, -0.02556 * sepiaRed - 0.0858 * sepiaGreen + 1.11136 * sepiaBlue));
    }
    data[index] = red * brightness;
    data[index + 1] = green * brightness;
    data[index + 2] = blue * brightness;
  }
  context.putImageData(pixels, 0, 0);
}

function makeBuffer(targetCanvas, width, height) {
  const canvas = typeof globalThis.OffscreenCanvas === 'function'
    ? new OffscreenCanvas(width, height)
    : (targetCanvas.ownerDocument || document).createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getFrameCache(targetCanvas, width, height) {
  let cache = frameCaches.get(targetCanvas);
  if (!cache) {
    const buffer = makeBuffer(targetCanvas, width, height);
    const context = buffer.getContext('2d', { alpha: false });
    if (!context) throw new Error('A 2D canvas context is required to render a photograph.');
    cache = { buffer, context, mesh: null };
    frameCaches.set(targetCanvas, cache);
  }
  if (cache.buffer.width !== width || cache.buffer.height !== height) {
    cache.buffer.width = width;
    cache.buffer.height = height;
    cache.mesh = null;
  }
  return cache;
}

function projectedPoint(x, y, sinYaw, cosYaw, sinPitch, cosPitch) {
  // Rotate a flat image plane around X, then Y, before a perspective divide.
  const rotatedX = x * cosYaw + y * sinPitch * sinYaw;
  const rotatedY = y * cosPitch;
  const depth = -x * sinYaw + y * sinPitch * cosYaw;
  const perspective = FOCAL_DISTANCE / (FOCAL_DISTANCE - depth);
  return { x: rotatedX * perspective, y: rotatedY * perspective };
}

/** Minimum origin-centered scale whose convex quadrilateral contains [-1,1]². */
function coverScale(corners) {
  let scale = 1;
  for (let index = 0; index < 4; index++) {
    const a = corners[index];
    const b = corners[(index + 1) % 4];
    const edgeX = b.x - a.x;
    const edgeY = b.y - a.y;
    const originDistance = edgeY * a.x - edgeX * a.y;
    scale = Math.max(scale, (Math.abs(edgeX) + Math.abs(edgeY)) / originDistance);
  }
  return scale;
}

function expandedTriangle(a, b, c, overlap = 0.65) {
  const points = [a, b, c];
  const winding = ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) >= 0 ? 1 : -1;
  const normals = points.map((point, index) => {
    const next = points[(index + 1) % 3];
    const edgeX = next.x - point.x;
    const edgeY = next.y - point.y;
    const length = Math.hypot(edgeX, edgeY);
    return { x: winding * edgeY / length, y: -winding * edgeX / length };
  });
  return points.map((point, index) => {
    const previous = normals[(index + 2) % 3];
    const next = normals[index];
    // Keep the true miter at acute corners. A larger denominator floor truncates
    // overlap on very wide frames and leaves tiny antialiased pinholes.
    const amount = overlap / Math.max(1e-8, 1 + previous.x * next.x + previous.y * next.y);
    return { x: point.x + (previous.x + next.x) * amount, y: point.y + (previous.y + next.y) * amount };
  });
}

function affineTriangle(source, destination) {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const sx1 = s1.x - s0.x;
  const sy1 = s1.y - s0.y;
  const sx2 = s2.x - s0.x;
  const sy2 = s2.y - s0.y;
  const dx1 = d1.x - d0.x;
  const dy1 = d1.y - d0.y;
  const dx2 = d2.x - d0.x;
  const dy2 = d2.y - d0.y;
  const determinant = sx1 * sy2 - sx2 * sy1;
  const a = (dx1 * sy2 - dx2 * sy1) / determinant;
  const b = (dy1 * sy2 - dy2 * sy1) / determinant;
  const c = (dx2 * sx1 - dx1 * sx2) / determinant;
  const d = (dy2 * sx1 - dy1 * sx2) / determinant;
  return {
    clip: expandedTriangle(d0, d1, d2),
    matrix: [a, b, c, d, d0.x - a * s0.x - c * s0.y, d0.y - b * s0.x - d * s0.y],
  };
}

function makeMesh(width, height, pose) {
  const yaw = pose.yaw * DEG;
  const pitch = pose.pitch * DEG;
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);
  const sinPitch = Math.sin(pitch);
  const cosPitch = Math.cos(pitch);
  const project = (x, y) => projectedPoint(x, y, sinYaw, cosYaw, sinPitch, cosPitch);
  const corners = [project(-1, -1), project(1, -1), project(1, 1), project(-1, 1)];
  // The tiny, normalized bleed is equal at preview and capture resolutions.
  const scale = coverScale(corners) * pose.zoom * 1.003;
  const longestEdge = Math.max(width, height);
  const subdivisions = longestEdge > 1100 ? 24 : longestEdge > 800 ? 18 : 12;
  const columns = Math.max(6, Math.round(subdivisions * width / longestEdge));
  const rows = Math.max(6, Math.round(subdivisions * height / longestEdge));
  const sourceGrid = [];
  const destinationGrid = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const v = row / rows;
      const projected = project(2 * u - 1, 2 * v - 1);
      sourceGrid.push({ x: u * width, y: v * height });
      destinationGrid.push({ x: (projected.x * scale + 1) * width / 2, y: (projected.y * scale + 1) * height / 2 });
    }
  }
  const triangles = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const topLeft = row * (columns + 1) + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + columns + 1;
      const bottomRight = bottomLeft + 1;
      for (const indices of [[topLeft, topRight, bottomRight], [topLeft, bottomRight, bottomLeft]]) {
        triangles.push(affineTriangle(indices.map((i) => sourceGrid[i]), indices.map((i) => destinationGrid[i])));
      }
    }
  }
  return { width, height, pose, triangles };
}

/**
 * Draw into a pre-sized canvas. Match the source aspect ratio to retain the full
 * camera frame; a different target ratio uses a proportional center crop.
 * Mirroring happens before perspective so model motion stays in screen space.
 * Returns the effective pose and dimensions, or null when no frame is ready.
 */
export function drawPhotoFrame(targetCanvas, source, { filter = 'color', exposure = 0, mirror = false, pose = null } = {}) {
  const width = targetCanvas?.width;
  const height = targetCanvas?.height;
  // A video's layout width is not evidence that its first camera frame is ready.
  const isVideo = source != null && 'videoWidth' in source;
  const isImage = source != null && 'naturalWidth' in source;
  const sourceWidth = isVideo ? source.videoWidth : isImage ? source.naturalWidth : source?.width;
  const sourceHeight = isVideo ? source.videoHeight : isImage ? source.naturalHeight : source?.height;
  if (!width || !height || !sourceWidth || !sourceHeight) return null;
  if (isVideo && source.readyState !== undefined && source.readyState < 2) return null;
  const context = targetCanvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('A 2D canvas context is required to render a photograph.');
  const effectivePose = resolvePhotoPose(pose);
  const cache = getFrameCache(targetCanvas, width, height);
  const bufferContext = cache.context;
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = width / height;
  const cropWidth = sourceAspect > targetAspect ? sourceHeight * targetAspect : sourceWidth;
  const cropHeight = sourceAspect > targetAspect ? sourceHeight : sourceWidth / targetAspect;
  const supportsFilter = typeof bufferContext.filter === 'string';

  bufferContext.save();
  bufferContext.setTransform(1, 0, 0, 1, 0, 0);
  bufferContext.globalAlpha = 1;
  bufferContext.globalCompositeOperation = 'source-over';
  bufferContext.imageSmoothingEnabled = true;
  bufferContext.imageSmoothingQuality = 'high';
  if (supportsFilter) bufferContext.filter = photoFilterCSS(filter, exposure);
  if (mirror) {
    bufferContext.translate(width, 0);
    bufferContext.scale(-1, 1);
  }
  bufferContext.drawImage(source, (sourceWidth - cropWidth) / 2, (sourceHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, width, height);
  bufferContext.restore();
  if (!supportsFilter) applyPixelFilter(bufferContext, width, height, filter, exposure);

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  if (typeof context.filter === 'string') context.filter = 'none';
  context.clearRect(0, 0, width, height);
  if (effectivePose.yaw === 0 && effectivePose.pitch === 0) {
    // This fast path is an exact full-frame identity at the default zoom.
    const zoom = effectivePose.zoom;
    context.drawImage(cache.buffer, (1 - zoom) * width / 2, (1 - zoom) * height / 2, width * zoom, height * zoom);
  } else {
    const cachedPose = cache.mesh?.pose;
    if (!cachedPose || cachedPose.yaw !== effectivePose.yaw || cachedPose.pitch !== effectivePose.pitch || cachedPose.zoom !== effectivePose.zoom) {
      cache.mesh = makeMesh(width, height, effectivePose);
    }
    for (const triangle of cache.mesh.triangles) {
      context.save();
      context.beginPath();
      context.moveTo(triangle.clip[0].x, triangle.clip[0].y);
      context.lineTo(triangle.clip[1].x, triangle.clip[1].y);
      context.lineTo(triangle.clip[2].x, triangle.clip[2].y);
      context.closePath();
      context.clip();
      context.setTransform(...triangle.matrix);
      context.drawImage(cache.buffer, 0, 0);
      context.restore();
    }
  }
  context.restore();
  return { width, height, pose: effectivePose };
}
