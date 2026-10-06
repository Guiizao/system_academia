; Incluido automaticamente pelo electron-builder no instalador NSIS.
;
; A 0.1.0 empacotava o app dentro de resources\app.asar e o servidor em
; resources\app\servidor. A partir da 0.1.1 o app inteiro e uma pasta comum
; (resources\app, com o servidor em resources\app\app\servidor).
;
; Se sobrar o app.asar de uma instalacao antiga, o Electron carrega ELE antes
; da pasta nova -- e a versao quebrada volta. Por isso a limpeza aqui nao
; depende de a desinstalacao da versao antiga ter dado certo.
; Os dados da academia ficam em %LOCALAPPDATA%\DarkFisic e nao sao tocados.

!macro customInstall
  Delete "$INSTDIR\resources\app.asar"
  RMDir /r "$INSTDIR\resources\app.asar.unpacked"
  ; lugar antigo do servidor (na 0.1.1 ele fica em resources\app\app\...)
  RMDir /r "$INSTDIR\resources\app\servidor"
  RMDir /r "$INSTDIR\resources\app\drizzle"
  RMDir /r "$INSTDIR\resources\app\web"
!macroend
