// GLOBALS
var latestUrlScanResult
var results;
var resultsPTag;


//////////// DOM CONTENT ON LOAD SETUP EVENT LISTENERS /////////
document.addEventListener('DOMContentLoaded',function(){
    //GetApiKeyFromStorageSendToBackground();
    // HIDE SCAN RESULT AT BOTTOM
    results = document.getElementsByClassName('results')[0];
    resultsPTag = document.getElementById("urlResultsText")
    ////////////////////////////////////
    // listening for options button click
    document.getElementById('optionsButton').addEventListener('click',function() {
        if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
        } else {
        window.open(chrome.runtime.getURL('/options/options.html'));
        }
    });
    ////////////////////////////////////////////////////////
    /// listen for url submit listener
    var submitButton = document.getElementById('submitButton');
    var urlSearchButton = document.getElementById('urlForm');
    submitButton.addEventListener('click',function(event){
        event.preventDefault();
        var button = document.getElementById('submitButton');
        button.classList.toggle('button--loading');
        var urlForm = document.getElementById('urlForm');
        var urlFormData = new FormData(urlForm);
        var urlToScan = urlFormData.get("url");
        var input = urlSearchButton.getElementsByTagName('input');
        for (var x=0; x<input.length;x++){
            input[x].disabled = true;
        }
        // Send url to background script
        sendURLToBackground(urlToScan);
    })
})

////// Functions
function sendURLToBackground(targetURL){
    // Send payload to background script
    var payloadObject = {
        isScan:true,
        url:targetURL,
    }
    // Send message to background script
    chrome.runtime.sendMessage(payloadObject,function(response){
        // set results to visible and add padding
        results.style.visibility = "visible";
        results.style.display = "unset";
        resultsPTag.style.padding = "8px 16px";
        // disable form while sending to background script
        var urlSearchButton = document.getElementById('urlForm');
        var input = urlSearchButton.getElementsByTagName('input');
        for (var x=0; x<input.length;x++){
            input[x].disabled = false;
            input[x].placeholder = "https://google.com"
        }
        // check response for errors display error in popup and return
        if (response.Error){        
            var button = document.getElementById('submitButton');
            button.classList.toggle('button--loading');    
            var p = document.getElementById("urlResultsText")
            p.textContent = response.Error;
            p.style.backgroundColor = "#e74c3c";
            return;
        }
        // start button submit animation
        var button = document.getElementById('submitButton');
        button.classList.toggle('button--loading');    
        var p = document.getElementById("urlResultsText")
        // CHECK SCORE FROM RESPONSE
        try {
            var urlReport = response.task.reportURL;
            if (response.verdicts.overall.malicious || response.verdicts.urlscan.malicious){
                p.textContent = "POTENTIALLY MALICIOUS"
                p.style.backgroundColor = "#e74c3c";
                latestUrlScanResult = urlReport
                return;
            }
            p.textContent = "NON MALICOUS" 
            p.style.backgroundColor = "#18bc9c";
            latestUrlScanResult = urlReport
            return;
        } catch {
            // if Error return timout error since that is most likely the issue
            p.textContent = "Timeout Error!"
            p.style.backgroundColor = "#e74c3c"; 
        }
    });
}