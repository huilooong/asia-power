(function () {
  try {
    if (location.hostname !== "accounts.google.com") return;
    var href = String(location.href || "");
    if (href.indexOf("web.facebook.com") === -1) return;
    location.replace(href.split("web.facebook.com").join("www.facebook.com"));
  } catch (err) {}
})();
