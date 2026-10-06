/**
 * Avisa que o formulario voltou com o que tinha sido digitado antes.
 * Sem este aviso, campos preenchidos "do nada" assustam mais do que ajudam.
 */
export function FaixaRascunho({ aoDescartar }: { aoDescartar: () => void }) {
  return (
    <div className="faixa-rascunho" role="status">
      <span>Recuperamos o que você estava preenchendo.</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={aoDescartar}>Descartar e começar do zero</button>
    </div>
  );
}
