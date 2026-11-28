import type { SVGProps } from 'react';

/** Vue de dessus d'un tricycle motorisé : une roue avant et deux roues arrière. */
export type TricycleIconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  strokeWidth?: number;
};

export default function TricycleIcon({
  size = 24,
  strokeWidth = 1.75,
  ...props
}: TricycleIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* Roue avant (en haut), roues arrière (à gauche et à droite) */}
      <circle cx="12" cy="3.8" r="1.8" />
      <circle cx="4.4" cy="19" r="2.2" />
      <circle cx="19.6" cy="19" r="2.2" />
      {/* Fourche, guidon et cabine du tricycle */}
      <path d="M12 5.6v3.1M8.8 8.7h6.4" />
      <path d="M8.5 10h7l3.1 6.4H5.4L8.5 10Z" />
      <path d="M9.7 12.8h4.6M12 10v2.8M5.6 16.4l-1 0.6M18.4 16.4l1 0.6" />
      <path d="M8.4 16.4V19h7.2v-2.6" />
    </svg>
  );
}
