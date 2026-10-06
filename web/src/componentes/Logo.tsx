/**
 * Logo DARK FISIC. Mesmo desenho de desktop/build/logo.svg, a fonte de onde
 * saem todos os icones (Windows, bandeja, celular): mudou la, muda aqui.
 */
export function Logo({ tamanho = 30 }: { tamanho?: number }) {
  return (
    <svg className="logo" width={tamanho} height={tamanho} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#16181D" />
      <rect x=".75" y=".75" width="62.5" height="62.5" rx="13.25" fill="none" stroke="#2E333D" strokeWidth="1.5" />
      <g transform="translate(32 32) scale(.88) skewX(-10) translate(-32 -32)">
        <path d="M8 16H16A16 16 0 0 1 16 48H8Z M16 24A8 8 0 0 1 16 40Z" fill="#F2F4F7" fillRule="evenodd" />
        <path d="M36 16H56V24H44V28H52V36H44V48H36Z" fill="#5B85F5" />
      </g>
    </svg>
  );
}
