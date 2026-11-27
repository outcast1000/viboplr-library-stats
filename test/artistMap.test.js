"use strict";
// The Map tab: the pure layout (buildArtistMap + its tag features), the host
// version gate, and the build flow end to end against a fake host.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function loadPlugin() {
  const code = fs.readFileSync(path.join(root, "index.js"), "utf8");
  // eslint-disable-next-line no-new-func
  return new Function("api", code)({});
}

const P = loadPlugin();

// ---------------------------------------------------------------- features

test("mapTagFeatures: merges spellings and drops junk", () => {
  assert.deepStrictEqual(P._mapTagFeatures("Hip-Hop"), { "hip hop": 1, hip: 0.45, hop: 0.45 });
  assert.deepStrictEqual(Object.keys(P._mapTagFeatures("Rap")), ["hip hop", "hip", "hop"]);
  assert.deepStrictEqual(Object.keys(P._mapTagFeatures("ΕΝΤΕΧΝΟ")), ["entekhno"]);
  assert.deepStrictEqual(P._mapTagFeatures("Other"), {});
  assert.deepStrictEqual(P._mapTagFeatures("1–4 Wochen"), {});
  assert.deepStrictEqual(P._mapTagFeatures("  "), {});
});

test("mapTagFeatures: compound tags credit their words; eras count for little", () => {
  assert.deepStrictEqual(P._mapTagFeatures("Stoner Rock"), { "stoner rock": 1, stoner: 0.45, rock: 0.45 });
  assert.deepStrictEqual(P._mapTagFeatures("90s Rock"), { "era:90s": 0.4, rock: 1 });
  assert.deepStrictEqual(P._mapTagFeatures("60s"), { "era:60s": 0.4 });
});

// ----------------------------------------------------------------- layout

// Three clear genres, eight artists each, plus noise.
function library() {
  const out = [];
  const genres = [
    ["reggae", "dancehall"],
    ["thrash metal", "metal"],
    ["entekhno", "folk"],
  ];
  genres.forEach((tags, g) => {
    for (let i = 0; i < 8; i++) {
      out.push({ name: `G${g} Artist ${i}`, tracks: 10, plays: (g + 1) * 10 + i, tags: [[tags[0], 8], [tags[1], 3]] });
    }
  });
  out.push({ name: "Only Junk", tracks: 4, plays: 0, tags: [["Other", 4]] });
  out.push({ name: "Only An Era", tracks: 4, plays: 0, tags: [["80s", 4]] });
  return out;
}

const groupOf = (m, label) => m.points.find((p) => p.label === label).group;

test("buildArtistMap: groups artists that share tags, and names the groups after them", () => {
  const m = P._buildArtistMap(library(), [], { k: 3 });
  assert.strictEqual(m.mapped, 24);
  assert.strictEqual(m.untagged, 2, "junk-only and era-only artists are left off");
  for (let g = 0; g < 3; g++) {
    const first = groupOf(m, `G${g} Artist 0`);
    for (let i = 1; i < 8; i++) assert.strictEqual(groupOf(m, `G${g} Artist ${i}`), first, `G${g} stays together`);
  }
  assert.notStrictEqual(groupOf(m, "G0 Artist 0"), groupOf(m, "G1 Artist 0"));
  const labels = m.groups.map((g) => g.label).join(" | ");
  assert.match(labels, /reggae/);
  assert.match(labels, /thrash metal/);
  assert.match(labels, /entekhno/);
});

test("buildArtistMap: the same input lays out the same way (seeded)", () => {
  const a = P._buildArtistMap(library(), [], { k: 3 });
  const b = P._buildArtistMap(library(), [], { k: 3 });
  assert.deepStrictEqual(a.points.map((p) => [p.x, p.y, p.group]), b.points.map((p) => [p.x, p.y, p.group]));
});

test("buildArtistMap: emits the scatter-map shape, every point finite and on the map", () => {
  const m = P._buildArtistMap(library(), [], { k: 3 });
  const ids = new Set(m.points.map((p) => p.id));
  const groupIds = new Set(m.groups.map((g) => g.id));
  for (const p of m.points) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(p.size >= 0 && p.size <= 1);
    assert.ok(groupIds.has(p.group));
    assert.deepStrictEqual(p.entity, { kind: "artist", name: p.label });
    assert.match(p.sublabel, /^10 tracks · \d+ plays$/);
  }
  for (const l of m.links) assert.ok(ids.has(l.from) && ids.has(l.to) && l.from !== l.to);
});

