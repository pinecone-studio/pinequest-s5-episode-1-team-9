import { CEFR_LEVELS, type CefrLevel } from "@linguamatch/shared";

export interface ScenarioRole {
  roleName: string;
  situation: string;
  secretGoal: string;
}

export interface Scenario {
  title: string;
  level: CefrLevel;
  roles: [ScenarioRole, ScenarioRole];
}

const scenario = (level: CefrLevel, title: string, roles: [ScenarioRole, ScenarioRole]): Scenario => ({
  title,
  level,
  roles,
});

export const SCENARIO_BANK: readonly Scenario[] = [
  scenario("A1", "Checking in at a hotel", [
    {
      roleName: "Hotel receptionist",
      situation: "You work at the front desk of a small city hotel. A guest arrives to check in.",
      secretGoal: "The room they booked is not ready yet. Offer them something else without upsetting them.",
    },
    {
      roleName: "Guest",
      situation: "You have travelled all day and just arrived at your hotel. You want to check in and rest.",
      secretGoal: "You need a quiet room on a low floor. Ask until you get one.",
    },
  ]),
  scenario("A2", "Ordering in a busy cafe", [
    {
      roleName: "Waiter",
      situation: "It is lunchtime and your cafe is full. A customer sits down and looks at the menu.",
      secretGoal: "The kitchen has run out of the most popular dish. Recommend something else instead.",
    },
    {
      roleName: "Customer",
      situation: "You have 30 minutes for lunch and you are very hungry.",
      secretGoal: "You cannot eat dairy. Find something on the menu you can actually order.",
    },
  ]),
  scenario("B1", "Lost luggage at the airport", [
    {
      roleName: "Airline agent",
      situation: "A passenger comes to your desk because their suitcase did not arrive on the flight.",
      secretGoal: "You can only offer compensation if they can describe the bag exactly. Get the details.",
    },
    {
      roleName: "Passenger",
      situation: "You landed two hours ago and your suitcase never came onto the belt.",
      secretGoal: "Your medication is inside the bag. Make the agent treat this as urgent.",
    },
  ]),
  scenario("B2", "Viewing a flat to rent", [
    {
      roleName: "Landlord",
      situation: "You are showing a flat to someone who answered your advert.",
      secretGoal: "The heating is unreliable in winter. Only admit it if they ask directly.",
    },
    {
      roleName: "Prospective tenant",
      situation: "You are looking at a flat that is slightly above your budget.",
      secretGoal: "Negotiate the rent down, or get the landlord to include the bills.",
    },
  ]),
  scenario("C1", "Negotiating a promotion", [
    {
      roleName: "Manager",
      situation: "A member of your team has asked for a meeting about their career.",
      secretGoal: "Your budget is frozen this quarter. Keep them motivated without promising money.",
    },
    {
      roleName: "Employee",
      situation: "You have led two successful projects this year and want recognition for it.",
      secretGoal: "You have an offer from another company. Use it as leverage, but do not reveal it immediately.",
    },
  ]),
  scenario("C2", "An ethics committee debate", [
    {
      roleName: "Committee chair",
      situation: "Your hospital committee must decide whether to approve an experimental treatment.",
      secretGoal: "You personally oppose the trial, but you must appear neutral while chairing it.",
    },
    {
      roleName: "Lead researcher",
      situation: "You are presenting your trial proposal to the ethics committee.",
      secretGoal: "One of your earlier studies was retracted. Address it only if it comes up.",
    },
  ]),
];

const levelIndex = (l: CefrLevel) => CEFR_LEVELS.indexOf(l);

export function pickRandomScenario(
  level: CefrLevel,
  avoid: readonly string[] = [],
  random = Math.random,
): Scenario {
  const avoided = new Set(avoid);
  const target = levelIndex(level);
  for (let distance = 0; distance < CEFR_LEVELS.length; distance++) {
    const pool = SCENARIO_BANK.filter(
      (s) => Math.abs(levelIndex(s.level) - target) <= distance && !avoided.has(s.title),
    );
    if (pool.length > 0) return pool[Math.floor(random() * pool.length)]!;
  }
  return SCENARIO_BANK[Math.floor(random() * SCENARIO_BANK.length)]!;
}
