import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { ErroNegocio, ErroExcessoDeTentativas } from '../servicos/erros.js';

/** Erro de negocio vira 4xx legivel; o resto vira 500 sem vazar detalhe. */
export function registrarTratadorDeErros(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      const primeiro = err.issues[0];
      return reply.status(400).send({
        erro: `${primeiro.path.join('.') || 'entrada'}: ${primeiro.message}`,
      });
    }
    if (err instanceof ErroNegocio) {
      // Retry-After: o navegador e qualquer cliente sabem em quanto tempo
      // vale a pena tentar de novo, sem ficar martelando
      if (err instanceof ErroExcessoDeTentativas) reply.header('Retry-After', String(err.esperarSeg));
      return reply.status(err.status).send({ erro: err.message });
    }
    const msg = err instanceof Error ? err.message : String(err);
    // erros de requisicao que o proprio Fastify ja classificou (JSON malformado,
    // corpo invalido, grande demais): sao culpa do cliente, nao falha do servidor
    const codigo = (err as { statusCode?: number }).statusCode;
    if (codigo && codigo >= 400 && codigo < 500) {
      return reply.status(codigo).send({ erro: 'Requisição inválida. Recarregue a página e tente de novo.' });
    }
    // regra de negocio escrita como Error comum nos servicos mais antigos
    if (/não encontrad/i.test(msg)) {
      return reply.status(404).send({ erro: msg });
    }
    req.log.error(err);
    return reply.status(500).send({ erro: 'Erro interno. Veja os logs do servidor.' });
  });
}
