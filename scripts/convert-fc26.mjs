/**
 * Converts the FC 26 CSV export into a columnar, dictionary-encoded payload.
 *
 *   node scripts/convert-fc26.mjs [path-to.csv] [minOverall]
 *
 * Output:
 *   public/data/players.json  full dataset, fetched at runtime
 *   data/manifest.json        tiny static summary (imported into the bundle)
 *
 * Columnar + dictionary encoding keeps the payload small enough to fetch once
 * and hold in memory, and lets attribute access stay O(1) via a flat array.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source =
  process.argv[2] ?? resolve(process.env.USERPROFILE ?? "", "Downloads", "archive", "FC26_20250921.csv");
const minOverall = Number(process.argv[3] ?? 55);

/* ------------------------------------------------------- CSV parsing */
function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();
  return rows;
}

/* -------------------------------------- canonical attribute key order */
const ATTRIBUTE_KEYS = [
  "acceleration",
  "sprintSpeed",
  "finishing",
  "shotPower",
  "longShots",
  "volleys",
  "penalties",
  "headingAccuracy",
  "vision",
  "crossing",
  "fkAccuracy",
  "shortPassing",
  "longPassing",
  "curve",
  "agility",
  "balance",
  "reactions",
  "ballControl",
  "dribbling",
  "composure",
  "interceptions",
  "defensiveAwareness",
  "standingTackle",
  "slidingTackle",
  "jumping",
  "stamina",
  "strength",
  "aggression",
  "diving",
  "handling",
  "kicking",
  "reflexes",
  "positioning",
];

/** Source CSV column -> canonical attribute key. */
const SOURCE_COLUMNS = {
  movement_acceleration: "acceleration",
  movement_sprint_speed: "sprintSpeed",
  attacking_finishing: "finishing",
  power_shot_power: "shotPower",
  power_long_shots: "longShots",
  attacking_volleys: "volleys",
  mentality_penalties: "penalties",
  attacking_heading_accuracy: "headingAccuracy",
  mentality_vision: "vision",
  attacking_crossing: "crossing",
  skill_fk_accuracy: "fkAccuracy",
  attacking_short_passing: "shortPassing",
  skill_long_passing: "longPassing",
  skill_curve: "curve",
  movement_agility: "agility",
  movement_balance: "balance",
  movement_reactions: "reactions",
  skill_ball_control: "ballControl",
  skill_dribbling: "dribbling",
  mentality_composure: "composure",
  mentality_interceptions: "interceptions",
  defending_marking_awareness: "defensiveAwareness",
  defending_standing_tackle: "standingTackle",
  defending_sliding_tackle: "slidingTackle",
  power_jumping: "jumping",
  power_stamina: "stamina",
  power_strength: "strength",
  mentality_aggression: "aggression",
  goalkeeping_diving: "diving",
  goalkeeping_handling: "handling",
  goalkeeping_kicking: "kicking",
  goalkeeping_reflexes: "reflexes",
  goalkeeping_positioning: "positioning",
};

const CANONICAL_ORDER = new Map(ATTRIBUTE_KEYS.map((k, i) => [k, i]));

/* -------------------------------------------------------- dictionaries */
class Dictionary {
  constructor() {
    this.values = [];
    this.index = new Map();
  }
  add(value) {
    if (!this.index.has(value)) {
      this.index.set(value, this.values.length);
      this.values.push(value);
    }
    return this.index.get(value);
  }
}

/* --------------------------------------------------------------- main */

/**
 * Name repair.
 *
 * The upstream CSV's `long_name` is corrupt for a large slice of the roster: the
 * Latin name is glued straight onto the player's name in their own script with
 * no separator, e.g. "Mohamed Salah Hamed Ghalyمحمد صلاح" or
 * "Heung-min Son손흥민 孙兴慜". That is a scraping artefact, not a real name, and
 * it renders as unreadable mush in the UI. The native-script run is dropped and
 * the Latin form kept.
 *
 * A handful of rows also carry a legal first name that nobody uses, which makes
 * the player unrecognisable next to how they are actually known. Those are
 * corrected by id rather than by a rule, because there is no general rule that
 * tells "Masour" (a registry forename) from a genuine second given name.
 */
