import { describe, it, expect } from 'vitest';
import {
  linkWhatsapp, linkGrupoWhatsapp, mensagemCobranca, mensagemPix, mensagemConviteAula, podeAvisarNoWhatsapp,
} from '../src/dominio/whatsapp';

const ALUNO = { nome: 'Ana Paula Lima', telefone: '+5514997771193', aceitaWhatsapp: true };

describe('linkWhatsapp', () => {
  it('monta o endereco com o numero so em digitos e o texto escapado', () => {
    const url = new URL(linkWhatsapp('+55 (14) 99777-1193', 'Olá, tudo bem?')!);
    expect(url.origin + url.pathname).toBe('https://wa.me/5514997771193');
    expect(url.searchParams.get('text')).toBe('Olá, tudo bem?');
  });

  it('completa o 55 de quem esta sem', () => {
    expect(linkWhatsapp('14997771193', 'oi')).toContain('wa.me/5514997771193');
  });

  it('sem numero utilizavel, nao da link', () => {
    expect(linkWhatsapp('', 'oi')).toBeNull();
    expect(linkWhatsapp('123', 'oi')).toBeNull();
  });
});

describe('linkGrupoWhatsapp', () => {
  it('abre o WhatsApp para a pessoa escolher o grupo', () => {
    const url = new URL(linkGrupoWhatsapp('Aula de hoje'));
    expect(url.origin + url.pathname).toBe('https://wa.me/');
    expect(url.searchParams.get('text')).toBe('Aula de hoje');
  });
});

describe('podeAvisarNoWhatsapp', () => {
  it('precisa de numero e de autorizacao', () => {
    expect(podeAvisarNoWhatsapp(ALUNO)).toBe(true);
    expect(podeAvisarNoWhatsapp({ ...ALUNO, aceitaWhatsapp: false })).toBe(false);
    expect(podeAvisarNoWhatsapp({ ...ALUNO, telefone: '' })).toBe(false);
  });
});

describe('mensagens', () => {
  it('cobranca fala o primeiro nome, o valor e o vencimento', () => {
    const m = mensagemCobranca({ nome: ALUNO.nome, academia: 'DARK FISIC', valorCentavos: 9000, vencimento: '2026-10-10' });
    expect(m).toContain('Ana');
    expect(m).not.toContain('Ana Paula Lima');
    expect(m).toContain('R$ 90,00');
    expect(m).toContain('10/10/2026');
    expect(m).toContain('DARK FISIC');
  });

  it('cobranca sem vencimento nao inventa data', () => {
    const m = mensagemCobranca({ nome: 'Ana', academia: 'DARK FISIC', valorCentavos: 9000, vencimento: null });
    expect(m).toContain('R$ 90,00');
    expect(m).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('mensagem do Pix leva o codigo em linha separada', () => {
    const m = mensagemPix({ nome: 'Ana', valorCentavos: 9000, codigo: '00020126BR...6304ABCD' });
    expect(m).toContain('00020126BR...6304ABCD');
    expect(m.split('\n').some((l) => l.trim() === '00020126BR...6304ABCD')).toBe(true);
  });

  it('convite de aula tem nome, dia, hora e vagas', () => {
    const m = mensagemConviteAula({
      academia: 'DARK FISIC', nome: 'Funcional', data: '2026-10-05', hora: '19:00', local: 'Sala 2', vagasLivres: 4,
    });
    expect(m).toContain('Funcional');
    expect(m).toContain('05/10/2026');
    expect(m).toContain('19:00');
    expect(m).toContain('Sala 2');
    expect(m).toContain('4 vagas');
  });

  it('convite com uma vaga fala no singular', () => {
    const m = mensagemConviteAula({
      academia: 'DARK FISIC', nome: 'Funcional', data: '2026-10-05', hora: '19:00', local: 'Sala 2', vagasLivres: 1,
    });
    expect(m).toContain('1 vaga ');
  });
});
