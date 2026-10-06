const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const nomeDoArquivo = (caminho) => (caminho ?? '').split(/[\\/]/).pop();

/** Linha do registro do painel para o resultado de cada arquivo da pasta "importar". */
export function mensagemImportacao(r) {
  if (r.situacao === 'aguardando') return `Importação de ${r.arquivo} em espera: ${r.motivo}`;
  if (r.situacao === 'erro') {
    return `Importação de ${r.arquivo} recusada: ${r.motivo}. O arquivo foi renomeado para .erro e nada foi gravado.`;
  }
  const { alunosCriados, matriculas, pagamentos, ignorados } = r.resumo;
  const pulados = ignorados.length
    ? `; ${plural(ignorados.length, 'já estava cadastrado', 'já estavam cadastrados')} e ficaram como estavam` : '';
  return `Importação de ${r.arquivo}: ${plural(alunosCriados, 'aluno', 'alunos')}, `
    + `${plural(matriculas, 'matrícula', 'matrículas')} e ${plural(pagamentos, 'pagamento', 'pagamentos')} gravados${pulados}. `
    + `Cópia do banco de antes: ${nomeDoArquivo(r.backup)}`;
}
