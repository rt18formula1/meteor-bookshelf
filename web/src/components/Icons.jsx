import React from "react";

/* インラインSVGアイコン（絵文字は使わない） */
const P = ({ d, ...rest }) => <path d={d} {...rest} />;

function base(children, viewBox = "0 0 24 24") {
  return function Icon({ size = 22, className = "" }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {children}
      </svg>
    );
  };
}

export const IconShelf = base(
  <>
    <P d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <P d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </>
);
export const IconSearch = base(
  <>
    <circle cx="11" cy="11" r="7" />
    <P d="m21 21-4.35-4.35" />
  </>
);
export const IconScan = base(
  <>
    <P d="M3 7V5a2 2 0 0 1 2-2h2" />
    <P d="M17 3h2a2 2 0 0 1 2 2v2" />
    <P d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <P d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <P d="M7 8v8" />
    <P d="M11 8v8" />
    <P d="M15 8v5" />
    <P d="M18.5 8v8" />
  </>
);
export const IconMemo = base(
  <>
    <P d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <P d="M14 2v6h6" />
    <P d="M9 13h6" />
    <P d="M9 17h4" />
  </>
);
export const IconSettings = base(
  <>
    <circle cx="12" cy="12" r="3" />
    <P d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>
);
export const IconCamera = base(
  <>
    <P d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </>
);
export const IconPlus = base(
  <>
    <P d="M12 5v14" />
    <P d="M5 12h14" />
  </>
);
export const IconEdit = base(
  <>
    <P d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
  </>
);
export const IconDownload = base(
  <>
    <P d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <P d="m7 10 5 5 5-5" />
    <P d="M12 15V3" />
  </>
);
export const IconBookLogo = base(
  <>
    <P d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
    <P d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
  </>
);
