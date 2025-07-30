"use client";

import { useEffect } from "react";
import { Crisp } from "crisp-sdk-web";

const CrispChat = () => {
  useEffect(() => {
    Crisp.configure("8b21fae9-4407-4f34-8199-23237a419540");
  });

  return null;
};

export default CrispChat;
