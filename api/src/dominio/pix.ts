/** Campo TLV do BR Code: id + tamanho em 2 digitos + valor. */
function tlv(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, '0') + valor;
}

/** Remove acentos e simbolos fora do permitido, forca maiusculas. */
function higienizar(texto: string, max: number): string {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, sem reflexao. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function montarBrCode(args: {
  chave: string;
  nomeRecebedor: string;
  cidade: string;
  valorCentavos?: number;
  txid?: string;
}): string {
  const { chave, valorCentavos, txid } = args;
  if (!chave?.trim()) throw new Error('Chave Pix não configurada');

  const nome = higienizar(args.nomeRecebedor, 25);
  const cidade = higienizar(args.cidade, 15);

  let p = '';
  p += tlv('00', '01');                                             // payload format
  p += tlv('26', tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', chave));   // conta pix
  p += tlv('52', '0000');                                           // categoria
  p += tlv('53', '986');                                            // moeda BRL

  if (valorCentavos != null) {
    if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) {
      throw new Error('Valor deve ser inteiro em centavos e maior que zero');
    }
    p += tlv('54', (valorCentavos / 100).toFixed(2));
  }

  p += tlv('58', 'BR');
  p += tlv('59', nome);
  p += tlv('60', cidade);
  // txid ausente -> '***' literal (asteriscos nao sobrevivem a higienizacao)
  p += tlv('62', tlv('05', txid ? (higienizar(txid, 25) || '***') : '***'));

  p += '6304';
  return p + crc16(p);
}
