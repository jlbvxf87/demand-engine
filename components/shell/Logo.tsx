export default function Logo({ size = 22 }: { size?: number }) {
  // The orange "infinity / linked loops" factory mark from the Figma board.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7.2 8.4c-2 0-3.6 1.6-3.6 3.6s1.6 3.6 3.6 3.6c1.5 0 2.5-.9 3.4-2.1l1.4-1.9c.7-1 1.5-1.6 2.4-1.6 1.1 0 2 .9 2 2s-.9 2-2 2c-.9 0-1.5-.5-2.1-1.2"
        stroke="#F97316"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.8 15.6c2 0 3.6-1.6 3.6-3.6s-1.6-3.6-3.6-3.6c-1.5 0-2.5.9-3.4 2.1"
        stroke="#F97316"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}
