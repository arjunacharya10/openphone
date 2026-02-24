import QtQuick
import QtQuick.Layouts
import ".."

Item {
    id: root

    anchors.fill: parent

    signal unlocked()

    // Track animated state so we don't double-trigger.
    property bool isAnimating: false

    property string timeText: Qt.formatTime(new Date(), "hh:mm")
    property string dateText: Qt.formatDate(new Date(), "dddd, MMM d")

    Timer {
        interval: 1000
        running: true
        repeat: true
        onTriggered: {
            var now = new Date()
            root.timeText = Qt.formatTime(now, "hh:mm")
            root.dateText = Qt.formatDate(now, "dddd, MMM d")
        }
    }

    // Animate the whole sheet (wallpaper + content) for swipe + unlock.
    Item {
        id: sheet
        // Use explicit geometry so y can be animated and dragged.
        x: 0
        y: 0
        width: parent.width
        height: parent.height

        // ── Fullscreen wallpaper background ──
        Image {
            id: wallpaper
            anchors.fill: parent
            source: "qrc:/qml/assets/wallpaper.jpg"
            fillMode: Image.PreserveAspectCrop
            cache: true
            smooth: true
            opacity: 0.7
        }

        // ── Global gesture area: swipe up to unlock ──
        MouseArea {
            id: gestureArea
            anchors.fill: parent
            hoverEnabled: true

            property real pressY: 0

            onPressed: {
                if (root.isAnimating)
                    return
                pressY = mouse.y
            }

            onPositionChanged: {
                if (root.isAnimating)
                    return
                var dy = mouse.y - pressY
                // Only move sheet upward with the finger (negative dy).
                if (dy < 0) {
                    sheet.y = dy
                } else {
                    sheet.y = 0
                }
            }

            onReleased: {
                if (root.isAnimating)
                    return
                var dy = pressY - mouse.y
                var swipeThreshold = Theme.spacingLG
                if (dy > swipeThreshold) {
                    // Upward swipe: animate sheet off-screen and then unlock.
                    root.performUnlock()
                } else {
                    // Not far enough: gently snap back.
                    snapBackAnim.running = false
                    snapBackAnim.to = 0
                    snapBackAnim.running = true
                }
            }
        }

        // Time / date / swipe hint floating on the wallpaper
        ColumnLayout {
            id: contentColumn

            anchors.horizontalCenter: parent.horizontalCenter
            anchors.verticalCenter: parent.verticalCenter
            anchors.margins: Theme.spacingXL
            spacing: Theme.spacingMD

            // Time
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: root.timeText
                font.pixelSize: Theme.fontSizeXL * 2
                font.weight: Font.Light
                color: Theme.foreground
            }

            // Date
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: root.dateText
                font.pixelSize: Theme.fontSizeMD
                color: Theme.foreground
            }

            Item {
                Layout.fillWidth: true
                Layout.topMargin: Theme.spacingXL
                height: Theme.spacingXL
            }

            // Swipe hint text
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "Swipe up to unlock"
                font.pixelSize: Theme.fontSizeSM
                color: Theme.subtleText
            }
        }
    }

    // Smooth animations for sheet movement.
    NumberAnimation {
        id: unlockAnim
        target: sheet
        property: "y"
        duration: 220
        easing.type: Easing.InOutQuad
        onStopped: {
            if (sheet.y <= -root.height * 0.8) {
                // Sheet has slid away; now signal unlock and hide via Main.qml.
                root.unlocked()
            }
            root.isAnimating = false
            sheet.y = 0
        }
    }

    NumberAnimation {
        id: snapBackAnim
        target: sheet
        property: "y"
        duration: 160
        easing.type: Easing.OutQuad
    }

    function performUnlock() {
        if (isAnimating)
            return
        isAnimating = true
        unlockAnim.running = false
        unlockAnim.to = -root.height
        unlockAnim.running = true
    }
}

