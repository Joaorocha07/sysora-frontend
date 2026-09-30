/* eslint-disable @next/next/no-img-element */

type Props = {
  kind?: 'icon' | 'wordmark';
  // auto: acompanha o tema (glifo preto no claro, branco no escuro).
  // white/black: para superfícies de cor fixa (ex.: sidebar sempre preta).
  tone?: 'auto' | 'white' | 'black';
  className?: string;
  height?: number;
};

const SRC = {
  icon: { white: '/brand/sysora-icon-white.png', black: '/brand/sysora-icon-black.png' },
  wordmark: { white: '/brand/sysora-wordmark-white.png', black: '/brand/sysora-wordmark-black.png' },
};

export default function Logo({ kind = 'wordmark', tone = 'auto', className = '', height }: Props) {
  const style = height ? { height, width: 'auto' } : undefined;
  if (tone !== 'auto') return <img src={SRC[kind][tone]} alt="Sysora" className={className} style={style} />;
  return (
    <>
      <img src={SRC[kind].black} alt="Sysora" className={`logo-on-light ${className}`} style={style} />
      <img src={SRC[kind].white} alt="" aria-hidden className={`logo-on-dark ${className}`} style={style} />
    </>
  );
}
