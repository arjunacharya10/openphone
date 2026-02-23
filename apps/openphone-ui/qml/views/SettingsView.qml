import QtQuick
import QtQuick.Layouts
import "../components"
import ".."

Item {
    id: root

    property string profileName: ""
    property string profileEmail: ""
    property string profilePhone: ""
    property string profileBio: ""

    Flickable {
        anchors.fill: parent
        contentWidth: width
        contentHeight: contentColumn.implicitHeight + Theme.spacingLG * 2
        clip: true
        flickableDirection: Flickable.VerticalFlick

        ColumnLayout {
            id: contentColumn
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.margins: Theme.spacingLG
            spacing: Theme.spacingMD

            // ── Profile card ──
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: profileLayout.implicitHeight + Theme.spacingLG * 2
                color: Theme.cardBg
                border.color: Theme.cardBorder
                border.width: 1
                radius: Theme.radiusMD

                RowLayout {
                    id: profileLayout
                    anchors.fill: parent
                    anchors.margins: Theme.spacingLG
                    spacing: Theme.spacingLG

                    // ── Avatar ──
                    Rectangle {
                        width: Math.round(56 * Theme.scale)
                        height: width
                        radius: width / 2
                        color: Theme.kindBadgeBg

                        Text {
                            anchors.centerIn: parent
                            text: root.profileName ? root.profileName.trim().charAt(0).toUpperCase() : ""
                            font.pixelSize: Theme.fontSizeXL
                            font.weight: Font.Medium
                            color: Theme.muted
                            visible: text.length > 0
                        }
                    }

                    // ── Profile fields ──
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: Theme.spacingXS

                        TextInput {
                            id: nameInput
                            Layout.fillWidth: true
                            text: root.profileName
                            onTextChanged: root.profileName = text
                            font.pixelSize: Theme.fontSizeMD
                            color: Theme.foreground
                            selectedTextColor: Theme.background
                            selectionColor: Theme.accent
                            Text {
                                anchors.fill: parent
                                anchors.verticalCenter: parent.verticalCenter
                                text: "Name"
                                font: nameInput.font
                                color: Theme.dimText
                                visible: !nameInput.text && !nameInput.activeFocus
                                verticalAlignment: Text.AlignVCenter
                            }
                        }

                        TextInput {
                            id: emailInput
                            Layout.fillWidth: true
                            text: root.profileEmail
                            onTextChanged: root.profileEmail = text
                            font.pixelSize: Theme.fontSizeSM
                            color: Theme.foreground
                            selectedTextColor: Theme.background
                            selectionColor: Theme.accent
                            Text {
                                anchors.fill: parent
                                anchors.verticalCenter: parent.verticalCenter
                                text: "Email"
                                font: emailInput.font
                                color: Theme.dimText
                                visible: !emailInput.text && !emailInput.activeFocus
                                verticalAlignment: Text.AlignVCenter
                            }
                        }

                        TextInput {
                            id: phoneInput
                            Layout.fillWidth: true
                            text: root.profilePhone
                            onTextChanged: root.profilePhone = text
                            font.pixelSize: Theme.fontSizeSM
                            color: Theme.foreground
                            selectedTextColor: Theme.background
                            selectionColor: Theme.accent
                            Text {
                                anchors.fill: parent
                                anchors.verticalCenter: parent.verticalCenter
                                text: "Phone"
                                font: phoneInput.font
                                color: Theme.dimText
                                visible: !phoneInput.text && !phoneInput.activeFocus
                                verticalAlignment: Text.AlignVCenter
                            }
                        }

                        TextInput {
                            id: bioInput
                            Layout.fillWidth: true
                            Layout.maximumHeight: 60
                            text: root.profileBio
                            onTextChanged: root.profileBio = text
                            font.pixelSize: Theme.fontSizeSM
                            color: Theme.foreground
                            selectedTextColor: Theme.background
                            selectionColor: Theme.accent
                            wrapMode: TextInput.WordWrap
                            Text {
                                anchors.fill: parent
                                anchors.topMargin: 2
                                text: "Bio"
                                font: bioInput.font
                                color: Theme.dimText
                                visible: !bioInput.text && !bioInput.activeFocus
                                verticalAlignment: Text.AlignTop
                            }
                        }
                    }
                }
            }

            // ── General card ──
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: Theme.spacingLG * 2 + 44
                color: Theme.cardBg
                border.color: Theme.cardBorder
                border.width: 1
                radius: Theme.radiusMD

                SettingsRow {
                    anchors.fill: parent
                    anchors.leftMargin: 0
                    anchors.rightMargin: 0
                    label: "General"
                    iconType: "gear"
                    onClicked: {}
                }
            }

            // ── Gmail card ──
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: Theme.spacingLG * 2 + 44
                color: Theme.cardBg
                border.color: Theme.cardBorder
                border.width: 1
                radius: Theme.radiusMD

                SettingsRow {
                    anchors.fill: parent
                    anchors.leftMargin: 0
                    anchors.rightMargin: 0
                    label: "Gmail"
                    iconType: "envelope"
                    onClicked: {}
                }
            }
        }
    }
}
