import QtQuick
import QtQuick.Layouts
import ".."

Item {
    id: root

    signal submitted(string message)

    implicitHeight: Theme.spacingXL + Theme.spacingMD

    property bool sending: false

    ColumnLayout {
        anchors.fill: parent
        anchors.leftMargin: Theme.spacingLG
        anchors.rightMargin: Theme.spacingLG
        anchors.bottomMargin: Theme.spacingMD
        spacing: 0

        RowLayout {
            Layout.fillWidth: true
            spacing: Theme.spacingSM

            // ── Prompt character ──
            Text {
                text: "\u203A"
                font.pixelSize: Theme.fontSizeXL
                font.italic: true
                color: root.sending ? Theme.accent : Theme.dimText

                Behavior on color { ColorAnimation { duration: 200 } }
            }

            // ── Text input ──
            TextInput {
                id: inputField
                Layout.fillWidth: true
                font.pixelSize: Theme.fontSizeMD
                font.weight: Font.Light
                color: Theme.foreground
                selectionColor: Theme.accent
                selectedTextColor: Theme.background
                enabled: !root.sending

                property string placeholderText: root.sending ? "Sending..." : "Instruct or query..."

                Text {
                    anchors.fill: parent
                    anchors.verticalCenter: parent.verticalCenter
                    text: inputField.placeholderText
                    font: inputField.font
                    color: Theme.border
                    visible: !inputField.text && !inputField.activeFocus
                    verticalAlignment: Text.AlignVCenter
                }

                Keys.onReturnPressed: {
                    var msg = text.trim()
                    if (msg.length > 0 && !root.sending) {
                        root.submitted(msg)
                        text = ""
                    }
                }
            }
        }

        // ── Bottom border ──
        Rectangle {
            Layout.fillWidth: true
            height: 1
            color: Theme.border
        }
    }
}