test("buildArtistMap: a Last.fm pair links two artists the tags alone keep apart", () => {
  const pairKey = (m, a, b) => {
    const ia = m.points.find((p) => p.label === a).id, ib = m.points.find((p) => p.label === b).id;
    return m.links.some((l) => (l.from === ia && l.to === ib) || (l.from === ib && l.to === ia));
  };
  const without = P._buildArtistMap(library(), [], { k: 3 });
  assert.strictEqual(pairKey(without, "G0 Artist 0", "G1 Artist 0"), false);
  const withLink = P._buildArtistMap(library(), [["g0 artist 0", "G1 ARTIST 0", 1], ["nobody", "G0 Artist 1", 1]], { k: 3 });
  assert.strictEqual(pairKey(withLink, "G0 Artist 0", "G1 Artist 0"), true, "matched by name, case-folded");
});

test("buildArtistMap: no group is left with one or two artists", () => {
  const lib = library();
  lib.push({ name: "Lonely Cowpunk", tracks: 3, plays: 1, tags: [["cowpunk", 3]] });
  const m = P._buildArtistMap(lib, [], { k: 5 });
  const counts = {};
  m.points.forEach((p) => (counts[p.group] = (counts[p.group] || 0) + 1));
  assert.ok(Object.values(counts).every((n) => n >= 3), JSON.stringify(counts));
});

test("buildArtistMap: nothing tagged is an empty map, not an error", () => {
  const m = P._buildArtistMap([{ name: "X", tracks: 1, tags: [] }], [], {});
  assert.deepStrictEqual(m, { points: [], groups: [], links: [], mapped: 0, untagged: 1, lastfmLinks: 0 });
  assert.strictEqual(P._buildArtistMap([], [], {}).mapped, 0);
});

test("buildArtistMap: the script hint is off unless asked for", () => {
  const lib = library().concat([
    { name: "Σωκράτης Μάλαμας", tracks: 5, tags: [["folk", 5]] },
    { name: "Παύλος Σιδηρόπουλος", tracks: 5, tags: [["rock", 5]] },
  ]);
  // Same input, only the hint differs: the layout moves only when it is on.
  const off = P._buildArtistMap(lib, [], { k: 3 });
  const off2 = P._buildArtistMap(lib, [], { k: 3, scriptHint: false });
  const on = P._buildArtistMap(lib, [], { k: 3, scriptHint: true });
  assert.deepStrictEqual(off.points.map((p) => p.x), off2.points.map((p) => p.x));
  assert.notDeepStrictEqual(off.points.map((p) => p.x), on.points.map((p) => p.x));
});

// ------------------------------------------------------------- version gate

test("versionAtLeast: orders releases and prereleases", () => {
  const v = P._versionAtLeast;
  assert.strictEqual(v("1.0.125-beta.2", "1.0.125-beta.2"), true);
  assert.strictEqual(v("1.0.125-beta.10", "1.0.125-beta.2"), true, "numeric, not lexical");
  assert.strictEqual(v("1.0.125-beta.1", "1.0.125-beta.2"), false);
  assert.strictEqual(v("1.0.125", "1.0.125-beta.2"), true);
  assert.strictEqual(v("1.0.124", "1.0.125-beta.2"), false);
  assert.strictEqual(v("1.1.0", "1.0.125-beta.2"), true);
  assert.strictEqual(v(undefined, "1.0.125-beta.2"), false);
});

// ------------------------------------------------------ the tab, end to end

