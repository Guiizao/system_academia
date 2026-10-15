import { describe, it, expect } from 'vitest';
import { contem, paraBusca } from '../src/dominio';

describe('busca sem acento', () => {
  it('jose acha José, e maiúscula não importa', () => {
    expect(contem('José da Silva', 'jose')).toBe(true);
    expect(contem('JOSÉ', 'José')).toBe(true);
  });

  it('cedilha e til também somem', () => {
    expect(contem('Conceição Araújo', 'conceicao araujo')).toBe(true);
    expect(paraBusca('Ação')).toBe('acao');
  });

  it('o contrário também vale: digitar com acento acha nome sem acento', () => {
    expect(contem('Jose Carlos', 'josé')).toBe(true);
  });

  it('não acha o que não está lá', () => {
    expect(contem('Maria', 'jose')).toBe(false);
  });
});
