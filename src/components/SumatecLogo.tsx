import sumatecLogo from "@/assets/sumatec-logo.png.asset.json";

type SumatecLogoProps = {
  className?: string;
};

/**
 * Wordmark oficial de Sumatec (rojo de marca sobre fondos claros).
 * Nunca re-tipografiar — usar siempre este asset.
 */
export function SumatecLogo({ className }: SumatecLogoProps) {
  return (
    <img
      src={sumatecLogo.url}
      alt="Sumatec"
      className={className}
      loading="eager"
      decoding="async"
    />
  );
}