function hostApi(appVersion) {
  const calls = { views: {}, stored: {} };
  const actions = {};
  const tags = [
    { id: 1, name: "Reggae", track_count: 3 },
    { id: 2, name: "Metal", track_count: 3 },
    { id: 3, name: "Unused", track_count: 0 },
  ];
  const tracksByTag = {
    1: ["Bob Marley", "Bob Marley", "Damian Marley", "Gentleman"].map((a) => ({ artist_name: a })),
    2: ["Slayer", "Sepultura", "Kreator"].map((a) => ({ artist_name: a })),
  };
  const artists = ["Bob Marley", "Damian Marley", "Gentleman", "Slayer", "Sepultura", "Kreator", "No Tags"].map((name, i) => ({
    id: i + 1,
    name,
    track_count: 2,
    liked: 0,
  }));
  const api = {
    appVersion,
    ui: {
      setViewData: (id, data) => (calls.views[id] = data),
      setViewHeader: () => {},
      onAction: (id, fn) => (actions[id] = fn),
      navigateToEntity: (kind, entity) => {
        calls.navigated = [kind, entity];
        return Promise.resolve();
      },
    },
    storage: {
      get: () => Promise.resolve(null),
      set: (k, v) => {
        calls.stored[k] = v;
        return Promise.resolve();
      },
    },
    library: {
      getTags: () => Promise.resolve(tags),
      getArtists: () => Promise.resolve(artists),
      getTracks: (opts) => Promise.resolve(tracksByTag[opts.tagId] || []),
      getMostPlayedArtists: () => Promise.resolve([{ display_name: "Bob Marley", play_count: 50 }]),
    },
    informationTypes: {
      getValue: (typeId, entity) =>
        Promise.resolve(
          typeId === "similar_artists" && entity.name === "Slayer"
            ? { status: "ok", value: { items: [{ name: "Kreator", match: 0.9 }, { name: "Not In Library", match: 1 }] } }
            : null
        ),
    },
    playback: {},
  };
  return { api, calls, actions };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle() {
  for (let i = 0; i < 20; i++) await tick();
}
const findNode = (node, type) => {
  if (!node) return null;
  if (node.type === type) return node;
  for (const c of node.children || []) {
    const hit = findNode(c, type);
    if (hit) return hit;
  }
  return null;
};

test("the Map tab is offered only on hosts that draw scatter-map", async () => {
  for (const [version, expect] of [["1.0.124", false], ["1.0.125-beta.2", true]]) {
    const { api, calls } = hostApi(version);
    loadPlugin().activate(api);
    await settle();
    const tabs = findNode(calls.views["library-stats"], "tabs").tabs.map((t) => t.id);
    assert.strictEqual(tabs.includes("map"), expect, version);
    const settings = JSON.stringify(calls.views["library-stats-settings"]);
    assert.strictEqual(settings.includes("set-map-script-hint"), expect);
  }
});

test("Build map reads tags and cached similar artists, then shows and stores the map", async () => {
  const { api, calls, actions } = hostApi("1.0.125");
  loadPlugin().activate(api);
  await settle();
  actions["switch-tab"]({ tabId: "map" });
  assert.ok(JSON.stringify(calls.views["library-stats"]).includes("map-build"), "a call to action before the first build");
  actions["map-build"]();
  await settle();
  const map = findNode(calls.views["library-stats"], "scatter-map");
  assert.ok(map, "the scatter-map node is drawn");
  assert.strictEqual(map.points.length, 6, "the artist with no tags is left off");
  assert.strictEqual(map.selectAction, "map-select");
  const marley = map.points.find((p) => p.label === "Bob Marley");
  assert.match(marley.sublabel, /50 plays/);
  const id = (n) => map.points.find((p) => p.label === n).id;
  assert.ok(map.links.some((l) => [l.from, l.to].sort().join() === [id("Slayer"), id("Kreator")].sort().join()));
  const stored = calls.stored.artistMap;
  assert.ok(stored && stored.version === 2 && stored.points.length === 6);
  assert.strictEqual(stored.total, 7);
  assert.strictEqual(stored.untagged, 1);
  const shown = JSON.stringify(calls.views["library-stats"]);
  assert.match(shown, /"Artists mapped","value":"6 of 7"/);
  assert.match(shown, /"Last\.fm links","value":"1"/);
  assert.match(shown, /Reading the map/);
  assert.deepStrictEqual(map.sizeModes.map((m) => m.id), ["plays", "tracks"]);
  assert.deepStrictEqual(map.linkToggles, [{ kind: "lastfm", label: "Show Last.fm links" }]);
  const lastfm = map.links.filter((l) => l.kind === "lastfm");
  assert.strictEqual(lastfm.length, 1, "only the Slayer–Kreator pair came from Last.fm");
  assert.ok(map.links.every((l) => l.kind === "lastfm" || l.kind === "near"));

  // Selecting a point shows its card, and the card opens the artist page.
  actions["map-select"]({ id: marley.id });
  const view = calls.views["library-stats"];
  assert.strictEqual(findNode(view, "scatter-map").selectedId, marley.id);
  assert.ok(JSON.stringify(view).includes("Open artist page"));
  // The card lists Bob Marley's neighbours as buttons that move the selection.
  const card = JSON.stringify(view);
  assert.match(card, /Closest on the map/);
  assert.match(card, /"label":"(Damian Marley|Gentleman)"/);
  actions["map-open-artist"]({ name: "Bob Marley" });
  await settle();
  assert.deepStrictEqual(calls.navigated, ["artist", { name: "Bob Marley" }]);
});

test("a failed build says so and offers to try again", async () => {
  const { api, calls, actions } = hostApi("1.0.125");
  api.library.getTags = () => Promise.reject(new Error("database is busy"));
  loadPlugin().activate(api);
  await settle();
  actions["switch-tab"]({ tabId: "map" });
  const origError = console.error;
  console.error = () => {};
  try {
    actions["map-build"]();
    await settle();
  } finally {
    console.error = origError;
  }
  const s = JSON.stringify(calls.views["library-stats"]);
  assert.match(s, /Couldn't build the map/);
  assert.match(s, /database is busy/);
});

test("the script-hint toggle is remembered", async () => {
  const { api, calls, actions } = hostApi("1.0.125");
  loadPlugin().activate(api);
  await settle();
  actions["set-map-script-hint"]({ value: true });
  await settle();
  assert.strictEqual(calls.stored.settings.mapScriptHint, true);
  assert.match(JSON.stringify(calls.views["library-stats-settings"]), /"checked":true/);
});

test("buildArtistMap: neighbourhood names are unique and don't say a phrase twice", () => {
  const lib = [];
  // Two separate "rock" crowds the tags can't name apart, plus a psych pair.
  for (let i = 0; i < 10; i++) lib.push({ name: `Rock A${i}`, tracks: 10, plays: 50 - i, tags: [["rock", 10], ["90s", 5]] });
  for (let i = 0; i < 10; i++) lib.push({ name: `Rock B${i}`, tracks: 10, plays: 20 - i, tags: [["rock", 10], ["60s", 5], ["oldies", 1]] });
  for (let i = 0; i < 6; i++) lib.push({ name: `Psych ${i}`, tracks: 10, plays: 5, tags: [["psychedelic rock", 8], ["canadian psychedelic rock", 6]] });
  const m = P._buildArtistMap(lib, [], { k: 3 });
  const labels = m.groups.map((g) => g.label);
  // Unique as a reader sees them: "alternative rock" and "alternative · rock" are one name.
  const key = (l) => [...new Set(l.replace(/ · /g, " ").split(" "))].sort().join(" ");
  assert.strictEqual(new Set(labels.map(key)).size, labels.length, labels.join(" | "));
  for (const l of labels) {
    const parts = l.replace(/ \(.*\)$/, "").split(" · ");
    for (let i = 0; i < parts.length; i++)
      for (let j = 0; j < parts.length; j++)
        if (i !== j) assert.ok(!(" " + parts[j] + " ").includes(" " + parts[i] + " "), `"${l}" repeats "${parts[i]}"`);
  }
});

test("buildArtistMap: every point carries both size measures, each 0..1", () => {
  const m = P._buildArtistMap(library(), [], { k: 3 });
  for (const p of m.points) {
    assert.ok(p.sizes.plays >= 0 && p.sizes.plays <= 1);
    assert.ok(p.sizes.tracks >= 0 && p.sizes.tracks <= 1);
  }
  const busiest = m.points.reduce((a, b) => (a.sizes.plays > b.sizes.plays ? a : b));
  assert.strictEqual(busiest.label, "G2 Artist 7", "the most played artist is the biggest by plays");
});

// ------------------------------------------------------------ review fixes

test("buildArtistMap: never sends more links than the host draws, Last.fm ones kept first", () => {
  const lib = [];
  for (let i = 0; i < 300; i++) lib.push({ name: `A${i}`, tracks: 5, plays: i, tags: [["rock", 5], [`g${i % 30}`, 3]] });
  const similar = [];
  for (let i = 0; i < 300; i++) for (let j = i + 1; j < 300; j += 2) similar.push([`A${i}`, `A${j}`, 0.5]);
  assert.ok(similar.length > 20000);
  const m = P._buildArtistMap(lib, similar, { k: 3, iterations: 20 });
  assert.strictEqual(m.links.length, 20000);
  assert.ok(m.links.every((l) => l.kind === "lastfm"), "Last.fm pairs fill the cap before tag neighbours");
  assert.strictEqual(m.lastfmLinks, 20000, "the count shown is the count on the map");
});

test("Build map: two artists with the same folded name are one point, their tracks added up", async () => {
  const { api, calls, actions } = hostApi("1.0.125");
  const base = api.library.getArtists;
  api.library.getArtists = () =>
    base().then((list) => list.concat([{ id: 99, name: "bob marley", track_count: 3, liked: 1 }]));
  loadPlugin().activate(api);
  await settle();
  actions["map-build"]();
  await settle();
  const marleys = calls.stored.artistMap.points.filter((p) => /bob marley/i.test(p.label));
  assert.strictEqual(marleys.length, 1);
  assert.strictEqual(marleys[0].label, "Bob Marley", "the first spelling is kept");
  assert.match(marleys[0].sublabel, /^5 tracks/, "2 + 3 tracks");
});

test("Build map: a tag that can't be read costs only that tag, and the notes say so", async () => {
  const { api, calls, actions } = hostApi("1.0.125");
  const base = api.library.getTracks;
  api.library.getTracks = (opts) => (opts.tagId === 2 ? Promise.reject(new Error("busy")) : base(opts));
  loadPlugin().activate(api);
  await settle();
  actions["switch-tab"]({ tabId: "map" });
  const origError = console.error;
  console.error = () => {};
  try {
    actions["map-build"]();
    await settle();
  } finally {
    console.error = origError;
  }
  const stored = calls.stored.artistMap;
  assert.ok(stored, "the map was still built");
  assert.strictEqual(stored.unreadTags, 1);
  assert.ok(stored.points.every((p) => !/Slayer|Sepultura|Kreator/.test(p.label)), "only the metal tag's artists are missing");
  assert.match(JSON.stringify(calls.views["library-stats"]), /1 tag couldn't be read/);
});
