// The overlay: Shop, Flock, Share and, once a leaderboard is set up, Board. Words come from the theme, numbers from the pixel
// font, pictures from `art/`.
import { div, image } from "gpui-kit";
import { Input, h_flex, v_flex } from "gpui-base";
import { CATALOG, breedsOwned, canBuy, count, isLocked, owns, seasonsOwned, span } from "./game.js";
import { PIXEL_FONT, art, hillPreview } from "./scene.js";

const SIZES = { fence: [48, 39], tree: [48, 46], pine: [36, 44], pond: [76, 24], dog: [48, 39], barn: [76, 52], sheep: [72, 45] };

const SUMMER = { id: "season-summer", kind: "season", season: "summer", name: "Summer", art: "tree-summer" };

function thumb(item) {
  const kind = item.art.startsWith("sheep") ? "sheep" : item.art.startsWith("dog") ? "dog" : item.art.split("-")[0];
  const [w, h] = SIZES[kind];
  return div().w(76).h(52).flex().items_center().justify_center().flex_none().child(image(art(item.art)).w(w).h(h));
}

function button(id, words, on, t, press, solid = false) {
  return div().id(id).h(28).px(12).flex().items_center().rounded(6).text_size(12).font_medium()
    .bg(on && solid ? t.solid : t.raised)
    .text_color(on && solid ? t.solid_foreground : on ? t.foreground : t.dim)
    .when(on, (el) => el.hover((s) => s.opacity(0.85)).on_click(press))
    .child(words);
}

function card(item, view, t) {
  const state = view.state(), mine = owns(state, item.id), afford = canBuy(state, item);
  return h_flex().id(`card-${item.id}`).w(196).h(66).gap(6).px(6).items_center().rounded(8).bg(t.canvas).border_1().border_color(t.border)
    .child(thumb(item))
    .child(v_flex().flex_1().min_w(0).gap(4)
      .child(div().text_size(13).font_medium().text_color(t.foreground).truncate().child(item.name))
      .child(mine
        ? div().text_size(12).text_color(t.dim).child("Owned")
        : button(`buy-${item.id}`, `Buy ${count(item.price)}`, afford, t, (_e, cx) => view.purchase(item.id, cx), true).w(92).justify_center()));
}

// Summer comes with the hill. A season that's owned can be put on, one at a time.
function seasonCard(item, view, t) {
  const state = view.state(), active = state.season === item.season;
  if (!seasonsOwned(state).includes(item.season)) return card(item, view, t);
  return h_flex().id(`card-${item.id}`).w(196).h(66).gap(6).px(6).items_center().rounded(8).bg(active ? t.selected : t.canvas).border_1().border_color(active ? t.accent : t.border)
    .child(thumb(item))
    .child(v_flex().flex_1().min_w(0).gap(4)
      .child(div().text_size(13).font_medium().text_color(t.foreground).truncate().child(item.name))
      .child(active
        ? div().text_size(12).text_color(t.muted).child("In use")
        : button(`use-${item.season}`, "Use", true, t, (_e, cx) => view.pickSeason(item.season, cx)).w(92).justify_center()));
}

function section(title, t, rows) {
  return v_flex().gap(8).child(div().text_size(12).font_medium().text_color(t.muted).child(title)).child(rows);
}

function shopPage(view, t) {
  const state = view.state();
  const shown = (kinds) => CATALOG.filter((item) => kinds.includes(item.kind) && !isLocked(state, item));
  const grid = (items) => h_flex().flex_wrap().gap(8).children(items.map((item) => card(item, view, t)));
  const seasons = [SUMMER, ...shown(["season"])];
  return v_flex().id("shop-page").flex_1().min_h(0).gap(14).overflow_y_scrollbar()
    .child(section("Hill", t, grid(shown(["fence", "tree", "place"]))))
    .child(section("Sheep", t, grid(shown(["breed"]))))
    .child(section("Seasons", t, h_flex().flex_wrap().gap(8).children(seasons.map((item) => seasonCard(item, view, t)))));
}

// Wool's colour, dark enough to read on a light theme.
const amber = (view) => (view.look() === "dark" ? "#f2b950" : "#a86a10");

function stat(value, label, t, view, big = false) {
  return v_flex().flex_1().min_w(170).gap(6).p(14).rounded(8).bg(t.canvas).border_1().border_color(t.border)
    .child(div().font_family(PIXEL_FONT).text_size(big ? 40 : 24).text_color(big ? amber(view) : t.foreground).child(value))
    .child(div().text_size(12).text_color(t.muted).child(label));
}

function flockPage(view, t) {
  const s = view.state();
  return v_flex().id("flock-page").flex_1().min_h(0).gap(10)
    .child(h_flex().gap(10).child(stat(count(s.lifetime), "Lifetime wool", t, view, true)).child(stat(count(s.wool), "Wool to spend", t, view, true)))
    .child(h_flex().gap(10).child(stat(count(s.wolves), "Wolves driven off", t, view)).child(stat(span(s.longestMs), "Longest run", t, view)))
    .child(h_flex().gap(10).child(stat(count(s.turns), "Turns finished", t, view)).child(stat(count(s.peak), "Most sheep at once", t, view)))
    .child(hillPreview(s, view.look(), breedsOwned(s), 824));
}

