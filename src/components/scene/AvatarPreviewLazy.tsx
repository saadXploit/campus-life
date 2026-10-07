"use client";

import dynamic from "next/dynamic";

/** Loads the 3D preview only in the browser, so server pages can use it. */
const AvatarPreviewLazy = dynamic(() => import("./AvatarPreview"), { ssr: false });

export default AvatarPreviewLazy;
