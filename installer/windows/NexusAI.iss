#define AppName "Nexus AI Desktop"
#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
#define AppPublisher "Nexus AI"
#define AppExeName "NexusAI-Desktop.exe"

[Setup]
AppId={{6B2A34E1-AD43-4EA2-9E89-20E53E52D104}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\Nexus AI Desktop
DefaultGroupName=Nexus AI
DisableProgramGroupPage=yes
OutputDir=..\..\installer-output
OutputBaseFilename=NexusAI-Setup
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
WizardStyle=modern
UninstallDisplayIcon={app}\{#AppExeName}
CloseApplications=yes
RestartApplications=no

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked
Name: "startup"; Description: "Start Nexus AI Desktop automatically when I sign in to Windows"; GroupDescription: "Convenience:"; Flags: unchecked

[Files]
Source: "..\..\dist\{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Nexus AI Desktop"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\Nexus AI Desktop"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon
Name: "{userstartup}\Nexus AI Desktop"; Filename: "{app}\{#AppExeName}"; Tasks: startup

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch Nexus AI Desktop now"; Flags: postinstall nowait skipifsilent
