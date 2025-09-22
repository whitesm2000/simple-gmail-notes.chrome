$(document).ready(function(){
  var SGNP = SimpleGmailNotes;

  if (chrome.action && typeof chrome.action.setBadgeText === 'function') {
    chrome.action.setBadgeText({text: ''});
  } else if (SGNC.getBrowser().browserAction && SGNC.getBrowser().browserAction.setBadgeText) {
    SGNC.getBrowser().browserAction.setBadgeText({"text": ""});
  }

  $(".sgn-menu-table a").attr("target", "_blank");

  $("#open_options").click(function(){
    openTab("options.html");
    return false;
  });

  $("#open_help").click(function(){
    openTab("options.html");
    return false;
  });

  $("#review").click(function(){
    var url = SGNP.getReviewUrl();
    window.open(url, "_blank");
    return false;
  });

  $("#support").click(function(){
    var url = SGNP.getSupportUrl();
    window.open(url, "_blank");
    return false;
  });


});
