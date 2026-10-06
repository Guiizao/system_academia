/** Erro de regra de negocio: vira HTTP 4xx com mensagem legivel. */
export class ErroNegocio extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export class ErroNaoEncontrado extends ErroNegocio {
  constructor(message: string) { super(message, 404); }
}
export class ErroPermissao extends ErroNegocio {
  constructor(message: string) { super(message, 403); }
}
export class ErroExcessoDeTentativas extends ErroNegocio {
  constructor(message: string, public esperarSeg: number) { super(message, 429); }
}
