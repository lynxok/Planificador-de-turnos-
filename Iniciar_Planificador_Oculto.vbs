Set WshShell = CreateObject("WScript.Shell")
Dim strPath
strPath = Left(WScript.ScriptFullName, Len(WScript.ScriptFullName) - Len(WScript.ScriptName))
WshShell.Run chr(34) & strPath & "Iniciar_Planificador.bat" & chr(34), 0, False
