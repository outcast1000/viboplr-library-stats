"use strict";
// The host-drawn view header (api.ui.setViewHeader, host >= 1.0.77): the pure
// viewHeaderFor(state), and that activate() uses it instead of its own title
// row only when the host supports it.
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

const ts = (y, m, d) => Math.floor(new Date(y, m, d, 12).getTime() / 1000);
const snap = { totalTracks: 12340, playCount: 48211, firstTs: ts(2024, 2, 15), computedAt: ts(2026, 8, 29) };

test("manifest declares a one-line viewHeader subtitle", () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.ok(m.viewHeader && typeof m.viewHeader.subtitle === "string");
  assert.ok(m.viewHeader.subtitle.length > 0 && m.viewHeader.subtitle.length <= 160);
});

test("viewHeaderFor: no snapshot keeps the manifest subtitle and offers no Refresh", () => {
  const h = loadPlugin()._viewHeaderFor({ snapshot: null, computing: false, error: null });
  assert.ok(!("subtitle" in h), "manifest subtitle stays");
  assert.strictEqual(h.status, null);
  assert.deepStrictEqual(h.actions, []);
});

test("viewHeaderFor: a snapshot summarises tracks, plays and the build date", () => {
  const h = loadPlugin()._viewHeaderFor({ snapshot: snap, computing: false, error: null });
  assert.strictEqual(h.subtitle, "12,340 tracks · 48,211 plays since Mar 2024 · Updated Sep 29, 2026");
  assert.strictEqual(h.status, null);
  assert.deepStrictEqual(h.actions, [{ label: "Refresh", action: "refresh", variant: "secondary", disabled: false }]);
  assert.ok(h.subtitle.length <= 160);
});

test("viewHeaderFor: no plays omits the plays part", () => {
  const h = loadPlugin()._viewHeaderFor({
    snapshot: { totalTracks: 5, playCount: 0, computedAt: snap.computedAt },
    computing: false,
  });
  assert.strictEqual(h.subtitle, "5 tracks · Updated Sep 29, 2026");
});

test("viewHeaderFor: computing shows progress and disables Refresh", () => {
  const partial = { totalTracks: 12340, playCount: 1000, firstTs: snap.firstTs };
  const h = loadPlugin()._viewHeaderFor({ snapshot: partial, computing: true, progress: { done: 1000, total: 4000 } });
  assert.deepStrictEqual(h.status, { variant: "muted", label: "Computing… 25%" });
  assert.strictEqual(h.actions[0].disabled, true);
  assert.ok(!/Updated/.test(h.subtitle));
  const first = loadPlugin()._viewHeaderFor({ snapshot: null, computing: true, progress: { done: 0, total: 0 } });
  assert.deepStrictEqual(first.status, { variant: "muted", label: "Computing…" });
  assert.deepStrictEqual(first.actions, []);
});

test("viewHeaderFor: an error shows a Failed status", () => {
  const h = loadPlugin()._viewHeaderFor({ snapshot: snap, computing: false, error: "boom" });
  assert.deepStrictEqual(h.status, { variant: "error", label: "Failed" });
});

function mockApi(withHeader) {
  const calls = { views: [], headers: [] };
  const api = {
    ui: {
      setViewData: (id, data) => calls.views.push({ id, data }),
      onAction: () => {},
    },
    // Never resolves: activate renders the "Loading…" state synchronously.
    storage: { get: () => new Promise(() => {}), set: () => Promise.resolve() },
    library: {},
    playback: {},
  };
  if (withHeader) api.ui.setViewHeader = (id, h) => calls.headers.push({ id, h });
  return { api, calls };
}

const mainViews = (calls) => calls.views.filter((v) => v.id === "library-stats");
const hasToolbar = (data) => data.children.some((n) => n.type === "toolbar");

test("activate: with setViewHeader the view drops its own title row and pushes the header once", () => {
  const { api, calls } = mockApi(true);
  loadPlugin().activate(api);
  const main = mainViews(calls);
  assert.ok(main.length > 0);
  assert.ok(main.every((v) => !hasToolbar(v.data)), "no self-drawn title row");
  assert.strictEqual(calls.headers.length, 1, "change-gated: an identical header is not re-sent");
  assert.strictEqual(calls.headers[0].id, "library-stats");
});

test("activate: older hosts keep the toolbar title row", () => {
  const { api, calls } = mockApi(false);
  loadPlugin().activate(api);
  const main = mainViews(calls);
  assert.ok(main.length > 0 && main.every((v) => hasToolbar(v.data)));
});
