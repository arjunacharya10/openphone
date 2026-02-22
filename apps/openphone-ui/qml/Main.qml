import QtQuick
import QtQuick.Layouts
import "components"
import "views"

Window {
    id: root
    width: 480
    height: 960
    visible: true
    visibility: Window.FullScreen
    title: "OpenPhone"
    color: Theme.background

    // ── Bind window dimensions to Theme for responsive scaling ──
    onWidthChanged: Theme.windowWidth = width
    onHeightChanged: Theme.windowHeight = height
    Component.onCompleted: {
        Theme.windowWidth = width
        Theme.windowHeight = height
    }

    // ── View state: 0=Focus, 1=Ledger, 2=Calendar ──
    property int viewIndex: 0

    function cycleView() {
        viewIndex = (viewIndex + 1) % 3
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // ── Top bar ──
        ContextBand {
            Layout.fillWidth: true
            currentView: root.viewIndex
            onViewToggled: root.cycleView()
        }

        // ── View area ──
        StackLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: root.viewIndex

            FocusView {
                onActionTriggered: function(cardId, action) {
                    console.log("Action:", action, "on card:", cardId)
                }
            }

            LedgerView {}

            CalendarView {}
        }

        // ── Bottom input ──
        InputBar {
            Layout.fillWidth: true
            onSubmitted: function(message) {
                console.log("User input:", message)
            }
        }
    }
}
