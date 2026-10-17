// Catalog item properties ([code, param, min, max] from uniqueitems/setitems/runes.txt, see scripts/gen-data.mjs)
// as the stats a save holds ([statId, layer, value], see src/lib/stats.js), and as description lines with
// ranges: "+60-70% Enhanced Damage".
import data from "../data/stats.json";
import { describeStats } from "./stats";

const { stats, properties } = data;
const INDESTRUCTIBLE = 152;

// Stats for the lowest (pick 0) or highest (pick 1) roll. func is the properties.txt function:
// 1/2/8 roll a value, 3 copies the previous value (all resistances), 5/6/7 min/max/% damage,
// 10 skill tab (param 0-20, three per class), 11 skill on event, 15/16 use min/max, 17 use the param,
// 19 charges, 20 indestructible,
// 21 class (val) skills, 22/24 skill or monster (param). Random skills (12, 36) can't be shown as a range.
export function propStats(props, pick) {
  const out = [];
  for (const [code, par, min, max] of props) {
    const roll = pick ? max : min;
    let prev;
    for (const [func, stat, val] of properties[code] ?? []) {
      const shift = (v) => (stats[stat]?.shift ? v * 2 ** stats[stat].shift : v);
      let entry;
      switch (func) {
        case 1: case 2: case 8: case 14: entry = [stat, 0, shift(roll)]; break;
        case 3: entry = prev && [stat, prev[1], prev[2]]; break;
        case 5: entry = [21, 0, roll]; break;
        case 6: entry = [22, 0, roll]; break;
        case 7: out.push([18, 0, roll]); entry = [17, 0, roll]; break;
        case 10: entry = [stat, (Math.floor(par / 3) << 3) | par % 3, roll]; break;
        case 11: entry = [stat, (par << 6) | max, min]; break;
        case 15: entry = [stat, 0, shift(min)]; break;
        case 16: entry = [stat, 0, shift(max)]; break;
        case 17: entry = [stat, 0, shift(par)]; break;
        case 19: entry = [stat, (par << 6) | max, min | (min << 8)]; break;
        case 20: entry = [INDESTRUCTIBLE, 0, 1]; break;
        case 21: entry = [stat, val, roll]; break;
        case 22: case 24: entry = [stat, par, roll]; break;
      }
      if (entry) out.push((prev = entry));
    }
  }
  return out;
}

// "+60%" and "+70%" -> "+60-70%": numbers that differ become ranges
function merge(lo, hi) {
  if (lo === hi) return lo;
  const a = lo.split(/(\d+)/);
  const b = hi.split(/(\d+)/);
  if (a.length !== b.length) return hi;
  return a.map((part, i) => (i % 2 && part !== b[i] ? `${part}-${b[i]}` : part)).join("");
}

export function propLines(props, lang) {
  const lo = describeStats(propStats(props, 0), lang);
  const hi = describeStats(propStats(props, 1), lang);
  return lo.length === hi.length ? lo.map((line, i) => merge(line, hi[i])) : hi;
}
