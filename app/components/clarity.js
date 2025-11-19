"use client";

import { useEffect } from "react";
import Clarity from '@microsoft/clarity';

const MSClarity = () => {
  useEffect(() => {
    Clarity.init("u3acbobvot");
  });

  return null;
};

export default MSClarity;
