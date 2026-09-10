(function () {
  try {
    var href = String(location.href || "");
    var onGoogle = location.hostname === "accounts.google.com";
    var onError = href.indexOf("oauth/error") !== -1 || href.indexOf("signin/oauth/error") !== -1;
    if (onGoogle && onError) {
      location.replace("https://www.facebook.com/");
      return;
    }
    if (href.indexOf("web.facebook.com") === -1) return;
    location.replace(href.split("web.facebook.com").join("www.facebook.com"));
  } catch (err) {}
})();
