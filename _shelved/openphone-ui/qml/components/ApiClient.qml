import QtQuick
import ".."

Item {
    id: root

    property string baseUrl: "http://localhost:3000"

    signal cardFetched(var card)
    signal cardFetchFailed()
    signal sessionHistoryFetched(string sessionKey, var messages)
    signal sessionHistoryFetchFailed()

    function fetchCard(cardId) {
        var req = new XMLHttpRequest()
        req.open("GET", root.baseUrl + "/cards/" + encodeURIComponent(cardId))
        req.onreadystatechange = function() {
            if (req.readyState === XMLHttpRequest.DONE) {
                if (req.status === 200) {
                    try {
                        var card = JSON.parse(req.responseText)
                        root.cardFetched(card)
                    } catch (e) {
                        root.cardFetchFailed()
                    }
                } else {
                    root.cardFetchFailed()
                }
            }
        }
        req.send()
    }

    function fetchSessionHistory(sessionKey) {
        var req = new XMLHttpRequest()
        req.open("GET", root.baseUrl + "/chat/session/" + encodeURIComponent(sessionKey) + "/history")
        req.onreadystatechange = function() {
            if (req.readyState === XMLHttpRequest.DONE) {
                if (req.status === 200) {
                    try {
                        var data = JSON.parse(req.responseText)
                        root.sessionHistoryFetched(sessionKey, data.messages || [])
                    } catch (e) {
                        root.sessionHistoryFetchFailed()
                    }
                } else {
                    root.sessionHistoryFetchFailed()
                }
            }
        }
        req.send()
    }
}
