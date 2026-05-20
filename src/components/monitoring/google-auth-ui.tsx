"use client";

import { type ReactNode, type RefObject } from "react";
import { CircleCheck, CircleOff, LogOut } from "lucide-react";

import { GoogleLogo } from "@/components/google-logo";
import { Button } from "@/components/ui/button";
import { redirectToGoogleLogin } from "@/lib/monitoring/shared";

export const GOOGLE_LOGIN_PROMPT_TITLE = "Niet ingelogd bij Google";
export const GOOGLE_LOGIN_PROMPT_DESCRIPTION =
  "Log in voor GA4-realtime, topartikelen, Google Search Console en jaarcijfers. Het tabblad Recent werkt ook zonder login.";
export const GOOGLE_LOGIN_DISMISS_KEY = "fnl-monitoring-google-login-dismissed";

function GoogleAuthDialog({
  dialogRef,
  icon,
  iconClassName,
  title,
  description,
  children,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  icon: ReactNode;
  iconClassName: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  function close() {
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      className="fnl-google-dialog w-[calc(100%-2rem)] max-w-sm rounded-[8px] border border-border bg-card p-5 text-card-foreground open:flex open:flex-col"
      onClick={(e) => {
        if (e.target === dialogRef.current) close();
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">{children}</div>
    </dialog>
  );
}

function GoogleLoginPromptIcon() {
  return <CircleOff className="size-5" strokeWidth={2.25} aria-hidden />;
}

function GoogleLoginPromptActions({
  dismissLabel,
  onDismiss,
}: {
  dismissLabel: string;
  onDismiss?: () => void;
}) {
  return (
    <>
      {onDismiss && (
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          {dismissLabel}
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        className="rounded-[4px] font-semibold"
        onClick={redirectToGoogleLogin}
      >
        <GoogleLogo />
        Inloggen met Google
      </Button>
    </>
  );
}

export function GoogleConnectionDialog({
  dialogRef,
  onDisconnect,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  onDisconnect: () => void | Promise<void>;
}) {
  function close() {
    dialogRef.current?.close();
  }

  return (
    <GoogleAuthDialog
      dialogRef={dialogRef}
      icon={<CircleCheck className="size-5" strokeWidth={2.25} aria-hidden />}
      iconClassName="bg-[#eaf5ef] text-[#1a5239]"
      title="Google verbonden"
      description="Je bent ingelogd. GA4-realtime en Google Search Console zijn beschikbaar voor dit dashboard."
    >
      <Button type="button" variant="ghost" size="sm" onClick={close}>
        Sluiten
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive hover:bg-destructive/5 hover:text-destructive"
        onClick={() => void onDisconnect()}
      >
        <LogOut className="size-4" />
        Uitloggen
      </Button>
    </GoogleAuthDialog>
  );
}

export function GoogleLoginPromptDialog({
  dialogRef,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
}) {
  function close() {
    dialogRef.current?.close();
  }

  return (
    <GoogleAuthDialog
      dialogRef={dialogRef}
      icon={<GoogleLoginPromptIcon />}
      iconClassName="bg-muted text-muted-foreground"
      title={GOOGLE_LOGIN_PROMPT_TITLE}
      description={GOOGLE_LOGIN_PROMPT_DESCRIPTION}
    >
      <GoogleLoginPromptActions dismissLabel="Sluiten" onDismiss={close} />
    </GoogleAuthDialog>
  );
}

export function GoogleLoginInlinePrompt({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section className="fnl-card mb-6 p-5" aria-labelledby="google-login-prompt-title">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <GoogleLoginPromptIcon />
        </span>
        <div className="min-w-0">
          <h2 id="google-login-prompt-title" className="text-base font-semibold text-foreground">
            {GOOGLE_LOGIN_PROMPT_TITLE}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {GOOGLE_LOGIN_PROMPT_DESCRIPTION}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <GoogleLoginPromptActions dismissLabel="Later" onDismiss={onDismiss} />
      </div>
    </section>
  );
}
