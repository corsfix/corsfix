"use client";

import { useEffect } from "react";
import Clarity from '@microsoft/clarity';
import { usePathname } from "next/navigation";

const MSClarity = () => {
  const pathname = usePathname();
  useEffect(() => {
    Clarity.init("u3acbobvot");
    Clarity.identify(sessionStorage.cid ??= crypto.randomUUID());
  }, [pathname]);

  return null;
};

export default MSClarity;