function sharePage(view, t) {
  const shown = view.cardPath;
  return v_flex().id("share-page").flex_1().min_h(0).gap(12).items_center()
    .child(div().w(640).h(335).rounded(8).overflow_hidden().bg(t.canvas).border_1().border_color(t.border)
      .when(Boolean(shown), (el) => el.child(image(shown).size_full()))
      .when(!shown, (el) => el.flex().items_center().justify_center().text_size(12).text_color(t.dim).child(view.cardFailed ? "No card" : "Drawing")))
    .child(div().text_size(13).text_color(t.foreground).child(view.bragLine()))
    .child(h_flex().gap(8)
      .child(button("save-card", view.saving ? "Saving" : "Save card", Boolean(shown) && !view.saving, t, (_e, cx) => view.saveCard(cx), true))
      .child(button("copy-line", "Copy line", true, t, (_e, cx) => view.copyLine(cx))));
}

function boardRow(row, i, t, mine) {
  const cell = (words, w) => div().w(w).text_size(16).font_family(PIXEL_FONT).text_color(t.foreground).child(words);
  return h_flex().id(`row-${i}`).h(34).px(12).gap(10).items_center().rounded(6).bg(mine ? t.selected : t.canvas)
    .child(div().w(26).font_family(PIXEL_FONT).text_size(16).text_color(t.dim).child(`${i + 1}`))
    .child(div().flex_1().min_w(0).truncate().text_size(13).font_medium().text_color(t.foreground).child(row.nick))
    .child(cell(count(row.wool), 90))
    .child(cell(count(row.wolves), 60))
    .child(cell(span(row.longestMin * 60000), 80));
}

function boardPage(view, t) {
  const s = view.state(), rows = view.boardRows ?? [];
  const head = (words, w) => div().w(w).text_size(11).text_color(t.dim).child(words);
  return v_flex().id("board-page").flex_1().min_h(0).gap(10)
    .child(h_flex().gap(10).items_center()
      .child(button("board-toggle", `Share my score: ${s.boardOn ? "On" : "Off"}`, true, t, (_e, cx) => view.toggleBoard(cx), s.boardOn))
      .child(div().w(180).h(30).rounded(6).bg(t.canvas).border_1().border_color(t.input).px(8).flex().items_center().text_size(13).child(Input.new(view.nickInput)))
      .child(button("board-send", "Send", s.boardOn && view.nickOk(), t, (_e, cx) => view.sendBoard(cx), true)))
    .child(h_flex().px(12).gap(10).child(div().w(26)).child(div().flex_1().text_size(11).text_color(t.dim).child("Nickname")).child(head("Wool", 90)).child(head("Wolves", 60)).child(head("Longest", 80)))
    .child(v_flex().flex_1().min_h(0).gap(4).overflow_y_scrollbar().children(rows.map((row, i) => boardRow(row, i, t, row.nick === s.nick))));
}

function tab(id, words, view, t) {
  const on = view.page === id;
  return div().id(`tab-${id}`).h(30).px(12).flex().items_center().rounded(6).text_size(13).font_medium()
    .bg(on ? t.selected : "#00000000").text_color(on ? t.foreground : t.muted)
    .when(!on, (el) => el.hover((s) => s.bg(t.hover)).on_click((_e, cx) => view.goTo(id, cx)))
    .child(words);
}

function header(view, t) {
  const s = view.state(), pages = [["shop", "Shop"], ["flock", "Flock"], ["share", "Share"]];
  if (view.boardShown()) pages.push(["board", "Board"]);
  return h_flex().h(36).gap(14).items_center().flex_none()
    .child(div().font_family(PIXEL_FONT).text_size(24).text_color(t.foreground).child("Woolhill"))
    .when(view.demo, (el) => el.child(div().px(6).py(2).rounded(4).bg(t.raised).text_size(11).text_color(t.dim).child("Demo data")))
    .child(h_flex().gap(2).children(pages.map(([id, words]) => tab(id, words, view, t))))
    .child(div().flex_1())
    .when(view.needsStrip(), (el) => el.child(button("place-strip", "Add the hill to this window", true, t, (_e, cx) => view.placeStrip(cx))))
    .child(h_flex().gap(6).items_center().child(image(art("tuft")).w(27).h(21)).child(div().font_family(PIXEL_FONT).text_size(24).text_color(amber(view)).child(count(s.wool))));
}

export function overlayView(view, t) {
  const page = view.page === "flock" ? flockPage(view, t) : view.page === "share" ? sharePage(view, t) : view.page === "board" ? boardPage(view, t) : shopPage(view, t);
  return v_flex().id("root").size_full().bg(t.popover).p(18).gap(12).text_color(t.foreground)
    .child(header(view, t))
    .child(page)
    .when(Boolean(view.note), (el) => el.child(div().flex_none().text_size(12).text_color(view.note?.bad ? t.blocked : t.muted).child(view.note?.text ?? "")));
}
