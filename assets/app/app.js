import "phoenix_html";
import Turbolinks from "turbolinks";
import { u, ajax } from "umbrellajs";
import autosize from "autosize";
import Cookies from "cookies-js";
import OnsitePlayer from "modules/onsitePlayer";
import LivePlayer from "modules/livePlayer";
import Overlay from "modules/overlay";
import ImageButton from "modules/imageButton";
import Share from "modules/share";
import Log from "modules/log";
import Tooltip from "modules/tooltip";
import ts from "../shared/ts";
import gup from "../shared/gup";
import parseTime from "../shared/parseTime";

const player = new OnsitePlayer("#player");
const live = new LivePlayer(".js-live");
const overlay = new Overlay("#overlay");

window.u = u;

u(document).handle("click", ".js-toggle-nav", function(event) {
  u("body").toggleClass("nav-open");

  setTimeout(() => {
    u("body").toggleClass('nav-animate', "");
  }, 50);
});

u(document).handle("click", ".js-account-nav", function(event) {
  const content = u(".js-account-nav-content").html();
  overlay.html(content).show();
});

u(document).handle("click", ".podcast-summary-widget_toggle", function(event) {
  u(event.target).siblings(".podcast-summary-widget_menu").toggleClass("podcast-summary-widget_menu--is-open");
});

u(document).on("click", "[data-play]", function(event) {
  if (player.canPlay()) {
    event.preventDefault();
    const clicked = u(event.target).closest("a, button");

    if (player.currentlyLoaded == clicked.data("play")) {
      player.togglePlayPause();
    } else {
      player.load(clicked.attr("href"), clicked.data("play"));
    }
  }
});

u(document).handle("click", "[data-image]", function(event) {
  new ImageButton(this);
});

u(document).handle("click", "[data-share]", function(event) {
  new Share(overlay).load(u(this).data("share"));
});

// open share dialogs in their own window (order matters or next rule will apply)
u(document).handle("click", ".js-share-popup", function(event) {
  Log.track("Share");
  var h, href, left, shareWindow, top, w;
  href = u(event.target).attr("href");
  w = 600;
  h = 300;
  left = (screen.width / 2) - (w / 2);
  top = (screen.height / 2) - (h / 2);
  shareWindow = window.open(href, "Changelog", `location=1,status=1,scrollbars=1,width=${w},height=${h},top=${top},left=${left}`);
  shareWindow.opener = null;
});

// track outbound clicks
u(document).on("click", "[rel=external]", function(event) {
  let type = u(this).closest("[data-news-type]").data("news-type");
  let id = u(this).closest("[data-news-id]").data("news-id");

  if (id) {
    event.preventDefault();
    let href = `/${type}/${id}/visit`;

    if (player.isActive()) {
      let newWindow = window.open(href, "_blank");
      newWindow.opener = null;
    } else {
      window.location = href;
    }
  }
});

// open external links in new window when player is doing its thing
u(document).on("click", "a[href^=http]", function(event) {
  if (player.isActive()) {
    let href = u(this).attr("href");
    if (!href.match(location.hostname)) {
      event.preventDefault();
      let newWindow = window.open(href, "_blank");
      newWindow.opener = null;
    }
  }
});

// hide subscribe CTA
u(document).handle("click", ".js-hide-subscribe", function(event) {
  Cookies.set("hide_subscribe_cta", "true");
  u(this).closest("section").remove();
});

// hijack audio deep links
u(document).on("click", "a[href^=\\#t]", function(event) {
  let href = u(event.target).attr("href");

  if (deepLink(href)) {
    event.preventDefault();
    history.replaceState({}, document.title, href);
  };
});

// submit Campain Monitor forms via jsonp
u(document).on("submit", "form.js-cm", function(event) {
  event.preventDefault();

  const form = u(this);
  const status = form.find(".form_submit_responses");
  const scriptSrc = form.attr("action") + "?callback=afterSubscribe&" + form.serialize();

  status.html("<div class='form_submit_response'>Sending...</div>");

  window.afterSubscribe = function(data) {
    if (data.Status == 200) {
      Turbolinks.visit(data.RedirectUrl);
    } else {
      status.html(`<div class="form_submit_response form_submit_response--error">${data.Message}</div>`);
    }
  }

  if (u(`script[src='${scriptSrc}']`).length == 0) {
    const script = document.createElement("script");
    script.src = scriptSrc;
    document.body.appendChild(script);
  }
});

// submit all other forms with Turbolinks
u(document).on("submit", "form:not(.js-cm)", function(event) {
  event.preventDefault();

  const form = u(this);
  const action = form.attr("action");
  const method = form.attr("method");
  const data = form.serialize();
  const referrer = location.href;

  if (method == "get") {
    return Turbolinks.visit(`${action}?${data}`);
  }

  const options = {method: method, body: data, headers: {"Turbolinks-Referrer": referrer}};
  const andThen = function(err, resp, req) {
    if (req.getResponseHeader("content-type").match(/javascript/)) {
      eval(resp);
    } else {
      const snapshot = Turbolinks.Snapshot.wrap(resp);
      Turbolinks.controller.cache.put(referrer, snapshot);
      Turbolinks.visit(referrer, {action: "restore"});
    }
  }

  ajax(action, options, andThen);
});

function formatTimes() {
  u("span.time").each(function(el) {
    let span = u(el);
    let date = new Date(span.text());
    let style = span.data("style");
    span.text(ts(date, style));
    span.attr("title", ts(date, "timeFirst"));
    span.removeClass("time");
  });
}

function impress() {
  let ads = Array.from(document.querySelectorAll("[data-news-type=ad]"));
  let items = Array.from(document.querySelectorAll("[data-news-type=news]"));

  if (ads.length) {
    let adIds = ads.map(function(x) { return u(x).data("news-id"); });
    let options = {
      method: "POST",
      headers: {"x-csrf-token": u("[property=csrf]").attr("content")},
      body: {"ads": adIds}
    };
    ajax("/ad/impress", options);
  }

  if (items.length) {
    let itemIds = items.map(function(x) { return u(x).data("news-id"); });
    let options = {
      method: "POST",
      headers: {"x-csrf-token": u("[property=csrf]").attr("content")},
      body: {"items": itemIds}
    };
    ajax("/news/impress", options);
  }
}

function deepLink(href) {
  let linkTime = parseTime(gup("t", (href || location.href), "#"));
  if (!linkTime) return false;

  if (player.isPlaying()) {
    player.scrubEnd(linkTime);
  } else {
    let playable = u("[data-play]");
    player.load(playable.attr("href"), playable.data("play"), function() {
      player.scrubEnd(linkTime);
    });
  }

  return true;
}

window.onresize = function() {
}

window.onhashchange = function() {
  deepLink();
}

// on page load
u(document).on("turbolinks:load", function() {
  autosize(document.querySelectorAll("textarea"));
  new Tooltip(".has-tooltip");
  u("body").removeClass("nav-open");
  player.attach();
  overlay.hide();
  live.check();
  formatTimes();
  deepLink();
  impress();
});

Turbolinks.start();
