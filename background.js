/// GLOBALS
var globalLoopCounter = 0;
var globalUrlReportArray = [];
var globalScanMode;
var globalApiKey;

var context = ["link"];
var title = "Scan url for threats.";

GetApiKeyFromStorage();
GetScanModeFromStorage();

// Create link context menu
chrome.contextMenus.create({
    "title": title,
    contexts:context,
});  

chrome.runtime.onInstalled.addListener(reason => {
    if (chrome.runtime.openOptionsPage){
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chroem.runtime.getURL('options/options.html'))
    }
});

// WHEN EXTENSION IS STARTED
chrome.runtime.onStartup.addListener(function() {
    GetApiKeyFromStorage();
    GetScanModeFromStorage();
})

// WHEN CONTEXT MENU ON LINKS IS CLICKED
chrome.contextMenus.onClicked.addListener(function(info){
    doUrlScanFromLinkContext(info.linkUrl)
})

// WHEN API IS CHANGED ON OPTIONS
chrome.storage.onChanged.addListener(function (changes, namespace) {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
      if (namespace == "sync" && key == "urlScanKey"){
          globalApiKey = newValue;
      }
      if (namespace == "sync" && key == "scanMode"){
        globalScanMode = newValue;
      }
    }
});

// WHEN POPUP.JS SENDS URL OR APIKEY TO BACKGROUND.JS
chrome.runtime.onMessage.addListener(function(request,sender,sendResponse){
    if (request.url != ""){
        doUrlScanFromPopup(request.url,sendResponse);
    } else {
        sendResponse({Error:"Provided Url is empty"})
    }
    return true;
})

// WHEN NOTIFICATION BUTTON IS CLICKED
chrome.notifications.onButtonClicked.addListener(function(notifId, btnIdx) {
    var url;
    var index;
    for (var x=0; x < globalUrlReportArray.length; x ++){
        var dict = globalUrlReportArray[x]
        for (var k in dict){
            if (k === notifId){
                index = x
                url = dict[k]
            }
        }
    }
    if (btnIdx === 0) {
        globalUrlReportArray.splice(index,1);
        chrome.tabs.create({"url":url});
    } else {
        globalUrlReportArray.splice(index,1);
    }
});


function doUrlScanFromPopup(targetUrl,sendResp){
    globalLoopCounter = 0;
    if (globalApiKey == "" || globalApiKey == undefined){
        sendResp({Error:"Api Key Not Set!"})
        return;
    }
    let data = "url=" + targetUrl + "&visibility=" + globalScanMode;
    let options = {
        method: 'POST',
        headers: {
            'Content-Type':'application/x-www-form-urlencoded',
            'API-Key': globalApiKey,
        },
        body:data,
    }
    fetch("https://urlscan.io/api/v1/scan",options).then(resp => {
        console.log(resp);
        console.log(resp.status)
        if (!resp.ok){
            if (resp.status == 401) {
                console.log("Unauthorized invalid api key most likely");
                resp.json().then((json)=>{ 
                    console.log(json)
                    sendResp({Error:json.message})
                });
                throw Error(resp.status);
            }
            resp.json().then((json)=>{ 
                console.log(json) 
                sendResp({Error:json.message})
            });
            throw Error(resp.status);
        } // if successfully posted data sleep 15 seconds then run url loop
        return resp.json();})
        .then(respData => {
            console.log(respData.api);
            SendStartScanNotification(targetUrl);
            setTimeout(()=> {
                loopForUrlResponseFromPopup(respData.api,sendResp);
            },15000)
        }).catch(e => {
            console.log(e);
        });
}

function loopForUrlResponseFromPopup(resultsUrl,sendResp){
    let options = {
        method: 'GET',
        headers: {
            'Content-Type':'application/x-www-form-urlencoded',
            'API-Key': globalApiKey
        },
    }
    fetch(resultsUrl,options).then(resp => {
        if (resp.status == 404){
            if (globalLoopCounter < 15){
                globalLoopCounter++;
                setTimeout(() => {
                    loopForUrlResponseFromPopup(resultsUrl,sendResp)
                    console.log("url not ready, sleep 15 seconds and try again")
                },15000) // after first iteration sleep 5 seconds
                return;
            } else {
                globalLoopCounter++;
                 SendFailedNotification();
                 sendResp({Error:"Timeout on results exceeded!"});
                 return;
             }
        }
        globalLoopCounter = 0; ////////////////////////////////////////////// <----------
        return resp.json()
    }).then(data => {
        var verdict;
        if (data == undefined){
            return;
        }
        try {
            var test = data.verdicts.overall.malicious;
        }
        catch {
            SendFailedNotification();
            sendResp({Error:"Timeout Error!"})
            console.log(data)
            return;   
        }
        if (data.verdicts.overall.malicious || data.verdicts.urlscan.malicious){
            verdict = "POTENTIALLY MALICIOUS"
        } else {
            verdict = "NON MALICOUS"
        }
        SendSuccessNotification(data.task.reportURL,verdict);
        // SEND DATA TO POPUP!
        sendResp(data)
    }).catch(err => {
        SendFailedNotification();
        console.log(err)
    })
}



