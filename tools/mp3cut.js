// Minimal MP3 helper (no dependencies): inspect a file and cut a clip on frame boundaries.
//   node tools/mp3cut.js info <file.mp3>
//   node tools/mp3cut.js cut <in.mp3> <startSec> <durSec> <out.mp3>
// Handles an ID3v2 header and MPEG-1/2 Layer III frames. Cutting keeps whole frames only, so the result decodes cleanly
// (the bit reservoir of the first frame may reference earlier data: decoders conceal that, we also start 2 frames early).

import { readFileSync, writeFileSync } from 'node:fs';

const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BR2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

export function parseFrames(buf) {
  let p = 0;
  if (buf.slice(0, 3).toString('latin1') === 'ID3') {
    const size = (buf[6] & 0x7f) * 2097152 + (buf[7] & 0x7f) * 16384 + (buf[8] & 0x7f) * 128 + (buf[9] & 0x7f);
    p = 10 + size;
  }
  const frames = [];
  while (p + 4 <= buf.length) {
    if (buf[p] !== 0xff || (buf[p + 1] & 0xe0) !== 0xe0) { p++; continue; }
    const ver = (buf[p + 1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const layer = (buf[p + 1] >> 1) & 3; // 1 = Layer III
    const brIdx = (buf[p + 2] >> 4) & 15, srIdx = (buf[p + 2] >> 2) & 3, pad = (buf[p + 2] >> 1) & 1;
    if (layer !== 1 || ver === 1 || brIdx === 0 || brIdx === 15 || srIdx === 3) { p++; continue; }
    const br = (ver === 3 ? BR1 : BR2)[brIdx] * 1000;
    const sr = SR[ver][srIdx];
    const samples = ver === 3 ? 1152 : 576;
    const len = Math.floor(((ver === 3 ? 144 : 72) * br) / sr) + pad;
    if (len < 8 || p + len > buf.length) break;
    frames.push({ pos: p, len, br, sr, dur: samples / sr, channels: ((buf[p + 3] >> 6) & 3) === 3 ? 1 : 2 });
    p += len;
  }
  return frames;
}

export function info(file) {
  const buf = readFileSync(file);
  const fr = parseFrames(buf);
  const dur = fr.reduce((a, f) => a + f.dur, 0);
  return { frames: fr.length, seconds: +dur.toFixed(2), kbps: fr.length ? fr[0].br / 1000 : 0, sampleRate: fr.length ? fr[0].sr : 0, channels: fr.length ? fr[0].channels : 0, bytes: buf.length };
}

export function cut(file, startSec, durSec, out) {
  const buf = readFileSync(file);
  const fr = parseFrames(buf);
  let t = 0, i0 = 0;
  while (i0 < fr.length && t + fr[i0].dur <= startSec) { t += fr[i0].dur; i0++; }
  i0 = Math.max(0, i0 - 2); // two frames of lead-in for the bit reservoir
  let acc = 0, i1 = i0;
  while (i1 < fr.length && acc < durSec) { acc += fr[i1].dur; i1++; }
  const parts = [];
  for (let i = i0; i < i1; i++) parts.push(buf.subarray(fr[i].pos, fr[i].pos + fr[i].len));
  const res = Buffer.concat(parts);
  writeFileSync(out, res);
  return { frames: i1 - i0, seconds: +acc.toFixed(2), bytes: res.length };
}

if (process.argv[1] && process.argv[1].endsWith('mp3cut.js')) {
  const [cmd, a, b, c, d] = process.argv.slice(2);
  if (cmd === 'info') console.log(JSON.stringify(info(a)));
  else if (cmd === 'cut') console.log(JSON.stringify(cut(a, Number(b), Number(c), d)));
  else console.log('usage: mp3cut.js info <f> | cut <in> <start> <dur> <out>');
}
