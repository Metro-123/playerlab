export const ATTRIBUTE_GROUPS = [
  { key: "pace", label: "PACE", short: "PAC", attributes: ["acceleration", "sprintSpeed"] },
  { key: "shooting", label: "SHOOTING", short: "SHO", attributes: ["finishing", "shotPower", "longShots", "volleys", "penalties", "headingAccuracy"] },
  { key: "passing", label: "PASSING", short: "PAS", attributes: ["vision", "crossing", "fkAccuracy", "shortPassing", "longPassing", "curve"] },
  { key: "dribbling", label: "DRIBBLING", short: "DRI", attributes: ["agility", "balance", "reactions", "ballControl", "dribbling", "composure"] },
  { key: "defending", label: "DEFENDING", short: "DEF", attributes: ["interceptions", "headingAccuracy", "defensiveAwareness", "standingTackle", "slidingTackle"] },
  { key: "physical", label: "PHYSICAL", short: "PHY", attributes: ["jumping", "stamina", "strength", "aggression"] },
  { key: "goalkeeping", label: "GOALKEEPING", short: "GK", attributes: ["diving", "handling", "kicking", "reflexes", "positioning"] },
] as const;

export type AttributeGroupKey = (typeof ATTRIBUTE_GROUPS)[number]["key"];

export const ATTRIBUTE_KEYS = [
  "acceleration", "sprintSpeed",
  "finishing", "shotPower", "longShots", "volleys", "penalties", "headingAccuracy",
  "vision", "crossing", "fkAccuracy", "shortPassing", "longPassing", "curve",
  "agility", "balance", "reactions", "ballControl", "dribbling", "composure",
  "interceptions", "defensiveAwareness", "standingTackle", "slidingTackle",
  "jumping", "stamina", "strength", "aggression",
  "diving", "handling", "kicking", "reflexes", "positioning",
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number>;

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  acceleration: "Acceleration",
  sprintSpeed: "Sprint Speed",
  finishing: "Finishing",
  shotPower: "Shot Power",
  longShots: "Long Shots",
  volleys: "Volleys",
  penalties: "Penalties",
  headingAccuracy: "Heading",
  vision: "Vision",
  crossing: "Crossing",
  fkAccuracy: "FK Accuracy",
  shortPassing: "Short Passing",
  longPassing: "Long Passing",
  curve: "Curve",
  agility: "Agility",
  balance: "Balance",
  reactions: "Reactions",
  ballControl: "Ball Control",
  dribbling: "Dribbling",
  composure: "Composure",
  interceptions: "Interceptions",
  defensiveAwareness: "Def. Awareness",
  standingTackle: "Standing Tackle",
  slidingTackle: "Sliding Tackle",
  jumping: "Jumping",
  stamina: "Stamina",
  strength: "Strength",
  aggression: "Aggression",
  diving: "Diving",
  handling: "Handling",
  kicking: "Kicking",
  reflexes: "Reflexes",
  positioning: "Positioning",
};

export const GROUP_SHORTS = ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"] as const;
export type GroupShort = (typeof GROUP_SHORTS)[number];

/** Which attribute groups feed each published group rating. */
export const GROUP_MEMBERS: Record<GroupShort, AttributeKey[]> = {
  PAC: ["acceleration", "sprintSpeed"],
  SHO: ["finishing", "shotPower", "longShots", "volleys", "penalties", "headingAccuracy"],
  PAS: ["vision", "crossing", "fkAccuracy", "shortPassing", "longPassing", "curve"],
  DRI: ["agility", "balance", "reactions", "ballControl", "dribbling", "composure"],
  DEF: ["interceptions", "headingAccuracy", "defensiveAwareness", "standingTackle", "slidingTackle"],
  PHY: ["jumping", "stamina", "strength", "aggression"],
};

export const GK_ATTRIBUTES: AttributeKey[] = ["diving", "handling", "kicking", "reflexes", "positioning"];

/**
 * The five goalkeeping attributes present in the source, in card order. Used as
 * the goalkeeper counterpart to GROUP_SHORTS, since EA publishes no group
 * ratings for goalkeepers.
 */
export const GK_SHORTS = ["DIV", "HND", "KIC", "REF", "POS"] as const;
export type GkShort = (typeof GK_SHORTS)[number];

export const GK_BY_SHORT: Record<GkShort, AttributeKey> = {
  DIV: "diving",
  HND: "handling",
  KIC: "kicking",
  REF: "reflexes",
  POS: "positioning",
};

export const POSITION_GROUP: Record<string, GroupShort[]> = {
  GK: ["DRI", "PHY"],
  CB: ["DEF", "PHY", "PAS"],
  LB: ["DEF", "PAC", "PHY"],
  RB: ["DEF", "PAC", "PHY"],
  LWB: ["DEF", "PAC", "DRI"],
  RWB: ["DEF", "PAC", "DRI"],
  CDM: ["DEF", "PAS", "PHY"],
  CM: ["PAS", "DRI", "DEF"],
  CAM: ["PAS", "DRI", "SHO"],
  LM: ["PAC", "PAS", "DRI"],
  RM: ["PAC", "PAS", "DRI"],
  LW: ["PAC", "DRI", "SHO"],
  RW: ["PAC", "DRI", "SHO"],
  CF: ["SHO", "DRI", "PAC"],
  ST: ["SHO", "PAC", "PHY"],
};
