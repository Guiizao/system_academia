#Requires -Version 5.1
<#
  Atualiza o DARK FISIC JA INSTALADO sem instalador novo.

  Troca apenas "resources\app" (o programa). Nao toca em node_modules, no
  Electron nem nos dados da academia. Antes de mexer em qualquer coisa:
  confere versao, dependencias e a impressao digital (sha256) de cada arquivo.
  A troca e por renomeacao: ou a pasta nova entra inteira, ou nada muda.
  Se o sistema nao voltar no ar com a versao nova, desfaz tudo sozinho.

  Codigos de saida: 0 ok | 2 versao nao serve | 3 dependencias mudaram
                    4 pacote invalido | 5 desfeito (rollback) | 1 erro
#>
[CmdletBinding()]
param(
  [string]$Destino,
  [string]$Pacote,
  # a mesma porta que o app usa (DF_PORTA quando o dono mudou; senao 3000)
  [int]$Porta = $(if ($env:DF_PORTA) { [int]$env:DF_PORTA } else { 3000 }),
  [int]$SegundosParaSubir = 45,
  [switch]$SemReiniciar
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$GUID = '482b18aa-ad75-5637-95cf-a739467fdff6'
# a mesma pasta de dados que o app usa (main.js respeita DF_DADOS)
$DADOS = $(if ($env:DF_DADOS) { $env:DF_DADOS } else { Join-Path $env:LOCALAPPDATA 'DarkFisic' })
$PASTA_LOG = Join-Path $DADOS 'logs'
$PASTA_BANCO = Join-Path $DADOS 'dados'
$EXE = 'DARK FISIC.exe'
$NODE_MODULES = 'node_modules'
$OBRIGATORIOS = @('main.js', 'package.json', 'app/servidor/index.js', 'app/web/index.html', 'app/drizzle/meta/_journal.json')

function Escrever([string]$texto, [string]$cor = 'Gray') {
  Write-Host $texto -ForegroundColor $cor
  try {
    if (-not (Test-Path -LiteralPath $PASTA_LOG)) { New-Item -ItemType Directory -Path $PASTA_LOG -Force | Out-Null }
    $carimbo = Get-Date -Format 'dd/MM/yyyy HH:mm:ss'
    Add-Content -LiteralPath (Join-Path $PASTA_LOG 'atualizacao.log') -Value "[$carimbo] $($texto -replace '[\r\n]+', ' ')" -Encoding UTF8
  } catch { }
}
function Parar([string]$texto, [int]$codigo) {
  Escrever "ERRO: $texto" 'Red'
  exit $codigo
}
function Normalizar([string]$p) {
  if (-not $p) { return $null }
  return [IO.Path]::GetFullPath($p).TrimEnd('\')
}

# --- 1. onde esta instalado -------------------------------------------------
function AcharInstalacao {
  if ($Destino) { return $Destino }
  foreach ($raiz in @('HKCU:', 'HKLM:')) {
    # o NSIS do electron-builder grava InstallLocation AQUI
    foreach ($chave in @("$raiz\Software\$GUID", "$raiz\Software\Microsoft\Windows\CurrentVersion\Uninstall\$GUID")) {
      if (-not (Test-Path -LiteralPath $chave)) { continue }
      $prop = Get-ItemProperty -LiteralPath $chave
      if ($prop.InstallLocation -and (Test-Path -LiteralPath $prop.InstallLocation)) { return $prop.InstallLocation }
      if ($prop.UninstallString) {
        $pasta = Split-Path ($prop.UninstallString.Trim('"')) -Parent
        if ($pasta -and (Test-Path -LiteralPath $pasta)) { return $pasta }
      }
    }
  }
  $padrao = Join-Path $env:LOCALAPPDATA 'Programs\DARK FISIC'
  if (Test-Path -LiteralPath $padrao) { return $padrao }
  return $null
}

$instalacao = Normalizar (AcharInstalacao)
if (-not $instalacao) {
  Parar "nao achei o DARK FISIC instalado neste computador. Se ele esta em outra pasta, arraste a pasta para cima do ATUALIZAR.bat." 1
}
$exeInstalado = Join-Path $instalacao $EXE
if (-not (Test-Path -LiteralPath $exeInstalado)) { Parar "a pasta $instalacao nao tem o $EXE" 1 }

if (-not $Pacote) { $Pacote = Join-Path $PSScriptRoot 'pacote' }
if (-not (Test-Path -LiteralPath (Join-Path $Pacote 'atualizacao.json'))) {
  Parar "nao achei a pasta 'pacote' ao lado deste arquivo. Extraia o zip inteiro antes de rodar." 1
}

$appInstalado = Join-Path $instalacao 'resources\app'
$manifesto = Get-Content -LiteralPath (Join-Path $Pacote 'atualizacao.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$pkgInstalado = Get-Content -LiteralPath (Join-Path $appInstalado 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json

Escrever "DARK FISIC em: $instalacao"
Escrever "Versao instalada: $($pkgInstalado.version)   ->   versao nova: $($manifesto.versao)"
Escrever "Identificacao do pacote: $((Get-FileHash -LiteralPath (Join-Path $Pacote 'atualizacao.json') -Algorithm SHA256).Hash.Substring(0,16))"

# --- 2. conferir antes de mexer ---------------------------------------------
if ($manifesto.versao -notmatch '^\d+\.\d+\.\d+$') { Parar "o pacote tem uma versao estranha ($($manifesto.versao))" 4 }
if ([version]$manifesto.versao -le [version]$pkgInstalado.version) {
  Escrever "Nada a fazer: a versao instalada ($($pkgInstalado.version)) ja e igual ou mais nova." 'Yellow'
  exit 2
}

$depsAtuais = @{}; $pkgInstalado.dependencies.PSObject.Properties | ForEach-Object { $depsAtuais[$_.Name] = $_.Value }
$depsNovas  = @{}; $manifesto.dependencias.PSObject.Properties   | ForEach-Object { $depsNovas[$_.Name]  = $_.Value }
$diferentes = @()
foreach ($nome in (@($depsAtuais.Keys) + @($depsNovas.Keys) | Sort-Object -Unique)) {
  if ($depsAtuais[$nome] -ne $depsNovas[$nome]) { $diferentes += $nome }
}
if ($diferentes.Count -gt 0) {
  Escrever "As bibliotecas mudaram ($($diferentes -join ', ')). Esta atualizacao nao serve: use o instalador completo." 'Yellow'
  exit 3
}

# Copia para uma pasta so minha e confere LA: assim ninguem troca um arquivo
# entre a conferencia e a instalacao.
$staging = Join-Path $DADOS "atualizacoes\staging-$($manifesto.versao)"
if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
New-Item -ItemType Directory -Path (Split-Path $staging -Parent) -Force | Out-Null
# copia a PASTA inteira (com o destino ainda sem existir): copiar "pasta\*"
# para um destino que ja existe deixa arquivos de subpastas para tras
Copy-Item -LiteralPath $Pacote -Destination $staging -Recurse -Force

Escrever "Conferindo os arquivos novos..."
$listados = @($manifesto.arquivos)
if ($listados.Count -eq 0) { Parar "o pacote nao tem lista de arquivos: nao da para confiar nele" 4 }
foreach ($obrigatorio in $OBRIGATORIOS) {
  if (-not ($listados | Where-Object { $_.caminho -eq $obrigatorio })) { Parar "o pacote nao traz o $obrigatorio" 4 }
}
foreach ($arq in $listados) {
  $caminho = Join-Path $staging $arq.caminho
  if (-not (Test-Path -LiteralPath $caminho)) { Parar "faltou o arquivo $($arq.caminho) no pacote" 4 }
  if ((Get-FileHash -LiteralPath $caminho -Algorithm SHA256).Hash -ne $arq.sha256) {
    Parar "o arquivo $($arq.caminho) chegou corrompido. Baixe o zip de novo." 4
  }
}
# arquivo que veio junto mas nao esta na lista nao entra: seria codigo sem conferencia
$naLista = @{}; $listados | ForEach-Object { $naLista[$_.caminho] = $true }
foreach ($f in (Get-ChildItem -LiteralPath $staging -Recurse -File -Force)) {
  $rel = $f.FullName.Substring($staging.Length + 1).Replace('\', '/')
  if ($rel -ne 'atualizacao.json' -and -not $naLista[$rel]) { Parar "o pacote tem um arquivo a mais ($rel). Baixe o zip de novo." 4 }
}
Escrever "$($listados.Count) arquivos conferidos." 'Green'

# --- 3. fechar o programa ---------------------------------------------------
function AppRodando {
  $prefixo = "$instalacao\"
  return @(Get-Process -Name 'DARK FISIC' -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -and (Normalizar $_.Path).StartsWith($prefixo, [StringComparison]::OrdinalIgnoreCase)
  })
}
function ServidorNoAr {
  try { return (Invoke-RestMethod -Uri "http://localhost:$Porta/status" -TimeoutSec 3).versao } catch { return $null }
}

if ((AppRodando).Count -gt 0 -or (ServidorNoAr)) {
  Escrever "Fechando o DARK FISIC..."
  # 0.1.2 em diante entende --encerrar e sai fechando o banco direito
  Start-Process -FilePath $exeInstalado -ArgumentList '--encerrar' -WorkingDirectory $instalacao -ErrorAction SilentlyContinue | Out-Null
  for ($i = 0; $i -lt 15 -and ((AppRodando).Count -gt 0 -or (ServidorNoAr)); $i++) { Start-Sleep -Seconds 1 }
  $presos = AppRodando
  if ($presos.Count -gt 0) {
    # 0.1.1 nao tem --encerrar: encerra pelo processo (o SQLite recupera pelo WAL)
    $presos | Stop-Process -Force -ErrorAction SilentlyContinue
    for ($i = 0; $i -lt 10 -and (AppRodando).Count -gt 0; $i++) { Start-Sleep -Seconds 1 }
  }
  if ((AppRodando).Count -gt 0) { Parar "nao consegui fechar o DARK FISIC. Feche pela bandeja (Encerrar) e rode de novo." 1 }
  if (ServidorNoAr) { Parar "a porta $Porta continua respondendo: ha outro DARK FISIC no ar neste PC. Feche-o e rode de novo." 1 }
  Escrever "Programa fechado." 'Green'
}

# --- 4. backup do banco -----------------------------------------------------
$carimbo = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$copiaBanco = $null
if (Test-Path -LiteralPath (Join-Path $PASTA_BANCO 'academia.db')) {
  $pastaBackups = Join-Path $DADOS 'backups'
  New-Item -ItemType Directory -Path $pastaBackups -Force | Out-Null
  # nome de arquivo no padrao do painel: aparece na lista e a retencao nunca apaga
  $copiaBanco = Join-Path $pastaBackups "antes-da-atualizacao-$carimbo.db"
  Copy-Item -LiteralPath (Join-Path $PASTA_BANCO 'academia.db') -Destination $copiaBanco -Force
  foreach ($extra in @('-wal', '-shm')) {
    $de = Join-Path $PASTA_BANCO "academia.db$extra"
    if (Test-Path -LiteralPath $de) { Copy-Item -LiteralPath $de -Destination "$copiaBanco$extra" -Force }
  }
  $origem = (Get-Item -LiteralPath (Join-Path $PASTA_BANCO 'academia.db')).Length
  if ((Get-Item -LiteralPath $copiaBanco).Length -ne $origem) { Parar "a copia do banco saiu diferente do original. Nao vou continuar." 1 }
  Escrever "Copia do banco guardada: $(Split-Path $copiaBanco -Leaf)" 'Green'
} else {
  Escrever "Ainda nao ha banco de dados neste PC (instalacao nova): sem backup a fazer." 'Yellow'
}

# --- 5. trocar a pasta inteira, por renomeacao ------------------------------
$appNovo = "$appInstalado.novo"
$appAntigo = "$appInstalado.antigo"
foreach ($sobra in @($appNovo, $appAntigo)) { if (Test-Path -LiteralPath $sobra) { Remove-Item -LiteralPath $sobra -Recurse -Force } }

New-Item -ItemType Directory -Path $appNovo -Force | Out-Null
Get-ChildItem -LiteralPath $staging -Force | Where-Object { $_.Name -ne 'atualizacao.json' } |
  ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $appNovo -Recurse -Force }

$nmDe = Join-Path $appInstalado $NODE_MODULES
$nmPara = Join-Path $appNovo $NODE_MODULES
try {
  Move-Item -LiteralPath $nmDe -Destination $nmPara          # instantaneo: mesmo disco
  Rename-Item -LiteralPath $appInstalado -NewName 'app.antigo'
  Rename-Item -LiteralPath $appNovo -NewName 'app'
} catch {
  Escrever "Nao consegui trocar os arquivos: $($_.Exception.Message)" 'Red'
  if ((Test-Path -LiteralPath $nmPara) -and -not (Test-Path -LiteralPath $nmDe)) { Move-Item -LiteralPath $nmPara -Destination $nmDe }
  if (Test-Path -LiteralPath $appNovo) { Remove-Item -LiteralPath $appNovo -Recurse -Force }
  Parar "nada foi alterado: a versao $($pkgInstalado.version) continua instalada. Abra o DARK FISIC normalmente." 1
}
Escrever "Arquivos trocados." 'Green'

function Desfazer([string]$motivo) {
  Escrever "$motivo Desfazendo..." 'Red'
  (AppRodando) | Stop-Process -Force -ErrorAction SilentlyContinue
  for ($i = 0; $i -lt 10 -and (AppRodando).Count -gt 0; $i++) { Start-Sleep -Seconds 1 }
  $falhou = "$appInstalado.falhou"
  if (Test-Path -LiteralPath $falhou) { Remove-Item -LiteralPath $falhou -Recurse -Force }
  Rename-Item -LiteralPath $appInstalado -NewName 'app.falhou'
  Move-Item -LiteralPath (Join-Path $falhou $NODE_MODULES) -Destination (Join-Path $appAntigo $NODE_MODULES)
  Rename-Item -LiteralPath $appAntigo -NewName 'app'
  Remove-Item -LiteralPath $falhou -Recurse -Force

  # O banco volta com o trio .db + -wal + -shm. O SQLite grava primeiro no -wal:
  # logo depois de fechar o programa o .db pode estar quase vazio, com tudo no
  # -wal -- devolver so o .db apagaria o que ainda nao tinha sido gravado.
  # O banco so volta se o formato dele mudou nesta versao. Sem isso, devolver um
  # banco antigo por cima do atual jogaria fora o que foi feito enquanto a versao
  # nova esteve no ar -- e sobra de -wal corrompe o arquivo.
  $contar = { param($p) if (Test-Path -LiteralPath $p) { @((Get-Content -LiteralPath $p -Raw | ConvertFrom-Json).entries).Count } else { -1 } }
  $migrAntigas = & $contar (Join-Path $appInstalado 'app\drizzle\meta\_journal.json')
  $migrNovas   = & $contar (Join-Path $staging 'app\drizzle\meta\_journal.json')
  if ($copiaBanco -and $migrNovas -ne $migrAntigas) {
    $antesDoRollback = Join-Path $DADOS "backups\antes-de-desfazer-$carimbo.db"
    Copy-Item -LiteralPath (Join-Path $PASTA_BANCO 'academia.db') -Destination $antesDoRollback -Force
    foreach ($extra in @('-wal', '-shm')) {
      $de = Join-Path $PASTA_BANCO "academia.db$extra"
      if (Test-Path -LiteralPath $de) { Copy-Item -LiteralPath $de -Destination "$antesDoRollback$extra" -Force }
    }
    foreach ($extra in @('-wal', '-shm', '-journal')) { Remove-Item -LiteralPath (Join-Path $PASTA_BANCO "academia.db$extra") -Force -ErrorAction SilentlyContinue }
    Copy-Item -LiteralPath $copiaBanco -Destination (Join-Path $PASTA_BANCO 'academia.db') -Force
    foreach ($extra in @('-wal', '-shm')) {
      if (Test-Path -LiteralPath "$copiaBanco$extra") {
        Copy-Item -LiteralPath "$copiaBanco$extra" -Destination (Join-Path $PASTA_BANCO "academia.db$extra") -Force
      }
    }
    Escrever "Banco voltou ao estado de antes. O de agora ficou guardado em $(Split-Path $antesDoRollback -Leaf)." 'Yellow'
  } else {
    Escrever "Banco de dados mantido como esta (o formato nao mudou nesta versao)." 'Yellow'
  }

  Start-Process -FilePath $exeInstalado -WorkingDirectory $instalacao | Out-Null
  Parar "voltei para a versao $($pkgInstalado.version) e reabri o sistema. Nada foi perdido." 5
}

# --- 6. alunos da planilha (o sistema le sozinho quando sobe) ---------------
$pastaAlunos = Join-Path $PSScriptRoot 'alunos'
if (Test-Path -LiteralPath $pastaAlunos) {
  $destinoImportar = Join-Path $DADOS 'importar'
  New-Item -ItemType Directory -Path $destinoImportar -Force | Out-Null
  Get-ChildItem -LiteralPath $pastaAlunos -Filter '*.json' | ForEach-Object {
    if (Test-Path -LiteralPath (Join-Path $destinoImportar ($_.Name + '.importado'))) {
      Escrever "$($_.Name) ja tinha sido importado antes: nao vou importar de novo." 'Yellow'
    } else {
      Copy-Item -LiteralPath $_.FullName -Destination $destinoImportar -Force
      Escrever "Arquivo de alunos colocado em $destinoImportar (entra sozinho quando o sistema abrir)." 'Green'
    }
  }
}

# --- 7. reabrir e conferir --------------------------------------------------
if ($SemReiniciar) {
  Escrever "Arquivos no lugar (sem reiniciar, a pedido). Versao $($manifesto.versao)." 'Green'
  exit 0
}

Escrever "Abrindo o DARK FISIC..."
Start-Process -FilePath $exeInstalado -WorkingDirectory $instalacao | Out-Null
$limite = (Get-Date).AddSeconds($SegundosParaSubir)
$versaoNoAr = $null
while ((Get-Date) -lt $limite -and -not $versaoNoAr) {
  Start-Sleep -Seconds 2
  if ((ServidorNoAr) -eq $manifesto.versao) { $versaoNoAr = $manifesto.versao }
}
if (-not $versaoNoAr) { Desfazer "O sistema nao subiu com a versao nova." }

# --- 8. arrumar a casa ------------------------------------------------------
$guardado = Join-Path $DADOS "atualizacoes\anterior-$($pkgInstalado.version)"
if (Test-Path -LiteralPath $guardado) { Remove-Item -LiteralPath $guardado -Recurse -Force }
New-Item -ItemType Directory -Path (Split-Path $guardado -Parent) -Force | Out-Null
Move-Item -LiteralPath $appAntigo -Destination $guardado
Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue

# Programas e Recursos mostra a versao certa -- so na chave que aponta para ESTA pasta
foreach ($raiz in @('HKCU:', 'HKLM:')) {
  $chave = "$raiz\Software\Microsoft\Windows\CurrentVersion\Uninstall\$GUID"
  if (-not (Test-Path -LiteralPath $chave)) { continue }
  $prop = Get-ItemProperty -LiteralPath $chave
  $registrada = $null
  foreach ($candidato in @($prop.InstallLocation, (Get-ItemProperty -LiteralPath "$raiz\Software\$GUID" -ErrorAction SilentlyContinue).InstallLocation)) {
    if ($candidato) { $registrada = Normalizar $candidato; break }
  }
  if ($registrada -and $registrada -ne $instalacao) { continue }
  try { Set-ItemProperty -LiteralPath $chave -Name 'DisplayVersion' -Value $manifesto.versao } catch { }
}

Escrever "Pronto! DARK FISIC atualizado para a versao $versaoNoAr e no ar." 'Green'
Escrever "A versao anterior ficou guardada em $guardado"
exit 0