const NAME_OVERRIDES = new Map([
  ["231443", "Ousmane Dembélé"],
  // Source reads "Achraf Hakimi Mouh" — the trailing fragment is part of the
  // same scraping damage, and he is known simply as Achraf Hakimi.
  ["235212", "Achraf Hakimi"],
]);

/** Any character that is not part of a Latin-script name. */
const NON_LATIN = "[^\\p{Script=Latin}\\p{M}\\p{Nd}'’.\\- ]";

function cleanName(raw, id) {
  if (!raw) return "";
  const override = NAME_OVERRIDES.get(String(id));
  if (override) return override;

  // Drop every run of non-Latin script, then tidy the whitespace it leaves
  // behind along with any separator the source used to introduce the script.
  return String(raw)
    .replace(new RegExp(`${NON_LATIN}+`, "gu"), " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—,:;/|]+/, "")
    .replace(/[\s\-–—,:;/|]+$/, "")
    .trim();
}

const raw = readFileSync(source, "utf8");
const rows = parseCsv(raw);
const header = rows[0];
const col = Object.fromEntries(header.map((name, i) => [name, i]));

for (const required of ["long_name", "player_positions", "overall", "age", ...Object.keys(SOURCE_COLUMNS)]) {
  if (col[required] === undefined) throw new Error(`Missing expected column: ${required}`);
}

const positions = new Dictionary();
const nations = new Dictionary();
const leagues = new Dictionary();
const clubs = new Dictionary();

const ids = [];
const names = [];
const shortNames = [];
const posIdx = [];
const altIdx = [];
const age = [];
const natIdx = [];
const lgIdx = [];
const clIdx = [];
const height = [];
const weight = [];
const foot = [];
const weakFoot = [];
const skillMoves = [];
const overall = [];
const potential = [];
const valueEur = [];
const wageEur = [];
const reputation = [];
const attrFlat = [];
/** EA's own six published group ratings, kept so we can validate against them. */
const GROUP_COLUMNS = ["pace", "shooting", "passing", "dribbling", "defending", "physic"];
const groupFlat = [];

const get = (row, key) => {
  const i = col[key];
  return i === undefined ? "" : (row[i] ?? "").trim();
};
const num = (row, key, fallback = 0) => {
  const v = Number(get(row, key));
  return Number.isFinite(v) ? v : fallback;
};

let skipped = 0;
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (row.length < header.length - 2) continue;

  const ovr = num(row, "overall");
  if (ovr < minOverall) {
    skipped++;
    continue;
  }

  const name = cleanName(get(row, "long_name") || get(row, "short_name"), get(row, "player_id", r));
  if (!name) continue;

  const positionList = get(row, "player_positions")
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  if (positionList.length === 0) continue;

  ids.push(num(row, "player_id", r));
  names.push(name);
  shortNames.push(cleanName(get(row, "short_name"), get(row, "player_id", r)) || name);
  posIdx.push(positions.add(positionList[0]));
  altIdx.push(positionList.slice(1).map((p) => positions.add(p)));
  age.push(num(row, "age"));
  natIdx.push(nations.add(get(row, "nationality_name") || "—"));
  lgIdx.push(leagues.add(get(row, "league_name") || "—"));
  clIdx.push(clubs.add(get(row, "club_name") || "Free Agent"));
  height.push(num(row, "height_cm"));
  weight.push(num(row, "weight_kg"));
  foot.push(get(row, "preferred_foot").toLowerCase().startsWith("l") ? 1 : 0);
  weakFoot.push(num(row, "weak_foot", 3));
  skillMoves.push(num(row, "skill_moves", 3));
  overall.push(ovr);
  potential.push(num(row, "potential", ovr));
  valueEur.push(num(row, "value_eur"));
  wageEur.push(num(row, "wage_eur"));
  reputation.push(num(row, "international_reputation"));
  // `player_face_url` is deliberately dropped: portraits are served by
  // /api/face/[id], which rebuilds the CDN path from the id, so shipping 17,347
  // ~50-character URLs would add 881 KB to a payload nothing reads.

  for (const column of GROUP_COLUMNS) groupFlat.push(num(row, column));

  for (const sourceCol of Object.keys(SOURCE_COLUMNS)) {
    attrFlat.push(num(row, sourceCol, 1));
  }
}

