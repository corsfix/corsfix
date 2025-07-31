export function Logo({ className }: { className?: string }) {
  return (
    <svg
      version="1.2"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 400"
      strokeWidth="18"
      stroke="currentColor"
      fill="none"
      className={`fill-[#595ce7] text-white size-10 ${
        className ? className : ""
      }`}
    >
      <path
        fillRule="evenodd"
        d="m200 390c-105.1 0-190-84.9-190-190 0-105.1 84.9-190 190-190 105.1 0 190 84.9 190 190 0 105.1-84.9 190-190 190z"
      />
      <path
        fillRule="evenodd"
        d="m262.6 368.6c-65.2 0-117.9-75.4-117.9-168.7 0-93.3 52.7-168.7 117.9-168.7 65.1 0 117.8 75.4 117.8 168.7 0 93.3-52.7 168.7-117.8 168.7z"
      />
      <path
        fillRule="evenodd"
        d="m319.9 330.7c-31.8 0-57.4-58.2-57.4-130.2 0-72 25.6-130.1 57.4-130.1 31.7 0 57.3 58.1 57.3 130.1 0 72-25.6 130.2-57.3 130.2z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="m364.5 267.5c-14.1 0-25.6-29.9-25.6-67 0-37 11.5-67 25.6-67 14.1 0 25.5 30 25.5 67 0 37.1-11.4 67-25.5 67z"
      />
    </svg>
  );
}