function doUrlScanFromLinkContext(targetUrl){
    globalLoopCounter = 0;
    if (globalApiKey == "" || globalApiKey == undefined){
        SendFailedNotification(message="Api Key Not Set!")
        return;
    }
    let data = "url=" + targetUrl + "&visibility=" + globalScanMode;
    console.log(data);
    let options = {
        method: 'POST',
        headers: {
            'Content-Type':'application/x-www-form-urlencoded',
            'API-Key': globalApiKey,
        },
        body:data,
    }
    fetch("https://urlscan.io/api/v1/scan",options).then(resp => {
        console.log(resp);
        console.log(resp.status)
        if (!resp.ok){
            // If 401 send back error to popup.js
            if (resp.status == 401) {
                console.log("Unauthorized invalid api key most likely");
                resp.json().then((json)=>{ 
                    console.log(json)
                    SendFailedNotification(message=json.message)
                });
                throw Error(resp.status);
            }
            // if resp not ok send error to popup.js
            resp.json().then((json)=>{ 
                console.log(json) 
                SendFailedNotification(message=json.message)
            });
            throw Error(resp.status);
        } // if successfully posted data sleep 15 seconds then run url loop
        return resp.json();})
        .then(respData => {
            SendStartScanNotification(targetUrl);
            console.log(respData.api);
            setTimeout(()=> {
                loopForUrlResponseFromLinkContext(respData.api);
            },15000)
        }).catch(e => {
            console.log(e);
        });
}


function loopForUrlResponseFromLinkContext(resultsUrl){
    let options = {
        method: 'GET',
        headers: {
            'Content-Type':'application/x-www-form-urlencoded',
            'API-Key': globalApiKey
        },
    }
    fetch(resultsUrl,options).then(resp => {
        console.log(globalLoopCounter);
        console.log(resp);
        console.log(resp.status)
        if (resp.status == 404){
            if (globalLoopCounter < 15){
                globalLoopCounter++;
                setTimeout(() => {
                    loopForUrlResponseFromLinkContext(resultsUrl)
                    console.log("url not ready, sleep 15 seconds and try again")
                },15000) // after first iteration sleep 5 seconds
                return;
            } else {
                globalLoopCounter++;
                 SendFailedNotification();
                 return;
             }
        }
        globalLoopCounter = 0; ////////////////////////////////////////////// <----------
        return resp.json()
    }).then(data => {
        console.log(data)
        var verdict;
        if (data == undefined){
            return;
        }
        // CHECKING FOR INVALID DATA
        try {
            var test = data.verdicts.overall.malicious;
        }
        catch {
            console.log("got back invalid data");
            console.log(data)
            SendFailedNotification();
            return;   
        }
        if (data.verdicts.overall.malicious || data.verdicts.urlscan.malicious){
            verdict = "POTENTIALLY MALICIOUS"
        } else {
            verdict = "NON MALICOUS"
        }
        SendSuccessNotification(data.task.reportURL,verdict);
    }).catch(err => {
        SendFailedNotification();
        console.log(err)
    })
}

//// Function Declarations
// GETS APIKEY FROM STORAGE
function GetApiKeyFromStorage() {
    chrome.storage.sync.get(["urlScanKey"],function(result){
        console.log(result)
        console.log(result.urlScanKey);
        globalApiKey = result.urlScanKey;
    })
}

function GetScanModeFromStorage() {
    chrome.storage.sync.get(["scanMode"],function(result){
        console.log(result)
        console.log(result.scanMode);
        if (result.scanMode == undefined || result.scanMode == ''){
            chrome.storage.sync.set({"scanMode":"public"});
            console.log('set default as public')
            globalScanMode = "public";
            return;
        }
        console.log('set custom')
        globalScanMode = result.scanMode;
    })
}


function SendStartScanNotification(targetUrl){
    chrome.notifications.create("", {
        type:    "basic",
        iconUrl: "/images/urlSCAN.png",
        title:   "Url Scan Started!",
        message: "Started Scan on " + targetUrl,
        contextMessage: "Scanning..."
    }, function(){});
}

function SendSuccessNotification(urlResultStr,verdict){
    chrome.notifications.create("", {
        type:    "basic",
        iconUrl: "/images/urlSCAN.png",
        title:   "Url Scan Report Complete!",
        message: "Scan Result: " + verdict,
        contextMessage: "Url Scan Report Complete!",
        priority:2,
        requireInteraction:true,
        buttons: [{
            title: "View Full Scan Results",
            iconUrl: "/images/urlSCAN.png"
        }, {
            title: "Ignore",
            iconUrl: "/images/urlSCAN.png"
        }]
    }, function(notificationId) {
        globalUrlReportArray.push({[notificationId]:urlResultStr})
    });
}

function SendFailedNotification(message=undefined){
    if (message != undefined) {
        chrome.notifications.create("", {
            type:    "basic",
            iconUrl: "/images/urlSCAN.png",
            title:   "Url Scan Failed!",
            message: message,
            priority:2,
            requireInteraction:true,
            contextMessage: "Failed to finish scan",
        }, function() {});
        return;
    }
    chrome.notifications.create("", {
        type:    "basic",
        iconUrl: "/images/urlSCAN.png",
        title:   "Url Scan Failed!",
        message: "Url Scan Failed!",
        priority:2,
        requireInteraction:true,
        contextMessage: "Failed to finish scan",
    }, function() {});
    return;
}