$ErrorActionPreference = 'Stop'
# Executa o bloco real de troca, em uma instalação fictícia, falhando cada operação.
$fonte = Join-Path $PSScriptRoot '..\atualizador\atualizar.ps1'
$arvore = [System.Management.Automation.Language.Parser]::ParseFile($fonte, [ref]$null, [ref]$null)
$troca = $arvore.Find({ param($no)
  $no -is [System.Management.Automation.Language.TryStatementAst] -and
  $no.Body.Extent.Text.Contains('Move-Item -LiteralPath $nmDe -Destination $nmPara')
}, $true).Extent.Text
if (-not $troca) { throw 'Bloco de troca do atualizador não encontrado' }

function Escrever { param($texto, $cor) }
function Parar { param($texto, $codigo) throw 'Atualização interrompida' }
function Move-Item {
  param($LiteralPath, $Destination)
  if ($cenario -eq 'mover' -and $LiteralPath -eq $nmDe) { throw 'Falha simulada ao mover' }
  Microsoft.PowerShell.Management\Move-Item -LiteralPath $LiteralPath -Destination $Destination
}
function Rename-Item {
  param($LiteralPath, $NewName)
  if (($cenario -eq 'primeira' -and $LiteralPath -eq $appInstalado) -or
      ($cenario -eq 'segunda' -and $LiteralPath -eq $appNovo)) { throw 'Falha simulada ao renomear' }
  Microsoft.PowerShell.Management\Rename-Item -LiteralPath $LiteralPath -NewName $NewName
}

$aprovados = 0
$falhas = 0
foreach ($cenario in @('sucesso', 'mover', 'primeira', 'segunda')) {
  $raizTeste = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ('.temporario-atualizador-' + [guid]::NewGuid())))
  $appInstalado = Join-Path $raizTeste 'app'
  $appNovo = Join-Path $raizTeste 'app.novo'
  $appAntigo = Join-Path $raizTeste 'app.antigo'
  $nmDe = Join-Path $appInstalado 'node_modules'
  $nmPara = Join-Path $appNovo 'node_modules'
  $pkgInstalado = @{ version = '0.1.12' }
  foreach ($caminho in @($appInstalado, $appNovo, $appAntigo, $nmDe, $nmPara)) {
    if (-not [IO.Path]::GetFullPath($caminho).StartsWith($raizTeste + '\')) { throw 'Caminho fora do teste' }
  }
  try {
    New-Item -ItemType Directory -Path $nmDe, $appNovo -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $nmDe 'dependencia.txt') -Value 'biblioteca'
    Set-Content -LiteralPath (Join-Path $appInstalado 'versao.txt') -Value 'antiga'
    Set-Content -LiteralPath (Join-Path $appNovo 'versao.txt') -Value 'nova'
    try { & ([scriptblock]::Create($troca)) } catch {
      if ($cenario -eq 'sucesso') { throw }
    }
    $esperada = if ($cenario -eq 'sucesso') { 'nova' } else { 'antiga' }
    if (-not (Test-Path -LiteralPath (Join-Path $appInstalado 'versao.txt'))) { throw 'A instalação deixou de existir' }
    if ((Get-Content -LiteralPath (Join-Path $appInstalado 'versao.txt')) -ne $esperada) { throw 'Versão incorreta' }
    if ((Get-Content -LiteralPath (Join-Path $nmDe 'dependencia.txt')) -ne 'biblioteca') { throw 'Dependências perdidas' }
    $aprovados++
    Write-Output "PASSOU: $cenario"
  } catch {
    $falhas++
    Write-Output "FALHOU: $cenario - $($_.Exception.Message)"
  } finally {
    $prefixoSeguro = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\.temporario-atualizador-'
    if (-not $raizTeste.StartsWith($prefixoSeguro)) { throw 'Recusa limpar caminho fora do teste' }
    Remove-Item -LiteralPath $raizTeste -Recurse -Force
  }
}
Write-Output "Atualizador: $aprovados passaram; $falhas falharam; 4 cenários"
if ($falhas) { exit 1 }
