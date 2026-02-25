// ControlCenterPanel.qml
import QtQuick
import QtQuick.Layouts
import "../components"
import ".."

Item {
    id: root
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.top: parent.top

    signal closeRequested()

    // ── Toggle state (UI only) ──
    property bool wifiOn: true
    property bool bluetoothOn: true
    property bool orientationLockOn: false
    property real brightnessValue: 0.6
    property real volumeValue: 0.5

    // ── Drag handle ──
    Item {
        id: handleArea
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        height: Math.round(28 * Theme.scale)

        Rectangle {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.verticalCenter: parent.verticalCenter
            width: Math.round(44 * Theme.scale)
            height: Math.round(5 * Theme.scale)
            radius: height / 2
            color: Theme.glassBorder
            opacity: 0.55
        }

        MouseArea {
            anchors.fill: parent
            property real startY: 0
            property bool armed: false

            onPressed: {
                armed = true
                startY = mapToItem(root, mouse.x, mouse.y).y
            }
            onReleased: armed = false
            onCanceled: armed = false

            onPositionChanged: {
                if (!armed) return
                const yNow = mapToItem(root, mouse.x, mouse.y).y
                const dy = yNow - startY
                if (dy < -Theme.spacingMD) {
                    armed = false
                    root.closeRequested()
                }
            }
        }
    }

    // ── Card that sizes to content ──
    Rectangle {
        id: card
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: handleArea.bottom
        anchors.margins: Theme.spacingMD

        radius: Theme.radiusLG * 2
        color: Theme.glassBackground
        border.color: Theme.glassBorder
        border.width: 1

        // IMPORTANT: height driven by content + margins
        height: cardContent.implicitHeight + Theme.spacingLG * 2

        ColumnLayout {
            id: cardContent

            // IMPORTANT: don't anchors.fill; let it be implicitHeight-based
            x: Theme.spacingLG
            y: Theme.spacingLG
            width: card.width - Theme.spacingLG * 2
            spacing: Theme.spacingLG

            ControlTile {
                Layout.fillWidth: true
                Layout.preferredHeight: Math.round(96 * Theme.scale)

                content: Item {
                    anchors.fill: parent
                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: Theme.spacingMD

                        QuickToggle {
                            Layout.preferredWidth: Math.round(64 * Theme.scale)
                            Layout.preferredHeight: Layout.preferredWidth
                            checked: root.wifiOn
                            onClicked: root.wifiOn = !root.wifiOn
                            iconType: "wifi"
                        }

                        Item { Layout.fillWidth: true }

                        QuickToggle {
                            Layout.preferredWidth: Math.round(64 * Theme.scale)
                            Layout.preferredHeight: Layout.preferredWidth
                            checked: root.bluetoothOn
                            onClicked: root.bluetoothOn = !root.bluetoothOn
                            iconType: "bluetooth"
                        }

                        Item { Layout.fillWidth: true }

                        QuickToggle {
                            Layout.preferredWidth: Math.round(64 * Theme.scale)
                            Layout.preferredHeight: Layout.preferredWidth
                            checked: root.orientationLockOn
                            onClicked: root.orientationLockOn = !root.orientationLockOn
                            iconType: "orientationLock"
                        }
                    }
                }
            }

            ControlTile {
                Layout.fillWidth: true
                Layout.preferredHeight: Math.round(64 * Theme.scale)

                content: Item {
                    anchors.fill: parent
                    HorizontalSlider {
                        anchors.fill: parent
                        anchors.margins: Theme.spacingMD
                        value: root.brightnessValue
                        onValueModified: (v) => root.brightnessValue = v
                        iconType: "brightness"
                    }
                }
            }

            ControlTile {
                Layout.fillWidth: true
                Layout.preferredHeight: Math.round(64 * Theme.scale)

                content: Item {
                    anchors.fill: parent
                    HorizontalSlider {
                        anchors.fill: parent
                        anchors.margins: Theme.spacingMD
                        value: root.volumeValue
                        onValueModified: (v) => root.volumeValue = v
                        iconType: "volume"
                    }
                }
            }

            // REMOVE the filler:
            // Item { Layout.fillHeight: true }
        }
    }

    // Root height based on card + handle + margins
    height: handleArea.height + Theme.spacingMD * 2 + card.height

    component ControlTile: Rectangle {
        id: tile
        radius: Theme.radiusLG * 1.6
        color: Qt.rgba(1, 1, 1, 0.06)
        border.width: 1
        border.color: Qt.rgba(1, 1, 1, 0.08)

        Rectangle {
            anchors.fill: parent
            radius: tile.radius
            color: "transparent"
            border.width: 1
            border.color: Qt.rgba(0, 0, 0, 0.18)
            opacity: 0.25
        }

        property Item content: null
        onContentChanged: {
            if (!content) return
            content.parent = tile
            content.anchors.fill = tile
        }
    }
}