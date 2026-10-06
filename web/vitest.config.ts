import { defineConfig } from 'vitest/config';

// Testes do web sao de REGRA PURA (src/dominio) e dos tokens de tema.
// Componentes continuam sendo verificados na tela, pelo navegador.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/dominio/**'] },
  },
});
