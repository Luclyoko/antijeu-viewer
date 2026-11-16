// node test.js — vérifie la logique pure de index.html (script id="core") sans navigateur.
const fs = require("fs"), vm = require("vm"), assert = require("assert");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const core = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(core, ctx);
const {parseJournal, buildModel, matches, parseTime, TYPES} = ctx.module.exports;

const P = (n) => ({uuid: "uuid-" + n, name: n});
const ev = (t, type, data) => JSON.stringify({t, ms: t * 1000, type, data});
const text = [
  ev(0, "GAME_START", {settings: {}, players: [{...P("Alice"), alive: true, role: "Lezgard", winningTeam: "OLDDIES", forms: [], canAlly: false}, {...P("Bob"), alive: true}]}),
  ev(5, "ROLE", {player: P("Bob"), role: "Blackphey", winningTeam: "SOLO", forms: [], canAlly: false}),
  "",
  ev(10, "HIT", {attacker: P("Bob"), victim: P("Alice"), damage: 3.5, attackerHealth: 20, victimHealth: 16.5, cause: "ENTITY_ATTACK", position: {world: "world", x: 1, y: 64, z: 2}}),
  "{tronqué",
  ev(12, "DAMAGE", {target: P("Alice"), kind: "health", amount: 2, origin: {kind: "power", player: "uuid-Bob", name: "Foudre"}}),
  ev(15, "POWER", {source: P("Bob"), power: "Foudre", targets: [P("Alice")], roleAbility: true}),
  ev(20, "DEATH", {victim: P("Alice"), killer: P("Bob"), cause: "ENTITY_ATTACK", deconnection: false}),
  ev(30, "GAME_END", {interrupted: false}),
  JSON.stringify({t: 30, ms: 0, type: "REPORT", data: {title: "Anti-jeu — 1 signalement(s) à vérifier", notes: [], engagements: [2],
    flags: [{type: "EARLY_KILL", label: "Kill avant 1h", icon: "🔴", players: ["uuid-Bob", "uuid-Alice"], start: 20, end: 20, context: ["00:20 Bob tue Alice"]}]}}),
].join("\n");

const parsed = parseJournal(text);
assert.strictEqual(parsed.events.length, 7);
assert.strictEqual(parsed.unreadable, 1);
assert.strictEqual(parsed.report.flags.length, 1);

const m = buildModel(parsed);
const hit = m.rows.find(r => r.type === "HIT");
assert.strictEqual(hit.idx, 2, "idx = indice serveur (lignes vides/illisibles exclues)");
assert.ok(hit.eng, "engagement repris du REPORT");
assert.strictEqual(hit.parts[0].role.role, "Blackphey", "rôle au moment du coup");
assert.ok(hit.text.includes("3,5 pv"));

const bob = m.stats.find(s => s.uuid === "uuid-Bob"), alice = m.stats.find(s => s.uuid === "uuid-Alice");
assert.deepStrictEqual([bob.kills, bob.hitsDone, bob.dmgDone, bob.powers], [1, 1, 5.5, 1]);
assert.deepStrictEqual([alice.deaths, alice.dmgTaken, alice.alive], [1, 5.5, false]);

const all = {cats: new Set(TYPES.map(t => t[0])), players: [], mode: "any", side: "any", from: null, to: null, text: "", eng: false, out: false};
const count = f => m.rows.filter(r => matches(r, {...all, ...f})).length;
assert.strictEqual(count({}), 7);
assert.strictEqual(count({cats: new Set(["HIT"])}), 1);
assert.strictEqual(count({players: ["uuid-Bob"], side: "actor"}), 5); // ROLE, HIT, DAMAGE (origine), POWER, DEATH (tueur)
assert.strictEqual(count({players: ["uuid-Alice"], side: "target"}), 4);
assert.strictEqual(count({players: ["uuid-Bob", "uuid-Alice"], mode: "between"}), 4); // HIT, DAMAGE, POWER, DEATH
assert.strictEqual(count({from: 11, to: 20}), 3);
assert.strictEqual(count({text: "foudre"}), 2);
assert.strictEqual(count({eng: true}), 1);

// alignement des idx avec le serveur : type absent = événement, t/ms absents = illisible
const odd = parseJournal([JSON.stringify({t: 1, ms: 1, data: {}}), JSON.stringify({t: 2, type: "HIT", data: {}}), ev(3, "QUIT", {player: P("Bob")})].join("\n"));
assert.deepStrictEqual([odd.events.length, odd.unreadable], [2, 1]);

assert.strictEqual(parseTime("12:30"), 750);
assert.strictEqual(parseTime("12"), 720);
assert.strictEqual(parseTime(""), null);
assert.ok(Number.isNaN(parseTime("abc")));
console.log("OK");
