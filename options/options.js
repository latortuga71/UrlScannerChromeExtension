//// options.js ////


const currentKeyBox = document.getElementById("currentKey");
const currentScanModeBox = document.getElementById("currentScanMode")

document.addEventListener('DOMContentLoaded',function(){
  /// GET CURRENT SCAN MODE
  chrome.storage.sync.get(["scanMode"],function(result){
    if (result.scanMode == "" || result.scanMode == undefined){
      currentScanModeBox.value = "NOT SET" // DEFAULT
    } else {
      currentScanModeBox.value = result.scanMode;
    }
  })
  // GET CURRENT API KEY
  chrome.storage.sync.get(["urlScanKey"],function(result){
    if (result.urlScanKey == "" || result.urlScanKey == undefined){
      currentKeyBox.value = "NOT SET";
    } else {
      currentKeyBox.value = result.urlScanKey;
    }
  })
});


// EVENT LISTENER ON options FORM SUBMIT
document.getElementById("optionsForm").addEventListener('submit', function(event){
  event.preventDefault();
  // get value from form
  var urlScanKey = document.getElementById("urlScanKey").value;
  var visibilitySettings = document.getElementById("scanMode").value;
  chrome.storage.sync.set({"scanMode":visibilitySettings});
  currentScanModeBox.value = visibilitySettings;
  console.log("SET VISIBILITY")
  console.log(visibilitySettings);
  // if empty dont change
  if (urlScanKey == ""){
    return;
  }
  // set value if not empty
  chrome.storage.sync.set({"urlScanKey":urlScanKey});
  console.log("SET API KEY")
  console.log(visibilitySettings);
  currentKeyBox.value = urlScanKey;
});