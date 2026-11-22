Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strDir

' Ejecutar pythonw.exe en segundo plano completamente oculto
WshShell.Run "pythonw.exe serve.py", 0, False