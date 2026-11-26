// Minimal QR code encoder (byte mode, error correction level M, versions 1–6), after Project Nayuki's
// reference design. Same algorithm as the Apple TV lobby's QR. Usage: QR.svg(text, dark, light) -> SVG string.
(function (root) {
  'use strict';
  const ECC = [0, 10, 16, 26, 18, 24, 16];
  const BLOCKS = [0, 1, 1, 1, 2, 2, 4];

  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xff;
  }
  function rsDivisor(degree) {
    const r = new Array(degree - 1).fill(0).concat([1]);
    let root = 1;
    for (let k = 0; k < degree; k++) {
      for (let j = 0; j < r.length; j++) {
        r[j] = gfMul(r[j], root);
        if (j + 1 < r.length) r[j] ^= r[j + 1];
      }
      root = gfMul(root, 2);
    }
    return r;
  }
  function rsRemainder(data, div) {
    const r = new Array(div.length).fill(0);
    for (const b of data) {
      const f = b ^ r.shift();
      r.push(0);
      div.forEach((c, i) => { r[i] ^= gfMul(c, f); });
    }
    return r;
  }
  function rawModules(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) { const na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; }
    return r;
  }
  const dataCw = (v) => Math.floor(rawModules(v) / 8) - ECC[v] * BLOCKS[v];
  function alignPos(v) {
    if (v === 1) return [];
    const size = v * 4 + 17, na = Math.floor(v / 7) + 2;
    const step = Math.floor((v * 8 + na * 3 + 5) / (na * 2 - 2)) * 2;
    const out = [];
    for (let i = 0; i < na - 1; i++) out.push(size - 7 - i * step);
    return [6].concat(out.reverse());
  }

  function encode(text, mask) {
    const data = Array.from(new TextEncoder().encode(text));
    let ver = 1;
    while (ver <= 6 && 12 + data.length * 8 > dataCw(ver) * 8) ver++;
    if (ver > 6) throw new Error('text too long');
    const cap = dataCw(ver) * 8, bits = [];
    const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(data.length, 8); data.forEach((b) => put(b, 8));
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
    const cw = [];
    for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));

    const nb = BLOCKS[ver], ecl = ECC[ver], raw = Math.floor(rawModules(ver) / 8);
    const nshort = nb - (raw % nb), shortlen = Math.floor(raw / nb), div = rsDivisor(ecl);
    const blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      let dat = cw.slice(k, k + shortlen - ecl + (i < nshort ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, div);
      if (i < nshort) dat = dat.concat([0]);
      blocks.push(dat.concat(ecc));
    }
    const all = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((blk, j) => { if (i !== shortlen - ecl || j >= nshort) all.push(blk[i]); });
    }

    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const setf = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { setf(6, i, i % 2 === 0); setf(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setf(x, y, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const ap = alignPos(ver), n = ap.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setf(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const formatBits = (m) => {
      const d = m; let rem = d;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      return ((d << 10) | rem) ^ 0x5412;
    };
    const drawFormat = (m) => {
      const b = formatBits(m), g = (i) => ((b >>> i) & 1) === 1;
      for (let i = 0; i < 6; i++) setf(8, i, g(i));
      setf(8, 7, g(6)); setf(8, 8, g(7)); setf(7, 8, g(8));
      for (let i = 9; i < 15; i++) setf(14 - i, 8, g(i));
      for (let i = 0; i < 8; i++) setf(size - 1 - i, 8, g(i));
      for (let i = 8; i < 15; i++) setf(8, size - 15 + i, g(i));
      setf(8, size - 8, true);
    };
    drawFormat(0);
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
        if (!fn[y][x] && bi < all.length * 8) { mod[y][x] = ((all[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; }
      }
    }
    const masks = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0,
    ];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && masks[mask](x, y)) mod[y][x] = !mod[y][x];
    drawFormat(mask);
    return mod;
  }

  function svg(text, dark = '#000', light = '#fff', mask = 2, border = 3) {
    const mod = encode(text, mask), size = mod.length, full = size + border * 2;
    let d = '';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mod[y][x]) d += `M${x + border} ${y + border}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges"><rect width="${full}" height="${full}" fill="${light}"/><path fill="${dark}" d="${d}"/></svg>`;
  }

  root.QR = { encode, svg };
  if (typeof module !== 'undefined') module.exports = root.QR;
})(typeof window !== 'undefined' ? window : globalThis);
