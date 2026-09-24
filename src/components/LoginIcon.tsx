import type { SVGProps } from "react"

export function LoginIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path strokeDasharray="34" d="M13 4l7 0c0.55 0 1 0.45 1 1v14c0 0.55 -0.45 1 -1 1h-7">
          <animate fill="freeze" attributeName="stroke-dashoffset" dur="0.4s" values="34;0" />
        </path>
        <path strokeDasharray="14" strokeDashoffset="14" d="M3 12h11.5">
          <animate fill="freeze" attributeName="stroke-dashoffset" begin="0.5s" dur="0.2s" to="0" />
        </path>
        <path strokeDasharray="8" strokeDashoffset="8" d="M14.5 12l-3.5 -3.5M14.5 12l-3.5 3.5">
          <animate fill="freeze" attributeName="stroke-dashoffset" begin="0.7s" dur="0.2s" to="0" />
        </path>
      </g>
    </svg>
  )
}