// Sanity check on the attribute block size.
if (attrFlat.length !== ids.length * ATTRIBUTE_KEYS.length) {
  throw new Error(`Attribute block mismatch: ${attrFlat.length} != ${ids.length * ATTRIBUTE_KEYS.length}`);
}
if (CANONICAL_ORDER.size !== ATTRIBUTE_KEYS.length) throw new Error("Canonical order collision");

const order = ids.map((_, i) => i).sort((a, b) => overall[b] - overall[a]);
const at = (arr) => order.map((i) => arr[i]);
const attrSorted = [];
const groupSorted = [];
for (const i of order) {
  const start = i * ATTRIBUTE_KEYS.length;
  for (let k = 0; k < ATTRIBUTE_KEYS.length; k++) attrSorted.push(attrFlat[start + k]);
  for (let k = 0; k < GROUP_COLUMNS.length; k++) groupSorted.push(groupFlat[i * GROUP_COLUMNS.length + k]);
}

const payload = {
  name: "FC 26 Player Attributes",
  season: get(rows[1] ?? [], "fifa_version") || "26",
  synthetic: false,
  source: "FC26_20250921.csv",
  updated: get(rows[1] ?? [], "fifa_update_date"),
  minOverall,
  attributes: ATTRIBUTE_KEYS,
  groupAttributes: GROUP_COLUMNS,
  dictionaries: {
    positions: positions.values,
    nations: nations.values,
    leagues: leagues.values,
    clubs: clubs.values,
  },
  n: ids.length,
  ids: at(ids),
    names: at(names),
    shortNames: at(shortNames),
  pos: at(posIdx),
  alt: order.map((i) => altIdx[i]),
  age: at(age),
  nat: at(natIdx),
  lg: at(lgIdx),
  cl: at(clIdx),
  height: at(height),
  weight: at(weight),
  foot: at(foot),
  weakFoot: at(weakFoot),
  skillMoves: at(skillMoves),
  ovr: at(overall),
  potential: at(potential),
  valueEur: at(valueEur),
  wageEur: at(wageEur),
  reputation: at(reputation),
  attr: attrSorted,
  group: groupSorted,
};

mkdirSync(resolve(root, "public", "data"), { recursive: true });
writeFileSync(resolve(root, "public", "data", "players.json"), JSON.stringify(payload));

const manifest = {
  name: payload.name,
  season: payload.season,
  synthetic: false,
  source: payload.source,
  updated: payload.updated,
  minOverall,
  count: payload.n,
  positions: positions.values.length,
  leagues: leagues.values.length,
  clubs: clubs.values.length,
  nations: nations.values.length,
  attributes: ATTRIBUTE_KEYS,
  topOvr: payload.ovr[0],
  medianOvr: [...payload.ovr].sort((a, b) => a - b)[payload.n >> 1],
};
writeFileSync(resolve(root, "data", "manifest.json"), JSON.stringify(manifest, null, 2));

const bytes = statSync(resolve(root, "public", "data", "players.json")).size;
console.log(`Parsed  : ${rows.length - 1} rows from ${source}`);
console.log(`Kept    : ${payload.n} players (overall >= ${minOverall}); dropped ${skipped}`);
console.log(`Dicts   : ${positions.values.length} positions, ${leagues.values.length} leagues, ${clubs.values.length} clubs, ${nations.values.length} nations`);
console.log(`OVR     : ${manifest.medianOvr} median, ${manifest.topOvr} max`);
console.log(`Payload : ${(bytes / 1024 / 1024).toFixed(2)} MB -> public/data/players.json`);
console.log(`Manifest: data/manifest.json`);
console.log(`Top 5   : ${payload.names.slice(0, 5).map((n, i) => `${n} (${positions.values[payload.pos[i]]}, ${payload.ovr[i]})`).join(", ")}`);
