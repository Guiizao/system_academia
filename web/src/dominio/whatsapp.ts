import { formatarBRL, formatarData } from './index';

/**
 * Links do WhatsApp. O sistema NUNCA envia sozinho: monta o texto e abre a
 * conversa no WhatsApp Web ou no aplicativo, com a mensagem pronta. Quem
 * aperta "enviar" e a recepcao -- ela le antes e corrige se precisar.
 * (O bot da academia, que envia de verdade, fica para depois.)
 */

const primeiroNome = (nome: string) => (nome ?? '').trim().split(/\s+/)[0] ?? '';

function numeroDoWhatsapp(telefone: string): string | null {
  const d = (telefone ?? '').replace(/\D/g, '');
  const comPais = d.startsWith('55') ? d : `55${d}`;
  // 55 + DDD + 8 ou 9 digitos
  return comPais.length === 12 || comPais.length === 13 ? comPais : null;
}

export function linkWhatsapp(telefone: string, texto: string): string | null {
  const numero = numeroDoWhatsapp(telefone);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null;
}

/** Sem numero: o WhatsApp abre e a pessoa escolhe o grupo da academia. */
export function linkGrupoWhatsapp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

export function podeAvisarNoWhatsapp(aluno: { telefone: string; aceitaWhatsapp: boolean }): boolean {
  return aluno.aceitaWhatsapp && numeroDoWhatsapp(aluno.telefone) !== null;
}

export function mensagemCobranca(a: {
  nome: string; academia: string; valorCentavos: number; vencimento: string | null;
}): string {
  const quando = a.vencimento ? ` com vencimento em ${formatarData(a.vencimento)}` : '';
  return `Oi, ${primeiroNome(a.nome)}! Aqui é da ${a.academia}.\n`
    + `Passando para lembrar da mensalidade de ${formatarBRL(a.valorCentavos)}${quando}.\n`
    + 'Qualquer dúvida é só responder por aqui. Bom treino!';
}

/** O codigo vai sozinho numa linha: assim da para copiar com um toque. */
export function mensagemPix(a: { nome: string; valorCentavos: number; codigo: string }): string {
  return `Oi, ${primeiroNome(a.nome)}! Segue o Pix de ${formatarBRL(a.valorCentavos)} (copia e cola):\n\n`
    + `${a.codigo}\n\n`
    + 'Assim que cair, a gente confirma por aqui.';
}

export function mensagemConviteAula(a: {
  academia: string; nome: string; data: string; hora: string; local: string; vagasLivres: number;
}): string {
  const vagas = a.vagasLivres === 1 ? '1 vaga ' : `${a.vagasLivres} vagas `;
  return `Pessoal, aula de ${a.nome} na ${a.academia}!\n`
    + `${formatarData(a.data)} às ${a.hora}, ${a.local}.\n`
    + `Ainda temos ${vagas}— quem quiser, é só confirmar aqui que a gente inscreve.`;
}
