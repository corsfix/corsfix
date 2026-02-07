"use client";

import React, { useState } from "react";
import { UserAuthForm } from "./user-auth-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@radix-ui/react-dialog";

interface AuthModalProps {
  isOpen: boolean;
  disableSignup: boolean;
}

export function AuthModal({ isOpen, disableSignup }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="p-6 max-w-md overflow-hidden z-50 [&>button]:hidden">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6">
          <div className="flex flex-col space-y-2 text-center">
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              {isLogin ? "Log in to your account" : "Create an account"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {isLogin
                ? "Enter your email below to log in to your account"
                : "Enter your email below to create your account"}
            </p>
          </div>
          {!disableSignup && (
            <div className="flex justify-center mb-2">
              <Button
                variant="ghost"
                onClick={toggleAuthMode}
                data-umami-event="auth-toggle"
                className="text-sm"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Login"}
              </Button>
            </div>
          )}
          <UserAuthForm isLogin={isLogin} disableSignup={disableSignup} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
